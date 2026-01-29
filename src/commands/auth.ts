import { Command } from 'commander';
import { createClient } from '../lib/client.js';
import { printOutput, printError, type OutputFormat } from '../lib/output.js';
import {
  performOAuthLogin,
  loadTokens,
  deleteTokens,
  isTokenExpired,
  getValidAccessToken,
  createAuthState,
  buildAuthorizationUrl,
  exchangeCodeForTokens,
  saveTokens,
  type OAuthConfig,
} from '../lib/oauth.js';
import * as readline from 'readline';

const SETUP_GUIDE = `
┌─────────────────────────────────────────────────────────────────┐
│                   AIRTABLE CLI - OAUTH SETUP                    │
└─────────────────────────────────────────────────────────────────┘

To use this CLI, you need to create an OAuth integration with Airtable.
This is a one-time setup that takes about 2 minutes.

STEP 1: Create an OAuth Integration
────────────────────────────────────
  1. Open: https://airtable.com/create/oauth
  2. Click "Register new OAuth integration"
  3. Fill in the details:
     • Name: Choose any name (e.g., "My Airtable CLI")
     • Redirect URL: http://localhost:4000/callback

STEP 2: Select Scopes (Permissions)
───────────────────────────────────
  Select the permissions your app needs:
  ✓ data.records:read    - Read records from tables
  ✓ data.records:write   - Create, update, delete records
  ✓ schema.bases:read    - View base and table structure
  ✓ schema.bases:write   - Create tables and fields
  ✓ webhook:manage       - Create and manage webhooks

STEP 3: Save Your Credentials
─────────────────────────────
  After registering, you'll receive:
  • Client ID (required)
  • Client Secret (optional but recommended)

STEP 4: Configure the CLI
─────────────────────────
  Option A - Environment variables:
    export AIRTABLE_CLIENT_ID="your_client_id"
    export AIRTABLE_CLIENT_SECRET="your_client_secret"

  Option B - Moltbot/Clawdbot config (~/.clawdbot/clawdbot.json):
    {
      "skills": {
        "entries": {
          "airtable": {
            "enabled": true,
            "env": {
              "AIRTABLE_CLIENT_ID": "your_client_id",
              "AIRTABLE_CLIENT_SECRET": "your_client_secret"
            }
          }
        }
      }
    }

STEP 5: Login
─────────────
  Run: airtable auth login

  This will:
  • Open your browser to Airtable
  • Ask you to authorize the integration
  • Save your tokens securely

────────────────────────────────────────────────────────────────────
Need help? Visit: https://airtable.com/developers/web/guides/oauth-integrations
`;

const LOGIN_INSTRUCTIONS = `
┌─────────────────────────────────────────────────────────────────┐
│                      AIRTABLE CLI LOGIN                         │
└─────────────────────────────────────────────────────────────────┘

Before you can login, you need to set up OAuth credentials.

Quick Setup:
────────────
1. Go to: https://airtable.com/create/oauth
2. Create a new integration with redirect URL:
   http://localhost:4000/callback
3. Set your credentials:

   export AIRTABLE_CLIENT_ID="your_client_id"
   export AIRTABLE_CLIENT_SECRET="your_client_secret"

4. Run this command again: airtable auth login

For detailed instructions, run: airtable auth setup
`;

function getOAuthConfig(): OAuthConfig {
  const clientId = process.env.AIRTABLE_CLIENT_ID;
  const clientSecret = process.env.AIRTABLE_CLIENT_SECRET;

  if (!clientId) {
    console.log(LOGIN_INSTRUCTIONS);
    throw new Error('AIRTABLE_CLIENT_ID not configured');
  }

  return {
    clientId,
    clientSecret,
    port: parseInt(process.env.AIRTABLE_OAUTH_PORT || '4000'),
    scopes: process.env.AIRTABLE_SCOPES?.split(' ') || [
      'data.records:read',
      'data.records:write',
      'schema.bases:read',
      'schema.bases:write',
      'webhook:manage',
    ],
  };
}

export function createAuthCommand(): Command {
  const auth = new Command('auth').description('Authentication commands - login, logout, status');

  // Setup Guide
  auth
    .command('setup')
    .description('Show step-by-step OAuth setup instructions')
    .action(() => {
      console.log(SETUP_GUIDE);
    });

  // OAuth Login
  auth
    .command('login')
    .description('Login to Airtable using OAuth (opens browser)')
    .option('--client-id <id>', 'OAuth Client ID (or set AIRTABLE_CLIENT_ID)')
    .option('--port <port>', 'Local callback server port', '4000')
    .option('--manual', 'Manual mode: copy code from redirect URL (for remote/headless setups)')
    .action(async (options) => {
      try {
        // Check for existing valid tokens
        const existingTokens = loadTokens();
        if (existingTokens && !isTokenExpired(existingTokens)) {
          console.log(`
┌─────────────────────────────────────────────────────────────────┐
│                    ALREADY LOGGED IN                            │
└─────────────────────────────────────────────────────────────────┘

You are already authenticated with Airtable.

Options:
  • Check status:  airtable auth status
  • Log out:       airtable auth logout
  • Test API:      airtable bases list
`);
          return;
        }

        // Check if tokens exist but are expired
        if (existingTokens && isTokenExpired(existingTokens)) {
          console.log('Your session has expired. Starting new login...\n');
        }

        const config = {
          ...getOAuthConfig(),
          ...(options.clientId && { clientId: options.clientId }),
          ...(options.port && { port: parseInt(options.port) }),
        };

        // Manual mode for remote setups
        if (options.manual) {
          const authState = createAuthState();
          const authUrl = buildAuthorizationUrl(config, authState);

          console.log(`
┌─────────────────────────────────────────────────────────────────┐
│                 AIRTABLE CLI LOGIN (Manual Mode)                │
└─────────────────────────────────────────────────────────────────┘

STEP 1: Open this URL in your browser (phone, laptop, anywhere):

${authUrl}

STEP 2: Sign in to Airtable and click "Grant access"

STEP 3: You'll see an ERROR PAGE - that's normal!
        Look at the URL bar in your browser. It looks like:

        http://localhost:4000/callback?code=abc123xyz&state=...
                                            ──────────
                                            ↑ COPY THIS PART

STEP 4: Paste that code below.

`);

          const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
          });

          const code = await new Promise<string>((resolve) => {
            rl.question('Enter the code from the URL: ', (answer) => {
              rl.close();
              resolve(answer.trim());
            });
          });

          if (!code) {
            throw new Error('No code provided');
          }

          console.log('\nExchanging code for tokens...');
          const tokens = await exchangeCodeForTokens(code, config, authState.codeVerifier);
          saveTokens(tokens);

          console.log(`
┌─────────────────────────────────────────────────────────────────┐
│                    LOGIN SUCCESSFUL!                            │
└─────────────────────────────────────────────────────────────────┘

You're now connected to Airtable.
`);
          return;
        }

        // Normal mode with callback server
        console.log(`
┌─────────────────────────────────────────────────────────────────┐
│                    AIRTABLE CLI LOGIN                           │
└─────────────────────────────────────────────────────────────────┘

Starting OAuth authentication flow...

What will happen:
  1. Your browser will open to Airtable's authorization page
  2. Sign in to Airtable (if not already)
  3. Click "Grant access" to authorize this CLI
  4. You'll be redirected back and logged in automatically

TIP: Running remotely? Use: airtable auth login --manual

`);

        await performOAuthLogin(config);

        console.log(`
┌─────────────────────────────────────────────────────────────────┐
│                    LOGIN SUCCESSFUL!                            │
└─────────────────────────────────────────────────────────────────┘

You're now connected to Airtable.

Your credentials are stored securely at:
  ~/.moltbot/credentials/airtable.json

Try these commands:
  • airtable bases list          - List your bases
  • airtable auth status         - Check your session
  • airtable auth whoami         - See your user info
`);
      } catch (error) {
        const errorMsg = (error as Error).message;
        if (!errorMsg.includes('AIRTABLE_CLIENT_ID not configured')) {
          printError(errorMsg);
        }
        process.exit(1);
      }
    });

  // OAuth Logout
  auth
    .command('logout')
    .description('Log out and delete stored credentials')
    .action(async () => {
      try {
        const deleted = deleteTokens();
        if (deleted) {
          console.log(`
┌─────────────────────────────────────────────────────────────────┐
│                    LOGGED OUT                                   │
└─────────────────────────────────────────────────────────────────┘

Your Airtable credentials have been deleted.

To log in again, run: airtable auth login
`);
        } else {
          console.log('No stored credentials found. You are not logged in.');
        }
      } catch (error) {
        printError((error as Error).message);
        process.exit(1);
      }
    });

  // Auth Status
  auth
    .command('status')
    .description('Check authentication status')
    .option('--format <format>', 'Output format (json/table)', 'table')
    .action(async (options) => {
      try {
        const tokens = loadTokens();

        if (!tokens) {
          console.log(`
┌─────────────────────────────────────────────────────────────────┐
│                    NOT LOGGED IN                                │
└─────────────────────────────────────────────────────────────────┘

You are not currently authenticated.

To get started:
  • First time?    Run: airtable auth setup
  • Ready to go?   Run: airtable auth login
`);
          return;
        }

        const expired = isTokenExpired(tokens);

        if (options.format === 'json') {
          const status = {
            authenticated: true,
            method: 'oauth',
            token_type: tokens.token_type,
            scope: tokens.scope,
            expires_at: tokens.expires_at
              ? new Date(tokens.expires_at).toISOString()
              : 'unknown',
            expired,
            has_refresh_token: !!tokens.refresh_token,
          };
          printOutput(status, 'json');
          return;
        }

        const expiresAt = tokens.expires_at
          ? new Date(tokens.expires_at).toLocaleString()
          : 'Unknown';

        const scopes = tokens.scope?.split(' ') || [];

        console.log(`
┌─────────────────────────────────────────────────────────────────┐
│                    AUTHENTICATION STATUS                        │
└─────────────────────────────────────────────────────────────────┘

  Status:        ${expired ? '❌ Expired' : '✅ Authenticated'}
  Method:        OAuth 2.0
  Token Type:    ${tokens.token_type || 'Bearer'}
  Expires:       ${expiresAt}
  Refresh Token: ${tokens.refresh_token ? '✅ Available' : '❌ Not available'}

  Scopes:
${scopes.map(s => `    • ${s}`).join('\n') || '    (unknown)'}
`);

        // Verify the token works
        if (!expired) {
          try {
            const client = createClient(tokens.access_token);
            const userInfo = await client.whoAmI();
            console.log(`  Connected as:  ${userInfo.id}\n`);
          } catch {
            console.log(`
  ⚠️  Warning: Token validation failed.
  Your token may be revoked. Run: airtable auth login
`);
          }
        } else {
          console.log(`
  Your session has expired.
  Run: airtable auth login
`);
        }
      } catch (error) {
        printError((error as Error).message);
        process.exit(1);
      }
    });

  // Who am I
  auth
    .command('whoami')
    .description('Get current user info and token scopes')
    .option('--format <format>', 'Output format (json/table)', 'json')
    .action(async (options) => {
      try {
        const client = createClient();
        const userInfo = await client.whoAmI();

        if (options.format === 'json') {
          printOutput(userInfo, 'json');
        } else {
          console.log(`
┌─────────────────────────────────────────────────────────────────┐
│                    USER INFO                                    │
└─────────────────────────────────────────────────────────────────┘

  User ID: ${userInfo.id}
  Scopes:  ${userInfo.scopes?.join(', ') || 'N/A'}
`);
        }
      } catch (error) {
        printError((error as Error).message);
        process.exit(1);
      }
    });

  // Check connection
  auth
    .command('check')
    .description('Quick check if authentication is working')
    .action(async () => {
      try {
        const client = createClient();
        const userInfo = await client.whoAmI();
        console.log('✅ Connection successful!');
        console.log(`   User ID: ${userInfo.id}`);
        if (userInfo.scopes && userInfo.scopes.length > 0) {
          console.log(`   Scopes: ${userInfo.scopes.length} permissions granted`);
        }
      } catch (error) {
        console.log('❌ Connection failed');
        printError((error as Error).message);
        process.exit(1);
      }
    });

  return auth;
}
