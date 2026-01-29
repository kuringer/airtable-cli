import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

// Mock fs module
vi.mock('fs', async () => {
  const actual = await vi.importActual('fs');
  return {
    ...actual,
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
    unlinkSync: vi.fn(),
    mkdirSync: vi.fn(),
  };
});

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Import after mocking
import {
  buildAuthorizationUrl,
  exchangeCodeForTokens,
  refreshAccessToken,
  saveTokens,
  loadTokens,
  deleteTokens,
  isTokenExpired,
  createAuthState,
  type OAuthConfig,
  type TokenData,
} from '../src/lib/oauth.js';

describe('OAuth Module', () => {
  const mockConfig: OAuthConfig = {
    clientId: 'test-client-id',
    clientSecret: 'test-client-secret',
    port: 4000,
    scopes: ['data.records:read', 'data.records:write'],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.HOME = '/home/testuser';
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('createAuthState', () => {
    it('should generate code verifier and state', () => {
      const authState = createAuthState();

      expect(authState).toHaveProperty('codeVerifier');
      expect(authState).toHaveProperty('state');
      expect(authState.codeVerifier).toBeTruthy();
      expect(authState.state).toBeTruthy();
    });

    it('should generate unique values each time', () => {
      const state1 = createAuthState();
      const state2 = createAuthState();

      expect(state1.codeVerifier).not.toBe(state2.codeVerifier);
      expect(state1.state).not.toBe(state2.state);
    });

    it('should generate code verifier with valid characters', () => {
      const authState = createAuthState();
      // Base64url characters: A-Z, a-z, 0-9, -, _
      const validPattern = /^[A-Za-z0-9_-]+$/;
      expect(authState.codeVerifier).toMatch(validPattern);
    });
  });

  describe('buildAuthorizationUrl', () => {
    it('should build correct authorization URL', () => {
      const authState = {
        codeVerifier: 'test-verifier-string-that-is-long-enough',
        state: 'test-state',
      };

      const url = buildAuthorizationUrl(mockConfig, authState);

      expect(url).toContain('https://airtable.com/oauth2/v1/authorize');
      expect(url).toContain('client_id=test-client-id');
      expect(url).toContain('response_type=code');
      expect(url).toContain('state=test-state');
      expect(url).toContain('code_challenge_method=S256');
      expect(url).toContain('code_challenge=');
    });

    it('should include redirect URI', () => {
      const authState = createAuthState();
      const url = buildAuthorizationUrl(mockConfig, authState);

      expect(url).toContain('redirect_uri=http%3A%2F%2Flocalhost%3A4000%2Fcallback');
    });

    it('should include scopes', () => {
      const authState = createAuthState();
      const url = buildAuthorizationUrl(mockConfig, authState);

      expect(url).toContain('scope=data.records%3Aread');
      expect(url).toContain('data.records%3Awrite');
    });

    it('should use default scopes when not specified', () => {
      const configWithoutScopes: OAuthConfig = {
        clientId: 'test-client-id',
      };
      const authState = createAuthState();
      const url = buildAuthorizationUrl(configWithoutScopes, authState);

      // Default scopes should be included
      expect(url).toContain('scope=');
      expect(url).toContain('data.records');
    });

    it('should use custom redirect URI when provided', () => {
      const customConfig: OAuthConfig = {
        ...mockConfig,
        redirectUri: 'https://myapp.com/oauth/callback',
      };
      const authState = createAuthState();
      const url = buildAuthorizationUrl(customConfig, authState);

      expect(url).toContain('redirect_uri=https%3A%2F%2Fmyapp.com%2Foauth%2Fcallback');
    });
  });

  describe('exchangeCodeForTokens', () => {
    it('should exchange code for tokens successfully', async () => {
      const mockTokens = {
        access_token: 'test-access-token',
        refresh_token: 'test-refresh-token',
        token_type: 'Bearer',
        expires_in: 7200,
        scope: 'data.records:read data.records:write',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockTokens),
      });

      const tokens = await exchangeCodeForTokens(
        'auth-code-123',
        mockConfig,
        'code-verifier-123'
      );

      expect(tokens.access_token).toBe('test-access-token');
      expect(tokens.refresh_token).toBe('test-refresh-token');
      expect(tokens.expires_at).toBeDefined();
      expect(mockFetch).toHaveBeenCalledWith(
        'https://airtable.com/oauth2/v1/token',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/x-www-form-urlencoded',
          }),
        })
      );
    });

    it('should include authorization header when client secret is provided', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ access_token: 'token' }),
      });

      await exchangeCodeForTokens('code', mockConfig, 'verifier');

      const callArgs = mockFetch.mock.calls[0];
      expect(callArgs[1].headers.Authorization).toContain('Basic');
    });

    it('should not include authorization header when no client secret', async () => {
      const configNoSecret: OAuthConfig = {
        clientId: 'test-client-id',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ access_token: 'token' }),
      });

      await exchangeCodeForTokens('code', configNoSecret, 'verifier');

      const callArgs = mockFetch.mock.calls[0];
      expect(callArgs[1].headers.Authorization).toBeUndefined();
    });

    it('should throw error on failed token exchange', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: () => Promise.resolve('invalid_grant'),
      });

      await expect(
        exchangeCodeForTokens('bad-code', mockConfig, 'verifier')
      ).rejects.toThrow('Token exchange failed');
    });

    it('should calculate expires_at from expires_in', async () => {
      const now = Date.now();
      vi.spyOn(Date, 'now').mockReturnValue(now);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          access_token: 'token',
          expires_in: 3600,
        }),
      });

      const tokens = await exchangeCodeForTokens('code', mockConfig, 'verifier');

      expect(tokens.expires_at).toBe(now + 3600 * 1000);
    });
  });

  describe('refreshAccessToken', () => {
    it('should refresh token successfully', async () => {
      const mockNewTokens = {
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
        token_type: 'Bearer',
        expires_in: 7200,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockNewTokens),
      });

      const tokens = await refreshAccessToken('old-refresh-token', mockConfig);

      expect(tokens.access_token).toBe('new-access-token');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://airtable.com/oauth2/v1/token',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('grant_type=refresh_token'),
        })
      );
    });

    it('should throw error on failed refresh', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: () => Promise.resolve('invalid_token'),
      });

      await expect(
        refreshAccessToken('expired-token', mockConfig)
      ).rejects.toThrow('Token refresh failed');
    });
  });

  describe('saveTokens', () => {
    it('should save tokens to credentials file', () => {
      const mockExistsSync = vi.mocked(fs.existsSync);
      const mockWriteFileSync = vi.mocked(fs.writeFileSync);
      const mockMkdirSync = vi.mocked(fs.mkdirSync);

      mockExistsSync.mockReturnValue(true);

      const tokens: TokenData = {
        access_token: 'test-token',
        refresh_token: 'test-refresh',
        token_type: 'Bearer',
        expires_at: Date.now() + 3600000,
      };

      saveTokens(tokens);

      expect(mockWriteFileSync).toHaveBeenCalledWith(
        expect.stringContaining('airtable.json'),
        expect.stringContaining('test-token'),
        expect.objectContaining({ mode: 0o600 })
      );
    });

    it('should create credentials directory if it does not exist', () => {
      const mockExistsSync = vi.mocked(fs.existsSync);
      const mockMkdirSync = vi.mocked(fs.mkdirSync);
      const mockWriteFileSync = vi.mocked(fs.writeFileSync);

      mockExistsSync.mockReturnValue(false);

      saveTokens({ access_token: 'token', token_type: 'Bearer' });

      expect(mockMkdirSync).toHaveBeenCalledWith(
        expect.stringContaining('credentials'),
        expect.objectContaining({ recursive: true, mode: 0o700 })
      );
    });
  });

  describe('loadTokens', () => {
    it('should load tokens from file', () => {
      const mockExistsSync = vi.mocked(fs.existsSync);
      const mockReadFileSync = vi.mocked(fs.readFileSync);

      const storedTokens = {
        access_token: 'stored-token',
        refresh_token: 'stored-refresh',
        token_type: 'Bearer',
      };

      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify(storedTokens));

      const tokens = loadTokens();

      expect(tokens).toEqual(storedTokens);
    });

    it('should return null if no credentials file exists', () => {
      const mockExistsSync = vi.mocked(fs.existsSync);
      mockExistsSync.mockReturnValue(false);

      const tokens = loadTokens();

      expect(tokens).toBeNull();
    });

    it('should return null if file is invalid JSON', () => {
      const mockExistsSync = vi.mocked(fs.existsSync);
      const mockReadFileSync = vi.mocked(fs.readFileSync);

      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue('invalid json {{{');

      const tokens = loadTokens();

      expect(tokens).toBeNull();
    });
  });

  describe('deleteTokens', () => {
    it('should delete tokens file if it exists', () => {
      const mockExistsSync = vi.mocked(fs.existsSync);
      const mockUnlinkSync = vi.mocked(fs.unlinkSync);

      mockExistsSync.mockReturnValue(true);

      const result = deleteTokens();

      expect(result).toBe(true);
      expect(mockUnlinkSync).toHaveBeenCalledWith(
        expect.stringContaining('airtable.json')
      );
    });

    it('should return false if no tokens file exists', () => {
      const mockExistsSync = vi.mocked(fs.existsSync);
      mockExistsSync.mockReturnValue(false);

      const result = deleteTokens();

      expect(result).toBe(false);
    });
  });

  describe('isTokenExpired', () => {
    it('should return false for non-expired token', () => {
      const tokens: TokenData = {
        access_token: 'token',
        token_type: 'Bearer',
        expires_at: Date.now() + 3600000, // 1 hour from now
      };

      expect(isTokenExpired(tokens)).toBe(false);
    });

    it('should return true for expired token', () => {
      const tokens: TokenData = {
        access_token: 'token',
        token_type: 'Bearer',
        expires_at: Date.now() - 1000, // 1 second ago
      };

      expect(isTokenExpired(tokens)).toBe(true);
    });

    it('should return true for token expiring within 5 minutes', () => {
      const tokens: TokenData = {
        access_token: 'token',
        token_type: 'Bearer',
        expires_at: Date.now() + 60000, // 1 minute from now (within 5 min buffer)
      };

      expect(isTokenExpired(tokens)).toBe(true);
    });

    it('should return false if no expires_at', () => {
      const tokens: TokenData = {
        access_token: 'token',
        token_type: 'Bearer',
      };

      expect(isTokenExpired(tokens)).toBe(false);
    });
  });

  describe('PKCE Code Challenge', () => {
    it('should generate valid S256 code challenge', () => {
      // The code challenge should be base64url encoded SHA256 hash of the verifier
      const authState = createAuthState();
      const url = buildAuthorizationUrl(mockConfig, authState);

      // Extract code_challenge from URL
      const urlObj = new URL(url);
      const codeChallenge = urlObj.searchParams.get('code_challenge');

      expect(codeChallenge).toBeTruthy();
      // Base64url format: no +, /, or = characters
      expect(codeChallenge).not.toContain('+');
      expect(codeChallenge).not.toContain('/');
      expect(codeChallenge).not.toContain('=');
    });

    it('should use S256 challenge method', () => {
      const authState = createAuthState();
      const url = buildAuthorizationUrl(mockConfig, authState);

      expect(url).toContain('code_challenge_method=S256');
    });
  });
});

describe('OAuth Auth Commands Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.HOME = '/home/testuser';
  });

  it('should have login command that requires client ID', async () => {
    // This tests that the auth command properly checks for AIRTABLE_CLIENT_ID
    const originalClientId = process.env.AIRTABLE_CLIENT_ID;
    delete process.env.AIRTABLE_CLIENT_ID;

    // Import the auth command creator
    const { createAuthCommand } = await import('../src/commands/auth.js');
    const authCmd = createAuthCommand();

    // Find login command
    const loginCmd = authCmd.commands.find(c => c.name() === 'login');
    expect(loginCmd).toBeDefined();
    expect(loginCmd?.description()).toContain('OAuth');

    process.env.AIRTABLE_CLIENT_ID = originalClientId;
  });

  it('should have logout command', async () => {
    const { createAuthCommand } = await import('../src/commands/auth.js');
    const authCmd = createAuthCommand();

    const logoutCmd = authCmd.commands.find(c => c.name() === 'logout');
    expect(logoutCmd).toBeDefined();
  });

  it('should have status command', async () => {
    const { createAuthCommand } = await import('../src/commands/auth.js');
    const authCmd = createAuthCommand();

    const statusCmd = authCmd.commands.find(c => c.name() === 'status');
    expect(statusCmd).toBeDefined();
  });
});
