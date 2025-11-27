/**
 * Tests for Routing Engine
 */

import { RoutingEngine, RoutingRuleBuilder } from '../src/routing';
import { CRMRecord, ObjectType, RoutingRule } from '../src/types';

describe('RoutingEngine', () => {
  let engine: RoutingEngine;

  beforeEach(() => {
    engine = new RoutingEngine();
  });

  const createMockRecord = (properties: Record<string, string | number | boolean | null> = {}): CRMRecord => ({
    id: 'record-1',
    objectType: 'deals' as ObjectType,
    properties: { industry: 'tech', size: 'enterprise', ...properties },
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const createMockRule = (overrides: Partial<RoutingRule> = {}): RoutingRule => ({
    id: 'rule-1',
    name: 'Test Rule',
    priority: 1,
    conditions: [{ field: 'industry', operator: 'equals', value: 'tech' }],
    assignTo: { type: 'user', targetId: 'user-123' },
    ...overrides,
  });

  describe('routeRecord', () => {
    it('should route a record to a user', () => {
      const rule = createMockRule();
      engine.addRule(rule);

      const record = createMockRecord();
      const decision = engine.routeRecord(record);

      expect(decision).not.toBeNull();
      expect(decision?.ruleId).toBe('rule-1');
      expect(decision?.assigneeId).toBe('user-123');
    });

    it('should return null when no rules match', () => {
      const rule = createMockRule({
        conditions: [{ field: 'industry', operator: 'equals', value: 'finance' }],
      });
      engine.addRule(rule);

      const record = createMockRecord({ industry: 'tech' });
      const decision = engine.routeRecord(record);

      expect(decision).toBeNull();
    });

    it('should respect rule priority', () => {
      const rule1 = createMockRule({
        id: 'rule-1',
        priority: 2,
        assignTo: { type: 'user', targetId: 'user-low-priority' },
      });
      const rule2 = createMockRule({
        id: 'rule-2',
        priority: 1,
        assignTo: { type: 'user', targetId: 'user-high-priority' },
      });

      engine.addRule(rule1);
      engine.addRule(rule2);

      const record = createMockRecord();
      const decision = engine.routeRecord(record);

      expect(decision?.assigneeId).toBe('user-high-priority');
    });

    it('should route using round robin', () => {
      const rule = createMockRule({
        assignTo: {
          type: 'round_robin',
          targetIds: ['user-1', 'user-2', 'user-3'],
        },
      });
      engine.addRule(rule);

      const record1 = createMockRecord({ id: 'record-1' });
      const record2 = createMockRecord({ id: 'record-2' });
      const record3 = createMockRecord({ id: 'record-3' });

      const decision1 = engine.routeRecord(record1);
      const decision2 = engine.routeRecord(record2);
      const decision3 = engine.routeRecord(record3);

      expect(decision1?.assigneeId).toBe('user-1');
      expect(decision2?.assigneeId).toBe('user-2');
      expect(decision3?.assigneeId).toBe('user-3');
    });

    it('should route to team', () => {
      const rule = createMockRule({
        assignTo: { type: 'team', targetId: 'team-123' },
      });
      engine.addRule(rule);

      const record = createMockRecord();
      const decision = engine.routeRecord(record);

      expect(decision?.assignmentType).toBe('team');
    });
  });

  describe('rule management', () => {
    it('should add rules', () => {
      engine.addRule(createMockRule({ id: 'rule-1' }));
      engine.addRule(createMockRule({ id: 'rule-2' }));

      const rules = engine.getRules();
      expect(rules.length).toBe(2);
    });

    it('should remove rules', () => {
      engine.addRule(createMockRule({ id: 'rule-1' }));
      engine.addRule(createMockRule({ id: 'rule-2' }));

      const removed = engine.removeRule('rule-1');
      expect(removed).toBe(true);

      const rules = engine.getRules();
      expect(rules.length).toBe(1);
    });

    it('should return false when removing non-existent rule', () => {
      const removed = engine.removeRule('non-existent');
      expect(removed).toBe(false);
    });
  });

  describe('batchRouteRecords', () => {
    it('should route multiple records', () => {
      engine.addRule(createMockRule());

      const records = [
        { ...createMockRecord({ industry: 'tech' }), id: 'record-1' },
        { ...createMockRecord({ industry: 'finance' }), id: 'record-2' },
      ];

      const results = engine.batchRouteRecords(records);

      expect(results.size).toBe(2);
    });
  });

  describe('condition evaluation', () => {
    it('should evaluate equals condition', () => {
      engine.addRule(createMockRule({
        conditions: [{ field: 'status', operator: 'equals', value: 'active' }],
      }));

      const matchingRecord = createMockRecord({ status: 'active' });
      const nonMatchingRecord = createMockRecord({ status: 'inactive' });

      expect(engine.routeRecord(matchingRecord)).not.toBeNull();
      expect(engine.routeRecord(nonMatchingRecord)).toBeNull();
    });

    it('should evaluate contains condition', () => {
      engine.addRule(createMockRule({
        conditions: [{ field: 'notes', operator: 'contains', value: 'urgent' }],
      }));

      const matchingRecord = createMockRecord({ notes: 'This is urgent!' });
      const nonMatchingRecord = createMockRecord({ notes: 'Regular note' });

      expect(engine.routeRecord(matchingRecord)).not.toBeNull();
      expect(engine.routeRecord(nonMatchingRecord)).toBeNull();
    });

    it('should evaluate greaterThan condition', () => {
      engine.addRule(createMockRule({
        conditions: [{ field: 'amount', operator: 'greaterThan', value: 1000 }],
      }));

      const matchingRecord = createMockRecord({ amount: 5000 });
      const nonMatchingRecord = createMockRecord({ amount: 500 });

      expect(engine.routeRecord(matchingRecord)).not.toBeNull();
      expect(engine.routeRecord(nonMatchingRecord)).toBeNull();
    });

    it('should evaluate multiple conditions (AND logic)', () => {
      engine.addRule(createMockRule({
        conditions: [
          { field: 'industry', operator: 'equals', value: 'tech' },
          { field: 'size', operator: 'equals', value: 'enterprise' },
        ],
      }));

      const matchingRecord = createMockRecord({ industry: 'tech', size: 'enterprise' });
      const partialMatchRecord = createMockRecord({ industry: 'tech', size: 'startup' });

      expect(engine.routeRecord(matchingRecord)).not.toBeNull();
      expect(engine.routeRecord(partialMatchRecord)).toBeNull();
    });
  });
});

describe('RoutingRuleBuilder', () => {
  it('should build a valid routing rule', () => {
    const rule = new RoutingRuleBuilder('Test Rule')
      .priority(10)
      .condition('industry', 'equals', 'tech')
      .assignToUser('user-123')
      .build();

    expect(rule.name).toBe('Test Rule');
    expect(rule.priority).toBe(10);
    expect(rule.conditions.length).toBe(1);
    expect(rule.assignTo.targetId).toBe('user-123');
  });

  it('should build a rule with round robin', () => {
    const rule = new RoutingRuleBuilder('Round Robin Rule')
      .condition('status', 'equals', 'new')
      .assignRoundRobin(['user-1', 'user-2', 'user-3'])
      .build();

    expect(rule.assignTo.type).toBe('round_robin');
    expect(rule.assignTo.targetIds).toEqual(['user-1', 'user-2', 'user-3']);
  });

  it('should throw when no assignment target', () => {
    expect(() => {
      new RoutingRuleBuilder('Invalid Rule')
        .condition('status', 'equals', 'new')
        .build();
    }).toThrow('Routing rule must have an assignment target');
  });

  it('should use default priority', () => {
    const rule = new RoutingRuleBuilder('Default Priority')
      .assignToUser('user-123')
      .build();

    expect(rule.priority).toBe(100);
  });
});
