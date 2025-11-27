/**
 * Pattern Mining Engine
 * Analyzes historical data to discover winning RevOps plays
 */

import {
  HistoricalDataPoint,
  Play,
  PlayPattern,
  PatternCondition,
  ActionSequence,
  PatternMiningConfig,
  ObjectType,
  RecordAction,
} from '../types';
import { generateId } from '../utils';

/**
 * Default configuration for pattern mining
 */
export const DEFAULT_MINING_CONFIG: PatternMiningConfig = {
  minSampleSize: 10,
  minWinRate: 0.5,
  minConfidence: 0.6,
  lookbackDays: 365,
  objectTypes: ['leads', 'deals', 'jobs', 'placements', 'contracts'],
};

/**
 * Pattern mining result with statistics
 */
export interface PatternMiningResult {
  plays: Play[];
  totalRecordsAnalyzed: number;
  winningRecords: number;
  patternsDiscovered: number;
  miningDuration: number;
}

/**
 * Internal pattern candidate during mining
 */
interface PatternCandidate {
  conditions: PatternCondition[];
  matchingRecords: HistoricalDataPoint[];
  winningRecords: HistoricalDataPoint[];
}

/**
 * PatternMiningEngine discovers winning plays from historical data
 */
export class PatternMiningEngine {
  private config: PatternMiningConfig;

  constructor(config: Partial<PatternMiningConfig> = {}) {
    this.config = { ...DEFAULT_MINING_CONFIG, ...config };
  }

  /**
   * Analyze historical data and discover winning plays
   */
  async minePatterns(data: HistoricalDataPoint[]): Promise<PatternMiningResult> {
    const startTime = Date.now();

    // Filter data by lookback period and object types
    const filteredData = this.filterData(data);
    const winningRecords = filteredData.filter((d) => d.outcome === 'won');

    // Extract pattern candidates
    const candidates = this.extractPatternCandidates(filteredData, winningRecords);

    // Score and filter candidates to create plays
    const plays = this.createPlaysFromCandidates(candidates, filteredData);

    return {
      plays,
      totalRecordsAnalyzed: filteredData.length,
      winningRecords: winningRecords.length,
      patternsDiscovered: plays.length,
      miningDuration: Date.now() - startTime,
    };
  }

  /**
   * Filter data based on configuration
   */
  private filterData(data: HistoricalDataPoint[]): HistoricalDataPoint[] {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.lookbackDays);

    return data.filter(
      (d) =>
        d.createdAt >= cutoffDate &&
        this.config.objectTypes.includes(d.objectType) &&
        (d.outcome === 'won' || d.outcome === 'lost')
    );
  }

  /**
   * Extract pattern candidates from data
   */
  private extractPatternCandidates(
    allData: HistoricalDataPoint[],
    winningRecords: HistoricalDataPoint[]
  ): PatternCandidate[] {
    const candidates: PatternCandidate[] = [];

    // Analyze property-based patterns
    candidates.push(...this.extractPropertyPatterns(allData, winningRecords));

    // Analyze action sequence patterns
    candidates.push(...this.extractActionPatterns(allData, winningRecords));

    // Analyze persona/segment patterns
    candidates.push(...this.extractSegmentPatterns(allData, winningRecords));

    return candidates;
  }

  /**
   * Extract patterns based on properties
   * Uses frequency threshold to avoid creating candidates for rare values
   */
  private extractPropertyPatterns(
    allData: HistoricalDataPoint[],
    winningRecords: HistoricalDataPoint[]
  ): PatternCandidate[] {
    const candidates: PatternCandidate[] = [];
    const propertyValueCounts = new Map<string, Map<string, number>>();

    // Count property value occurrences to identify frequent values
    for (const record of winningRecords) {
      for (const [key, value] of Object.entries(record.properties)) {
        if (value !== null && value !== undefined) {
          if (!propertyValueCounts.has(key)) {
            propertyValueCounts.set(key, new Map());
          }
          const valueStr = String(value);
          const counts = propertyValueCounts.get(key)!;
          counts.set(valueStr, (counts.get(valueStr) || 0) + 1);
        }
      }
    }

    // Only create candidates for values that appear in at least minSampleSize/2 winning records
    // This prevents excessive memory usage from rare property values
    const frequencyThreshold = Math.max(2, Math.floor(this.config.minSampleSize / 2));

    for (const [property, valueCounts] of propertyValueCounts) {
      for (const [value, count] of valueCounts) {
        // Skip rare values that won't meet the sample size threshold anyway
        if (count < frequencyThreshold) {
          continue;
        }

        const condition: PatternCondition = {
          field: property,
          operator: 'equals',
          value,
        };

        const matchingRecords = allData.filter(
          (d) => String(d.properties[property]) === value
        );
        const matchingWinning = winningRecords.filter(
          (d) => String(d.properties[property]) === value
        );

        if (matchingRecords.length >= this.config.minSampleSize) {
          candidates.push({
            conditions: [condition],
            matchingRecords,
            winningRecords: matchingWinning,
          });
        }
      }
    }

    return candidates;
  }

  /**
   * Extract patterns based on actions taken
   */
  private extractActionPatterns(
    allData: HistoricalDataPoint[],
    winningRecords: HistoricalDataPoint[]
  ): PatternCandidate[] {
    const candidates: PatternCandidate[] = [];
    const actionCounts = new Map<string, number>();

    // Count action occurrences in winning records
    for (const record of winningRecords) {
      const actionTypes = new Set(record.actions.map((a) => a.type));
      for (const actionType of actionTypes) {
        actionCounts.set(actionType, (actionCounts.get(actionType) || 0) + 1);
      }
    }

    // Find common action combinations
    const commonActions = Array.from(actionCounts.entries())
      .filter(([, count]) => count >= this.config.minSampleSize)
      .map(([action]) => action);

    for (const actionType of commonActions) {
      const condition: PatternCondition = {
        field: 'actions',
        operator: 'contains',
        value: actionType,
      };

      const matchingRecords = allData.filter((d) =>
        d.actions.some((a) => a.type === actionType)
      );
      const matchingWinning = winningRecords.filter((d) =>
        d.actions.some((a) => a.type === actionType)
      );

      candidates.push({
        conditions: [condition],
        matchingRecords,
        winningRecords: matchingWinning,
      });
    }

    return candidates;
  }

  /**
   * Extract patterns based on persona/segment
   */
  private extractSegmentPatterns(
    allData: HistoricalDataPoint[],
    winningRecords: HistoricalDataPoint[]
  ): PatternCandidate[] {
    const candidates: PatternCandidate[] = [];

    // Group by persona
    const personaGroups = this.groupBy(winningRecords, (r) => r.persona || 'unknown');
    for (const [persona, records] of Object.entries(personaGroups)) {
      if (persona !== 'unknown' && records.length >= this.config.minSampleSize) {
        const condition: PatternCondition = {
          field: 'persona',
          operator: 'equals',
          value: persona,
        };

        const matchingRecords = allData.filter((d) => d.persona === persona);

        candidates.push({
          conditions: [condition],
          matchingRecords,
          winningRecords: records,
        });
      }
    }

    // Group by funding stage
    const fundingGroups = this.groupBy(winningRecords, (r) => r.fundingStage || 'unknown');
    for (const [stage, records] of Object.entries(fundingGroups)) {
      if (stage !== 'unknown' && records.length >= this.config.minSampleSize) {
        const condition: PatternCondition = {
          field: 'fundingStage',
          operator: 'equals',
          value: stage,
        };

        const matchingRecords = allData.filter((d) => d.fundingStage === stage);

        candidates.push({
          conditions: [condition],
          matchingRecords,
          winningRecords: records,
        });
      }
    }

    // Group by service line
    const serviceGroups = this.groupBy(winningRecords, (r) => r.serviceLine || 'unknown');
    for (const [line, records] of Object.entries(serviceGroups)) {
      if (line !== 'unknown' && records.length >= this.config.minSampleSize) {
        const condition: PatternCondition = {
          field: 'serviceLine',
          operator: 'equals',
          value: line,
        };

        const matchingRecords = allData.filter((d) => d.serviceLine === line);

        candidates.push({
          conditions: [condition],
          matchingRecords,
          winningRecords: records,
        });
      }
    }

    return candidates;
  }

  /**
   * Create Play objects from validated candidates
   */
  private createPlaysFromCandidates(
    candidates: PatternCandidate[],
    allData: HistoricalDataPoint[]
  ): Play[] {
    const plays: Play[] = [];

    for (const candidate of candidates) {
      const winRate = candidate.winningRecords.length / candidate.matchingRecords.length;
      const confidence = this.calculateConfidence(candidate, allData);

      if (winRate >= this.config.minWinRate && confidence >= this.config.minConfidence) {
        const optimalSequence = this.extractOptimalSequence(candidate.winningRecords);
        const avgDaysToClose = this.calculateAvgDaysToClose(candidate.winningRecords);
        const objectTypes = this.getApplicableObjectTypes(candidate.matchingRecords);

        const play: Play = {
          id: generateId('play'),
          name: this.generatePlayName(candidate.conditions),
          description: this.generatePlayDescription(candidate, winRate),
          pattern: {
            conditions: candidate.conditions,
            requiredActions: this.extractRequiredActions(candidate.winningRecords),
            optimalSequence,
          },
          score: this.calculatePlayScore(winRate, confidence, candidate.matchingRecords.length),
          confidence,
          sampleSize: candidate.matchingRecords.length,
          winRate,
          avgDaysToClose,
          applicableObjectTypes: objectTypes,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        plays.push(play);
      }
    }

    // Sort by score descending
    return plays.sort((a, b) => b.score - a.score);
  }

  /**
   * Calculate confidence score for a pattern
   */
  private calculateConfidence(
    candidate: PatternCandidate,
    allData: HistoricalDataPoint[]
  ): number {
    const sampleRatio = candidate.matchingRecords.length / allData.length;
    const winRate = candidate.winningRecords.length / candidate.matchingRecords.length;
    const baselineWinRate =
      allData.filter((d) => d.outcome === 'won').length / allData.length;

    // Confidence is higher when:
    // 1. Sample size is substantial
    // 2. Win rate is significantly above baseline
    const sampleConfidence = Math.min(1, sampleRatio * 10);
    const liftConfidence = winRate > baselineWinRate ? (winRate - baselineWinRate) / baselineWinRate : 0;

    return Math.min(1, (sampleConfidence * 0.4 + Math.min(1, liftConfidence) * 0.6));
  }

  /**
   * Extract optimal action sequence from winning records
   */
  private extractOptimalSequence(records: HistoricalDataPoint[]): ActionSequence[] {
    const actionSequences: { type: string; avgOrder: number; count: number }[] = [];
    const actionCounts = new Map<string, { totalOrder: number; count: number }>();

    for (const record of records) {
      const sortedActions = [...record.actions].sort(
        (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
      );

      sortedActions.forEach((action, index) => {
        const existing = actionCounts.get(action.type) || { totalOrder: 0, count: 0 };
        existing.totalOrder += index;
        existing.count += 1;
        actionCounts.set(action.type, existing);
      });
    }

    for (const [type, data] of actionCounts) {
      actionSequences.push({
        type,
        avgOrder: data.totalOrder / data.count,
        count: data.count,
      });
    }

    return actionSequences
      .filter((a) => a.count >= records.length * 0.3) // At least 30% of records had this action
      .sort((a, b) => a.avgOrder - b.avgOrder)
      .map((a, index) => ({
        order: index + 1,
        actionType: a.type,
        description: `Perform ${a.type} action`,
      }));
  }

  /**
   * Extract commonly required actions from winning records
   */
  private extractRequiredActions(records: HistoricalDataPoint[]): string[] {
    const actionCounts = new Map<string, number>();

    for (const record of records) {
      const actionTypes = new Set(record.actions.map((a) => a.type));
      for (const type of actionTypes) {
        actionCounts.set(type, (actionCounts.get(type) || 0) + 1);
      }
    }

    // Actions present in at least 70% of winning records
    const threshold = records.length * 0.7;
    return Array.from(actionCounts.entries())
      .filter(([, count]) => count >= threshold)
      .map(([type]) => type);
  }

  /**
   * Calculate average days to close for records
   */
  private calculateAvgDaysToClose(records: HistoricalDataPoint[]): number {
    const daysToClose = records
      .filter((r) => r.daysToClose !== undefined)
      .map((r) => r.daysToClose!);

    if (daysToClose.length === 0) return 0;
    return daysToClose.reduce((a, b) => a + b, 0) / daysToClose.length;
  }

  /**
   * Get applicable object types from records
   */
  private getApplicableObjectTypes(records: HistoricalDataPoint[]): ObjectType[] {
    return [...new Set(records.map((r) => r.objectType))];
  }

  /**
   * Calculate overall play score
   */
  private calculatePlayScore(winRate: number, confidence: number, sampleSize: number): number {
    const winRateScore = winRate * 40;
    const confidenceScore = confidence * 35;
    const sampleScore = Math.min(25, Math.log10(sampleSize + 1) * 10);
    return winRateScore + confidenceScore + sampleScore;
  }

  /**
   * Generate a descriptive name for the play
   */
  private generatePlayName(conditions: PatternCondition[]): string {
    const parts = conditions.map((c) => {
      const fieldName = c.field.replace(/([A-Z])/g, ' $1').trim();
      return `${fieldName} ${c.operator} ${c.value}`;
    });
    return `Play: ${parts.join(', ')}`;
  }

  /**
   * Generate a description for the play
   */
  private generatePlayDescription(candidate: PatternCandidate, winRate: number): string {
    const conditions = candidate.conditions
      .map((c) => `${c.field} ${c.operator} ${c.value}`)
      .join(' AND ');
    return `Pattern matching ${conditions} with ${(winRate * 100).toFixed(1)}% win rate across ${candidate.matchingRecords.length} records.`;
  }

  /**
   * Helper to group array by key
   */
  private groupBy<T>(arr: T[], keyFn: (item: T) => string): Record<string, T[]> {
    return arr.reduce(
      (acc, item) => {
        const key = keyFn(item);
        if (!acc[key]) acc[key] = [];
        acc[key].push(item);
        return acc;
      },
      {} as Record<string, T[]>
    );
  }
}
