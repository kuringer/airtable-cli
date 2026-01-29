import { Command } from 'commander';
import { createClient } from '../lib/client.js';
import { printOutput, printError, type OutputFormat } from '../lib/output.js';

export function createAuthCommand(): Command {
  const auth = new Command('auth').description('Authentication and user info');

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

  // Check connection
  auth
    .command('check')
    .description('Check if the API key is valid')
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
