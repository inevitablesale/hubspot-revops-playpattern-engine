# API Reference

## Overview

The HubSpot RevOps PlayPattern Engine provides a RESTful API for pattern mining, play recommendations, and CRM integration.

## Authentication

The API uses HubSpot OAuth 2.0 for authentication. After completing the OAuth flow, include the access token in requests that require authentication.

---

## OAuth Endpoints

### Initiate OAuth Flow

```
GET /oauth/authorize
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `state` | string | Optional state parameter for CSRF protection |

**Response:** Redirects to HubSpot OAuth page

---

### OAuth Callback

```
GET /oauth/callback
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `code` | string | Authorization code from HubSpot |

**Response:**
```json
{
  "success": true,
  "portalId": "12345678",
  "message": "Successfully connected to HubSpot"
}
```

---

## Play Endpoints

### List All Plays

```
GET /api/plays
```

**Response:**
```json
{
  "plays": [
    {
      "id": "play_abc123",
      "name": "Enterprise Tech Play",
      "description": "Optimized for enterprise tech deals",
      "score": 85,
      "winRate": 0.72,
      "sampleSize": 150,
      "confidence": 0.85,
      "avgDaysToClose": 35,
      "applicableObjectTypes": ["deals"],
      "pattern": {
        "conditions": [...],
        "requiredActions": ["email", "call", "demo"],
        "optimalSequence": [...]
      }
    }
  ]
}
```

---

### Get Play by ID

```
GET /api/plays/:playId
```

**Path Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `playId` | string | Unique play identifier |

**Response:**
```json
{
  "play": {
    "id": "play_abc123",
    "name": "Enterprise Tech Play",
    ...
  }
}
```

---

### Apply Play to Record

```
POST /api/plays/:playId/apply
```

**Path Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `playId` | string | Play ID to apply |

**Request Body:**
```json
{
  "objectType": "deals",
  "objectId": "12345",
  "accessToken": "your_hubspot_access_token"
}
```

**Response:**
```json
{
  "success": true,
  "result": {
    "objectId": "12345",
    "updatedProperties": ["applied_play_id", "applied_play_name", "play_applied_date", "play_score", "play_status"]
  }
}
```

---

## CRM Card Endpoint

### Get CRM Card Data

```
GET /api/crm-card
```

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `objectType` | string | Yes | Type: leads, deals, jobs, placements, contracts |
| `objectId` | string | Yes | HubSpot object ID |
| `appliedPlayId` | string | No | Currently applied play ID |

**Response:**
```json
{
  "results": [
    {
      "objectId": 1,
      "title": "Enterprise Tech Play",
      "properties": [
        { "label": "Score", "dataType": "NUMBER", "value": 85 },
        { "label": "Match", "dataType": "STRING", "value": "92%" },
        { "label": "Win Rate", "dataType": "STRING", "value": "+22%" },
        { "label": "Confidence", "dataType": "STRING", "value": "85%" }
      ],
      "actions": [
        {
          "type": "ACTION_HOOK",
          "label": "Apply This Play",
          "httpMethod": "POST",
          "uri": "/api/plays/play_abc123/apply"
        }
      ]
    }
  ],
  "primaryAction": {
    "type": "CONFIRMATION_ACTION_HOOK",
    "label": "Apply Top Play",
    "httpMethod": "POST",
    "uri": "/api/plays/apply"
  },
  "secondaryActions": [
    {
      "type": "IFRAME",
      "label": "View All Plays",
      "uri": "/plays?objectId=12345&objectType=deals"
    }
  ]
}
```

---

## Recommendations Endpoint

### Get Recommendations for Record

```
GET /api/recommendations
```

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `objectType` | string | Yes | Type: leads, deals, jobs, placements, contracts |
| `objectId` | string | Yes | Record ID |

**Response:**
```json
{
  "recommendations": [
    {
      "playId": "play_abc123",
      "playName": "Enterprise Tech Play",
      "score": 85.5,
      "confidence": 0.85,
      "matchPercentage": 0.92,
      "reasoning": "This play has a 72% win rate based on 150 similar records...",
      "nextActions": [
        {
          "order": 1,
          "actionType": "email",
          "description": "Send introduction email",
          "urgency": "high",
          "dueDate": "2024-01-15T00:00:00.000Z"
        }
      ],
      "estimatedImpact": {
        "winRateIncrease": 0.22,
        "daysToCloseReduction": 4
      }
    }
  ]
}
```

---

## Sequence Endpoint

### Get Recommended Sequence

```
GET /api/sequence/:playId
```

**Path Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `playId` | string | Play ID |

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `objectType` | string | Yes | Object type |
| `objectId` | string | Yes | Record ID |

**Response:**
```json
{
  "sequence": [
    {
      "order": 1,
      "actionType": "email",
      "description": "Send introduction email",
      "urgency": "high",
      "dueDate": "2024-01-15T00:00:00.000Z"
    },
    {
      "order": 2,
      "actionType": "call",
      "description": "Discovery call",
      "urgency": "medium",
      "dueDate": "2024-01-17T00:00:00.000Z"
    }
  ]
}
```

---

## Pattern Mining Endpoint

### Mine Patterns from Historical Data

```
POST /api/mine
```

**Request Body:**
```json
{
  "data": [
    {
      "recordId": "deal-1",
      "objectType": "deals",
      "outcome": "won",
      "properties": {
        "industry": "tech",
        "size": "enterprise",
        "amount": 50000
      },
      "actions": [
        { "id": "a1", "type": "email", "timestamp": "2024-01-01T10:00:00Z" },
        { "id": "a2", "type": "call", "timestamp": "2024-01-03T14:00:00Z" }
      ],
      "timeline": [],
      "persona": "CTO",
      "fundingStage": "Series B",
      "serviceLine": "Consulting",
      "createdAt": "2024-01-01T00:00:00Z",
      "closedAt": "2024-02-15T00:00:00Z",
      "daysToClose": 45
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "playsDiscovered": 5,
  "plays": [...]
}
```

---

## Routing Endpoint

### Route a Record

```
POST /api/route
```

**Request Body:**
```json
{
  "id": "record-123",
  "objectType": "deals",
  "properties": {
    "industry": "tech",
    "size": "enterprise",
    "amount": 75000
  },
  "createdAt": "2024-01-01T00:00:00Z",
  "updatedAt": "2024-01-01T00:00:00Z"
}
```

**Response:**
```json
{
  "decision": {
    "recordId": "record-123",
    "ruleId": "rule_xyz789",
    "ruleName": "High Value Tech Deals",
    "assignmentType": "user",
    "assigneeId": "user-123",
    "reason": "Matched rule \"High Value Tech Deals\": industry equals tech AND amount greaterThan 50000",
    "priority": 1
  }
}
```

---

## Health Check

### Check Service Health

```
GET /health
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T12:00:00.000Z"
}
```

---

## Error Responses

All endpoints may return the following error responses:

### 400 Bad Request
```json
{
  "error": "Missing required field: objectType"
}
```

### 404 Not Found
```json
{
  "error": "Play not found"
}
```

### 500 Internal Server Error
```json
{
  "error": "Internal server error",
  "message": "Detailed error message (development only)"
}
```

---

## Data Types

### ObjectType
```typescript
type ObjectType = 'leads' | 'deals' | 'jobs' | 'placements' | 'contracts';
```

### RecordOutcome
```typescript
type RecordOutcome = 'won' | 'lost' | 'pending' | 'active';
```

### PatternCondition
```typescript
interface PatternCondition {
  field: string;
  operator: 'equals' | 'contains' | 'greaterThan' | 'lessThan' | 'in' | 'notIn' | 'exists' | 'notExists';
  value: string | number | boolean | string[] | number[];
}
```

### PlayStatus
```typescript
type PlayStatus = 'applied' | 'in_progress' | 'completed' | 'abandoned';
```
