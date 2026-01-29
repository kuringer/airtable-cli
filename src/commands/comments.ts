import { Command } from 'commander';
import { createClientAsync } from '../lib/client.js';
import { printOutput, printError, type OutputFormat } from '../lib/output.js';

export function createCommentsCommand(): Command {
  const comments = new Command('comments').description('Manage comments on records');

  // List comments
  comments
    .command('list')
    .description('List comments on a record')
    .requiredOption('-b, --base <baseId>', 'Base ID')
    .requiredOption('-t, --table <tableIdOrName>', 'Table ID or name')
    .requiredOption('-r, --record <recordId>', 'Record ID')
    .option('-o, --offset <offset>', 'Pagination offset')
    .option('--format <format>', 'Output format (json/table)', 'json')
    .action(async (options) => {
      try {
        const client = await createClientAsync();
        const response = await client.listComments(
          options.base,
          options.table,
          options.record,
          options.offset
        );
        printOutput(response, options.format as OutputFormat);
      } catch (error) {
        printError((error as Error).message);
        process.exit(1);
      }
    });

  // Create a comment
  comments
    .command('create')
    .description('Create a comment on a record')
    .requiredOption('-b, --base <baseId>', 'Base ID')
    .requiredOption('-t, --table <tableIdOrName>', 'Table ID or name')
    .requiredOption('-r, --record <recordId>', 'Record ID')
    .requiredOption('-m, --message <text>', 'Comment text')
    .option('--format <format>', 'Output format (json/table)', 'json')
    .action(async (options) => {
      try {
        const client = await createClientAsync();
        const comment = await client.createComment(
          options.base,
          options.table,
          options.record,
          options.message
        );
        printOutput(comment, options.format as OutputFormat);
      } catch (error) {
        printError((error as Error).message);
        process.exit(1);
      }
    });

  return comments;
}
