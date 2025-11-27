/**
 * Recommended Sequences Module
 * Generates and manages optimal action sequences for plays
 */

import {
  Play,
  CRMRecord,
  ActionSequence,
  RecommendedAction,
  RecordAction,
} from '../types';

/**
 * Sequence configuration options
 */
export interface SequenceConfig {
  maxSteps: number;
  includeTiming: boolean;
  urgencyThresholds: {
    high: number;
    medium: number;
  };
}

/**
 * Default sequence configuration
 */
export const DEFAULT_SEQUENCE_CONFIG: SequenceConfig = {
  maxSteps: 5,
  includeTiming: true,
  urgencyThresholds: {
    high: 1,
    medium: 3,
  },
};

/**
 * Sequence progress tracking
 */
export interface SequenceProgress {
  playId: string;
  recordId: string;
  completedSteps: number[];
  remainingSteps: ActionSequence[];
  progressPercentage: number;
  lastActivityDate?: Date;
  estimatedCompletionDate?: Date;
}

/**
 * SequenceManager handles recommended action sequences
 */
export class SequenceManager {
  private config: SequenceConfig;

  constructor(config: Partial<SequenceConfig> = {}) {
    this.config = { ...DEFAULT_SEQUENCE_CONFIG, ...config };
  }

  /**
   * Get recommended sequence for a record based on a play
   */
  getRecommendedSequence(play: Play, record: CRMRecord): RecommendedAction[] {
    const sequence = play.pattern.optimalSequence;
    const completedActions = this.identifyCompletedActions(record, sequence);

    return sequence
      .filter((step) => !completedActions.includes(step.order))
      .slice(0, this.config.maxSteps)
      .map((step, index) => this.createRecommendedAction(step, index, completedActions.length));
  }

  /**
   * Identify which sequence steps have been completed for a record
   */
  private identifyCompletedActions(
    record: CRMRecord,
    sequence: ActionSequence[]
  ): number[] {
    // In a real implementation, this would check the record's action history
    // For now, we return an empty array to indicate no actions completed
    return [];
  }

  /**
   * Create a recommended action from a sequence step
   */
  private createRecommendedAction(
    step: ActionSequence,
    indexInRemaining: number,
    completedCount: number
  ): RecommendedAction {
    const urgency = this.determineUrgency(indexInRemaining);
    const dueDate = this.calculateDueDate(step, indexInRemaining);

    return {
      order: completedCount + indexInRemaining + 1,
      actionType: step.actionType,
      description: step.description,
      urgency,
      dueDate,
      metadata: step.metadata,
    };
  }

  /**
   * Determine urgency level based on position in sequence
   */
  private determineUrgency(position: number): 'high' | 'medium' | 'low' {
    if (position < this.config.urgencyThresholds.high) return 'high';
    if (position < this.config.urgencyThresholds.medium) return 'medium';
    return 'low';
  }

  /**
   * Calculate due date for an action
   */
  private calculateDueDate(step: ActionSequence, position: number): Date {
    const baseDate = new Date();

    if (this.config.includeTiming && step.timing) {
      const daysToAdd = step.timing.optimalDay || step.timing.minDays || position + 1;
      baseDate.setDate(baseDate.getDate() + daysToAdd);
    } else {
      baseDate.setDate(baseDate.getDate() + position + 1);
    }

    return baseDate;
  }

  /**
   * Track progress on a sequence
   */
  trackProgress(
    playId: string,
    recordId: string,
    sequence: ActionSequence[],
    recordActions: RecordAction[]
  ): SequenceProgress {
    const completedSteps = this.findCompletedSteps(sequence, recordActions);
    const remainingSteps = sequence.filter((s) => !completedSteps.includes(s.order));
    const progressPercentage =
      sequence.length > 0 ? (completedSteps.length / sequence.length) * 100 : 0;

    const lastActivity = recordActions.length > 0
      ? new Date(Math.max(...recordActions.map((a) => a.timestamp.getTime())))
      : undefined;

    const estimatedCompletion = this.estimateCompletionDate(remainingSteps);

    return {
      playId,
      recordId,
      completedSteps,
      remainingSteps,
      progressPercentage,
      lastActivityDate: lastActivity,
      estimatedCompletionDate: estimatedCompletion,
    };
  }

  /**
   * Find which steps have been completed based on record actions
   */
  private findCompletedSteps(
    sequence: ActionSequence[],
    recordActions: RecordAction[]
  ): number[] {
    const actionTypes = new Set(recordActions.map((a) => a.type));
    return sequence.filter((s) => actionTypes.has(s.actionType)).map((s) => s.order);
  }

  /**
   * Estimate completion date based on remaining steps
   */
  private estimateCompletionDate(remainingSteps: ActionSequence[]): Date | undefined {
    if (remainingSteps.length === 0) return undefined;

    const totalDays = remainingSteps.reduce((sum, step) => {
      return sum + (step.timing?.optimalDay || step.timing?.minDays || 1);
    }, 0);

    const completionDate = new Date();
    completionDate.setDate(completionDate.getDate() + totalDays);
    return completionDate;
  }

  /**
   * Generate sequence visualization data
   */
  generateSequenceVisualization(
    sequence: ActionSequence[],
    completedSteps: number[]
  ): SequenceVisualization {
    return {
      totalSteps: sequence.length,
      completedCount: completedSteps.length,
      steps: sequence.map((step) => ({
        order: step.order,
        actionType: step.actionType,
        description: step.description,
        completed: completedSteps.includes(step.order),
        timing: step.timing,
      })),
    };
  }
}

/**
 * Sequence visualization data structure
 */
export interface SequenceVisualization {
  totalSteps: number;
  completedCount: number;
  steps: {
    order: number;
    actionType: string;
    description: string;
    completed: boolean;
    timing?: {
      minDays?: number;
      maxDays?: number;
      optimalDay?: number;
    };
  }[];
}

/**
 * Merge multiple sequences into an optimized combined sequence
 */
export function mergeSequences(sequences: ActionSequence[][]): ActionSequence[] {
  const allSteps = sequences.flat();
  const uniqueActions = new Map<string, ActionSequence>();

  // Deduplicate by action type, keeping the one with earliest timing
  for (const step of allSteps) {
    const existing = uniqueActions.get(step.actionType);
    if (!existing || (step.timing?.optimalDay || 999) < (existing.timing?.optimalDay || 999)) {
      uniqueActions.set(step.actionType, step);
    }
  }

  // Sort by optimal timing
  return Array.from(uniqueActions.values())
    .sort((a, b) => (a.timing?.optimalDay || 0) - (b.timing?.optimalDay || 0))
    .map((step, index) => ({ ...step, order: index + 1 }));
}
