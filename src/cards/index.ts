/**
 * CRM Card Output Module
 * Generates CRM card data for displaying play recommendations
 */

import {
  CRMCardData,
  CRMCardSection,
  CRMRecord,
  PlayRecommendation,
  Play,
  ObjectType,
} from '../types';
import { PlayScoringEngine } from '../scoring';

/**
 * Card action types
 */
export interface CardAction {
  type: 'IFRAME' | 'ACTION_HOOK' | 'CONFIRMATION_ACTION_HOOK';
  label: string;
  httpMethod?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  uri?: string;
  propertyNamesIncluded?: string[];
  confirmationMessage?: string;
  confirmButtonText?: string;
  cancelButtonText?: string;
}

/**
 * HubSpot CRM card response format
 */
export interface HubSpotCardResponse {
  results: HubSpotCardResult[];
  primaryAction?: CardAction;
  secondaryActions?: CardAction[];
}

/**
 * Individual card result item
 */
export interface HubSpotCardResult {
  objectId: number;
  title: string;
  link?: string;
  properties: HubSpotCardProperty[];
  actions?: CardAction[];
}

/**
 * Card property for display
 */
export interface HubSpotCardProperty {
  label: string;
  dataType: 'STRING' | 'NUMBER' | 'DATE' | 'CURRENCY' | 'STATUS' | 'LINK';
  value: string | number;
}

/**
 * CRMCardGenerator creates card data for HubSpot display
 */
export class CRMCardGenerator {
  private scoringEngine: PlayScoringEngine;
  private baseUrl: string;

  constructor(baseUrl: string = '') {
    this.scoringEngine = new PlayScoringEngine();
    this.baseUrl = baseUrl;
  }

  /**
   * Generate CRM card data for a record
   */
  generateCardData(
    record: CRMRecord,
    plays: Play[],
    appliedPlayId?: string
  ): CRMCardData {
    const recommendations = this.scoringEngine.scorePlaysByRecord(record, plays);
    const topRecommendation = recommendations.length > 0 ? recommendations[0] : undefined;

    const sections = this.buildCardSections(
      record,
      recommendations,
      appliedPlayId
    );

    return {
      objectId: record.id,
      objectType: record.objectType,
      title: 'RevOps Play Recommendations',
      topRecommendation,
      allRecommendations: recommendations,
      appliedPlayId,
      sections,
    };
  }

  /**
   * Build card sections for display
   */
  private buildCardSections(
    record: CRMRecord,
    recommendations: PlayRecommendation[],
    appliedPlayId?: string
  ): CRMCardSection[] {
    const sections: CRMCardSection[] = [];

    // Applied play section
    if (appliedPlayId) {
      const appliedPlay = recommendations.find((r) => r.playId === appliedPlayId);
      sections.push({
        id: 'applied_play',
        title: 'Currently Applied Play',
        type: 'status',
        content: {
          playId: appliedPlayId,
          playName: appliedPlay?.playName || 'Unknown Play',
          status: 'active',
        },
      });
    }

    // Top recommendation section
    if (recommendations.length > 0 && recommendations[0].playId !== appliedPlayId) {
      const top = recommendations[0];
      sections.push({
        id: 'top_recommendation',
        title: 'Top Recommendation',
        type: 'text',
        content: {
          playName: top.playName,
          score: Math.round(top.score),
          matchPercentage: Math.round(top.matchPercentage * 100),
          reasoning: top.reasoning,
        },
      });
    }

    // Next actions section
    if (recommendations.length > 0) {
      const nextActions = recommendations[0].nextActions.slice(0, 3);
      sections.push({
        id: 'next_actions',
        title: 'Recommended Next Actions',
        type: 'list',
        content: nextActions.map((action) => ({
          order: action.order,
          action: action.actionType,
          description: action.description,
          urgency: action.urgency,
        })),
      });
    }

    // All recommendations section
    if (recommendations.length > 1) {
      sections.push({
        id: 'all_recommendations',
        title: 'Other Plays',
        type: 'list',
        content: recommendations.slice(1, 4).map((rec) => ({
          playId: rec.playId,
          playName: rec.playName,
          score: Math.round(rec.score),
          matchPercentage: Math.round(rec.matchPercentage * 100),
        })),
      });
    }

    return sections;
  }

  /**
   * Format card data for HubSpot API response
   */
  formatForHubSpot(cardData: CRMCardData): HubSpotCardResponse {
    const results: HubSpotCardResult[] = [];

    // Add top recommendation as primary result
    if (cardData.topRecommendation) {
      results.push(this.createRecommendationResult(cardData.topRecommendation, 1));
    }

    // Add other recommendations
    cardData.allRecommendations.slice(1, 5).forEach((rec, index) => {
      results.push(this.createRecommendationResult(rec, index + 2));
    });

    // Primary action to apply play
    const primaryAction: CardAction | undefined = cardData.topRecommendation
      ? {
          type: 'CONFIRMATION_ACTION_HOOK',
          label: 'Apply Top Play',
          httpMethod: 'POST',
          uri: `${this.baseUrl}/api/plays/apply`,
          propertyNamesIncluded: ['hs_object_id'],
          confirmationMessage: `Apply "${cardData.topRecommendation.playName}" to this record?`,
          confirmButtonText: 'Apply Play',
          cancelButtonText: 'Cancel',
        }
      : undefined;

    // Secondary actions
    const secondaryActions: CardAction[] = [
      {
        type: 'IFRAME',
        label: 'View All Plays',
        uri: `${this.baseUrl}/plays?objectId=${cardData.objectId}&objectType=${cardData.objectType}`,
      },
    ];

    return {
      results,
      primaryAction,
      secondaryActions,
    };
  }

  /**
   * Create a card result from a recommendation
   */
  private createRecommendationResult(
    rec: PlayRecommendation,
    priority: number
  ): HubSpotCardResult {
    return {
      objectId: priority,
      title: rec.playName,
      properties: [
        {
          label: 'Score',
          dataType: 'NUMBER',
          value: Math.round(rec.score),
        },
        {
          label: 'Match',
          dataType: 'STRING',
          value: `${Math.round(rec.matchPercentage * 100)}%`,
        },
        {
          label: 'Win Rate',
          dataType: 'STRING',
          value: rec.estimatedImpact.winRateIncrease
            ? `+${Math.round(rec.estimatedImpact.winRateIncrease * 100)}%`
            : 'N/A',
        },
        {
          label: 'Confidence',
          dataType: 'STRING',
          value: `${Math.round(rec.confidence * 100)}%`,
        },
      ],
      actions: [
        {
          type: 'ACTION_HOOK',
          label: 'Apply This Play',
          httpMethod: 'POST',
          uri: `${this.baseUrl}/api/plays/${rec.playId}/apply`,
        },
      ],
    };
  }

  /**
   * Generate empty state card when no recommendations
   */
  generateEmptyStateCard(
    objectId: string,
    objectType: ObjectType
  ): HubSpotCardResponse {
    return {
      results: [
        {
          objectId: 1,
          title: 'No Recommendations Available',
          properties: [
            {
              label: 'Status',
              dataType: 'STRING',
              value: 'Insufficient data or no matching plays found',
            },
          ],
        },
      ],
      secondaryActions: [
        {
          type: 'IFRAME',
          label: 'Learn More',
          uri: `${this.baseUrl}/help/no-recommendations`,
        },
      ],
    };
  }
}

/**
 * Express middleware for handling CRM card requests
 */
export function createCardMiddleware(
  generator: CRMCardGenerator,
  getPlays: () => Play[],
  getRecord: (objectType: ObjectType, objectId: string) => Promise<CRMRecord | null>
) {
  return async (req: { query: Record<string, string> }, res: { json: (data: unknown) => void }) => {
    const { objectType, objectId, appliedPlayId } = req.query;

    if (!objectType || !objectId) {
      res.json(generator.generateEmptyStateCard('unknown', 'deals'));
      return;
    }

    const record = await getRecord(objectType as ObjectType, objectId);
    if (!record) {
      res.json(generator.generateEmptyStateCard(objectId, objectType as ObjectType));
      return;
    }

    const plays = getPlays();
    const cardData = generator.generateCardData(record, plays, appliedPlayId);
    res.json(generator.formatForHubSpot(cardData));
  };
}
