/**
 * Tests for CRM Card Generator
 */

import { CRMCardGenerator } from '../src/cards';
import { Play, CRMRecord, ObjectType } from '../src/types';

describe('CRMCardGenerator', () => {
  let generator: CRMCardGenerator;

  beforeEach(() => {
    generator = new CRMCardGenerator('http://localhost:3000');
  });

  const createMockPlay = (overrides: Partial<Play> = {}): Play => ({
    id: 'play-1',
    name: 'Enterprise Tech Play',
    description: 'Optimized for enterprise tech deals',
    pattern: {
      conditions: [{ field: 'industry', operator: 'equals', value: 'tech' }],
      requiredActions: ['email', 'call', 'demo'],
      optimalSequence: [
        { order: 1, actionType: 'email', description: 'Send introduction' },
        { order: 2, actionType: 'call', description: 'Discovery call' },
        { order: 3, actionType: 'demo', description: 'Product demo' },
      ],
    },
    score: 85,
    confidence: 0.85,
    sampleSize: 150,
    winRate: 0.72,
    avgDaysToClose: 35,
    applicableObjectTypes: ['deals'],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  const createMockRecord = (overrides: Partial<CRMRecord> = {}): CRMRecord => ({
    id: 'record-123',
    objectType: 'deals' as ObjectType,
    properties: { industry: 'tech', amount: 50000 },
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  describe('generateCardData', () => {
    it('should generate card data with recommendations', () => {
      const record = createMockRecord();
      const plays = [createMockPlay()];

      const cardData = generator.generateCardData(record, plays);

      expect(cardData.objectId).toBe('record-123');
      expect(cardData.objectType).toBe('deals');
      expect(cardData.title).toBe('RevOps Play Recommendations');
      expect(cardData.allRecommendations.length).toBeGreaterThan(0);
    });

    it('should include top recommendation', () => {
      const record = createMockRecord();
      const plays = [createMockPlay()];

      const cardData = generator.generateCardData(record, plays);

      expect(cardData.topRecommendation).toBeDefined();
      expect(cardData.topRecommendation?.playId).toBe('play-1');
    });

    it('should include applied play ID when provided', () => {
      const record = createMockRecord();
      const plays = [createMockPlay()];

      const cardData = generator.generateCardData(record, plays, 'play-1');

      expect(cardData.appliedPlayId).toBe('play-1');
    });

    it('should generate card sections', () => {
      const record = createMockRecord();
      const plays = [createMockPlay()];

      const cardData = generator.generateCardData(record, plays);

      expect(cardData.sections.length).toBeGreaterThan(0);
    });

    it('should include next actions section', () => {
      const record = createMockRecord();
      const plays = [createMockPlay()];

      const cardData = generator.generateCardData(record, plays);

      const actionsSection = cardData.sections.find((s) => s.id === 'next_actions');
      expect(actionsSection).toBeDefined();
      expect(actionsSection?.type).toBe('list');
    });
  });

  describe('formatForHubSpot', () => {
    it('should format card data for HubSpot API', () => {
      const record = createMockRecord();
      const plays = [createMockPlay()];
      const cardData = generator.generateCardData(record, plays);

      const hubspotResponse = generator.formatForHubSpot(cardData);

      expect(hubspotResponse.results).toBeDefined();
      expect(Array.isArray(hubspotResponse.results)).toBe(true);
    });

    it('should include primary action when recommendations exist', () => {
      const record = createMockRecord();
      const plays = [createMockPlay()];
      const cardData = generator.generateCardData(record, plays);

      const hubspotResponse = generator.formatForHubSpot(cardData);

      expect(hubspotResponse.primaryAction).toBeDefined();
      expect(hubspotResponse.primaryAction?.type).toBe('CONFIRMATION_ACTION_HOOK');
      expect(hubspotResponse.primaryAction?.label).toBe('Apply Top Play');
    });

    it('should include secondary actions', () => {
      const record = createMockRecord();
      const plays = [createMockPlay()];
      const cardData = generator.generateCardData(record, plays);

      const hubspotResponse = generator.formatForHubSpot(cardData);

      expect(hubspotResponse.secondaryActions).toBeDefined();
      expect(hubspotResponse.secondaryActions?.length).toBeGreaterThan(0);
    });

    it('should format result properties correctly', () => {
      const record = createMockRecord();
      const plays = [createMockPlay()];
      const cardData = generator.generateCardData(record, plays);

      const hubspotResponse = generator.formatForHubSpot(cardData);

      const firstResult = hubspotResponse.results[0];
      expect(firstResult.title).toBeDefined();
      expect(firstResult.properties).toBeDefined();
      expect(firstResult.properties.length).toBeGreaterThan(0);
    });

    it('should include score property', () => {
      const record = createMockRecord();
      const plays = [createMockPlay()];
      const cardData = generator.generateCardData(record, plays);

      const hubspotResponse = generator.formatForHubSpot(cardData);

      const scoreProperty = hubspotResponse.results[0].properties.find(
        (p) => p.label === 'Score'
      );
      expect(scoreProperty).toBeDefined();
      expect(scoreProperty?.dataType).toBe('NUMBER');
    });
  });

  describe('generateEmptyStateCard', () => {
    it('should generate empty state when no recommendations', () => {
      const emptyCard = generator.generateEmptyStateCard('record-123', 'deals');

      expect(emptyCard.results.length).toBe(1);
      expect(emptyCard.results[0].title).toBe('No Recommendations Available');
    });

    it('should include learn more action', () => {
      const emptyCard = generator.generateEmptyStateCard('record-123', 'deals');

      expect(emptyCard.secondaryActions?.length).toBe(1);
      expect(emptyCard.secondaryActions?.[0].label).toBe('Learn More');
    });
  });

  describe('multiple plays', () => {
    it('should rank plays by score', () => {
      const record = createMockRecord();
      const plays = [
        createMockPlay({ id: 'play-low', score: 50, winRate: 0.5 }),
        createMockPlay({ id: 'play-high', score: 90, winRate: 0.9 }),
      ];

      const cardData = generator.generateCardData(record, plays);

      expect(cardData.topRecommendation?.playId).toBe('play-high');
    });

    it('should include other plays section when multiple recommendations', () => {
      const record = createMockRecord();
      const plays = [
        createMockPlay({ id: 'play-1' }),
        createMockPlay({ id: 'play-2' }),
        createMockPlay({ id: 'play-3' }),
      ];

      const cardData = generator.generateCardData(record, plays);

      const otherPlaysSection = cardData.sections.find(
        (s) => s.id === 'all_recommendations'
      );
      expect(otherPlaysSection).toBeDefined();
    });
  });
});
