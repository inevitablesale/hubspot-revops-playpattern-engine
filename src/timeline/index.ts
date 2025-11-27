/**
 * Timeline Events Module
 * Manages timeline events for tracking applied plays in HubSpot
 */

import { Client } from '@hubspot/api-client';
import { TimelineEvent, Play, CRMRecord, ObjectType } from '../types';
import { generateId } from '../utils';

/**
 * Event type definitions for the timeline
 */
export const TIMELINE_EVENT_TYPES = {
  PLAY_APPLIED: 'play_applied',
  PLAY_COMPLETED: 'play_completed',
  PLAY_ABANDONED: 'play_abandoned',
  ACTION_COMPLETED: 'action_completed',
  RECOMMENDATION_SHOWN: 'recommendation_shown',
} as const;

/**
 * Timeline event template for HubSpot
 */
export interface TimelineEventTemplate {
  id?: string;
  objectType: string;
  name: string;
  headerTemplate: string;
  detailTemplate: string;
  tokens: TimelineTokenDefinition[];
}

/**
 * Token definition for timeline templates
 */
export interface TimelineTokenDefinition {
  name: string;
  label: string;
  type: 'string' | 'number' | 'date' | 'enumeration';
  options?: { label: string; value: string }[];
}

/**
 * TimelineManager handles timeline event creation and management
 */
export class TimelineManager {
  private appId: string;
  private eventTypeId?: string;

  constructor(appId: string) {
    this.appId = appId;
  }

  /**
   * Set the event type ID after registration
   */
  setEventTypeId(eventTypeId: string): void {
    this.eventTypeId = eventTypeId;
  }

  /**
   * Create a timeline event for an applied play
   */
  createPlayAppliedEvent(
    record: CRMRecord,
    play: Play,
    userId?: string
  ): TimelineEvent {
    return {
      id: generateId('event'),
      eventType: TIMELINE_EVENT_TYPES.PLAY_APPLIED,
      timestamp: new Date(),
      playId: play.id,
      description: `Play "${play.name}" was applied to this record.`,
      metadata: {
        playName: play.name,
        playScore: play.score,
        playWinRate: play.winRate,
        appliedBy: userId,
        recordType: record.objectType,
      },
    };
  }

  /**
   * Create a timeline event for a completed play
   */
  createPlayCompletedEvent(
    record: CRMRecord,
    play: Play,
    outcome: 'success' | 'failure'
  ): TimelineEvent {
    return {
      id: generateId('event'),
      eventType: TIMELINE_EVENT_TYPES.PLAY_COMPLETED,
      timestamp: new Date(),
      playId: play.id,
      description: `Play "${play.name}" was completed with outcome: ${outcome}.`,
      metadata: {
        playName: play.name,
        outcome,
        recordType: record.objectType,
      },
    };
  }

  /**
   * Create a timeline event for an abandoned play
   */
  createPlayAbandonedEvent(
    record: CRMRecord,
    play: Play,
    reason: string
  ): TimelineEvent {
    return {
      id: generateId('event'),
      eventType: TIMELINE_EVENT_TYPES.PLAY_ABANDONED,
      timestamp: new Date(),
      playId: play.id,
      description: `Play "${play.name}" was abandoned. Reason: ${reason}`,
      metadata: {
        playName: play.name,
        abandonReason: reason,
        recordType: record.objectType,
      },
    };
  }

  /**
   * Create a timeline event for a completed action
   */
  createActionCompletedEvent(
    record: CRMRecord,
    playId: string,
    actionType: string,
    actionDescription: string
  ): TimelineEvent {
    return {
      id: generateId('event'),
      eventType: TIMELINE_EVENT_TYPES.ACTION_COMPLETED,
      timestamp: new Date(),
      playId,
      description: `Action completed: ${actionDescription}`,
      metadata: {
        actionType,
        recordType: record.objectType,
      },
    };
  }

  /**
   * Get the timeline event template for play events
   */
  getPlayEventTemplate(): TimelineEventTemplate {
    return {
      objectType: 'deals',
      name: 'RevOps Play Event',
      headerTemplate: '{{playName}} - {{eventType}}',
      detailTemplate: '{{description}}\n\nPlay Score: {{playScore}}\nWin Rate: {{playWinRate}}%',
      tokens: [
        { name: 'playName', label: 'Play Name', type: 'string' },
        { name: 'playScore', label: 'Play Score', type: 'number' },
        { name: 'playWinRate', label: 'Win Rate', type: 'number' },
        { name: 'eventType', label: 'Event Type', type: 'string' },
        { name: 'description', label: 'Description', type: 'string' },
        {
          name: 'outcome',
          label: 'Outcome',
          type: 'enumeration',
          options: [
            { label: 'Success', value: 'success' },
            { label: 'Failure', value: 'failure' },
          ],
        },
      ],
    };
  }

  /**
   * Format event for HubSpot API submission
   */
  formatForHubSpot(event: TimelineEvent, objectId: string): HubSpotTimelineEventPayload {
    return {
      eventTemplateId: this.eventTypeId || '',
      objectId,
      timestamp: event.timestamp.toISOString(),
      tokens: {
        playName: String(event.metadata?.playName || ''),
        playScore: String(event.metadata?.playScore || 0),
        playWinRate: String(Math.round((Number(event.metadata?.playWinRate) || 0) * 100)),
        eventType: event.eventType,
        description: event.description,
        outcome: String(event.metadata?.outcome || ''),
      },
    };
  }
}

/**
 * HubSpot Timeline Event API payload
 */
export interface HubSpotTimelineEventPayload {
  eventTemplateId: string;
  objectId: string;
  timestamp: string;
  tokens: Record<string, string>;
}

/**
 * HubSpotTimelineClient wraps HubSpot API for timeline operations
 */
export class HubSpotTimelineClient {
  private client: Client;
  private manager: TimelineManager;

  constructor(accessToken: string, appId: string) {
    this.client = new Client({ accessToken });
    this.manager = new TimelineManager(appId);
  }

  /**
   * Register timeline event type with HubSpot
   */
  async registerEventType(template: TimelineEventTemplate): Promise<string> {
    // Note: Timeline API registration would be done here
    // This is a placeholder for the actual API call
    const eventTypeId = generateId('evt_type');
    this.manager.setEventTypeId(eventTypeId);
    return eventTypeId;
  }

  /**
   * Create a timeline event in HubSpot
   */
  async createEvent(
    event: TimelineEvent,
    objectType: ObjectType,
    objectId: string
  ): Promise<void> {
    const payload = this.manager.formatForHubSpot(event, objectId);

    // In production, this would call:
    // await this.client.crm.timeline.eventsApi.create(payload);

    // For now, we log the event
    console.log(`Timeline event created for ${objectType}/${objectId}:`, payload);
  }

  /**
   * Get timeline manager instance
   */
  getManager(): TimelineManager {
    return this.manager;
  }
}

/**
 * Create timeline events for batch operations
 */
export function createBatchTimelineEvents(
  records: CRMRecord[],
  play: Play,
  eventType: keyof typeof TIMELINE_EVENT_TYPES
): TimelineEvent[] {
  const manager = new TimelineManager('batch');

  return records.map((record) => {
    switch (eventType) {
      case 'PLAY_APPLIED':
        return manager.createPlayAppliedEvent(record, play);
      case 'PLAY_COMPLETED':
        return manager.createPlayCompletedEvent(record, play, 'success');
      case 'PLAY_ABANDONED':
        return manager.createPlayAbandonedEvent(record, play, 'Batch operation');
      default:
        return manager.createPlayAppliedEvent(record, play);
    }
  });
}
