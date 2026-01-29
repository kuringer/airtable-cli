import { Command } from 'commander';
import { createClient } from '../lib/client.js';
import { printOutput, printError, type OutputFormat } from '../lib/output.js';

export function createWebhooksCommand(): Command {
  const webhooks = new Command('webhooks').description('Manage webhooks for a base');

  // List webhooks
  webhooks
    .command('list')
    .description('List webhooks for a base')
    .requiredOption('-b, --base <baseId>', 'Base ID')
    .option('--format <format>', 'Output format (json/table)', 'json')
    .action(async (options) => {
      try {
        const client = createClient();
        const response = await client.listWebhooks(options.base);
        printOutput(response.webhooks, options.format as OutputFormat);
      } catch (error) {
        printError((error as Error).message);
        process.exit(1);
      }
    });

  // Create a webhook
  webhooks
    .command('create')
    .description('Create a webhook for a base')
    .requiredOption('-b, --base <baseId>', 'Base ID')
    .requiredOption('-u, --url <notificationUrl>', 'Notification URL')
    .requiredOption('--spec <json>', 'Webhook specification as JSON')
    .option('--format <format>', 'Output format (json/table)', 'json')
    .action(async (options) => {
      try {
        const client = createClient();
        const specification = JSON.parse(options.spec);
        const webhook = await client.createWebhook(options.base, {
          notificationUrl: options.url,
          specification,
        });
        printOutput(webhook, options.format as OutputFormat);
      } catch (error) {
        printError((error as Error).message);
        process.exit(1);
      }
    });

  // Enable/disable webhook
  webhooks
    .command('toggle')
    .description('Enable or disable webhook notifications')
    .requiredOption('-b, --base <baseId>', 'Base ID')
    .requiredOption('-w, --webhook <webhookId>', 'Webhook ID')
    .requiredOption('--enable <boolean>', 'Enable (true) or disable (false)')
    .action(async (options) => {
      try {
        const client = createClient();
        const enable = options.enable === 'true';
        await client.updateWebhook(options.base, options.webhook, enable);
        console.log(`Webhook ${enable ? 'enabled' : 'disabled'} successfully.`);
      } catch (error) {
        printError((error as Error).message);
        process.exit(1);
      }
    });

  // Delete a webhook
  webhooks
    .command('delete')
    .description('Delete a webhook')
    .requiredOption('-b, --base <baseId>', 'Base ID')
    .requiredOption('-w, --webhook <webhookId>', 'Webhook ID')
    .action(async (options) => {
      try {
        const client = createClient();
        await client.deleteWebhook(options.base, options.webhook);
        console.log('Webhook deleted successfully.');
      } catch (error) {
        printError((error as Error).message);
        process.exit(1);
      }
    });

  // Refresh a webhook
  webhooks
    .command('refresh')
    .description('Refresh a webhook (extend expiration)')
    .requiredOption('-b, --base <baseId>', 'Base ID')
    .requiredOption('-w, --webhook <webhookId>', 'Webhook ID')
    .option('--format <format>', 'Output format (json/table)', 'json')
    .action(async (options) => {
      try {
        const client = createClient();
        const result = await client.refreshWebhook(options.base, options.webhook);
        printOutput(result, options.format as OutputFormat);
      } catch (error) {
        printError((error as Error).message);
        process.exit(1);
      }
    });

  // Get webhook payloads
  webhooks
    .command('payloads')
    .description('Get webhook payloads')
    .requiredOption('-b, --base <baseId>', 'Base ID')
    .requiredOption('-w, --webhook <webhookId>', 'Webhook ID')
    .option('-c, --cursor <cursor>', 'Cursor for pagination')
    .option('--format <format>', 'Output format (json/table)', 'json')
    .action(async (options) => {
      try {
        const client = createClient();
        const cursor = options.cursor ? parseInt(options.cursor) : undefined;
        const result = await client.getWebhookPayloads(
          options.base,
          options.webhook,
          cursor
        );
        printOutput(result, options.format as OutputFormat);
      } catch (error) {
        printError((error as Error).message);
        process.exit(1);
      }
    });

  return webhooks;
}
