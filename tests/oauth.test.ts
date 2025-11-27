/**
 * Tests for OAuth Module
 */

import { OAuthManager, REQUIRED_SCOPES } from '../src/oauth';

describe('OAuthManager', () => {
  const testConfig = {
    clientId: 'test-client-id',
    clientSecret: 'test-client-secret',
    redirectUri: 'http://localhost:3000/oauth/callback',
    scopes: REQUIRED_SCOPES,
  };

  let oauthManager: OAuthManager;

  beforeEach(() => {
    oauthManager = new OAuthManager(testConfig);
  });

  describe('getAuthorizationUrl', () => {
    it('should generate a valid authorization URL', () => {
      const url = oauthManager.getAuthorizationUrl();

      expect(url).toContain('https://app.hubspot.com/oauth/authorize');
      expect(url).toContain(`client_id=${testConfig.clientId}`);
      expect(url).toContain(`redirect_uri=${encodeURIComponent(testConfig.redirectUri)}`);
    });

    it('should include state parameter when provided', () => {
      const state = 'test-state-value';
      const url = oauthManager.getAuthorizationUrl(state);

      expect(url).toContain(`state=${state}`);
    });

    it('should include all required scopes', () => {
      const url = oauthManager.getAuthorizationUrl();

      for (const scope of REQUIRED_SCOPES) {
        expect(url).toContain(encodeURIComponent(scope));
      }
    });
  });

  describe('token management', () => {
    it('should store and retrieve tokens', () => {
      const tokens = {
        accessToken: 'test-access-token',
        refreshToken: 'test-refresh-token',
        expiresAt: new Date(Date.now() + 3600000),
        portalId: '12345',
      };

      oauthManager.setTokens('12345', tokens);
      expect(oauthManager.isConnected('12345')).toBe(true);
    });

    it('should remove tokens', () => {
      const tokens = {
        accessToken: 'test-access-token',
        refreshToken: 'test-refresh-token',
        expiresAt: new Date(Date.now() + 3600000),
        portalId: '12345',
      };

      oauthManager.setTokens('12345', tokens);
      oauthManager.removeTokens('12345');
      expect(oauthManager.isConnected('12345')).toBe(false);
    });

    it('should report disconnected for unknown portals', () => {
      expect(oauthManager.isConnected('unknown-portal')).toBe(false);
    });
  });
});

describe('REQUIRED_SCOPES', () => {
  it('should include essential CRM scopes', () => {
    expect(REQUIRED_SCOPES).toContain('crm.objects.contacts.read');
    expect(REQUIRED_SCOPES).toContain('crm.objects.deals.read');
    expect(REQUIRED_SCOPES).toContain('timeline');
    expect(REQUIRED_SCOPES).toContain('oauth');
  });
});
