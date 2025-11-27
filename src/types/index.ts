/**
 * HubSpot RevOps PlayPattern Engine - Type Definitions
 */

/**
 * Supported CRM object types
 */
export type ObjectType = 'leads' | 'deals' | 'jobs' | 'placements' | 'contracts';

/**
 * Record status indicating outcome
 */
export type RecordOutcome = 'won' | 'lost' | 'pending' | 'active';

/**
 * Base CRM record interface
 */
export interface CRMRecord {
  id: string;
  objectType: ObjectType;
  properties: Record<string, string | number | boolean | null>;
  createdAt: Date;
  updatedAt: Date;
  associations?: RecordAssociation[];
}

/**
 * Record association to other objects
 */
export interface RecordAssociation {
  toObjectType: ObjectType;
  toObjectId: string;
  associationType: string;
}

/**
 * Historical data point used for pattern analysis
 */
export interface HistoricalDataPoint {
  recordId: string;
  objectType: ObjectType;
  outcome: RecordOutcome;
  properties: Record<string, string | number | boolean | null>;
  actions: RecordAction[];
  timeline: TimelineEvent[];
  persona?: string;
  fundingStage?: string;
  serviceLine?: string;
  createdAt: Date;
  closedAt?: Date;
  daysToClose?: number;
}

/**
 * Action taken on a record
 */
export interface RecordAction {
  id: string;
  type: string;
  timestamp: Date;
  userId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Timeline event for tracking plays
 */
export interface TimelineEvent {
  id?: string;
  eventType: string;
  timestamp: Date;
  playId?: string;
  description: string;
  metadata?: Record<string, unknown>;
}

/**
 * A discovered pattern/play from historical data
 */
export interface Play {
  id: string;
  name: string;
  description: string;
  pattern: PlayPattern;
  score: number;
  confidence: number;
  sampleSize: number;
  winRate: number;
  avgDaysToClose: number;
  applicableObjectTypes: ObjectType[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Pattern criteria that defines a play
 */
export interface PlayPattern {
  conditions: PatternCondition[];
  requiredActions: string[];
  optimalSequence: ActionSequence[];
  routingRules?: RoutingRule[];
}

/**
 * Condition for pattern matching
 */
export interface PatternCondition {
  field: string;
  operator: 'equals' | 'contains' | 'greaterThan' | 'lessThan' | 'in' | 'notIn' | 'exists' | 'notExists';
  value: string | number | boolean | string[] | number[];
}

/**
 * Sequence of actions in optimal order
 */
export interface ActionSequence {
  order: number;
  actionType: string;
  description: string;
  timing?: {
    minDays?: number;
    maxDays?: number;
    optimalDay?: number;
  };
  metadata?: Record<string, unknown>;
}

/**
 * Routing rule for record assignment
 */
export interface RoutingRule {
  id: string;
  name: string;
  priority: number;
  conditions: PatternCondition[];
  assignTo: {
    type: 'user' | 'team' | 'round_robin';
    targetId?: string;
    targetIds?: string[];
  };
}

/**
 * Play recommendation for an active record
 */
export interface PlayRecommendation {
  playId: string;
  playName: string;
  score: number;
  confidence: number;
  matchPercentage: number;
  nextActions: RecommendedAction[];
  reasoning: string;
  estimatedImpact: {
    winRateIncrease?: number;
    daysToCloseReduction?: number;
  };
}

/**
 * Recommended next action
 */
export interface RecommendedAction {
  order: number;
  actionType: string;
  description: string;
  urgency: 'high' | 'medium' | 'low';
  dueDate?: Date;
  metadata?: Record<string, unknown>;
}

/**
 * CRM card data structure for display
 */
export interface CRMCardData {
  objectId: string;
  objectType: ObjectType;
  title: string;
  topRecommendation?: PlayRecommendation;
  allRecommendations: PlayRecommendation[];
  appliedPlayId?: string;
  sections: CRMCardSection[];
}

/**
 * Section in a CRM card
 */
export interface CRMCardSection {
  id: string;
  title: string;
  type: 'text' | 'list' | 'status' | 'actions';
  content: unknown;
}

/**
 * OAuth token data
 */
export interface OAuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  portalId?: string;
}

/**
 * Play scoring weights
 */
export interface ScoringWeights {
  winRate: number;
  sampleSize: number;
  recency: number;
  similarity: number;
}

/**
 * Pattern mining configuration
 */
export interface PatternMiningConfig {
  minSampleSize: number;
  minWinRate: number;
  minConfidence: number;
  lookbackDays: number;
  objectTypes: ObjectType[];
}

/**
 * API response wrapper
 */
export interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}
