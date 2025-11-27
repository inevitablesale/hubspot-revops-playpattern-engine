/**
 * Tests for Play Scoring Engine
 */

import { PlayScoringEngine, batchScorePlays, DEFAULT_SCORING_WEIGHTS } from '../src/scoring';
import { Play, CRMRecord, ObjectType } from '../src/types';

describe('PlayScoringEngine', () => {
  let engine: PlayScoringEngine;

  beforeEach(() => {
    engine = new PlayScoringEngine();
  });

  const createMockPlay = (overrides: Partial<Play> = {}): Play => ({
    id: 'play-1',
    name: 'Test Play',
    description: 'A test play',
    pattern: {
      conditions: [{ field: 'industry', operator: 'equals', value: 'tech' }],
      requiredActions: ['email', 'call'],
      optimalSequence: [
        { order: 1, actionType: 'email', description: 'Send introduction email' },
        { order: 2, actionType: 'call', description: 'Follow-up call' },
      ],
    },
    score: 75,
    confidence: 0.8,
    sampleSize: 100,
    winRate: 0.65,
    avgDaysToClose: 45,
    applicableObjectTypes: ['deals'],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  const createMockRecord = (overrides: Partial<CRMRecord> = {}): CRMRecord => ({
    id: 'record-1',
    objectType: 'deals' as ObjectType,
    properties: { industry: 'tech', size: 'enterprise' },
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  describe('scorePlaysByRecord', () => {
    it('should score plays for a matching record', () => {
      const play = createMockPlay();
      const record = createMockRecord();

      const recommendations = engine.scorePlaysByRecord(record, [play]);

      expect(recommendations.length).toBe(1);
      expect(recommendations[0].playId).toBe(play.id);
      expect(recommendations[0].score).toBeGreaterThan(0);
    });

    it('should filter out non-applicable plays', () => {
      const play = createMockPlay({ applicableObjectTypes: ['leads'] });
      const record = createMockRecord({ objectType: 'deals' });

      const recommendations = engine.scorePlaysByRecord(record, [play]);

      expect(recommendations.length).toBe(0);
    });

    it('should sort recommendations by score descending', () => {
      const play1 = createMockPlay({ id: 'play-1', winRate: 0.9, score: 90 });
      const play2 = createMockPlay({ id: 'play-2', winRate: 0.5, score: 50 });
      const record = createMockRecord();

      const recommendations = engine.scorePlaysByRecord(record, [play2, play1]);

      expect(recommendations.length).toBe(2);
      expect(recommendations[0].score).toBeGreaterThan(recommendations[1].score);
    });

    it('should limit recommendations to maxRecommendations', () => {
      const plays = Array.from({ length: 10 }, (_, i) =>
        createMockPlay({ id: `play-${i}` })
      );
      const record = createMockRecord();

      const recommendations = engine.scorePlaysByRecord(record, plays, 3);

      expect(recommendations.length).toBe(3);
    });

    it('should include match percentage in recommendations', () => {
      const play = createMockPlay();
      const record = createMockRecord();

      const recommendations = engine.scorePlaysByRecord(record, [play]);

      expect(recommendations[0].matchPercentage).toBeGreaterThanOrEqual(0);
      expect(recommendations[0].matchPercentage).toBeLessThanOrEqual(1);
    });

    it('should generate next actions', () => {
      const play = createMockPlay();
      const record = createMockRecord();

      const recommendations = engine.scorePlaysByRecord(record, [play]);

      expect(recommendations[0].nextActions.length).toBeGreaterThan(0);
      expect(recommendations[0].nextActions[0].actionType).toBeDefined();
      expect(recommendations[0].nextActions[0].urgency).toBeDefined();
    });

    it('should include reasoning in recommendations', () => {
      const play = createMockPlay();
      const record = createMockRecord();

      const recommendations = engine.scorePlaysByRecord(record, [play]);

      expect(recommendations[0].reasoning).toBeDefined();
      expect(recommendations[0].reasoning.length).toBeGreaterThan(0);
    });
  });

  describe('condition evaluation', () => {
    it('should match equals condition', () => {
      const play = createMockPlay({
        pattern: {
          conditions: [{ field: 'status', operator: 'equals', value: 'active' }],
          requiredActions: [],
          optimalSequence: [],
        },
      });
      const record = createMockRecord({
        properties: { status: 'active' },
      });

      const recommendations = engine.scorePlaysByRecord(record, [play]);

      expect(recommendations.length).toBe(1);
    });

    it('should match contains condition', () => {
      const play = createMockPlay({
        pattern: {
          conditions: [{ field: 'description', operator: 'contains', value: 'enterprise' }],
          requiredActions: [],
          optimalSequence: [],
        },
      });
      const record = createMockRecord({
        properties: { description: 'Large enterprise client' },
      });

      const recommendations = engine.scorePlaysByRecord(record, [play]);

      expect(recommendations.length).toBe(1);
    });

    it('should match greaterThan condition', () => {
      const play = createMockPlay({
        pattern: {
          conditions: [{ field: 'amount', operator: 'greaterThan', value: 1000 }],
          requiredActions: [],
          optimalSequence: [],
        },
      });
      const record = createMockRecord({
        properties: { amount: 5000 },
      });

      const recommendations = engine.scorePlaysByRecord(record, [play]);

      expect(recommendations.length).toBe(1);
    });

    it('should match exists condition', () => {
      const play = createMockPlay({
        pattern: {
          conditions: [{ field: 'email', operator: 'exists', value: true }],
          requiredActions: [],
          optimalSequence: [],
        },
      });
      const record = createMockRecord({
        properties: { email: 'test@example.com' },
      });

      const recommendations = engine.scorePlaysByRecord(record, [play]);

      expect(recommendations.length).toBe(1);
    });
  });
});

describe('batchScorePlays', () => {
  it('should score plays for multiple records', () => {
    const records = [
      {
        id: 'record-1',
        objectType: 'deals' as ObjectType,
        properties: { industry: 'tech' },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'record-2',
        objectType: 'deals' as ObjectType,
        properties: { industry: 'finance' },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    const plays: Play[] = [
      {
        id: 'play-1',
        name: 'Tech Play',
        description: 'Play for tech',
        pattern: {
          conditions: [{ field: 'industry', operator: 'equals', value: 'tech' }],
          requiredActions: [],
          optimalSequence: [],
        },
        score: 75,
        confidence: 0.8,
        sampleSize: 100,
        winRate: 0.65,
        avgDaysToClose: 45,
        applicableObjectTypes: ['deals'],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    const results = batchScorePlays(records, plays);

    expect(results.size).toBe(2);
    expect(results.has('record-1')).toBe(true);
    expect(results.has('record-2')).toBe(true);
  });
});

describe('DEFAULT_SCORING_WEIGHTS', () => {
  it('should sum to 1', () => {
    const total =
      DEFAULT_SCORING_WEIGHTS.winRate +
      DEFAULT_SCORING_WEIGHTS.sampleSize +
      DEFAULT_SCORING_WEIGHTS.recency +
      DEFAULT_SCORING_WEIGHTS.similarity;

    expect(total).toBeCloseTo(1, 2);
  });
});
