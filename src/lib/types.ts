// Airtable API Types

export interface AirtableConfig {
  apiKey: string;
  baseUrl?: string;
}

export interface AirtableRecord {
  id: string;
  createdTime: string;
  fields: Record<string, unknown>;
}

export interface RecordFields {
  [key: string]: unknown;
}

export interface ListRecordsParams {
  pageSize?: number;
  offset?: string;
  view?: string;
  filterByFormula?: string;
  sort?: SortParam[];
  fields?: string[];
  cellFormat?: 'json' | 'string';
  timeZone?: string;
  userLocale?: string;
  returnFieldsByFieldId?: boolean;
}

export interface SortParam {
  field: string;
  direction?: 'asc' | 'desc';
}

export interface ListRecordsResponse {
  records: AirtableRecord[];
  offset?: string;
}

export interface CreateRecordParams {
  fields: RecordFields;
  typecast?: boolean;
}

export interface UpdateRecordParams {
  id: string;
  fields: RecordFields;
  typecast?: boolean;
}

export interface UpsertRecordParams {
  fields: RecordFields;
  typecast?: boolean;
}

export interface UpsertParams {
  records: UpsertRecordParams[];
  fieldsToMergeOn: string[];
  performUpsert: {
    fieldsToMergeOn: string[];
  };
  typecast?: boolean;
}

export interface DeleteRecordsResponse {
  records: { id: string; deleted: boolean }[];
}

// Base and Table Schema Types
export interface BaseSchema {
  id: string;
  name: string;
  permissionLevel: string;
}

export interface TableSchema {
  id: string;
  name: string;
  description?: string;
  primaryFieldId: string;
  fields: FieldSchema[];
  views: ViewSchema[];
}

export interface FieldSchema {
  id: string;
  name: string;
  type: string;
  description?: string;
  options?: Record<string, unknown>;
}

export interface ViewSchema {
  id: string;
  name: string;
  type: string;
}

export interface ListBasesResponse {
  bases: BaseSchema[];
  offset?: string;
}

export interface GetBaseSchemaResponse {
  tables: TableSchema[];
}

export interface CreateTableParams {
  name: string;
  description?: string;
  fields: CreateFieldParams[];
}

export interface CreateFieldParams {
  name: string;
  type: string;
  description?: string;
  options?: Record<string, unknown>;
}

// Comments Types
export interface Comment {
  id: string;
  author: {
    id: string;
    email: string;
    name: string;
  };
  createdTime: string;
  text: string;
}

export interface ListCommentsResponse {
  comments: Comment[];
  offset?: string;
}

// Webhook Types
export interface Webhook {
  id: string;
  macSecretBase64?: string;
  notificationUrl?: string;
  cursorForNextPayload?: number;
  areNotificationsEnabled: boolean;
  isHookEnabled: boolean;
  expirationTime?: string;
  specification: WebhookSpecification;
}

export interface WebhookSpecification {
  options: {
    filters: {
      dataTypes: string[];
      recordChangeScope?: string;
      sourceOptions?: {
        formPageSubmission?: {
          pageId: string;
        };
        formSubmission?: {
          viewId: string;
        };
      };
    };
    includes?: {
      includeCellValuesInFieldIds?: string[] | 'all';
      includePreviousCellValues?: boolean;
      includePreviousFieldDefinitions?: boolean;
    };
  };
}

export interface CreateWebhookParams {
  notificationUrl: string;
  specification: WebhookSpecification;
}

export interface ListWebhooksResponse {
  webhooks: Webhook[];
}

// User Types
export interface WhoAmIResponse {
  id: string;
  scopes?: string[];
}

// API Error
export interface AirtableError {
  error: {
    type: string;
    message: string;
  };
}
