/**
 * Play Scoring Engine
 * Scores and ranks plays for specific records
 */

import {
  Play,
  CRMRecord,
  PlayRecommendation,
  RecommendedAction,
  PatternCondition,
  ScoringWeights,
} from '../types';

/**
 * Default scoring weights
 */
export const DEFAULT_SCORING_WEIGHTS: ScoringWeights = {
  winRate: 0.35,
  sampleSize: 0.15,
  recency: 0.15,
  similarity: 0.35,
};

/**
 * PlayScoringEngine scores and ranks plays for active records
 */
export class PlayScoringEngine {
  private weights: ScoringWeights;

  constructor(weights: Partial<ScoringWeights> = {}) {
    this.weights = { ...DEFAULT_SCORING_WEIGHTS, ...weights };
  }

  /**
   * Score all plays for a specific record and return recommendations
   */
  scorePlaysByRecord(
    record: CRMRecord,
    plays: Play[],
    maxRecommendations: number = 5
  ): PlayRecommendation[] {
    const scoredPlays = plays
      .filter((play) => this.isPlayApplicable(play, record))
      .map((play) => this.scorePlayForRecord(record, play))
      .filter((rec): rec is PlayRecommendation => rec !== null)
      .sort((a, b) => b.score - a.score);

    return scoredPlays.slice(0, maxRecommendations);
  }

  /**
   * Check if a play is applicable to a record
   */
  private isPlayApplicable(play: Play, record: CRMRecord): boolean {
    return play.applicableObjectTypes.includes(record.objectType);
  }

  /**
   * Score a single play for a specific record
   */
  private scorePlayForRecord(record: CRMRecord, play: Play): PlayRecommendation | null {
    const matchResult = this.calculatePatternMatch(record, play);
    if (matchResult.matchPercentage < 0.3) {
      return null; // Too low match to recommend
    }

    const score = this.calculateFinalScore(play, matchResult.matchPercentage);
    const nextActions = this.generateNextActions(record, play);

    return {
      playId: play.id,
      playName: play.name,
      score,
      confidence: play.confidence,
      matchPercentage: matchResult.matchPercentage,
      nextActions,
      reasoning: this.generateReasoning(play, matchResult),
      estimatedImpact: {
        winRateIncrease: Math.round((play.winRate - 0.5) * 100) / 100,
        daysToCloseReduction: Math.round(play.avgDaysToClose * 0.1),
      },
    };
  }

  /**
   * Calculate how well a record matches a play's pattern
   */
  private calculatePatternMatch(
    record: CRMRecord,
    play: Play
  ): { matchPercentage: number; matchedConditions: PatternCondition[] } {
    const conditions = play.pattern.conditions;
    if (conditions.length === 0) {
      return { matchPercentage: 0, matchedConditions: [] };
    }

    const matchedConditions: PatternCondition[] = [];

    for (const condition of conditions) {
      if (this.evaluateCondition(record, condition)) {
        matchedConditions.push(condition);
      }
    }

    return {
      matchPercentage: matchedConditions.length / conditions.length,
      matchedConditions,
    };
  }

  /**
   * Evaluate a single condition against a record
   */
  private evaluateCondition(record: CRMRecord, condition: PatternCondition): boolean {
    const value = record.properties[condition.field];

    switch (condition.operator) {
      case 'equals':
        return String(value) === String(condition.value);
      case 'contains':
        return String(value).includes(String(condition.value));
      case 'greaterThan':
        return Number(value) > Number(condition.value);
      case 'lessThan':
        return Number(value) < Number(condition.value);
      case 'in':
        return Array.isArray(condition.value) && (condition.value as string[]).includes(String(value));
      case 'notIn':
        return Array.isArray(condition.value) && !(condition.value as string[]).includes(String(value));
      case 'exists':
        return value !== null && value !== undefined && value !== '';
      case 'notExists':
        return value === null || value === undefined || value === '';
      default:
        return false;
    }
  }

  /**
   * Calculate final score incorporating all factors
   */
  private calculateFinalScore(play: Play, matchPercentage: number): number {
    const winRateScore = play.winRate * this.weights.winRate;
    const sampleScore = Math.min(1, Math.log10(play.sampleSize + 1) / 3) * this.weights.sampleSize;

    // Recency score based on when the play was created/updated
    const daysSinceUpdate = Math.floor(
      (Date.now() - play.updatedAt.getTime()) / (1000 * 60 * 60 * 24)
    );
    const recencyScore = Math.max(0, 1 - daysSinceUpdate / 365) * this.weights.recency;

    const similarityScore = matchPercentage * this.weights.similarity;

    return (winRateScore + sampleScore + recencyScore + similarityScore) * 100;
  }

  /**
   * Generate recommended next actions based on play sequence
   */
  private generateNextActions(record: CRMRecord, play: Play): RecommendedAction[] {
    const sequence = play.pattern.optimalSequence;

    return sequence.slice(0, 3).map((step, index) => ({
      order: step.order,
      actionType: step.actionType,
      description: step.description,
      urgency: index === 0 ? 'high' : index === 1 ? 'medium' : 'low',
      dueDate: this.calculateDueDate(step.timing),
      metadata: step.metadata,
    }));
  }

  /**
   * Calculate due date based on timing configuration
   */
  private calculateDueDate(timing?: {
    minDays?: number;
    maxDays?: number;
    optimalDay?: number;
  }): Date | undefined {
    if (!timing) return undefined;

    const daysToAdd = timing.optimalDay || timing.minDays || 1;
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + daysToAdd);
    return dueDate;
  }

  /**
   * Generate reasoning text for the recommendation
   */
  private generateReasoning(
    play: Play,
    matchResult: { matchPercentage: number; matchedConditions: PatternCondition[] }
  ): string {
    const matchedFields = matchResult.matchedConditions.map((c) => c.field).join(', ');
    return `This play has a ${(play.winRate * 100).toFixed(0)}% win rate based on ${play.sampleSize} similar records. ` +
      `Record matches ${(matchResult.matchPercentage * 100).toFixed(0)}% of pattern criteria (${matchedFields || 'general pattern'}).`;
  }
}

/**
 * Batch score plays for multiple records
 */
export function batchScorePlays(
  records: CRMRecord[],
  plays: Play[],
  weights?: Partial<ScoringWeights>
): Map<string, PlayRecommendation[]> {
  const engine = new PlayScoringEngine(weights);
  const results = new Map<string, PlayRecommendation[]>();

  for (const record of records) {
    const recommendations = engine.scorePlaysByRecord(record, plays);
    results.set(record.id, recommendations);
  }

  return results;
}
