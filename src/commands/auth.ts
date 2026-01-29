import { Command } from 'commander';
import { createClient } from '../lib/client.js';
import { printOutput, printError, type OutputFormat } from '../lib/output.js';
import {
  performOAuthLogin,
  loadTokens,
  deleteTokens,
  isTokenExpired,
  getValidAccessToken,
  type OAuthConfig,
} from '../lib/oauth.js';

function getOAuthConfig(): OAuthConfig {
  const clientId = process.env.AIRTABLE_CLIENT_ID;
  const clientSecret = process.env.AIRTABLE_CLIENT_SECRET;

  if (!clientId) {
    throw new Error(
      'AIRTABLE_CLIENT_ID environment variable is required for OAuth.\n' +
      'Register your integration at https://airtable.com/create/oauth'
    );
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
  const auth = new Command('auth').description('Authentication and user info');

  // OAuth Login
  auth
    .command('login')
    .description('Login to Airtable using OAuth (opens browser)')
    .option('--client-id <id>', 'OAuth Client ID (or set AIRTABLE_CLIENT_ID env var)')
    .option('--port <port>', 'Local callback server port', '4000')
    .action(async (options) => {
      try {
        // Check for existing tokens
        const existingTokens = loadTokens();
        if (existingTokens && !isTokenExpired(existingTokens)) {
          console.log('You are already logged in.');
          console.log('Use "airtable auth logout" to log out first, or "airtable auth status" to check your session.');
          return;
        }

        const config = {
          ...getOAuthConfig(),
          ...(options.clientId && { clientId: options.clientId }),
          ...(options.port && { port: parseInt(options.port) }),
        };

        await performOAuthLogin(config);
        console.log('\nSuccessfully logged in to Airtable!');
        console.log('Your credentials are stored in ~/.clawdbot/credentials/airtable.json');
      } catch (error) {
        printError((error as Error).message);
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
          console.log('Successfully logged out. Credentials deleted.');
        } else {
          console.log('No stored credentials found.');
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
    .option('--format <format>', 'Output format (json/table)', 'json')
    .action(async (options) => {
      try {
        const tokens = loadTokens();

        if (!tokens) {
          console.log('Not logged in.');
          console.log('Use "airtable auth login" to authenticate with OAuth.');
          console.log('Or set AIRTABLE_API_KEY environment variable for PAT authentication.');
          return;
        }

        const expired = isTokenExpired(tokens);
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

        if (options.format === 'json') {
          printOutput(status, 'json');
        } else {
          console.log('Authentication Status:');
          console.log(`  Method: OAuth`);
          console.log(`  Token Type: ${tokens.token_type}`);
          console.log(`  Scopes: ${tokens.scope || 'unknown'}`);
          console.log(`  Expires: ${status.expires_at}`);
          console.log(`  Expired: ${expired ? 'Yes' : 'No'}`);
          console.log(`  Refresh Token: ${tokens.refresh_token ? 'Available' : 'Not available'}`);
        }

        // Also verify the token works
        if (!expired) {
          try {
            const client = createClient(tokens.access_token);
            const userInfo = await client.whoAmI();
            console.log(`\nConnected as: ${userInfo.id}`);
          } catch {
            console.log('\nWarning: Token validation failed. You may need to re-login.');
          }
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
        printOutput(userInfo, options.format as OutputFormat);
      } catch (error) {
        printError((error as Error).message);
        process.exit(1);
      }
    });

  // Check connection (legacy command, kept for compatibility)
  auth
    .command('check')
    .description('Check if authentication is valid')
    .action(async () => {
      try {
        const client = createClient();
        const userInfo = await client.whoAmI();
        console.log('Connection successful!');
        console.log(`User ID: ${userInfo.id}`);
        if (userInfo.scopes) {
          console.log(`Scopes: ${userInfo.scopes.join(', ')}`);
        }
      } catch (error) {
        printError((error as Error).message);
        process.exit(1);
      }
    });

  return auth;
}
