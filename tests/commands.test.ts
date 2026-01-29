import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Command } from 'commander';
import { createRecordsCommand } from '../src/commands/records.js';
import { createBasesCommand } from '../src/commands/bases.js';
import { createTablesCommand } from '../src/commands/tables.js';
import { createFieldsCommand } from '../src/commands/fields.js';
import { createCommentsCommand } from '../src/commands/comments.js';
import { createWebhooksCommand } from '../src/commands/webhooks.js';
import { createAuthCommand } from '../src/commands/auth.js';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Set up API key for tests
beforeEach(() => {
  process.env.AIRTABLE_API_KEY = 'test-api-key';
  mockFetch.mockReset();
});

afterEach(() => {
  delete process.env.AIRTABLE_API_KEY;
});

describe('Records Command', () => {
  it('should create records command with all subcommands', () => {
    const cmd = createRecordsCommand();
    expect(cmd.name()).toBe('records');

    const subcommands = cmd.commands.map((c) => c.name());
    expect(subcommands).toContain('list');
    expect(subcommands).toContain('get');
    expect(subcommands).toContain('create');
    expect(subcommands).toContain('create-batch');
    expect(subcommands).toContain('update');
    expect(subcommands).toContain('update-batch');
    expect(subcommands).toContain('replace');
    expect(subcommands).toContain('upsert');
    expect(subcommands).toContain('delete');
    expect(subcommands).toContain('delete-batch');
  });

  it('should have correct options for list command', () => {
    const cmd = createRecordsCommand();
    const listCmd = cmd.commands.find((c) => c.name() === 'list');
    expect(listCmd).toBeDefined();

    const optionNames = listCmd!.options.map((o) => o.long);
    expect(optionNames).toContain('--base');
    expect(optionNames).toContain('--table');
    expect(optionNames).toContain('--view');
    expect(optionNames).toContain('--filter');
    expect(optionNames).toContain('--sort');
    expect(optionNames).toContain('--all');
    expect(optionNames).toContain('--format');
  });
});

describe('Bases Command', () => {
  it('should create bases command with all subcommands', () => {
    const cmd = createBasesCommand();
    expect(cmd.name()).toBe('bases');

    const subcommands = cmd.commands.map((c) => c.name());
    expect(subcommands).toContain('list');
    expect(subcommands).toContain('schema');
  });

  it('should have correct options for list command', () => {
    const cmd = createBasesCommand();
    const listCmd = cmd.commands.find((c) => c.name() === 'list');
    expect(listCmd).toBeDefined();

    const optionNames = listCmd!.options.map((o) => o.long);
    expect(optionNames).toContain('--all');
    expect(optionNames).toContain('--offset');
    expect(optionNames).toContain('--format');
  });

  it('should have correct options for schema command', () => {
    const cmd = createBasesCommand();
    const schemaCmd = cmd.commands.find((c) => c.name() === 'schema');
    expect(schemaCmd).toBeDefined();

    const optionNames = schemaCmd!.options.map((o) => o.long);
    expect(optionNames).toContain('--base');
    expect(optionNames).toContain('--format');
  });
});

describe('Tables Command', () => {
  it('should create tables command with all subcommands', () => {
    const cmd = createTablesCommand();
    expect(cmd.name()).toBe('tables');

    const subcommands = cmd.commands.map((c) => c.name());
    expect(subcommands).toContain('create');
    expect(subcommands).toContain('update');
  });

  it('should have correct options for create command', () => {
    const cmd = createTablesCommand();
    const createCmd = cmd.commands.find((c) => c.name() === 'create');
    expect(createCmd).toBeDefined();

    const optionNames = createCmd!.options.map((o) => o.long);
    expect(optionNames).toContain('--base');
    expect(optionNames).toContain('--name');
    expect(optionNames).toContain('--description');
    expect(optionNames).toContain('--fields');
  });
});

describe('Fields Command', () => {
  it('should create fields command with all subcommands', () => {
    const cmd = createFieldsCommand();
    expect(cmd.name()).toBe('fields');

    const subcommands = cmd.commands.map((c) => c.name());
    expect(subcommands).toContain('create');
    expect(subcommands).toContain('update');
    expect(subcommands).toContain('types');
  });

  it('should have correct options for create command', () => {
    const cmd = createFieldsCommand();
    const createCmd = cmd.commands.find((c) => c.name() === 'create');
    expect(createCmd).toBeDefined();

    const optionNames = createCmd!.options.map((o) => o.long);
    expect(optionNames).toContain('--base');
    expect(optionNames).toContain('--table');
    expect(optionNames).toContain('--name');
    expect(optionNames).toContain('--type');
    expect(optionNames).toContain('--description');
    expect(optionNames).toContain('--options');
  });
});

describe('Comments Command', () => {
  it('should create comments command with all subcommands', () => {
    const cmd = createCommentsCommand();
    expect(cmd.name()).toBe('comments');

    const subcommands = cmd.commands.map((c) => c.name());
    expect(subcommands).toContain('list');
    expect(subcommands).toContain('create');
  });

  it('should have correct options for list command', () => {
    const cmd = createCommentsCommand();
    const listCmd = cmd.commands.find((c) => c.name() === 'list');
    expect(listCmd).toBeDefined();

    const optionNames = listCmd!.options.map((o) => o.long);
    expect(optionNames).toContain('--base');
    expect(optionNames).toContain('--table');
    expect(optionNames).toContain('--record');
    expect(optionNames).toContain('--offset');
  });

  it('should have correct options for create command', () => {
    const cmd = createCommentsCommand();
    const createCmd = cmd.commands.find((c) => c.name() === 'create');
    expect(createCmd).toBeDefined();

    const optionNames = createCmd!.options.map((o) => o.long);
    expect(optionNames).toContain('--base');
    expect(optionNames).toContain('--table');
    expect(optionNames).toContain('--record');
    expect(optionNames).toContain('--message');
  });
});

describe('Webhooks Command', () => {
  it('should create webhooks command with all subcommands', () => {
    const cmd = createWebhooksCommand();
    expect(cmd.name()).toBe('webhooks');

    const subcommands = cmd.commands.map((c) => c.name());
    expect(subcommands).toContain('list');
    expect(subcommands).toContain('create');
    expect(subcommands).toContain('toggle');
    expect(subcommands).toContain('delete');
    expect(subcommands).toContain('refresh');
    expect(subcommands).toContain('payloads');
  });

  it('should have correct options for create command', () => {
    const cmd = createWebhooksCommand();
    const createCmd = cmd.commands.find((c) => c.name() === 'create');
    expect(createCmd).toBeDefined();

    const optionNames = createCmd!.options.map((o) => o.long);
    expect(optionNames).toContain('--base');
    expect(optionNames).toContain('--url');
    expect(optionNames).toContain('--spec');
  });
});

describe('Auth Command', () => {
  it('should create auth command with all subcommands', () => {
    const cmd = createAuthCommand();
    expect(cmd.name()).toBe('auth');

    const subcommands = cmd.commands.map((c) => c.name());
    expect(subcommands).toContain('whoami');
    expect(subcommands).toContain('check');
  });
});

describe('Command Integration', () => {
  it('should execute records list command with mocked API', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          records: [{ id: 'rec1', fields: { Name: 'Test' } }],
        }),
    });

    const program = new Command();
    program.addCommand(createRecordsCommand());

    await program.parseAsync([
      'node',
      'test',
      'records',
      'list',
      '-b',
      'appTest',
      '-t',
      'TestTable',
    ]);

    expect(mockFetch).toHaveBeenCalled();
    const calledUrl = mockFetch.mock.calls[0][0];
    expect(calledUrl).toContain('appTest');
    expect(calledUrl).toContain('TestTable');

    consoleSpy.mockRestore();
  });

  it('should execute bases list command with mocked API', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          bases: [{ id: 'app1', name: 'Base 1', permissionLevel: 'create' }],
        }),
    });

    const program = new Command();
    program.addCommand(createBasesCommand());

    await program.parseAsync(['node', 'test', 'bases', 'list']);

    expect(mockFetch).toHaveBeenCalled();
    const calledUrl = mockFetch.mock.calls[0][0];
    expect(calledUrl).toContain('meta/bases');

    consoleSpy.mockRestore();
  });

  it('should execute auth whoami command with mocked API', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          id: 'usr123',
          scopes: ['data.records:read'],
        }),
    });

    const program = new Command();
    program.addCommand(createAuthCommand());

    await program.parseAsync(['node', 'test', 'auth', 'whoami']);

    expect(mockFetch).toHaveBeenCalled();
    const calledUrl = mockFetch.mock.calls[0][0];
    expect(calledUrl).toContain('meta/whoami');

    consoleSpy.mockRestore();
  });
});
