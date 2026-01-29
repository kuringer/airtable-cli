---
name: airtable
description: "Manage Airtable bases, tables, records, comments, and webhooks via the Airtable Web API. Use when the user wants to list, create, update, or delete records, manage table schemas, or interact with Airtable data."
homepage: https://airtable.com/developers/web/api/introduction
repository: https://github.com/anthonyencodeclub/airtable-cli
user-invocable: true
metadata:
  clawdbot:
    emoji: 📊
    requires:
      bins:
        - node
      env:
        - AIRTABLE_CLIENT_ID
    primaryEnv: AIRTABLE_CLIENT_ID
---

# Airtable CLI Skill

Interact with Airtable bases, tables, and records using the official Airtable Web API.

## Authentication (OAuth)

This CLI uses OAuth for secure authentication. Users authorize via Airtable's website and tokens are stored locally with automatic refresh.

**Step 1: Register an OAuth Integration**
1. Go to https://airtable.com/create/oauth
2. Create a new integration with:
   - Name: Your app name
   - Redirect URL: `http://localhost:4000/callback`
3. Select scopes:
   - `data.records:read` - Read records
   - `data.records:write` - Create/update/delete records
   - `schema.bases:read` - Read base/table schemas
   - `schema.bases:write` - Create tables/fields
   - `webhook:manage` - Manage webhooks
4. Save your Client ID and generate a Client Secret

**Step 2: Configure in moltbot**

Add to `~/.clawdbot/clawdbot.json`:
```json
{
  "skills": {
    "entries": {
      "airtable": {
        "enabled": true,
        "env": {
          "AIRTABLE_CLIENT_ID": "your_client_id_here",
          "AIRTABLE_CLIENT_SECRET": "your_client_secret_here"
        }
      }
    }
  }
}
```

**Step 3: Login (run locally)**

**IMPORTANT**: Run this command in your **local terminal**, not through moltbot/WhatsApp:

```bash
airtable auth login
```

This starts a local callback server and opens your browser. After you click "Grant access", the server receives the authorization code and stores tokens securely at `~/.clawdbot/credentials/airtable.json`.

Once logged in, you can use moltbot to interact with Airtable.

## Available Commands

### Authentication
```bash
# Login with OAuth (opens browser)
airtable auth login

# Check authentication status
airtable auth status

# Logout and delete stored credentials
airtable auth logout

# Get current user info and scopes
airtable auth whoami

# Verify connection is valid
airtable auth check
```

### Bases
```bash
# List all accessible bases
airtable bases list [--all] [--format json|table|csv]

# Get base schema (tables, fields, views)
airtable bases schema -b <baseId>
```

### Records
```bash
# List records from a table
airtable records list -b <baseId> -t <tableIdOrName> \
  [--view <viewName>] \
  [--filter <formula>] \
  [--sort <field>] \
  [--direction asc|desc] \
  [--fields <field1,field2>] \
  [--all] \
  [--format json|table|csv]

# Get a single record
airtable records get -b <baseId> -t <tableIdOrName> -r <recordId>

# Create a record
airtable records create -b <baseId> -t <tableIdOrName> \
  --fields '{"Name": "John", "Email": "john@example.com"}' \
  [--typecast]

# Create multiple records (up to 10)
airtable records create-batch -b <baseId> -t <tableIdOrName> \
  --records '[{"fields": {"Name": "John"}}, {"fields": {"Name": "Jane"}}]'

# Update a record (partial update)
airtable records update -b <baseId> -t <tableIdOrName> -r <recordId> \
  --fields '{"Status": "Active"}'

# Update multiple records
airtable records update-batch -b <baseId> -t <tableIdOrName> \
  --records '[{"id": "rec123", "fields": {"Status": "Active"}}]'

# Replace a record (full replacement)
airtable records replace -b <baseId> -t <tableIdOrName> -r <recordId> \
  --fields '{"Name": "Updated Name", "Status": "Active"}'

# Upsert records (create or update based on merge fields)
airtable records upsert -b <baseId> -t <tableIdOrName> \
  --records '[{"fields": {"Email": "john@example.com", "Name": "John Updated"}}]' \
  --merge-on Email

# Delete a record
airtable records delete -b <baseId> -t <tableIdOrName> -r <recordId>

# Delete multiple records
airtable records delete-batch -b <baseId> -t <tableIdOrName> \
  --records rec123,rec456,rec789
```

### Tables
```bash
# Create a new table
airtable tables create -b <baseId> -n "Table Name" \
  --fields '[{"name": "Name", "type": "singleLineText"}, {"name": "Status", "type": "singleSelect"}]'

# Update table name/description
airtable tables update -b <baseId> -t <tableId> -n "New Name"
```

### Fields
```bash
# Create a new field
airtable fields create -b <baseId> -t <tableId> -n "Field Name" --type singleLineText

# Update field name/description
airtable fields update -b <baseId> -t <tableId> -f <fieldId> -n "New Field Name"

# List available field types
airtable fields types
```

### Comments
```bash
# List comments on a record
airtable comments list -b <baseId> -t <tableIdOrName> -r <recordId>

# Add a comment to a record
airtable comments create -b <baseId> -t <tableIdOrName> -r <recordId> \
  -m "This is a comment"
```

### Webhooks
```bash
# List webhooks for a base
airtable webhooks list -b <baseId>

# Create a webhook
airtable webhooks create -b <baseId> -u https://your-server.com/webhook \
  --spec '{"options": {"filters": {"dataTypes": ["tableData"]}}}'

# Enable/disable a webhook
airtable webhooks toggle -b <baseId> -w <webhookId> --enable true

# Delete a webhook
airtable webhooks delete -b <baseId> -w <webhookId>

# Refresh webhook expiration
airtable webhooks refresh -b <baseId> -w <webhookId>

# Get webhook payloads
airtable webhooks payloads -b <baseId> -w <webhookId> [--cursor <n>]
```

## Field Types

Available field types for table/field creation:
- `singleLineText` - Single line of text
- `multilineText` - Multiple lines of text
- `email` - Email address
- `url` - URL
- `phoneNumber` - Phone number
- `number` - Number (integer or decimal)
- `currency` - Currency amount
- `percent` - Percentage
- `checkbox` - Boolean checkbox
- `singleSelect` - Single select dropdown
- `multipleSelects` - Multiple select tags
- `date` - Date only
- `dateTime` - Date and time
- `duration` - Duration value
- `rating` - Rating (1-10 stars)
- `richText` - Rich text with formatting
- `multipleAttachments` - File attachments
- `multipleRecordLinks` - Links to records in another table

## Output Formats

All commands support `--format` option:
- `json` (default) - Full JSON output
- `table` - ASCII table format
- `csv` - CSV format (for records)

## Credential Storage

- **OAuth tokens**: `~/.clawdbot/credentials/airtable.json` (mode 0600)
- **Token refresh**: Automatic when using OAuth with refresh tokens

## Rate Limits

Airtable API has a rate limit of 5 requests per second per base. The CLI does not implement rate limiting - consider this when making batch operations.

## Examples

### Login and list bases
```bash
airtable auth login
airtable bases list --format table
```

### List all records with filtering
```bash
airtable records list -b appXXXXXXX -t "Contacts" \
  --filter "{Status}='Active'" \
  --sort "Created" --direction desc \
  --format table
```

### Export table to CSV
```bash
airtable records list -b appXXXXXXX -t "Products" --all --format csv > products.csv
```

### Bulk update records
```bash
airtable records update-batch -b appXXXXXXX -t "Tasks" \
  --records '[
    {"id": "recA", "fields": {"Status": "Complete"}},
    {"id": "recB", "fields": {"Status": "Complete"}},
    {"id": "recC", "fields": {"Status": "Complete"}}
  ]'
```
