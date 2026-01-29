import { Command } from 'commander';
import { createClientAsync } from '../lib/client.js';
import { printOutput, printError, type OutputFormat } from '../lib/output.js';

export function createFieldsCommand(): Command {
  const fields = new Command('fields').description('Manage fields in a table');

  // Create a field
  fields
    .command('create')
    .description('Create a new field in a table')
    .requiredOption('-b, --base <baseId>', 'Base ID')
    .requiredOption('-t, --table <tableId>', 'Table ID')
    .requiredOption('-n, --name <name>', 'Field name')
    .requiredOption('--type <type>', 'Field type (e.g., singleLineText, number, checkbox)')
    .option('-d, --description <description>', 'Field description')
    .option('--options <json>', 'Field options as JSON (type-specific)')
    .option('--format <format>', 'Output format (json/table)', 'json')
    .action(async (options) => {
      try {
        const client = await createClientAsync();
        const fieldOptions = options.options ? JSON.parse(options.options) : undefined;
        const field = await client.createField(options.base, options.table, {
          name: options.name,
          type: options.type,
          description: options.description,
          options: fieldOptions,
        });
        printOutput(field, options.format as OutputFormat);
      } catch (error) {
        printError((error as Error).message);
        process.exit(1);
      }
    });

  // Update a field
  fields
    .command('update')
    .description('Update a field name or description')
    .requiredOption('-b, --base <baseId>', 'Base ID')
    .requiredOption('-t, --table <tableId>', 'Table ID')
    .requiredOption('-f, --field <fieldId>', 'Field ID')
    .option('-n, --name <name>', 'New field name')
    .option('-d, --description <description>', 'New field description')
    .option('--format <format>', 'Output format (json/table)', 'json')
    .action(async (options) => {
      try {
        const client = await createClientAsync();
        const params: { name?: string; description?: string } = {};
        if (options.name) params.name = options.name;
        if (options.description) params.description = options.description;

        if (Object.keys(params).length === 0) {
          printError('At least one of --name or --description is required');
          process.exit(1);
        }

        const field = await client.updateField(
          options.base,
          options.table,
          options.field,
          params
        );
        printOutput(field, options.format as OutputFormat);
      } catch (error) {
        printError((error as Error).message);
        process.exit(1);
      }
    });

  // List field types
  fields
    .command('types')
    .description('Show available field types')
    .action(() => {
      const fieldTypes = [
        { type: 'singleLineText', description: 'Single line of text' },
        { type: 'multilineText', description: 'Multiple lines of text' },
        { type: 'email', description: 'Email address' },
        { type: 'url', description: 'URL' },
        { type: 'phoneNumber', description: 'Phone number' },
        { type: 'number', description: 'Number (integer or decimal)' },
        { type: 'currency', description: 'Currency amount' },
        { type: 'percent', description: 'Percentage' },
        { type: 'checkbox', description: 'Checkbox (true/false)' },
        { type: 'singleSelect', description: 'Single select from options' },
        { type: 'multipleSelects', description: 'Multiple select from options' },
        { type: 'date', description: 'Date' },
        { type: 'dateTime', description: 'Date and time' },
        { type: 'duration', description: 'Duration' },
        { type: 'rating', description: 'Rating (1-10 stars)' },
        { type: 'richText', description: 'Rich text with formatting' },
        { type: 'multipleAttachments', description: 'File attachments' },
        { type: 'multipleRecordLinks', description: 'Links to records in another table' },
        { type: 'barcode', description: 'Barcode' },
        { type: 'autoNumber', description: 'Auto-incrementing number' },
        { type: 'createdTime', description: 'Created timestamp' },
        { type: 'lastModifiedTime', description: 'Last modified timestamp' },
        { type: 'createdBy', description: 'User who created the record' },
        { type: 'lastModifiedBy', description: 'User who last modified the record' },
      ];
      printOutput(fieldTypes, 'table');
    });

  return fields;
}
