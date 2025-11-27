# HubSpot RevOps PlayPattern Engine

Installable HubSpot app + Breeze Agent that analyzes historical lifecycle data across Leads, Deals, Jobs, Placements, and Contracts. Generates recommendations for each record based on persona, funding stage, service line, and past success patterns. Helps GTM and CS teams replicate top-performing motions and accelerate revenue outcomes.

## Features

- **OAuth 2.0 Integration**: Secure connection to HubSpot accounts
- **Pattern Mining Engine**: Discovers winning plays from historical CRM data
- **Play Scoring**: Ranks plays based on win rate, sample size, recency, and similarity
- **CRM Card Output**: Display recommendations directly in HubSpot record views
- **Recommended Sequences**: Optimal action sequences for each play
- **Routing Logic**: Automatic record assignment based on play patterns
- **Timeline Events**: Track applied plays in HubSpot timeline
- **Property Updates**: Store play IDs and status on records

## Quick Start

### Prerequisites

- Node.js >= 18.0.0
- npm or yarn
- HubSpot Developer Account

### Installation

```bash
# Clone the repository
git clone https://github.com/inevitablesale/hubspot-revops-playpattern-engine.git
cd hubspot-revops-playpattern-engine

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Build the project
npm run build
```

### Configuration

Edit `.env` with your HubSpot app credentials:

```env
HUBSPOT_CLIENT_ID=your_client_id_here
HUBSPOT_CLIENT_SECRET=your_client_secret_here
HUBSPOT_REDIRECT_URI=http://localhost:3000/oauth/callback
PORT=3000
```

### Running the App

```bash
# Development mode
npm run dev

# Production mode
npm start
```

## API Endpoints

### OAuth

- `GET /oauth/authorize` - Initiate OAuth flow
- `GET /oauth/callback` - OAuth callback handler

### CRM Card

- `GET /api/crm-card` - Get CRM card data for a record
  - Query params: `objectType`, `objectId`, `appliedPlayId` (optional)

### Plays

- `GET /api/plays` - List all discovered plays
- `GET /api/plays/:playId` - Get a specific play
- `POST /api/plays/:playId/apply` - Apply a play to a record

### Recommendations

- `GET /api/recommendations` - Get recommendations for a record
  - Query params: `objectType`, `objectId`

### Sequences

- `GET /api/sequence/:playId` - Get recommended sequence for a play
  - Query params: `objectType`, `objectId`

### Pattern Mining

- `POST /api/mine` - Mine patterns from historical data
  - Body: `{ data: HistoricalDataPoint[] }`

### Routing

- `POST /api/route` - Route a record based on configured rules
  - Body: `CRMRecord`

## Architecture

```
src/
├── index.ts           # Main application entry point
├── oauth/             # HubSpot OAuth 2.0 implementation
├── patterns/          # Pattern mining engine
├── scoring/           # Play scoring and ranking
├── sequences/         # Action sequence management
├── routing/           # Record routing logic
├── timeline/          # Timeline event creation
├── properties/        # CRM property updates
├── cards/             # CRM card generation
├── types/             # TypeScript type definitions
└── utils/             # Utility functions
```

## Usage Examples

### Mining Patterns

```typescript
import { PlayPatternEngine } from 'hubspot-revops-playpattern-engine';

const engine = new PlayPatternEngine();

// Historical data from your CRM
const historicalData = [
  {
    recordId: 'deal-1',
    objectType: 'deals',
    outcome: 'won',
    properties: { industry: 'tech', size: 'enterprise' },
    actions: [
      { id: 'a1', type: 'email', timestamp: new Date() },
      { id: 'a2', type: 'call', timestamp: new Date() },
    ],
    timeline: [],
    createdAt: new Date('2024-01-01'),
    closedAt: new Date('2024-02-15'),
    daysToClose: 45,
  },
  // ... more records
];

// Discover winning patterns
const plays = await engine.minePatterns(historicalData);
console.log(`Discovered ${plays.length} winning plays`);
```

### Getting Recommendations

```typescript
const record = {
  id: 'deal-123',
  objectType: 'deals',
  properties: { industry: 'tech', amount: 50000 },
  createdAt: new Date(),
  updatedAt: new Date(),
};

const recommendations = engine.getRecommendations(record);
console.log('Top recommendation:', recommendations[0].playName);
console.log('Score:', recommendations[0].score);
```

### Setting Up Routing Rules

```typescript
import { RoutingRuleBuilder } from 'hubspot-revops-playpattern-engine';

const rule = new RoutingRuleBuilder('High Value Tech Deals')
  .priority(1)
  .condition('industry', 'equals', 'tech')
  .condition('amount', 'greaterThan', 100000)
  .assignToUser('user-123')
  .build();

engine.addRoutingRule(rule);
```

## HubSpot App Setup

1. Create a new app in your [HubSpot Developer Account](https://developers.hubspot.com/)

2. Configure OAuth scopes:
   - `crm.objects.contacts.read`
   - `crm.objects.contacts.write`
   - `crm.objects.deals.read`
   - `crm.objects.deals.write`
   - `crm.objects.custom.read`
   - `crm.objects.custom.write`
   - `timeline`
   - `crm.schemas.custom.read`
   - `oauth`

3. Set redirect URI to match your `HUBSPOT_REDIRECT_URI`

4. Create a CRM card pointing to your `/api/crm-card` endpoint

5. Create custom properties for play tracking (optional, can be done programmatically)

## Testing

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

## Development

```bash
# Type checking
npm run lint

# Build
npm run build

# Clean build artifacts
npm run clean
```

## Play Properties

The engine uses the following custom properties on records:

| Property | Description |
|----------|-------------|
| `applied_play_id` | ID of the currently applied play |
| `applied_play_name` | Name of the applied play |
| `play_applied_date` | When the play was applied |
| `play_score` | Score of the applied play |
| `play_status` | Status: applied, in_progress, completed, abandoned |
| `recommended_play_ids` | Semicolon-separated list of recommended play IDs |

## Timeline Events

The engine creates the following timeline events:

- **Play Applied**: When a play is applied to a record
- **Play Completed**: When a play reaches completion
- **Play Abandoned**: When a play is abandoned
- **Action Completed**: When an action in a sequence is completed

## License

ISC

