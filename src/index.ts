#!/usr/bin/env node

import { Command } from 'commander';
import { config } from 'dotenv';
import { createRecordsCommand } from './commands/records.js';
import { createBasesCommand } from './commands/bases.js';
import { createTablesCommand } from './commands/tables.js';
import { createFieldsCommand } from './commands/fields.js';
import { createCommentsCommand } from './commands/comments.js';
import { createWebhooksCommand } from './commands/webhooks.js';
import { createAuthCommand } from './commands/auth.js';

// Load environment variables from .env file
config();

const program = new Command();

program
  .name('airtable')
  .description('A comprehensive CLI for interacting with the Airtable API')
  .version('1.0.0');

// Global options
program.option(
  '-k, --api-key <key>',
  'OAuth access token (if not using stored credentials)'
);

// Add all command groups
program.addCommand(createRecordsCommand());
program.addCommand(createBasesCommand());
program.addCommand(createTablesCommand());
program.addCommand(createFieldsCommand());
program.addCommand(createCommentsCommand());
program.addCommand(createWebhooksCommand());
program.addCommand(createAuthCommand());

// Parse and execute
program.parse();
