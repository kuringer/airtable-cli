import * as crypto from 'crypto';
import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// OAuth endpoints
const AIRTABLE_AUTH_URL = 'https://airtable.com/oauth2/v1/authorize';
const AIRTABLE_TOKEN_URL = 'https://airtable.com/oauth2/v1/token';

// Default configuration
const DEFAULT_PORT = 4000;
const DEFAULT_REDIRECT_PATH = '/callback';

export interface OAuthConfig {
  clientId: string;
  clientSecret?: string;
  redirectUri?: string;
  port?: number;
  scopes?: string[];
}

export interface TokenData {
  access_token: string;
  refresh_token?: string;
  token_type: string;
  expires_in?: number;
  expires_at?: number;
  scope?: string;
}

interface AuthState {
  codeVerifier: string;
  state: string;
}

// Get the credentials directory path (prefer moltbot, fallback to clawdbot)
function getCredentialsDir(): string {
  const homeDir = process.env.HOME || process.env.USERPROFILE || '';

  // Check for existing moltbot credentials directory
  const moltbotDir = path.join(homeDir, '.moltbot', 'credentials');
  if (fs.existsSync(moltbotDir)) {
    return moltbotDir;
  }

  // Check for existing clawdbot credentials directory
  const clawdbotDir = path.join(homeDir, '.clawdbot', 'credentials');
  if (fs.existsSync(clawdbotDir)) {
    return clawdbotDir;
  }

  // Default to moltbot for new installations
  return moltbotDir;
}

function getTokenPath(): string {
  return path.join(getCredentialsDir(), 'airtable.json');
}

// Find existing token file (check both locations)
function findExistingTokenPath(): string | null {
  const homeDir = process.env.HOME || process.env.USERPROFILE || '';

  const moltbotPath = path.join(homeDir, '.moltbot', 'credentials', 'airtable.json');
  if (fs.existsSync(moltbotPath)) {
    return moltbotPath;
  }

  const clawdbotPath = path.join(homeDir, '.clawdbot', 'credentials', 'airtable.json');
  if (fs.existsSync(clawdbotPath)) {
    return clawdbotPath;
  }

  return null;
}

/**
 * Generate a cryptographically secure random string for PKCE
 */
function generateCodeVerifier(): string {
  return crypto.randomBytes(96).toString('base64url');
}

/**
 * Generate the code challenge from code verifier using SHA-256
 */
function generateCodeChallenge(verifier: string): string {
  return crypto
    .createHash('sha256')
    .update(verifier)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

/**
 * Generate a random state parameter for CSRF protection
 */
function generateState(): string {
  return crypto.randomBytes(50).toString('base64url');
}

/**
 * Build the authorization URL with PKCE parameters
 */
export function buildAuthorizationUrl(
  config: OAuthConfig,
  authState: AuthState
): string {
  const port = config.port || DEFAULT_PORT;
  const redirectUri = config.redirectUri || `http://localhost:${port}${DEFAULT_REDIRECT_PATH}`;

  const scopes = config.scopes || [
    'data.records:read',
    'data.records:write',
    'schema.bases:read',
    'schema.bases:write',
    'webhook:manage',
  ];

  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: scopes.join(' '),
    state: authState.state,
    code_challenge: generateCodeChallenge(authState.codeVerifier),
    code_challenge_method: 'S256',
  });

  return `${AIRTABLE_AUTH_URL}?${params.toString()}`;
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeCodeForTokens(
  code: string,
  config: OAuthConfig,
  codeVerifier: string
): Promise<TokenData> {
  const port = config.port || DEFAULT_PORT;
  const redirectUri = config.redirectUri || `http://localhost:${port}${DEFAULT_REDIRECT_PATH}`;

  const body = new URLSearchParams({
    client_id: config.clientId,
    code_verifier: codeVerifier,
    redirect_uri: redirectUri,
    code: code,
    grant_type: 'authorization_code',
  });

  const headers: Record<string, string> = {
    'Content-Type': 'application/x-www-form-urlencoded',
  };

  // Add basic auth if client secret is provided
  if (config.clientSecret) {
    const credentials = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64');
    headers['Authorization'] = `Basic ${credentials}`;
  }

  const response = await fetch(AIRTABLE_TOKEN_URL, {
    method: 'POST',
    headers,
    body: body.toString(),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Token exchange failed: ${response.status} - ${errorBody}`);
  }

  const tokenData = await response.json() as TokenData;

  // Calculate expiration timestamp
  if (tokenData.expires_in) {
    tokenData.expires_at = Date.now() + (tokenData.expires_in * 1000);
  }

  return tokenData;
}

/**
 * Refresh an access token using a refresh token
 */
export async function refreshAccessToken(
  refreshToken: string,
  config: OAuthConfig
): Promise<TokenData> {
  const body = new URLSearchParams({
    client_id: config.clientId,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });

  const headers: Record<string, string> = {
    'Content-Type': 'application/x-www-form-urlencoded',
  };

  if (config.clientSecret) {
    const credentials = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64');
    headers['Authorization'] = `Basic ${credentials}`;
  }

  const response = await fetch(AIRTABLE_TOKEN_URL, {
    method: 'POST',
    headers,
    body: body.toString(),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Token refresh failed: ${response.status} - ${errorBody}`);
  }

  const tokenData = await response.json() as TokenData;

  if (tokenData.expires_in) {
    tokenData.expires_at = Date.now() + (tokenData.expires_in * 1000);
  }

  return tokenData;
}

/**
 * Save tokens to the credentials file
 */
export function saveTokens(tokens: TokenData): void {
  const credentialsDir = getCredentialsDir();

  // Ensure credentials directory exists
  if (!fs.existsSync(credentialsDir)) {
    fs.mkdirSync(credentialsDir, { recursive: true, mode: 0o700 });
  }

  const tokenPath = getTokenPath();
  const tokenData = {
    ...tokens,
    saved_at: new Date().toISOString(),
  };

  fs.writeFileSync(tokenPath, JSON.stringify(tokenData, null, 2), { mode: 0o600 });
}

/**
 * Load tokens from the credentials file (checks both moltbot and clawdbot locations)
 */
export function loadTokens(): TokenData | null {
  const tokenPath = findExistingTokenPath();

  if (!tokenPath) {
    return null;
  }

  try {
    const data = fs.readFileSync(tokenPath, 'utf-8');
    return JSON.parse(data) as TokenData;
  } catch {
    return null;
  }
}

/**
 * Delete stored tokens (removes from both moltbot and clawdbot locations if they exist)
 */
export function deleteTokens(): boolean {
  const homeDir = process.env.HOME || process.env.USERPROFILE || '';
  let deleted = false;

  // Check and delete from moltbot location
  const moltbotPath = path.join(homeDir, '.moltbot', 'credentials', 'airtable.json');
  if (fs.existsSync(moltbotPath)) {
    fs.unlinkSync(moltbotPath);
    deleted = true;
  }

  // Check and delete from clawdbot location
  const clawdbotPath = path.join(homeDir, '.clawdbot', 'credentials', 'airtable.json');
  if (fs.existsSync(clawdbotPath)) {
    fs.unlinkSync(clawdbotPath);
    deleted = true;
  }

  return deleted;
}

/**
 * Check if tokens are expired or about to expire (within 5 minutes)
 */
export function isTokenExpired(tokens: TokenData): boolean {
  if (!tokens.expires_at) {
    return false; // No expiration info, assume valid
  }

  const bufferMs = 5 * 60 * 1000; // 5 minutes buffer
  return Date.now() > (tokens.expires_at - bufferMs);
}

/**
 * Get a valid access token, refreshing if necessary
 */
export async function getValidAccessToken(config: OAuthConfig): Promise<string | null> {
  const tokens = loadTokens();

  if (!tokens) {
    return null;
  }

  if (!isTokenExpired(tokens)) {
    return tokens.access_token;
  }

  // Token expired, try to refresh
  if (tokens.refresh_token) {
    try {
      const newTokens = await refreshAccessToken(tokens.refresh_token, config);
      saveTokens(newTokens);
      return newTokens.access_token;
    } catch (error) {
      console.error('Failed to refresh token:', error);
      return null;
    }
  }

  return null;
}

/**
 * Start a local server to handle the OAuth callback
 */
export function startCallbackServer(
  config: OAuthConfig,
  authState: AuthState
): Promise<string> {
  return new Promise((resolve, reject) => {
    const port = config.port || DEFAULT_PORT;
    const redirectPath = DEFAULT_REDIRECT_PATH;

    const server = http.createServer(async (req, res) => {
      const url = new URL(req.url || '', `http://localhost:${port}`);

      if (url.pathname === redirectPath) {
        const code = url.searchParams.get('code');
        const state = url.searchParams.get('state');
        const error = url.searchParams.get('error');
        const errorDescription = url.searchParams.get('error_description');

        if (error) {
          res.writeHead(400, { 'Content-Type': 'text/html' });
          res.end(`
            <html>
              <body style="font-family: system-ui; padding: 40px; text-align: center;">
                <h1 style="color: #dc2626;">Authorization Failed</h1>
                <p>${errorDescription || error}</p>
                <p>You can close this window.</p>
              </body>
            </html>
          `);
          server.close();
          reject(new Error(errorDescription || error));
          return;
        }

        if (state !== authState.state) {
          res.writeHead(400, { 'Content-Type': 'text/html' });
          res.end(`
            <html>
              <body style="font-family: system-ui; padding: 40px; text-align: center;">
                <h1 style="color: #dc2626;">Security Error</h1>
                <p>State mismatch - possible CSRF attack.</p>
                <p>You can close this window.</p>
              </body>
            </html>
          `);
          server.close();
          reject(new Error('State mismatch - possible CSRF attack'));
          return;
        }

        if (!code) {
          res.writeHead(400, { 'Content-Type': 'text/html' });
          res.end(`
            <!DOCTYPE html>
            <html>
              <head>
                <title>Airtable CLI - Error</title>
                <style>
                  * { margin: 0; padding: 0; box-sizing: border-box; }
                  body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    min-height: 100vh;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                  }
                  .card {
                    background: white;
                    border-radius: 16px;
                    padding: 48px;
                    text-align: center;
                    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
                    max-width: 400px;
                  }
                  .icon {
                    width: 64px;
                    height: 64px;
                    background: #ef4444;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin: 0 auto 24px;
                  }
                  .icon svg { width: 32px; height: 32px; color: white; }
                  h1 { color: #1f2937; font-size: 24px; font-weight: 600; margin-bottom: 12px; }
                  p { color: #6b7280; font-size: 16px; line-height: 1.5; }
                  .brand { margin-top: 32px; padding-top: 24px; border-top: 1px solid #e5e7eb; color: #9ca3af; font-size: 14px; }
                </style>
              </head>
              <body>
                <div class="card">
                  <div class="icon">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                    </svg>
                  </div>
                  <h1>Authorization Failed</h1>
                  <p>No authorization code received. Please try again.</p>
                  <div class="brand">Airtable CLI</div>
                </div>
              </body>
            </html>
          `);
          server.close();
          reject(new Error('No authorization code received'));
          return;
        }

        // Success!
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>Airtable CLI - Connected</title>
              <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body {
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                  min-height: 100vh;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                }
                .card {
                  background: white;
                  border-radius: 16px;
                  padding: 48px;
                  text-align: center;
                  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
                  max-width: 400px;
                }
                .icon {
                  width: 64px;
                  height: 64px;
                  background: #10b981;
                  border-radius: 50%;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  margin: 0 auto 24px;
                }
                .icon svg { width: 32px; height: 32px; color: white; }
                h1 {
                  color: #1f2937;
                  font-size: 24px;
                  font-weight: 600;
                  margin-bottom: 12px;
                }
                p {
                  color: #6b7280;
                  font-size: 16px;
                  line-height: 1.5;
                }
                .brand {
                  margin-top: 32px;
                  padding-top: 24px;
                  border-top: 1px solid #e5e7eb;
                  color: #9ca3af;
                  font-size: 14px;
                }
              </style>
            </head>
            <body>
              <div class="card">
                <div class="icon">
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                  </svg>
                </div>
                <h1>Connected to Airtable</h1>
                <p>Authorization successful! You can close this window and return to your terminal.</p>
                <div class="brand">Airtable CLI</div>
              </div>
            </body>
          </html>
        `);

        server.close();
        resolve(code);
      } else {
        res.writeHead(404);
        res.end('Not found');
      }
    });

    server.on('error', (err) => {
      reject(err);
    });

    server.listen(port, () => {
      console.log(`Callback server listening on http://localhost:${port}`);
    });

    // Timeout after 5 minutes
    setTimeout(() => {
      server.close();
      reject(new Error('Authorization timeout - no callback received within 5 minutes'));
    }, 5 * 60 * 1000);
  });
}

/**
 * Create a new auth state with PKCE parameters
 */
export function createAuthState(): AuthState {
  return {
    codeVerifier: generateCodeVerifier(),
    state: generateState(),
  };
}

/**
 * Perform the full OAuth login flow
 */
export async function performOAuthLogin(config: OAuthConfig): Promise<TokenData> {
  const authState = createAuthState();
  const authUrl = buildAuthorizationUrl(config, authState);

  console.log('\nOpening browser for Airtable authorization...');
  console.log('If the browser does not open automatically, visit:');
  console.log(`\n${authUrl}\n`);

  // Try to open the browser
  const openCommand = process.platform === 'darwin'
    ? 'open'
    : process.platform === 'win32'
      ? 'start'
      : 'xdg-open';

  const { exec } = await import('child_process');
  exec(`${openCommand} "${authUrl}"`);

  // Wait for the callback
  const code = await startCallbackServer(config, authState);

  console.log('Received authorization code, exchanging for tokens...');

  // Exchange code for tokens
  const tokens = await exchangeCodeForTokens(code, config, authState.codeVerifier);

  // Save tokens
  saveTokens(tokens);

  console.log('Tokens saved successfully!');

  return tokens;
}
