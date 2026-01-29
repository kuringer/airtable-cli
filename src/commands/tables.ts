import { Command } from 'commander';
import { createClient } from '../lib/client.js';
import { printOutput, printError, type OutputFormat } from '../lib/output.js';

export function createTablesCommand(): Command {
  const tables = new Command('tables').description('Manage tables in a base');

  // Create a table
  tables
    .command('create')
    .description('Create a new table in a base')
    .requiredOption('-b, --base <baseId>', 'Base ID')
    .requiredOption('-n, --name <name>', 'Table name')
    .option('-d, --description <description>', 'Table description')
    .requiredOption('--fields <json>', 'Array of field definitions as JSON')
    .option('--format <format>', 'Output format (json/table)', 'json')
    .action(async (options) => {
      try {
        const client = createClient();
        const fields = JSON.parse(options.fields);
        const table = await client.createTable(options.base, {
          name: options.name,
          description: options.description,
          fields,
        });
        printOutput(table, options.format as OutputFormat);
      } catch (error) {
        printError((error as Error).message);
        process.exit(1);
      }
    });

  // Update a table
  tables
    .command('update')
    .description('Update a table name or description')
    .requiredOption('-b, --base <baseId>', 'Base ID')
    .requiredOption('-t, --table <tableId>', 'Table ID')
    .option('-n, --name <name>', 'New table name')
    .option('-d, --description <description>', 'New table description')
    .option('--format <format>', 'Output format (json/table)', 'json')
    .action(async (options) => {
      try {
        const client = createClient();
        const params: { name?: string; description?: string } = {};
        if (options.name) params.name = options.name;
        if (options.description) params.description = options.description;

        if (Object.keys(params).length === 0) {
          printError('At least one of --name or --description is required');
          process.exit(1);
        }

        const table = await client.updateTable(
          options.base,
          options.table,
          params
        );
        printOutput(table, options.format as OutputFormat);
      } catch (error) {
        printError((error as Error).message);
        process.exit(1);
      }
    });

  return tables;
}
