/**
 * Property Updates Module
 * Manages play ID property updates on CRM records
 */

import { Client } from '@hubspot/api-client';
import { CRMRecord, ObjectType, Play } from '../types';

/**
 * Property definitions for play tracking
 */
export const PLAY_PROPERTIES = {
  APPLIED_PLAY_ID: 'applied_play_id',
  APPLIED_PLAY_NAME: 'applied_play_name',
  PLAY_APPLIED_DATE: 'play_applied_date',
  PLAY_SCORE: 'play_score',
  PLAY_STATUS: 'play_status',
  RECOMMENDED_PLAY_IDS: 'recommended_play_ids',
} as const;

/**
 * Play status values
 */
export type PlayStatus = 'applied' | 'in_progress' | 'completed' | 'abandoned';

/**
 * Property update request
 */
export interface PropertyUpdateRequest {
  objectType: ObjectType;
  objectId: string;
  properties: Record<string, string | number | boolean>;
}

/**
 * Property update result
 */
export interface PropertyUpdateResult {
  success: boolean;
  objectId: string;
  updatedProperties: string[];
  error?: string;
}

/**
 * PropertyManager handles play-related property updates
 */
export class PropertyManager {
  private client: Client | null = null;

  constructor(accessToken?: string) {
    if (accessToken) {
      this.client = new Client({ accessToken });
    }
  }

  /**
   * Set HubSpot client with access token
   */
  setClient(accessToken: string): void {
    this.client = new Client({ accessToken });
  }

  /**
   * Apply a play to a record by updating properties
   */
  async applyPlayToRecord(
    objectType: ObjectType,
    objectId: string,
    play: Play
  ): Promise<PropertyUpdateResult> {
    const properties = {
      [PLAY_PROPERTIES.APPLIED_PLAY_ID]: play.id,
      [PLAY_PROPERTIES.APPLIED_PLAY_NAME]: play.name,
      [PLAY_PROPERTIES.PLAY_APPLIED_DATE]: new Date().toISOString(),
      [PLAY_PROPERTIES.PLAY_SCORE]: play.score.toString(),
      [PLAY_PROPERTIES.PLAY_STATUS]: 'applied' as PlayStatus,
    };

    return this.updateRecordProperties(objectType, objectId, properties);
  }

  /**
   * Update play status on a record
   */
  async updatePlayStatus(
    objectType: ObjectType,
    objectId: string,
    status: PlayStatus
  ): Promise<PropertyUpdateResult> {
    const properties = {
      [PLAY_PROPERTIES.PLAY_STATUS]: status,
    };

    return this.updateRecordProperties(objectType, objectId, properties);
  }

  /**
   * Store recommended play IDs on a record
   */
  async storeRecommendedPlays(
    objectType: ObjectType,
    objectId: string,
    playIds: string[]
  ): Promise<PropertyUpdateResult> {
    const properties = {
      [PLAY_PROPERTIES.RECOMMENDED_PLAY_IDS]: playIds.join(';'),
    };

    return this.updateRecordProperties(objectType, objectId, properties);
  }

  /**
   * Clear play properties from a record
   */
  async clearPlayProperties(
    objectType: ObjectType,
    objectId: string
  ): Promise<PropertyUpdateResult> {
    const properties = {
      [PLAY_PROPERTIES.APPLIED_PLAY_ID]: '',
      [PLAY_PROPERTIES.APPLIED_PLAY_NAME]: '',
      [PLAY_PROPERTIES.PLAY_APPLIED_DATE]: '',
      [PLAY_PROPERTIES.PLAY_SCORE]: '',
      [PLAY_PROPERTIES.PLAY_STATUS]: '',
    };

    return this.updateRecordProperties(objectType, objectId, properties);
  }

  /**
   * Update record properties in HubSpot
   */
  private async updateRecordProperties(
    objectType: ObjectType,
    objectId: string,
    properties: Record<string, string>
  ): Promise<PropertyUpdateResult> {
    try {
      if (!this.client) {
        // Return mock result when no client is available
        return {
          success: true,
          objectId,
          updatedProperties: Object.keys(properties),
        };
      }

      const apiObjectType = this.mapObjectTypeToApi(objectType);
      
      await this.client.crm.objects.basicApi.update(
        apiObjectType,
        objectId,
        { properties }
      );

      return {
        success: true,
        objectId,
        updatedProperties: Object.keys(properties),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        objectId,
        updatedProperties: [],
        error: errorMessage,
      };
    }
  }

  /**
   * Map internal object type to HubSpot API object type
   */
  private mapObjectTypeToApi(objectType: ObjectType): string {
    const mapping: Record<ObjectType, string> = {
      leads: 'contacts',
      deals: 'deals',
      jobs: 'jobs',
      placements: 'placements',
      contracts: 'contracts',
    };
    return mapping[objectType] || objectType;
  }

  /**
   * Batch update properties for multiple records
   */
  async batchApplyPlay(
    records: Array<{ objectType: ObjectType; objectId: string }>,
    play: Play
  ): Promise<PropertyUpdateResult[]> {
    const results: PropertyUpdateResult[] = [];

    for (const record of records) {
      const result = await this.applyPlayToRecord(
        record.objectType,
        record.objectId,
        play
      );
      results.push(result);
    }

    return results;
  }
}

/**
 * Property schema definitions for HubSpot property creation
 */
export const PLAY_PROPERTY_SCHEMAS = [
  {
    name: PLAY_PROPERTIES.APPLIED_PLAY_ID,
    label: 'Applied Play ID',
    type: 'string',
    fieldType: 'text',
    groupName: 'revops_plays',
    description: 'The ID of the currently applied RevOps play',
  },
  {
    name: PLAY_PROPERTIES.APPLIED_PLAY_NAME,
    label: 'Applied Play Name',
    type: 'string',
    fieldType: 'text',
    groupName: 'revops_plays',
    description: 'The name of the currently applied RevOps play',
  },
  {
    name: PLAY_PROPERTIES.PLAY_APPLIED_DATE,
    label: 'Play Applied Date',
    type: 'datetime',
    fieldType: 'date',
    groupName: 'revops_plays',
    description: 'When the play was applied to this record',
  },
  {
    name: PLAY_PROPERTIES.PLAY_SCORE,
    label: 'Play Score',
    type: 'number',
    fieldType: 'number',
    groupName: 'revops_plays',
    description: 'The score of the applied play',
  },
  {
    name: PLAY_PROPERTIES.PLAY_STATUS,
    label: 'Play Status',
    type: 'enumeration',
    fieldType: 'select',
    groupName: 'revops_plays',
    description: 'Current status of the applied play',
    options: [
      { label: 'Applied', value: 'applied' },
      { label: 'In Progress', value: 'in_progress' },
      { label: 'Completed', value: 'completed' },
      { label: 'Abandoned', value: 'abandoned' },
    ],
  },
  {
    name: PLAY_PROPERTIES.RECOMMENDED_PLAY_IDS,
    label: 'Recommended Play IDs',
    type: 'string',
    fieldType: 'text',
    groupName: 'revops_plays',
    description: 'Semicolon-separated list of recommended play IDs',
  },
];

/**
 * Create property group for RevOps plays
 */
export const PLAY_PROPERTY_GROUP = {
  name: 'revops_plays',
  label: 'RevOps Plays',
  displayOrder: -1,
};
