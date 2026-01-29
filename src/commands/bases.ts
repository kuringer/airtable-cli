import { Command } from 'commander';
import { createClient } from '../lib/client.js';
import { printOutput, printError, type OutputFormat } from '../lib/output.js';

export function createBasesCommand(): Command {
  const bases = new Command('bases').description('Manage Airtable bases');

  // List bases
  bases
    .command('list')
    .description('List all accessible bases')
    .option('-a, --all', 'Fetch all bases (auto-paginate)')
    .option('-o, --offset <offset>', 'Pagination offset')
    .option('--format <format>', 'Output format (json/table/csv)', 'json')
    .action(async (options) => {
      try {
        const client = createClient();
        if (options.all) {
          const allBases = await client.listAllBases();
          printOutput(allBases, options.format as OutputFormat);
        } else {
          const response = await client.listBases(options.offset);
          printOutput(response, options.format as OutputFormat);
        }
      } catch (error) {
        printError((error as Error).message);
        process.exit(1);
      }
    });

  // Get base schema
  bases
    .command('schema')
    .description('Get the schema of a base (tables, fields, views)')
    .requiredOption('-b, --base <baseId>', 'Base ID')
    .option('--format <format>', 'Output format (json/table)', 'json')
    .action(async (options) => {
      try {
        const client = createClient();
        const schema = await client.getBaseSchema(options.base);
        printOutput(schema, options.format as OutputFormat);
      } catch (error) {
        printError((error as Error).message);
        process.exit(1);
      }
    });

  return bases;
}
