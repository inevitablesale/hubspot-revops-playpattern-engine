/**
 * HubSpot OAuth 2.0 Implementation
 * Handles authorization, token exchange, and token refresh
 */

import axios from 'axios';
import { OAuthTokens } from '../types';

const HUBSPOT_AUTH_URL = 'https://app.hubspot.com/oauth/authorize';
const HUBSPOT_TOKEN_URL = 'https://api.hubapi.com/oauth/v1/token';

export interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
}

/**
 * Required OAuth scopes for the RevOps PlayPattern Engine
 */
export const REQUIRED_SCOPES = [
  'crm.objects.contacts.read',
  'crm.objects.contacts.write',
  'crm.objects.deals.read',
  'crm.objects.deals.write',
  'crm.objects.custom.read',
  'crm.objects.custom.write',
  'timeline',
  'crm.schemas.custom.read',
  'oauth',
];

/**
 * OAuthManager handles HubSpot OAuth 2.0 flow
 */
export class OAuthManager {
  private config: OAuthConfig;
  private tokens: Map<string, OAuthTokens> = new Map();

  constructor(config: OAuthConfig) {
    this.config = config;
  }

  /**
   * Generate the authorization URL for the OAuth flow
   */
  getAuthorizationUrl(state?: string): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      scope: this.config.scopes.join(' '),
    });

    if (state) {
      params.append('state', state);
    }

    return `${HUBSPOT_AUTH_URL}?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access tokens
   */
  async exchangeCodeForTokens(code: string): Promise<OAuthTokens> {
    const data = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      redirect_uri: this.config.redirectUri,
      code,
    });

    const response = await axios.post(HUBSPOT_TOKEN_URL, data.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    const tokens: OAuthTokens = {
      accessToken: response.data.access_token,
      refreshToken: response.data.refresh_token,
      expiresAt: new Date(Date.now() + response.data.expires_in * 1000),
      portalId: response.data.hub_id?.toString(),
    };

    if (tokens.portalId) {
      this.tokens.set(tokens.portalId, tokens);
    }

    return tokens;
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(refreshToken: string): Promise<OAuthTokens> {
    const data = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      refresh_token: refreshToken,
    });

    const response = await axios.post(HUBSPOT_TOKEN_URL, data.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    const tokens: OAuthTokens = {
      accessToken: response.data.access_token,
      refreshToken: response.data.refresh_token,
      expiresAt: new Date(Date.now() + response.data.expires_in * 1000),
      portalId: response.data.hub_id?.toString(),
    };

    if (tokens.portalId) {
      this.tokens.set(tokens.portalId, tokens);
    }

    return tokens;
  }

  /**
   * Get tokens for a portal, refreshing if necessary
   */
  async getValidTokens(portalId: string): Promise<OAuthTokens | null> {
    const tokens = this.tokens.get(portalId);
    if (!tokens) {
      return null;
    }

    // Refresh if token expires within 5 minutes
    const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000);
    if (tokens.expiresAt <= fiveMinutesFromNow) {
      return this.refreshAccessToken(tokens.refreshToken);
    }

    return tokens;
  }

  /**
   * Store tokens for a portal
   */
  setTokens(portalId: string, tokens: OAuthTokens): void {
    this.tokens.set(portalId, tokens);
  }

  /**
   * Remove tokens for a portal
   */
  removeTokens(portalId: string): void {
    this.tokens.delete(portalId);
  }

  /**
   * Check if a portal is connected
   */
  isConnected(portalId: string): boolean {
    return this.tokens.has(portalId);
  }
}

/**
 * Create OAuth configuration from environment variables
 */
export function createOAuthConfigFromEnv(): OAuthConfig {
  const clientId = process.env.HUBSPOT_CLIENT_ID;
  const clientSecret = process.env.HUBSPOT_CLIENT_SECRET;
  const redirectUri = process.env.HUBSPOT_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      'Missing required OAuth environment variables: HUBSPOT_CLIENT_ID, HUBSPOT_CLIENT_SECRET, HUBSPOT_REDIRECT_URI'
    );
  }

  return {
    clientId,
    clientSecret,
    redirectUri,
    scopes: REQUIRED_SCOPES,
  };
}
