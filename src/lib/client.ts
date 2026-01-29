import type {
  AirtableConfig,
  AirtableRecord,
  ListRecordsParams,
  ListRecordsResponse,
  CreateRecordParams,
  UpdateRecordParams,
  DeleteRecordsResponse,
  ListBasesResponse,
  GetBaseSchemaResponse,
  TableSchema,
  CreateTableParams,
  CreateFieldParams,
  FieldSchema,
  ListCommentsResponse,
  Comment,
  ListWebhooksResponse,
  Webhook,
  CreateWebhookParams,
  WhoAmIResponse,
  UpsertParams,
  RecordFields,
} from './types.js';
import { loadTokens, isTokenExpired, refreshAccessToken, saveTokens } from './oauth.js';

const DEFAULT_BASE_URL = 'https://api.airtable.com/v0';

export class AirtableClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(config: AirtableConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || DEFAULT_BASE_URL;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}/${endpoint}`;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      const errorMessage =
        (errorBody as { error?: { message?: string } })?.error?.message ||
        `HTTP ${response.status}: ${response.statusText}`;
      throw new Error(`Airtable API Error: ${errorMessage}`);
    }

    // Handle 204 No Content responses
    if (response.status === 204) {
      return {} as T;
    }

    return response.json() as Promise<T>;
  }

  // ============ Records Operations ============

  /**
   * List records from a table with optional filtering, sorting, and pagination
   */
  async listRecords(
    baseId: string,
    tableIdOrName: string,
    params: ListRecordsParams = {}
  ): Promise<ListRecordsResponse> {
    const queryParams = new URLSearchParams();

    if (params.pageSize) queryParams.set('pageSize', String(params.pageSize));
    if (params.offset) queryParams.set('offset', params.offset);
    if (params.view) queryParams.set('view', params.view);
    if (params.filterByFormula)
      queryParams.set('filterByFormula', params.filterByFormula);
    if (params.cellFormat) queryParams.set('cellFormat', params.cellFormat);
    if (params.timeZone) queryParams.set('timeZone', params.timeZone);
    if (params.userLocale) queryParams.set('userLocale', params.userLocale);
    if (params.returnFieldsByFieldId)
      queryParams.set('returnFieldsByFieldId', 'true');

    if (params.fields) {
      params.fields.forEach((field) => queryParams.append('fields[]', field));
    }

    if (params.sort) {
      params.sort.forEach((s, i) => {
        queryParams.set(`sort[${i}][field]`, s.field);
        if (s.direction) queryParams.set(`sort[${i}][direction]`, s.direction);
      });
    }

    const query = queryParams.toString();
    const endpoint = `${baseId}/${encodeURIComponent(tableIdOrName)}${query ? `?${query}` : ''}`;

    return this.request<ListRecordsResponse>(endpoint);
  }

  /**
   * List all records with automatic pagination
   */
  async listAllRecords(
    baseId: string,
    tableIdOrName: string,
    params: Omit<ListRecordsParams, 'offset'> = {}
  ): Promise<AirtableRecord[]> {
    const allRecords: AirtableRecord[] = [];
    let offset: string | undefined;

    do {
      const response = await this.listRecords(baseId, tableIdOrName, {
        ...params,
        offset,
      });
      allRecords.push(...response.records);
      offset = response.offset;
    } while (offset);

    return allRecords;
  }

  /**
   * Get a single record by ID
   */
  async getRecord(
    baseId: string,
    tableIdOrName: string,
    recordId: string
  ): Promise<AirtableRecord> {
    return this.request<AirtableRecord>(
      `${baseId}/${encodeURIComponent(tableIdOrName)}/${recordId}`
    );
  }

  /**
   * Create a single record
   */
  async createRecord(
    baseId: string,
    tableIdOrName: string,
    params: CreateRecordParams
  ): Promise<AirtableRecord> {
    return this.request<AirtableRecord>(
      `${baseId}/${encodeURIComponent(tableIdOrName)}`,
      {
        method: 'POST',
        body: JSON.stringify(params),
      }
    );
  }

  /**
   * Create multiple records (up to 10 at a time)
   */
  async createRecords(
    baseId: string,
    tableIdOrName: string,
    records: CreateRecordParams[]
  ): Promise<{ records: AirtableRecord[] }> {
    if (records.length > 10) {
      throw new Error('Cannot create more than 10 records at once');
    }

    return this.request<{ records: AirtableRecord[] }>(
      `${baseId}/${encodeURIComponent(tableIdOrName)}`,
      {
        method: 'POST',
        body: JSON.stringify({ records }),
      }
    );
  }

  /**
   * Update a single record (partial update)
   */
  async updateRecord(
    baseId: string,
    tableIdOrName: string,
    recordId: string,
    fields: RecordFields,
    typecast = false
  ): Promise<AirtableRecord> {
    return this.request<AirtableRecord>(
      `${baseId}/${encodeURIComponent(tableIdOrName)}/${recordId}`,
      {
        method: 'PATCH',
        body: JSON.stringify({ fields, typecast }),
      }
    );
  }

  /**
   * Update multiple records (up to 10 at a time)
   */
  async updateRecords(
    baseId: string,
    tableIdOrName: string,
    records: UpdateRecordParams[]
  ): Promise<{ records: AirtableRecord[] }> {
    if (records.length > 10) {
      throw new Error('Cannot update more than 10 records at once');
    }

    return this.request<{ records: AirtableRecord[] }>(
      `${baseId}/${encodeURIComponent(tableIdOrName)}`,
      {
        method: 'PATCH',
        body: JSON.stringify({
          records: records.map((r) => ({
            id: r.id,
            fields: r.fields,
            typecast: r.typecast,
          })),
        }),
      }
    );
  }

  /**
   * Replace a single record (full replacement)
   */
  async replaceRecord(
    baseId: string,
    tableIdOrName: string,
    recordId: string,
    fields: RecordFields,
    typecast = false
  ): Promise<AirtableRecord> {
    return this.request<AirtableRecord>(
      `${baseId}/${encodeURIComponent(tableIdOrName)}/${recordId}`,
      {
        method: 'PUT',
        body: JSON.stringify({ fields, typecast }),
      }
    );
  }

  /**
   * Upsert records (create or update based on specified fields)
   */
  async upsertRecords(
    baseId: string,
    tableIdOrName: string,
    params: UpsertParams
  ): Promise<{ records: AirtableRecord[]; updatedRecords: string[]; createdRecords: string[] }> {
    return this.request(
      `${baseId}/${encodeURIComponent(tableIdOrName)}`,
      {
        method: 'PATCH',
        body: JSON.stringify(params),
      }
    );
  }

  /**
   * Delete a single record
   */
  async deleteRecord(
    baseId: string,
    tableIdOrName: string,
    recordId: string
  ): Promise<{ id: string; deleted: boolean }> {
    return this.request(
      `${baseId}/${encodeURIComponent(tableIdOrName)}/${recordId}`,
      {
        method: 'DELETE',
      }
    );
  }

  /**
   * Delete multiple records (up to 10 at a time)
   */
  async deleteRecords(
    baseId: string,
    tableIdOrName: string,
    recordIds: string[]
  ): Promise<DeleteRecordsResponse> {
    if (recordIds.length > 10) {
      throw new Error('Cannot delete more than 10 records at once');
    }

    const queryParams = new URLSearchParams();
    recordIds.forEach((id) => queryParams.append('records[]', id));

    return this.request<DeleteRecordsResponse>(
      `${baseId}/${encodeURIComponent(tableIdOrName)}?${queryParams.toString()}`,
      {
        method: 'DELETE',
      }
    );
  }

  // ============ Base Operations ============

  /**
   * List all bases accessible with the current token
   */
  async listBases(offset?: string): Promise<ListBasesResponse> {
    const queryParams = offset ? `?offset=${offset}` : '';
    return this.request<ListBasesResponse>(`meta/bases${queryParams}`);
  }

  /**
   * List all bases with automatic pagination
   */
  async listAllBases(): Promise<ListBasesResponse['bases']> {
    const allBases: ListBasesResponse['bases'] = [];
    let offset: string | undefined;

    do {
      const response = await this.listBases(offset);
      allBases.push(...response.bases);
      offset = response.offset;
    } while (offset);

    return allBases;
  }

  /**
   * Get base schema (tables, fields, views)
   */
  async getBaseSchema(baseId: string): Promise<GetBaseSchemaResponse> {
    return this.request<GetBaseSchemaResponse>(`meta/bases/${baseId}/tables`);
  }

  // ============ Table Operations ============

  /**
   * Create a new table in a base
   */
  async createTable(
    baseId: string,
    params: CreateTableParams
  ): Promise<TableSchema> {
    return this.request<TableSchema>(`meta/bases/${baseId}/tables`, {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  /**
   * Update a table's name or description
   */
  async updateTable(
    baseId: string,
    tableId: string,
    params: { name?: string; description?: string }
  ): Promise<TableSchema> {
    return this.request<TableSchema>(
      `meta/bases/${baseId}/tables/${tableId}`,
      {
        method: 'PATCH',
        body: JSON.stringify(params),
      }
    );
  }

  // ============ Field Operations ============

  /**
   * Create a new field in a table
   */
  async createField(
    baseId: string,
    tableId: string,
    params: CreateFieldParams
  ): Promise<FieldSchema> {
    return this.request<FieldSchema>(
      `meta/bases/${baseId}/tables/${tableId}/fields`,
      {
        method: 'POST',
        body: JSON.stringify(params),
      }
    );
  }

  /**
   * Update a field's name or description
   */
  async updateField(
    baseId: string,
    tableId: string,
    fieldId: string,
    params: { name?: string; description?: string }
  ): Promise<FieldSchema> {
    return this.request<FieldSchema>(
      `meta/bases/${baseId}/tables/${tableId}/fields/${fieldId}`,
      {
        method: 'PATCH',
        body: JSON.stringify(params),
      }
    );
  }

  // ============ Comments Operations ============

  /**
   * List comments on a record
   */
  async listComments(
    baseId: string,
    tableIdOrName: string,
    recordId: string,
    offset?: string
  ): Promise<ListCommentsResponse> {
    const queryParams = offset ? `?offset=${offset}` : '';
    return this.request<ListCommentsResponse>(
      `${baseId}/${encodeURIComponent(tableIdOrName)}/${recordId}/comments${queryParams}`
    );
  }

  /**
   * Create a comment on a record
   */
  async createComment(
    baseId: string,
    tableIdOrName: string,
    recordId: string,
    text: string
  ): Promise<Comment> {
    return this.request<Comment>(
      `${baseId}/${encodeURIComponent(tableIdOrName)}/${recordId}/comments`,
      {
        method: 'POST',
        body: JSON.stringify({ text }),
      }
    );
  }

  // ============ Webhook Operations ============

  /**
   * List webhooks for a base
   */
  async listWebhooks(baseId: string): Promise<ListWebhooksResponse> {
    return this.request<ListWebhooksResponse>(`bases/${baseId}/webhooks`);
  }

  /**
   * Create a webhook for a base
   */
  async createWebhook(
    baseId: string,
    params: CreateWebhookParams
  ): Promise<Webhook> {
    return this.request<Webhook>(`bases/${baseId}/webhooks`, {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  /**
   * Enable or disable webhook notifications
   */
  async updateWebhook(
    baseId: string,
    webhookId: string,
    enable: boolean
  ): Promise<void> {
    await this.request(`bases/${baseId}/webhooks/${webhookId}/enableNotifications`, {
      method: 'POST',
      body: JSON.stringify({ enable }),
    });
  }

  /**
   * Delete a webhook
   */
  async deleteWebhook(baseId: string, webhookId: string): Promise<void> {
    await this.request(`bases/${baseId}/webhooks/${webhookId}`, {
      method: 'DELETE',
    });
  }

  /**
   * Refresh a webhook (extend expiration)
   */
  async refreshWebhook(baseId: string, webhookId: string): Promise<{ expirationTime: string }> {
    return this.request(`bases/${baseId}/webhooks/${webhookId}/refresh`, {
      method: 'POST',
    });
  }

  /**
   * Get webhook payloads
   */
  async getWebhookPayloads(
    baseId: string,
    webhookId: string,
    cursor?: number
  ): Promise<{
    cursor: number;
    mightHaveMore: boolean;
    payloads: unknown[];
  }> {
    const queryParams = cursor !== undefined ? `?cursor=${cursor}` : '';
    return this.request(`bases/${baseId}/webhooks/${webhookId}/payloads${queryParams}`);
  }

  // ============ User Operations ============

  /**
   * Get current user info and token scopes
   */
  async whoAmI(): Promise<WhoAmIResponse> {
    return this.request<WhoAmIResponse>('meta/whoami');
  }
}

/**
 * Create an Airtable client with automatic credential resolution.
 *
 * Priority order:
 * 1. Explicitly passed apiKey
 * 2. OAuth tokens stored in ~/.clawdbot/credentials/airtable.json
 * 3. AIRTABLE_API_KEY environment variable
 */
export function createClient(apiKey?: string): AirtableClient {
  // If API key is explicitly provided, use it
  if (apiKey) {
    return new AirtableClient({ apiKey });
  }

  // Try to load OAuth tokens
  const tokens = loadTokens();

  if (tokens) {
    // Check if token needs refresh
    if (isTokenExpired(tokens) && tokens.refresh_token) {
      // Note: This is synchronous context, so we can't refresh here
      // The token will need to be refreshed via 'auth status' or 'auth login'
      console.warn('OAuth token expired. Run "airtable auth login" to refresh.');
    } else if (!isTokenExpired(tokens)) {
      return new AirtableClient({ apiKey: tokens.access_token });
    }
  }

  throw new Error(
    'No Airtable credentials found.\n' +
    'Run "airtable auth login" to authenticate with OAuth'
  );
}

/**
 * Create an Airtable client with async credential resolution (supports token refresh)
 */
export async function createClientAsync(apiKey?: string): Promise<AirtableClient> {
  // If API key is explicitly provided, use it
  if (apiKey) {
    return new AirtableClient({ apiKey });
  }

  // Try to load OAuth tokens with refresh support
  const tokens = loadTokens();

  if (tokens) {
    // Check if token needs refresh
    if (isTokenExpired(tokens) && tokens.refresh_token) {
      const clientId = process.env.AIRTABLE_CLIENT_ID;
      const clientSecret = process.env.AIRTABLE_CLIENT_SECRET;

      if (clientId) {
        try {
          const newTokens = await refreshAccessToken(tokens.refresh_token, { clientId, clientSecret });
          saveTokens(newTokens);
          return new AirtableClient({ apiKey: newTokens.access_token });
        } catch {
          console.warn('Failed to refresh token. Please run "airtable auth login".');
        }
      }
    } else if (!isTokenExpired(tokens)) {
      return new AirtableClient({ apiKey: tokens.access_token });
    }
  }

  throw new Error(
    'No Airtable credentials found.\n' +
    'Run "airtable auth login" to authenticate with OAuth'
  );
}
