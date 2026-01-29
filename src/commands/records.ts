import { Command } from 'commander';
import { createClient } from '../lib/client.js';
import { printOutput, printError, type OutputFormat } from '../lib/output.js';

export function createRecordsCommand(): Command {
  const records = new Command('records').description('Manage records in a table');

  // List records
  records
    .command('list')
    .description('List records from a table')
    .requiredOption('-b, --base <baseId>', 'Base ID')
    .requiredOption('-t, --table <tableIdOrName>', 'Table ID or name')
    .option('-v, --view <view>', 'View name or ID')
    .option('-f, --filter <formula>', 'Filter by formula')
    .option('-s, --sort <field>', 'Sort by field')
    .option('-d, --direction <direction>', 'Sort direction (asc/desc)', 'asc')
    .option('--fields <fields>', 'Comma-separated list of fields to return')
    .option('-n, --page-size <size>', 'Number of records per page', '100')
    .option('-o, --offset <offset>', 'Pagination offset')
    .option('-a, --all', 'Fetch all records (auto-paginate)')
    .option('--format <format>', 'Output format (json/table/csv)', 'json')
    .action(async (options) => {
      try {
        const client = createClient();
        const params = {
          view: options.view,
          filterByFormula: options.filter,
          pageSize: parseInt(options.pageSize),
          offset: options.offset,
          fields: options.fields?.split(','),
          sort: options.sort
            ? [{ field: options.sort, direction: options.direction as 'asc' | 'desc' }]
            : undefined,
        };

        if (options.all) {
          const records = await client.listAllRecords(
            options.base,
            options.table,
            params
          );
          printOutput(records, options.format as OutputFormat);
        } else {
          const response = await client.listRecords(
            options.base,
            options.table,
            params
          );
          printOutput(response, options.format as OutputFormat);
        }
      } catch (error) {
        printError((error as Error).message);
        process.exit(1);
      }
    });

  // Get a single record
  records
    .command('get')
    .description('Get a single record by ID')
    .requiredOption('-b, --base <baseId>', 'Base ID')
    .requiredOption('-t, --table <tableIdOrName>', 'Table ID or name')
    .requiredOption('-r, --record <recordId>', 'Record ID')
    .option('--format <format>', 'Output format (json/table)', 'json')
    .action(async (options) => {
      try {
        const client = createClient();
        const record = await client.getRecord(
          options.base,
          options.table,
          options.record
        );
        printOutput(record, options.format as OutputFormat);
      } catch (error) {
        printError((error as Error).message);
        process.exit(1);
      }
    });

  // Create a record
  records
    .command('create')
    .description('Create a new record')
    .requiredOption('-b, --base <baseId>', 'Base ID')
    .requiredOption('-t, --table <tableIdOrName>', 'Table ID or name')
    .requiredOption('--fields <json>', 'Fields as JSON object')
    .option('--typecast', 'Enable automatic type casting')
    .option('--format <format>', 'Output format (json/table)', 'json')
    .action(async (options) => {
      try {
        const client = createClient();
        const fields = JSON.parse(options.fields);
        const record = await client.createRecord(options.base, options.table, {
          fields,
          typecast: options.typecast,
        });
        printOutput(record, options.format as OutputFormat);
      } catch (error) {
        printError((error as Error).message);
        process.exit(1);
      }
    });

  // Create multiple records
  records
    .command('create-batch')
    .description('Create multiple records (up to 10)')
    .requiredOption('-b, --base <baseId>', 'Base ID')
    .requiredOption('-t, --table <tableIdOrName>', 'Table ID or name')
    .requiredOption('--records <json>', 'Array of records as JSON')
    .option('--typecast', 'Enable automatic type casting')
    .option('--format <format>', 'Output format (json/table)', 'json')
    .action(async (options) => {
      try {
        const client = createClient();
        const recordsData = JSON.parse(options.records);
        const records = recordsData.map((r: { fields: Record<string, unknown> }) => ({
          fields: r.fields || r,
          typecast: options.typecast,
        }));
        const result = await client.createRecords(
          options.base,
          options.table,
          records
        );
        printOutput(result.records, options.format as OutputFormat);
      } catch (error) {
        printError((error as Error).message);
        process.exit(1);
      }
    });

  // Update a record
  records
    .command('update')
    .description('Update a record (partial update)')
    .requiredOption('-b, --base <baseId>', 'Base ID')
    .requiredOption('-t, --table <tableIdOrName>', 'Table ID or name')
    .requiredOption('-r, --record <recordId>', 'Record ID')
    .requiredOption('--fields <json>', 'Fields to update as JSON object')
    .option('--typecast', 'Enable automatic type casting')
    .option('--format <format>', 'Output format (json/table)', 'json')
    .action(async (options) => {
      try {
        const client = createClient();
        const fields = JSON.parse(options.fields);
        const record = await client.updateRecord(
          options.base,
          options.table,
          options.record,
          fields,
          options.typecast
        );
        printOutput(record, options.format as OutputFormat);
      } catch (error) {
        printError((error as Error).message);
        process.exit(1);
      }
    });

  // Update multiple records
  records
    .command('update-batch')
    .description('Update multiple records (up to 10)')
    .requiredOption('-b, --base <baseId>', 'Base ID')
    .requiredOption('-t, --table <tableIdOrName>', 'Table ID or name')
    .requiredOption('--records <json>', 'Array of {id, fields} objects as JSON')
    .option('--typecast', 'Enable automatic type casting')
    .option('--format <format>', 'Output format (json/table)', 'json')
    .action(async (options) => {
      try {
        const client = createClient();
        const recordsData = JSON.parse(options.records);
        const result = await client.updateRecords(
          options.base,
          options.table,
          recordsData.map((r: { id: string; fields: Record<string, unknown> }) => ({
            id: r.id,
            fields: r.fields,
            typecast: options.typecast,
          }))
        );
        printOutput(result.records, options.format as OutputFormat);
      } catch (error) {
        printError((error as Error).message);
        process.exit(1);
      }
    });

  // Replace a record
  records
    .command('replace')
    .description('Replace a record (full replacement)')
    .requiredOption('-b, --base <baseId>', 'Base ID')
    .requiredOption('-t, --table <tableIdOrName>', 'Table ID or name')
    .requiredOption('-r, --record <recordId>', 'Record ID')
    .requiredOption('--fields <json>', 'All fields as JSON object')
    .option('--typecast', 'Enable automatic type casting')
    .option('--format <format>', 'Output format (json/table)', 'json')
    .action(async (options) => {
      try {
        const client = createClient();
        const fields = JSON.parse(options.fields);
        const record = await client.replaceRecord(
          options.base,
          options.table,
          options.record,
          fields,
          options.typecast
        );
        printOutput(record, options.format as OutputFormat);
      } catch (error) {
        printError((error as Error).message);
        process.exit(1);
      }
    });

  // Upsert records
  records
    .command('upsert')
    .description('Upsert records (create or update based on merge fields)')
    .requiredOption('-b, --base <baseId>', 'Base ID')
    .requiredOption('-t, --table <tableIdOrName>', 'Table ID or name')
    .requiredOption('--records <json>', 'Array of records as JSON')
    .requiredOption('--merge-on <fields>', 'Comma-separated field names to merge on')
    .option('--typecast', 'Enable automatic type casting')
    .option('--format <format>', 'Output format (json/table)', 'json')
    .action(async (options) => {
      try {
        const client = createClient();
        const recordsData = JSON.parse(options.records);
        const fieldsToMergeOn = options.mergeOn.split(',');
        const result = await client.upsertRecords(options.base, options.table, {
          records: recordsData.map((r: { fields: Record<string, unknown> }) => ({
            fields: r.fields || r,
          })),
          fieldsToMergeOn,
          performUpsert: { fieldsToMergeOn },
          typecast: options.typecast,
        });
        printOutput(result, options.format as OutputFormat);
      } catch (error) {
        printError((error as Error).message);
        process.exit(1);
      }
    });

  // Delete a record
  records
    .command('delete')
    .description('Delete a record')
    .requiredOption('-b, --base <baseId>', 'Base ID')
    .requiredOption('-t, --table <tableIdOrName>', 'Table ID or name')
    .requiredOption('-r, --record <recordId>', 'Record ID')
    .option('--format <format>', 'Output format (json/table)', 'json')
    .action(async (options) => {
      try {
        const client = createClient();
        const result = await client.deleteRecord(
          options.base,
          options.table,
          options.record
        );
        printOutput(result, options.format as OutputFormat);
      } catch (error) {
        printError((error as Error).message);
        process.exit(1);
      }
    });

  // Delete multiple records
  records
    .command('delete-batch')
    .description('Delete multiple records (up to 10)')
    .requiredOption('-b, --base <baseId>', 'Base ID')
    .requiredOption('-t, --table <tableIdOrName>', 'Table ID or name')
    .requiredOption('--records <ids>', 'Comma-separated list of record IDs')
    .option('--format <format>', 'Output format (json/table)', 'json')
    .action(async (options) => {
      try {
        const client = createClient();
        const recordIds = options.records.split(',');
        const result = await client.deleteRecords(
          options.base,
          options.table,
          recordIds
        );
        printOutput(result.records, options.format as OutputFormat);
      } catch (error) {
        printError((error as Error).message);
        process.exit(1);
      }
    });

  return records;
}
