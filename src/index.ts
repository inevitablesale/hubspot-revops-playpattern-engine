/**
 * HubSpot RevOps PlayPattern Engine
 * Main Application Entry Point
 */

import express, { Express, Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';
import {
  OAuthManager,
  createOAuthConfigFromEnv,
  REQUIRED_SCOPES,
} from './oauth';
import { PatternMiningEngine, DEFAULT_MINING_CONFIG } from './patterns';
import { PlayScoringEngine, batchScorePlays } from './scoring';
import { SequenceManager } from './sequences';
import { RoutingEngine, RoutingRuleBuilder } from './routing';
import { TimelineManager, HubSpotTimelineClient } from './timeline';
import { PropertyManager, PLAY_PROPERTIES } from './properties';
import { CRMCardGenerator } from './cards';
import {
  Play,
  CRMRecord,
  HistoricalDataPoint,
  ObjectType,
  OAuthTokens,
  PlayRecommendation,
} from './types';
import { generateId } from './utils';

// Load environment variables
dotenv.config();

/**
 * PlayPatternEngine is the main orchestrator for all functionality
 */
export class PlayPatternEngine {
  private oauthManager: OAuthManager;
  private patternMiner: PatternMiningEngine;
  private scoringEngine: PlayScoringEngine;
  private sequenceManager: SequenceManager;
  private routingEngine: RoutingEngine;
  private propertyManager: PropertyManager;
  private cardGenerator: CRMCardGenerator;

  private plays: Map<string, Play> = new Map();
  private records: Map<string, CRMRecord> = new Map();

  constructor(baseUrl: string = '') {
    const oauthConfig = createOAuthConfigFromEnv();
    this.oauthManager = new OAuthManager(oauthConfig);
    this.patternMiner = new PatternMiningEngine();
    this.scoringEngine = new PlayScoringEngine();
    this.sequenceManager = new SequenceManager();
    this.routingEngine = new RoutingEngine();
    this.propertyManager = new PropertyManager();
    this.cardGenerator = new CRMCardGenerator(baseUrl);
  }

  /**
   * Get OAuth authorization URL
   */
  getAuthorizationUrl(state?: string): string {
    return this.oauthManager.getAuthorizationUrl(state);
  }

  /**
   * Exchange OAuth code for tokens
   */
  async handleOAuthCallback(code: string): Promise<OAuthTokens> {
    return this.oauthManager.exchangeCodeForTokens(code);
  }

  /**
   * Mine patterns from historical data
   */
  async minePatterns(data: HistoricalDataPoint[]): Promise<Play[]> {
    const result = await this.patternMiner.minePatterns(data);

    // Store discovered plays
    for (const play of result.plays) {
      this.plays.set(play.id, play);
    }

    return result.plays;
  }

  /**
   * Get play recommendations for a record
   */
  getRecommendations(record: CRMRecord): PlayRecommendation[] {
    const plays = Array.from(this.plays.values());
    return this.scoringEngine.scorePlaysByRecord(record, plays);
  }

  /**
   * Get recommended action sequence for a record and play
   */
  getSequence(playId: string, record: CRMRecord) {
    const play = this.plays.get(playId);
    if (!play) return [];
    return this.sequenceManager.getRecommendedSequence(play, record);
  }

  /**
   * Route a record based on configured rules
   */
  routeRecord(record: CRMRecord) {
    return this.routingEngine.routeRecord(record);
  }

  /**
   * Apply a play to a record
   */
  async applyPlay(
    objectType: ObjectType,
    objectId: string,
    playId: string,
    accessToken: string
  ) {
    const play = this.plays.get(playId);
    if (!play) {
      throw new Error(`Play not found: ${playId}`);
    }

    this.propertyManager.setClient(accessToken);
    return this.propertyManager.applyPlayToRecord(objectType, objectId, play);
  }

  /**
   * Generate CRM card data
   */
  generateCardData(record: CRMRecord, appliedPlayId?: string) {
    const plays = Array.from(this.plays.values());
    return this.cardGenerator.generateCardData(record, plays, appliedPlayId);
  }

  /**
   * Format card data for HubSpot API
   */
  formatCardForHubSpot(record: CRMRecord, appliedPlayId?: string) {
    const cardData = this.generateCardData(record, appliedPlayId);
    return this.cardGenerator.formatForHubSpot(cardData);
  }

  /**
   * Get all plays
   */
  getPlays(): Play[] {
    return Array.from(this.plays.values());
  }

  /**
   * Get a specific play
   */
  getPlay(playId: string): Play | undefined {
    return this.plays.get(playId);
  }

  /**
   * Add a routing rule
   */
  addRoutingRule(rule: ReturnType<RoutingRuleBuilder['build']>) {
    this.routingEngine.addRule(rule);
  }

  /**
   * Store a record for later use
   */
  storeRecord(record: CRMRecord) {
    this.records.set(`${record.objectType}:${record.id}`, record);
  }

  /**
   * Get a stored record
   */
  getRecord(objectType: ObjectType, objectId: string): CRMRecord | undefined {
    return this.records.get(`${objectType}:${objectId}`);
  }
}

/**
 * Create Express application with all routes
 */
export function createApp(engine?: PlayPatternEngine): Express {
  const app = express();
  const playEngine = engine || new PlayPatternEngine(process.env.BASE_URL || '');

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Health check
  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
  });

  // OAuth routes
  app.get('/oauth/authorize', (req: Request, res: Response) => {
    const state = req.query.state as string | undefined;
    const authUrl = playEngine.getAuthorizationUrl(state);
    res.redirect(authUrl);
  });

  app.get('/oauth/callback', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const code = req.query.code as string;
      if (!code) {
        res.status(400).json({ error: 'Missing authorization code' });
        return;
      }

      const tokens = await playEngine.handleOAuthCallback(code);
      res.json({
        success: true,
        portalId: tokens.portalId,
        message: 'Successfully connected to HubSpot',
      });
    } catch (error) {
      next(error);
    }
  });

  // CRM Card endpoint
  app.get('/api/crm-card', async (req: Request, res: Response) => {
    const objectType = req.query.objectType as ObjectType;
    const objectId = req.query.objectId as string;
    const appliedPlayId = req.query.appliedPlayId as string | undefined;

    if (!objectType || !objectId) {
      res.status(400).json({ error: 'Missing objectType or objectId' });
      return;
    }

    // Get record from storage or create placeholder
    let record = playEngine.getRecord(objectType, objectId);
    if (!record) {
      record = {
        id: objectId,
        objectType,
        properties: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }

    const cardResponse = playEngine.formatCardForHubSpot(record, appliedPlayId);
    res.json(cardResponse);
  });

  // Play routes
  app.get('/api/plays', (_req: Request, res: Response) => {
    const plays = playEngine.getPlays();
    res.json({ plays });
  });

  app.get('/api/plays/:playId', (req: Request, res: Response) => {
    const play = playEngine.getPlay(req.params.playId);
    if (!play) {
      res.status(404).json({ error: 'Play not found' });
      return;
    }
    res.json({ play });
  });

  app.post('/api/plays/:playId/apply', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { playId } = req.params;
      const { objectType, objectId, accessToken } = req.body;

      if (!objectType || !objectId || !accessToken) {
        res.status(400).json({ error: 'Missing required fields' });
        return;
      }

      const result = await playEngine.applyPlay(
        objectType as ObjectType,
        objectId,
        playId,
        accessToken
      );

      res.json({ success: result.success, result });
    } catch (error) {
      next(error);
    }
  });

  // Recommendations route
  app.get('/api/recommendations', (req: Request, res: Response) => {
    const objectType = req.query.objectType as ObjectType;
    const objectId = req.query.objectId as string;

    if (!objectType || !objectId) {
      res.status(400).json({ error: 'Missing objectType or objectId' });
      return;
    }

    const record = playEngine.getRecord(objectType, objectId);
    if (!record) {
      res.status(404).json({ error: 'Record not found' });
      return;
    }

    const recommendations = playEngine.getRecommendations(record);
    res.json({ recommendations });
  });

  // Sequence route
  app.get('/api/sequence/:playId', (req: Request, res: Response) => {
    const { playId } = req.params;
    const objectType = req.query.objectType as ObjectType;
    const objectId = req.query.objectId as string;

    if (!objectType || !objectId) {
      res.status(400).json({ error: 'Missing objectType or objectId' });
      return;
    }

    const record = playEngine.getRecord(objectType, objectId);
    if (!record) {
      res.status(404).json({ error: 'Record not found' });
      return;
    }

    const sequence = playEngine.getSequence(playId, record);
    res.json({ sequence });
  });

  // Pattern mining route
  app.post('/api/mine', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { data } = req.body;
      if (!data || !Array.isArray(data)) {
        res.status(400).json({ error: 'Missing or invalid data array' });
        return;
      }

      // Parse dates in the data
      const parsedData = data.map((d: HistoricalDataPoint) => ({
        ...d,
        createdAt: new Date(d.createdAt),
        closedAt: d.closedAt ? new Date(d.closedAt) : undefined,
        actions: d.actions?.map((a) => ({
          ...a,
          timestamp: new Date(a.timestamp),
        })) || [],
        timeline: d.timeline?.map((t) => ({
          ...t,
          timestamp: new Date(t.timestamp),
        })) || [],
      }));

      const plays = await playEngine.minePatterns(parsedData);
      res.json({
        success: true,
        playsDiscovered: plays.length,
        plays,
      });
    } catch (error) {
      next(error);
    }
  });

  // Routing route
  app.post('/api/route', (req: Request, res: Response) => {
    const record = req.body as CRMRecord;
    if (!record.id || !record.objectType) {
      res.status(400).json({ error: 'Missing record id or objectType' });
      return;
    }

    const decision = playEngine.routeRecord(record);
    res.json({ decision });
  });

  // Error handler
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error('Error:', err.message);
    res.status(500).json({
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
  });

  return app;
}

/**
 * Start the server
 */
export function startServer(port: number = 3000): void {
  const app = createApp();
  app.listen(port, () => {
    console.log(`RevOps PlayPattern Engine running on port ${port}`);
  });
}

// Export all modules
export * from './oauth';
export * from './patterns';
export * from './scoring';
export * from './sequences';
export * from './routing';
export * from './timeline';
export * from './properties';
export * from './cards';
export * from './types';
export * from './utils';

// Start server if run directly
if (require.main === module) {
  const port = parseInt(process.env.PORT || '3000', 10);
  startServer(port);
}
