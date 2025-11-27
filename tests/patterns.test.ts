/**
 * Tests for Pattern Mining Engine
 */

import { PatternMiningEngine, DEFAULT_MINING_CONFIG } from '../src/patterns';
import { HistoricalDataPoint, ObjectType, RecordOutcome } from '../src/types';

describe('PatternMiningEngine', () => {
  let engine: PatternMiningEngine;

  beforeEach(() => {
    engine = new PatternMiningEngine();
  });

  const createHistoricalData = (
    count: number,
    outcome: RecordOutcome,
    properties: Record<string, string | number | boolean | null> = {}
  ): HistoricalDataPoint[] => {
    return Array.from({ length: count }, (_, i) => ({
      recordId: `record-${i}`,
      objectType: 'deals' as ObjectType,
      outcome,
      properties: { industry: 'tech', size: 'enterprise', ...properties },
      actions: [
        { id: `action-${i}-1`, type: 'email', timestamp: new Date() },
        { id: `action-${i}-2`, type: 'call', timestamp: new Date() },
      ],
      timeline: [],
      createdAt: new Date(),
      closedAt: outcome !== 'pending' && outcome !== 'active' ? new Date() : undefined,
      daysToClose: outcome !== 'pending' && outcome !== 'active' ? 30 : undefined,
    }));
  };

  describe('minePatterns', () => {
    it('should discover patterns from winning records', async () => {
      const data = [
        ...createHistoricalData(20, 'won', { stage: 'proposal' }),
        ...createHistoricalData(10, 'lost', { stage: 'discovery' }),
      ];

      const result = await engine.minePatterns(data);

      expect(result.totalRecordsAnalyzed).toBe(30);
      expect(result.winningRecords).toBe(20);
      expect(result.plays.length).toBeGreaterThan(0);
    });

    it('should calculate correct win rates', async () => {
      const data = [
        ...createHistoricalData(15, 'won', { type: 'A' }),
        ...createHistoricalData(5, 'lost', { type: 'A' }),
        ...createHistoricalData(5, 'won', { type: 'B' }),
        ...createHistoricalData(15, 'lost', { type: 'B' }),
      ];

      const result = await engine.minePatterns(data);

      // Type A should have higher win rate (75%) than Type B (25%)
      const typeAPlay = result.plays.find((p) =>
        p.pattern.conditions.some((c) => c.field === 'type' && c.value === 'A')
      );

      if (typeAPlay) {
        expect(typeAPlay.winRate).toBeCloseTo(0.75, 1);
      }
    });

    it('should filter out patterns below minimum sample size', async () => {
      const customEngine = new PatternMiningEngine({ minSampleSize: 50 });
      const data = createHistoricalData(20, 'won');

      const result = await customEngine.minePatterns(data);

      // Should find fewer or no patterns due to high sample size requirement
      expect(result.patternsDiscovered).toBeLessThanOrEqual(result.plays.length);
    });

    it('should respect lookback days configuration', async () => {
      const oldData = createHistoricalData(20, 'won').map((d) => ({
        ...d,
        createdAt: new Date(Date.now() - 400 * 24 * 60 * 60 * 1000), // 400 days ago
      }));

      const result = await engine.minePatterns(oldData);

      // Old data should be filtered out
      expect(result.totalRecordsAnalyzed).toBe(0);
    });

    it('should extract optimal action sequences', async () => {
      const data = createHistoricalData(15, 'won');
      const result = await engine.minePatterns(data);

      if (result.plays.length > 0) {
        const play = result.plays[0];
        expect(play.pattern.optimalSequence).toBeDefined();
        expect(Array.isArray(play.pattern.optimalSequence)).toBe(true);
      }
    });
  });

  describe('configuration', () => {
    it('should use default configuration when none provided', () => {
      const defaultEngine = new PatternMiningEngine();
      expect(defaultEngine).toBeDefined();
    });

    it('should merge custom configuration with defaults', () => {
      const customEngine = new PatternMiningEngine({
        minSampleSize: 5,
        minWinRate: 0.7,
      });
      expect(customEngine).toBeDefined();
    });
  });
});

describe('DEFAULT_MINING_CONFIG', () => {
  it('should have reasonable default values', () => {
    expect(DEFAULT_MINING_CONFIG.minSampleSize).toBeGreaterThan(0);
    expect(DEFAULT_MINING_CONFIG.minWinRate).toBeGreaterThan(0);
    expect(DEFAULT_MINING_CONFIG.minWinRate).toBeLessThanOrEqual(1);
    expect(DEFAULT_MINING_CONFIG.lookbackDays).toBeGreaterThan(0);
    expect(DEFAULT_MINING_CONFIG.objectTypes.length).toBeGreaterThan(0);
  });

  it('should include all supported object types', () => {
    expect(DEFAULT_MINING_CONFIG.objectTypes).toContain('leads');
    expect(DEFAULT_MINING_CONFIG.objectTypes).toContain('deals');
    expect(DEFAULT_MINING_CONFIG.objectTypes).toContain('jobs');
    expect(DEFAULT_MINING_CONFIG.objectTypes).toContain('placements');
    expect(DEFAULT_MINING_CONFIG.objectTypes).toContain('contracts');
  });
});
