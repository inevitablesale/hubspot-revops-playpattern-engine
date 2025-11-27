# HubSpot App Setup Guide

This guide walks you through setting up the RevOps PlayPattern Engine as a HubSpot app.

## Prerequisites

- HubSpot Developer Account ([Sign up here](https://developers.hubspot.com/))
- Node.js 18+ installed
- Access to a HubSpot portal for testing

## Step 1: Create a HubSpot App

1. Log in to your [HubSpot Developer Account](https://developers.hubspot.com/)

2. Navigate to **Apps** in the top navigation

3. Click **Create app**

4. Fill in the app details:
   - **App name**: RevOps PlayPattern Engine
   - **Description**: Analyzes historical data to discover winning sales patterns and recommend next actions
   - **Logo**: Upload your app logo (optional)

5. Click **Create app**

## Step 2: Configure OAuth

1. In your app settings, go to the **Auth** tab

2. Add the following **Scopes**:
   - `crm.objects.contacts.read`
   - `crm.objects.contacts.write`
   - `crm.objects.deals.read`
   - `crm.objects.deals.write`
   - `crm.objects.custom.read`
   - `crm.objects.custom.write`
   - `timeline`
   - `crm.schemas.custom.read`
   - `oauth`

3. Set the **Redirect URL**:
   - For local development: `http://localhost:3000/oauth/callback`
   - For production: `https://your-domain.com/oauth/callback`

4. Save your changes

5. Copy your **Client ID** and **Client Secret** - you'll need these for configuration

## Step 3: Create CRM Cards

1. In your app settings, go to the **CRM cards** tab

2. Click **Create card**

3. Configure the card:
   - **Card name**: Play Recommendations
   - **Target object types**: Contacts, Deals, and any custom objects you want
   - **Data fetch URL**: `https://your-domain.com/api/crm-card`
   - **Properties to send**: Select the properties you want sent to your endpoint

4. Card Settings:
   - Enable **Use custom primary action**
   - Enable **Include secondary actions**

5. Save the card

## Step 4: Create Custom Properties

Create a property group and properties in HubSpot to track play data:

### Using HubSpot UI

1. Go to **Settings** > **Properties** in your HubSpot portal

2. Create a new property group:
   - Name: `RevOps Plays`
   - Object: Deals (and any other objects you need)

3. Create the following properties:

| Property Name | Label | Type | Field Type |
|--------------|-------|------|------------|
| `applied_play_id` | Applied Play ID | Single-line text | Text input |
| `applied_play_name` | Applied Play Name | Single-line text | Text input |
| `play_applied_date` | Play Applied Date | Date picker | Date picker |
| `play_score` | Play Score | Number | Number |
| `play_status` | Play Status | Dropdown | Dropdown (options: Applied, In Progress, Completed, Abandoned) |
| `recommended_play_ids` | Recommended Play IDs | Single-line text | Text input |

### Using the API

You can also create properties programmatically:

```javascript
const hubspot = require('@hubspot/api-client');

const client = new hubspot.Client({ accessToken: 'your_access_token' });

// Create property group
await client.crm.properties.groupsApi.create('deals', {
  name: 'revops_plays',
  label: 'RevOps Plays',
  displayOrder: -1,
});

// Create properties
const properties = [
  {
    name: 'applied_play_id',
    label: 'Applied Play ID',
    type: 'string',
    fieldType: 'text',
    groupName: 'revops_plays',
  },
  // ... add other properties
];

for (const prop of properties) {
  await client.crm.properties.coreApi.create('deals', prop);
}
```

## Step 5: Configure Timeline Events (Optional)

If you want to track play events in the HubSpot timeline:

1. Go to **Features** > **Timeline events** in your app settings

2. Create an event template:
   - **Name**: RevOps Play Event
   - **Object type**: Deals
   - **Header template**: `{{playName}} - {{eventType}}`
   - **Detail template**: `{{description}}\n\nPlay Score: {{playScore}}\nWin Rate: {{playWinRate}}%`

3. Add token definitions:
   - `playName` (string)
   - `playScore` (number)
   - `playWinRate` (number)
   - `eventType` (string)
   - `description` (string)
   - `outcome` (enumeration: success, failure)

4. Save the template and note the Event Template ID

## Step 6: Deploy Your Application

### Local Development

1. Configure your environment:

```bash
cp .env.example .env
```

2. Edit `.env` with your credentials:

```env
HUBSPOT_CLIENT_ID=your_client_id
HUBSPOT_CLIENT_SECRET=your_client_secret
HUBSPOT_REDIRECT_URI=http://localhost:3000/oauth/callback
PORT=3000
BASE_URL=http://localhost:3000
```

3. Install dependencies and run:

```bash
npm install
npm run dev
```

### Production Deployment

#### Option 1: Docker

```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY dist ./dist

EXPOSE 3000

CMD ["node", "dist/index.js"]
```

#### Option 2: Cloud Platforms

Deploy to your preferred platform:
- **Heroku**: Use the Node.js buildpack
- **AWS**: Deploy to Elastic Beanstalk or ECS
- **Google Cloud**: Deploy to Cloud Run or App Engine
- **Vercel/Railway**: Connect your GitHub repository

Remember to set environment variables in your deployment platform.

## Step 7: Test the Integration

1. Start your local server:

```bash
npm run dev
```

2. Initiate OAuth flow by visiting:
   `http://localhost:3000/oauth/authorize`

3. Authorize the app in HubSpot

4. Once connected, test the CRM card by viewing a Deal in HubSpot

5. You should see the Play Recommendations card with actions

## Step 8: Load Historical Data

To discover patterns, you need to load historical data:

```bash
curl -X POST http://localhost:3000/api/mine \
  -H "Content-Type: application/json" \
  -d '{
    "data": [
      {
        "recordId": "deal-1",
        "objectType": "deals",
        "outcome": "won",
        "properties": {
          "industry": "tech",
          "dealstage": "closedwon"
        },
        "actions": [
          {"id": "1", "type": "email", "timestamp": "2024-01-01T10:00:00Z"},
          {"id": "2", "type": "call", "timestamp": "2024-01-03T14:00:00Z"}
        ],
        "timeline": [],
        "createdAt": "2024-01-01T00:00:00Z",
        "closedAt": "2024-02-15T00:00:00Z",
        "daysToClose": 45
      }
    ]
  }'
```

## Troubleshooting

### CRM Card Not Showing

- Verify the card is assigned to the correct object type
- Check that your server is accessible from HubSpot
- Review the Network tab in browser dev tools for errors

### OAuth Errors

- Ensure redirect URI matches exactly (including trailing slashes)
- Verify all required scopes are selected
- Check that client ID and secret are correct

### Timeline Events Not Appearing

- Verify the event template ID is correct
- Ensure the access token has timeline scope
- Check the event payload matches the template tokens

## Next Steps

- Configure routing rules for automatic record assignment
- Set up webhooks for real-time event processing
- Integrate with your data warehouse for historical analysis
- Create custom plays based on your business logic
