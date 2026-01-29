import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { formatOutput, printOutput, printError, printSuccess } from '../src/lib/output.js';

describe('Output Utilities', () => {
  describe('formatOutput', () => {
    describe('JSON format', () => {
      it('should format data as JSON', () => {
        const data = { name: 'Test', value: 123 };
        const result = formatOutput(data, 'json');
        expect(result).toBe(JSON.stringify(data, null, 2));
      });

      it('should handle arrays', () => {
        const data = [{ id: 1 }, { id: 2 }];
        const result = formatOutput(data, 'json');
        expect(result).toBe(JSON.stringify(data, null, 2));
      });

      it('should handle null', () => {
        const result = formatOutput(null, 'json');
        expect(result).toBe('null');
      });

      it('should default to JSON format', () => {
        const data = { test: true };
        const result = formatOutput(data);
        expect(result).toBe(JSON.stringify(data, null, 2));
      });
    });

    describe('Table format', () => {
      it('should format array of objects as table', () => {
        const data = [
          { name: 'Alice', age: 30 },
          { name: 'Bob', age: 25 },
        ];
        const result = formatOutput(data, 'table');

        expect(result).toContain('name');
        expect(result).toContain('age');
        expect(result).toContain('Alice');
        expect(result).toContain('Bob');
        expect(result).toContain('30');
        expect(result).toContain('25');
        expect(result).toContain('+');
        expect(result).toContain('|');
      });

      it('should handle empty array', () => {
        const result = formatOutput([], 'table');
        expect(result).toBe('No records found.');
      });

      it('should handle Airtable record format with fields', () => {
        const data = [
          { id: 'rec1', fields: { Name: 'Test', Status: 'Active' } },
          { id: 'rec2', fields: { Name: 'Test2', Status: 'Inactive' } },
        ];
        const result = formatOutput(data, 'table');

        expect(result).toContain('id');
        expect(result).toContain('Name');
        expect(result).toContain('Status');
        expect(result).toContain('rec1');
        expect(result).toContain('Test');
        expect(result).toContain('Active');
      });

      it('should truncate long values', () => {
        const data = [
          { description: 'A'.repeat(100) },
        ];
        const result = formatOutput(data, 'table');

        expect(result).toContain('...');
        // Value should be truncated to 50 chars max (47 + '...')
        expect(result).not.toContain('A'.repeat(100));
      });

      it('should format single object', () => {
        const data = { name: 'Test', value: 42 };
        const result = formatOutput(data, 'table');

        expect(result).toContain('name');
        expect(result).toContain('Test');
        expect(result).toContain('value');
        expect(result).toContain('42');
        expect(result).toContain(':');
      });

      it('should handle null/undefined values', () => {
        const data = [
          { name: 'Test', empty: null, missing: undefined },
        ];
        const result = formatOutput(data, 'table');

        expect(result).toContain('name');
        expect(result).toContain('Test');
      });

      it('should return empty string for null data', () => {
        const result = formatOutput(null, 'table');
        expect(result).toBe('');
      });
    });

    describe('CSV format', () => {
      it('should format array of objects as CSV', () => {
        const data = [
          { name: 'Alice', age: 30 },
          { name: 'Bob', age: 25 },
        ];
        const result = formatOutput(data, 'csv');

        const lines = result.split('\n');
        expect(lines[0]).toContain('name');
        expect(lines[0]).toContain('age');
        expect(lines[1]).toContain('Alice');
        expect(lines[1]).toContain('30');
        expect(lines[2]).toContain('Bob');
        expect(lines[2]).toContain('25');
      });

      it('should handle empty array', () => {
        const result = formatOutput([], 'csv');
        expect(result).toBe('');
      });

      it('should escape commas in values', () => {
        const data = [{ text: 'Hello, World' }];
        const result = formatOutput(data, 'csv');

        expect(result).toContain('"Hello, World"');
      });

      it('should escape double quotes in values', () => {
        const data = [{ text: 'He said "hello"' }];
        const result = formatOutput(data, 'csv');

        expect(result).toContain('""hello""');
      });

      it('should handle newlines in values', () => {
        const data = [{ text: 'Line 1\nLine 2' }];
        const result = formatOutput(data, 'csv');

        expect(result).toContain('"Line 1\nLine 2"');
      });

      it('should handle Airtable record format with fields', () => {
        const data = [
          { id: 'rec1', fields: { Name: 'Test' } },
        ];
        const result = formatOutput(data, 'csv');

        expect(result).toContain('id');
        expect(result).toContain('Name');
        expect(result).toContain('rec1');
        expect(result).toContain('Test');
      });

      it('should handle objects in values', () => {
        const data = [
          { name: 'Test', meta: { key: 'value' } },
        ];
        const result = formatOutput(data, 'csv');

        expect(result).toContain('name');
        expect(result).toContain('meta');
      });
    });

    describe('Unknown format', () => {
      it('should default to JSON for unknown format', () => {
        const data = { test: true };
        const result = formatOutput(data, 'unknown' as 'json');
        expect(result).toBe(JSON.stringify(data, null, 2));
      });
    });
  });

  describe('printOutput', () => {
    let consoleSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
      consoleSpy.mockRestore();
    });

    it('should print formatted output to console', () => {
      const data = { test: true };
      printOutput(data, 'json');

      expect(consoleSpy).toHaveBeenCalledWith(JSON.stringify(data, null, 2));
    });

    it('should default to JSON format', () => {
      const data = { test: true };
      printOutput(data);

      expect(consoleSpy).toHaveBeenCalledWith(JSON.stringify(data, null, 2));
    });
  });

  describe('printError', () => {
    let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
      consoleErrorSpy.mockRestore();
    });

    it('should print error message to stderr', () => {
      printError('Something went wrong');

      expect(consoleErrorSpy).toHaveBeenCalledWith('Error: Something went wrong');
    });
  });

  describe('printSuccess', () => {
    let consoleSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
      consoleSpy.mockRestore();
    });

    it('should print success message', () => {
      printSuccess('Operation completed');

      expect(consoleSpy).toHaveBeenCalledWith('Success: Operation completed');
    });
  });
});
