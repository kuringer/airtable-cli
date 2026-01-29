import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AirtableClient, createClient } from '../src/lib/client.js';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('AirtableClient', () => {
  let client: AirtableClient;

  beforeEach(() => {
    client = new AirtableClient({ apiKey: 'test-api-key' });
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create a client with the provided API key', () => {
      const client = new AirtableClient({ apiKey: 'my-key' });
      expect(client).toBeInstanceOf(AirtableClient);
    });

    it('should use default base URL', () => {
      const client = new AirtableClient({ apiKey: 'my-key' });
      expect(client).toBeInstanceOf(AirtableClient);
    });

    it('should accept custom base URL', () => {
      const client = new AirtableClient({
        apiKey: 'my-key',
        baseUrl: 'https://custom.api.com',
      });
      expect(client).toBeInstanceOf(AirtableClient);
    });
  });

  describe('createClient helper', () => {
    it('should create client with provided API key', () => {
      const client = createClient('my-api-key');
      expect(client).toBeInstanceOf(AirtableClient);
    });

    it('should throw error when no API key provided and no env var', () => {
      const originalEnv = process.env.AIRTABLE_API_KEY;
      delete process.env.AIRTABLE_API_KEY;

      expect(() => createClient()).toThrow(
        'Airtable API key is required'
      );

      process.env.AIRTABLE_API_KEY = originalEnv;
    });

    it('should use AIRTABLE_API_KEY env var when no key provided', () => {
      const originalEnv = process.env.AIRTABLE_API_KEY;
      process.env.AIRTABLE_API_KEY = 'env-api-key';

      const client = createClient();
      expect(client).toBeInstanceOf(AirtableClient);

      process.env.AIRTABLE_API_KEY = originalEnv;
    });
  });

  describe('Records Operations', () => {
    describe('listRecords', () => {
      it('should list records from a table', async () => {
        const mockRecords = {
          records: [
            { id: 'rec1', createdTime: '2024-01-01', fields: { Name: 'Test' } },
          ],
        };
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockRecords),
        });

        const result = await client.listRecords('baseId', 'tableName');

        expect(mockFetch).toHaveBeenCalledWith(
          'https://api.airtable.com/v0/baseId/tableName',
          expect.objectContaining({
            headers: expect.objectContaining({
              Authorization: 'Bearer test-api-key',
            }),
          })
        );
        expect(result).toEqual(mockRecords);
      });

      it('should include query parameters', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ records: [] }),
        });

        await client.listRecords('baseId', 'tableName', {
          pageSize: 50,
          view: 'Grid view',
          filterByFormula: '{Status} = "Active"',
        });

        const calledUrl = mockFetch.mock.calls[0][0];
        expect(calledUrl).toContain('pageSize=50');
        expect(calledUrl).toContain('view=Grid+view');
        expect(calledUrl).toContain('filterByFormula=');
      });

      it('should include sort parameters', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ records: [] }),
        });

        await client.listRecords('baseId', 'tableName', {
          sort: [{ field: 'Name', direction: 'asc' }],
        });

        const calledUrl = mockFetch.mock.calls[0][0];
        expect(calledUrl).toContain('sort%5B0%5D%5Bfield%5D=Name');
        expect(calledUrl).toContain('sort%5B0%5D%5Bdirection%5D=asc');
      });

      it('should include fields parameter', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ records: [] }),
        });

        await client.listRecords('baseId', 'tableName', {
          fields: ['Name', 'Status'],
        });

        const calledUrl = mockFetch.mock.calls[0][0];
        expect(calledUrl).toContain('fields%5B%5D=Name');
        expect(calledUrl).toContain('fields%5B%5D=Status');
      });
    });

    describe('listAllRecords', () => {
      it('should fetch all records with pagination', async () => {
        mockFetch
          .mockResolvedValueOnce({
            ok: true,
            json: () =>
              Promise.resolve({
                records: [{ id: 'rec1', fields: {} }],
                offset: 'offset1',
              }),
          })
          .mockResolvedValueOnce({
            ok: true,
            json: () =>
              Promise.resolve({
                records: [{ id: 'rec2', fields: {} }],
              }),
          });

        const result = await client.listAllRecords('baseId', 'tableName');

        expect(mockFetch).toHaveBeenCalledTimes(2);
        expect(result).toHaveLength(2);
        expect(result[0].id).toBe('rec1');
        expect(result[1].id).toBe('rec2');
      });
    });

    describe('getRecord', () => {
      it('should get a single record by ID', async () => {
        const mockRecord = {
          id: 'rec123',
          createdTime: '2024-01-01',
          fields: { Name: 'Test' },
        };
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockRecord),
        });

        const result = await client.getRecord('baseId', 'tableName', 'rec123');

        expect(mockFetch).toHaveBeenCalledWith(
          'https://api.airtable.com/v0/baseId/tableName/rec123',
          expect.any(Object)
        );
        expect(result).toEqual(mockRecord);
      });
    });

    describe('createRecord', () => {
      it('should create a single record', async () => {
        const mockRecord = {
          id: 'recNew',
          createdTime: '2024-01-01',
          fields: { Name: 'New Record' },
        };
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockRecord),
        });

        const result = await client.createRecord('baseId', 'tableName', {
          fields: { Name: 'New Record' },
        });

        expect(mockFetch).toHaveBeenCalledWith(
          'https://api.airtable.com/v0/baseId/tableName',
          expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({ fields: { Name: 'New Record' } }),
          })
        );
        expect(result).toEqual(mockRecord);
      });

      it('should support typecast option', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ id: 'rec', fields: {} }),
        });

        await client.createRecord('baseId', 'tableName', {
          fields: { Name: 'Test' },
          typecast: true,
        });

        const body = JSON.parse(mockFetch.mock.calls[0][1].body);
        expect(body.typecast).toBe(true);
      });
    });

    describe('createRecords', () => {
      it('should create multiple records', async () => {
        const mockResponse = {
          records: [
            { id: 'rec1', fields: { Name: 'Record 1' } },
            { id: 'rec2', fields: { Name: 'Record 2' } },
          ],
        };
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockResponse),
        });

        const result = await client.createRecords('baseId', 'tableName', [
          { fields: { Name: 'Record 1' } },
          { fields: { Name: 'Record 2' } },
        ]);

        expect(result.records).toHaveLength(2);
      });

      it('should throw error when trying to create more than 10 records', async () => {
        const records = Array(11).fill({ fields: { Name: 'Test' } });

        await expect(
          client.createRecords('baseId', 'tableName', records)
        ).rejects.toThrow('Cannot create more than 10 records at once');
      });
    });

    describe('updateRecord', () => {
      it('should update a record', async () => {
        const mockRecord = {
          id: 'rec123',
          fields: { Name: 'Updated' },
        };
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockRecord),
        });

        const result = await client.updateRecord(
          'baseId',
          'tableName',
          'rec123',
          { Name: 'Updated' }
        );

        expect(mockFetch).toHaveBeenCalledWith(
          'https://api.airtable.com/v0/baseId/tableName/rec123',
          expect.objectContaining({
            method: 'PATCH',
          })
        );
        expect(result).toEqual(mockRecord);
      });
    });

    describe('updateRecords', () => {
      it('should update multiple records', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ records: [] }),
        });

        await client.updateRecords('baseId', 'tableName', [
          { id: 'rec1', fields: { Name: 'Updated 1' } },
          { id: 'rec2', fields: { Name: 'Updated 2' } },
        ]);

        expect(mockFetch).toHaveBeenCalledWith(
          'https://api.airtable.com/v0/baseId/tableName',
          expect.objectContaining({
            method: 'PATCH',
          })
        );
      });

      it('should throw error when trying to update more than 10 records', async () => {
        const records = Array(11).fill({ id: 'rec', fields: {} });

        await expect(
          client.updateRecords('baseId', 'tableName', records)
        ).rejects.toThrow('Cannot update more than 10 records at once');
      });
    });

    describe('replaceRecord', () => {
      it('should replace a record using PUT', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ id: 'rec123', fields: {} }),
        });

        await client.replaceRecord('baseId', 'tableName', 'rec123', {
          Name: 'Replaced',
        });

        expect(mockFetch).toHaveBeenCalledWith(
          'https://api.airtable.com/v0/baseId/tableName/rec123',
          expect.objectContaining({
            method: 'PUT',
          })
        );
      });
    });

    describe('deleteRecord', () => {
      it('should delete a record', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ id: 'rec123', deleted: true }),
        });

        const result = await client.deleteRecord(
          'baseId',
          'tableName',
          'rec123'
        );

        expect(mockFetch).toHaveBeenCalledWith(
          'https://api.airtable.com/v0/baseId/tableName/rec123',
          expect.objectContaining({
            method: 'DELETE',
          })
        );
        expect(result.deleted).toBe(true);
      });
    });

    describe('deleteRecords', () => {
      it('should delete multiple records', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              records: [
                { id: 'rec1', deleted: true },
                { id: 'rec2', deleted: true },
              ],
            }),
        });

        const result = await client.deleteRecords('baseId', 'tableName', [
          'rec1',
          'rec2',
        ]);

        expect(result.records).toHaveLength(2);
      });

      it('should throw error when trying to delete more than 10 records', async () => {
        const recordIds = Array(11).fill('rec');

        await expect(
          client.deleteRecords('baseId', 'tableName', recordIds)
        ).rejects.toThrow('Cannot delete more than 10 records at once');
      });
    });
  });

  describe('Base Operations', () => {
    describe('listBases', () => {
      it('should list all accessible bases', async () => {
        const mockBases = {
          bases: [
            { id: 'app123', name: 'Test Base', permissionLevel: 'create' },
          ],
        };
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockBases),
        });

        const result = await client.listBases();

        expect(mockFetch).toHaveBeenCalledWith(
          'https://api.airtable.com/v0/meta/bases',
          expect.any(Object)
        );
        expect(result).toEqual(mockBases);
      });

      it('should include offset for pagination', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ bases: [] }),
        });

        await client.listBases('offset123');

        const calledUrl = mockFetch.mock.calls[0][0];
        expect(calledUrl).toContain('offset=offset123');
      });
    });

    describe('listAllBases', () => {
      it('should fetch all bases with pagination', async () => {
        mockFetch
          .mockResolvedValueOnce({
            ok: true,
            json: () =>
              Promise.resolve({
                bases: [{ id: 'app1', name: 'Base 1' }],
                offset: 'offset1',
              }),
          })
          .mockResolvedValueOnce({
            ok: true,
            json: () =>
              Promise.resolve({
                bases: [{ id: 'app2', name: 'Base 2' }],
              }),
          });

        const result = await client.listAllBases();

        expect(mockFetch).toHaveBeenCalledTimes(2);
        expect(result).toHaveLength(2);
      });
    });

    describe('getBaseSchema', () => {
      it('should get base schema', async () => {
        const mockSchema = {
          tables: [
            {
              id: 'tbl123',
              name: 'Table 1',
              fields: [],
              views: [],
            },
          ],
        };
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockSchema),
        });

        const result = await client.getBaseSchema('baseId');

        expect(mockFetch).toHaveBeenCalledWith(
          'https://api.airtable.com/v0/meta/bases/baseId/tables',
          expect.any(Object)
        );
        expect(result).toEqual(mockSchema);
      });
    });
  });

  describe('Table Operations', () => {
    describe('createTable', () => {
      it('should create a table', async () => {
        const mockTable = {
          id: 'tblNew',
          name: 'New Table',
          fields: [],
          views: [],
        };
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockTable),
        });

        const result = await client.createTable('baseId', {
          name: 'New Table',
          fields: [{ name: 'Name', type: 'singleLineText' }],
        });

        expect(mockFetch).toHaveBeenCalledWith(
          'https://api.airtable.com/v0/meta/bases/baseId/tables',
          expect.objectContaining({
            method: 'POST',
          })
        );
        expect(result).toEqual(mockTable);
      });
    });

    describe('updateTable', () => {
      it('should update a table', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({ id: 'tbl123', name: 'Updated Name' }),
        });

        await client.updateTable('baseId', 'tbl123', { name: 'Updated Name' });

        expect(mockFetch).toHaveBeenCalledWith(
          'https://api.airtable.com/v0/meta/bases/baseId/tables/tbl123',
          expect.objectContaining({
            method: 'PATCH',
          })
        );
      });
    });
  });

  describe('Field Operations', () => {
    describe('createField', () => {
      it('should create a field', async () => {
        const mockField = {
          id: 'fldNew',
          name: 'New Field',
          type: 'singleLineText',
        };
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockField),
        });

        const result = await client.createField('baseId', 'tbl123', {
          name: 'New Field',
          type: 'singleLineText',
        });

        expect(mockFetch).toHaveBeenCalledWith(
          'https://api.airtable.com/v0/meta/bases/baseId/tables/tbl123/fields',
          expect.objectContaining({
            method: 'POST',
          })
        );
        expect(result).toEqual(mockField);
      });
    });

    describe('updateField', () => {
      it('should update a field', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({ id: 'fld123', name: 'Updated Field' }),
        });

        await client.updateField('baseId', 'tbl123', 'fld123', {
          name: 'Updated Field',
        });

        expect(mockFetch).toHaveBeenCalledWith(
          'https://api.airtable.com/v0/meta/bases/baseId/tables/tbl123/fields/fld123',
          expect.objectContaining({
            method: 'PATCH',
          })
        );
      });
    });
  });

  describe('Comments Operations', () => {
    describe('listComments', () => {
      it('should list comments on a record', async () => {
        const mockComments = {
          comments: [
            {
              id: 'com123',
              author: { id: 'usr123', email: 'test@example.com', name: 'Test' },
              text: 'A comment',
              createdTime: '2024-01-01',
            },
          ],
        };
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockComments),
        });

        const result = await client.listComments(
          'baseId',
          'tableName',
          'rec123'
        );

        expect(mockFetch).toHaveBeenCalledWith(
          'https://api.airtable.com/v0/baseId/tableName/rec123/comments',
          expect.any(Object)
        );
        expect(result).toEqual(mockComments);
      });
    });

    describe('createComment', () => {
      it('should create a comment', async () => {
        const mockComment = {
          id: 'comNew',
          text: 'New comment',
          author: { id: 'usr123', email: 'test@example.com', name: 'Test' },
          createdTime: '2024-01-01',
        };
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockComment),
        });

        const result = await client.createComment(
          'baseId',
          'tableName',
          'rec123',
          'New comment'
        );

        expect(mockFetch).toHaveBeenCalledWith(
          'https://api.airtable.com/v0/baseId/tableName/rec123/comments',
          expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({ text: 'New comment' }),
          })
        );
        expect(result).toEqual(mockComment);
      });
    });
  });

  describe('Webhook Operations', () => {
    describe('listWebhooks', () => {
      it('should list webhooks for a base', async () => {
        const mockWebhooks = {
          webhooks: [
            {
              id: 'wh123',
              notificationUrl: 'https://example.com/webhook',
              areNotificationsEnabled: true,
              isHookEnabled: true,
            },
          ],
        };
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockWebhooks),
        });

        const result = await client.listWebhooks('baseId');

        expect(mockFetch).toHaveBeenCalledWith(
          'https://api.airtable.com/v0/bases/baseId/webhooks',
          expect.any(Object)
        );
        expect(result).toEqual(mockWebhooks);
      });
    });

    describe('createWebhook', () => {
      it('should create a webhook', async () => {
        const mockWebhook = { id: 'whNew' };
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockWebhook),
        });

        const spec = {
          options: {
            filters: {
              dataTypes: ['tableData'],
            },
          },
        };

        await client.createWebhook('baseId', {
          notificationUrl: 'https://example.com/webhook',
          specification: spec,
        });

        expect(mockFetch).toHaveBeenCalledWith(
          'https://api.airtable.com/v0/bases/baseId/webhooks',
          expect.objectContaining({
            method: 'POST',
          })
        );
      });
    });

    describe('deleteWebhook', () => {
      it('should delete a webhook', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 204,
          json: () => Promise.resolve({}),
        });

        await client.deleteWebhook('baseId', 'wh123');

        expect(mockFetch).toHaveBeenCalledWith(
          'https://api.airtable.com/v0/bases/baseId/webhooks/wh123',
          expect.objectContaining({
            method: 'DELETE',
          })
        );
      });
    });

    describe('refreshWebhook', () => {
      it('should refresh a webhook', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ expirationTime: '2025-01-01' }),
        });

        const result = await client.refreshWebhook('baseId', 'wh123');

        expect(mockFetch).toHaveBeenCalledWith(
          'https://api.airtable.com/v0/bases/baseId/webhooks/wh123/refresh',
          expect.objectContaining({
            method: 'POST',
          })
        );
        expect(result.expirationTime).toBeDefined();
      });
    });

    describe('getWebhookPayloads', () => {
      it('should get webhook payloads', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              cursor: 1,
              mightHaveMore: false,
              payloads: [],
            }),
        });

        const result = await client.getWebhookPayloads('baseId', 'wh123');

        expect(mockFetch).toHaveBeenCalledWith(
          'https://api.airtable.com/v0/bases/baseId/webhooks/wh123/payloads',
          expect.any(Object)
        );
        expect(result).toHaveProperty('cursor');
        expect(result).toHaveProperty('mightHaveMore');
        expect(result).toHaveProperty('payloads');
      });

      it('should include cursor parameter', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({ cursor: 2, mightHaveMore: false, payloads: [] }),
        });

        await client.getWebhookPayloads('baseId', 'wh123', 1);

        const calledUrl = mockFetch.mock.calls[0][0];
        expect(calledUrl).toContain('cursor=1');
      });
    });
  });

  describe('User Operations', () => {
    describe('whoAmI', () => {
      it('should get current user info', async () => {
        const mockUserInfo = {
          id: 'usr123',
          scopes: ['data.records:read', 'data.records:write'],
        };
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockUserInfo),
        });

        const result = await client.whoAmI();

        expect(mockFetch).toHaveBeenCalledWith(
          'https://api.airtable.com/v0/meta/whoami',
          expect.any(Object)
        );
        expect(result).toEqual(mockUserInfo);
      });
    });
  });

  describe('Error Handling', () => {
    it('should throw error on non-ok response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: () =>
          Promise.resolve({
            error: { message: 'Invalid API key' },
          }),
      });

      await expect(client.listBases()).rejects.toThrow(
        'Airtable API Error: Invalid API key'
      );
    });

    it('should handle responses without error message', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: () => Promise.reject(new Error('Invalid JSON')),
      });

      await expect(client.listBases()).rejects.toThrow(
        'Airtable API Error: HTTP 500: Internal Server Error'
      );
    });
  });
});
