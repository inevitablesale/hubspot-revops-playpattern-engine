/**
 * Routing Logic Module
 * Handles record assignment based on plays and rules
 */

import { CRMRecord, RoutingRule, PatternCondition, Play } from '../types';
import { generateId } from '../utils';

/**
 * Routing decision result
 */
export interface RoutingDecision {
  recordId: string;
  ruleId: string;
  ruleName: string;
  assignmentType: 'user' | 'team' | 'round_robin';
  assigneeId?: string;
  assigneeIds?: string[];
  reason: string;
  priority: number;
}

/**
 * Round robin state for fair distribution
 */
interface RoundRobinState {
  targetIds: string[];
  currentIndex: number;
}

/**
 * RoutingEngine handles record assignment logic
 */
export class RoutingEngine {
  private rules: RoutingRule[] = [];
  private roundRobinStates: Map<string, RoundRobinState> = new Map();

  constructor(rules: RoutingRule[] = []) {
    this.rules = rules.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Add a routing rule
   */
  addRule(rule: RoutingRule): void {
    this.rules.push(rule);
    this.rules.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Remove a routing rule by ID
   */
  removeRule(ruleId: string): boolean {
    const index = this.rules.findIndex((r) => r.id === ruleId);
    if (index !== -1) {
      this.rules.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Get all routing rules
   */
  getRules(): RoutingRule[] {
    return [...this.rules];
  }

  /**
   * Route a record based on configured rules
   */
  routeRecord(record: CRMRecord): RoutingDecision | null {
    for (const rule of this.rules) {
      if (this.evaluateRuleConditions(record, rule.conditions)) {
        return this.createRoutingDecision(record, rule);
      }
    }
    return null;
  }

  /**
   * Batch route multiple records
   */
  batchRouteRecords(records: CRMRecord[]): Map<string, RoutingDecision | null> {
    const results = new Map<string, RoutingDecision | null>();
    for (const record of records) {
      results.set(record.id, this.routeRecord(record));
    }
    return results;
  }

  /**
   * Evaluate all conditions for a rule
   */
  private evaluateRuleConditions(
    record: CRMRecord,
    conditions: PatternCondition[]
  ): boolean {
    return conditions.every((condition) => this.evaluateCondition(record, condition));
  }

  /**
   * Evaluate a single condition
   */
  private evaluateCondition(record: CRMRecord, condition: PatternCondition): boolean {
    const value = record.properties[condition.field];

    // Handle null/undefined for non-existence checks
    if (condition.operator === 'exists') {
      return value !== null && value !== undefined && value !== '';
    }
    if (condition.operator === 'notExists') {
      return value === null || value === undefined || value === '';
    }

    // For other operators, null/undefined means no match
    if (value === null || value === undefined) {
      return false;
    }

    switch (condition.operator) {
      case 'equals':
        return String(value) === String(condition.value);
      case 'contains':
        return String(value).toLowerCase().includes(String(condition.value).toLowerCase());
      case 'greaterThan':
        return Number(value) > Number(condition.value);
      case 'lessThan':
        return Number(value) < Number(condition.value);
      case 'in':
        return Array.isArray(condition.value) && (condition.value as string[]).includes(String(value));
      case 'notIn':
        return Array.isArray(condition.value) && !(condition.value as string[]).includes(String(value));
      default:
        return false;
    }
  }

  /**
   * Create routing decision for a matched rule
   */
  private createRoutingDecision(record: CRMRecord, rule: RoutingRule): RoutingDecision {
    let assigneeId: string | undefined;
    let assigneeIds: string[] | undefined;

    if (rule.assignTo.type === 'round_robin') {
      assigneeId = this.getNextRoundRobinAssignee(rule.id, rule.assignTo.targetIds || []);
    } else if (rule.assignTo.type === 'user') {
      assigneeId = rule.assignTo.targetId;
    } else if (rule.assignTo.type === 'team') {
      assigneeIds = rule.assignTo.targetIds;
    }

    return {
      recordId: record.id,
      ruleId: rule.id,
      ruleName: rule.name,
      assignmentType: rule.assignTo.type,
      assigneeId,
      assigneeIds,
      reason: this.generateRoutingReason(rule),
      priority: rule.priority,
    };
  }

  /**
   * Get next assignee in round robin rotation
   */
  private getNextRoundRobinAssignee(ruleId: string, targetIds: string[]): string | undefined {
    if (targetIds.length === 0) return undefined;

    let state = this.roundRobinStates.get(ruleId);
    if (!state) {
      state = { targetIds, currentIndex: 0 };
      this.roundRobinStates.set(ruleId, state);
    }

    const assigneeId = state.targetIds[state.currentIndex];
    state.currentIndex = (state.currentIndex + 1) % state.targetIds.length;

    return assigneeId;
  }

  /**
   * Generate routing reason text
   */
  private generateRoutingReason(rule: RoutingRule): string {
    const conditionText = rule.conditions
      .map((c) => `${c.field} ${c.operator} ${c.value}`)
      .join(' AND ');
    return `Matched rule "${rule.name}": ${conditionText}`;
  }

  /**
   * Create routing rules from play patterns
   */
  static createRulesFromPlay(play: Play, assignTo: RoutingRule['assignTo']): RoutingRule {
    return {
      id: generateId('route'),
      name: `Auto-route for ${play.name}`,
      priority: Math.round(100 - play.score),
      conditions: play.pattern.conditions,
      assignTo,
    };
  }
}

/**
 * Create a routing rule builder
 */
export class RoutingRuleBuilder {
  private rule: Partial<RoutingRule> = {};

  constructor(name: string) {
    this.rule = {
      id: generateId('route'),
      name,
      conditions: [],
    };
  }

  priority(value: number): this {
    this.rule.priority = value;
    return this;
  }

  condition(field: string, operator: PatternCondition['operator'], value: PatternCondition['value']): this {
    if (!this.rule.conditions) this.rule.conditions = [];
    this.rule.conditions.push({ field, operator, value });
    return this;
  }

  assignToUser(userId: string): this {
    this.rule.assignTo = { type: 'user', targetId: userId };
    return this;
  }

  assignToTeam(teamId: string): this {
    this.rule.assignTo = { type: 'team', targetId: teamId };
    return this;
  }

  assignRoundRobin(userIds: string[]): this {
    this.rule.assignTo = { type: 'round_robin', targetIds: userIds };
    return this;
  }

  build(): RoutingRule {
    if (!this.rule.priority) this.rule.priority = 100;
    if (!this.rule.assignTo) {
      throw new Error('Routing rule must have an assignment target');
    }
    return this.rule as RoutingRule;
  }
}
