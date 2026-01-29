# Airtable CLI

A command-line interface for interacting with Airtable bases, tables, records, and webhooks.

## Installation

```bash
npm install
npm run build
npm link  # Makes 'airtable' command available globally
```

## Authentication (OAuth)

This CLI uses OAuth for secure authentication. Users authorize via Airtable's website and tokens are stored locally with automatic refresh.

### Step 1: Create an OAuth Integration

1. Go to [https://airtable.com/create/oauth](https://airtable.com/create/oauth)
2. Click "Register new OAuth integration"
3. Configure:
   - **Name**: Your app name (e.g., "My Airtable CLI")
   - **Redirect URL**: `http://localhost:4000/callback`

### Step 2: Select Scopes

| Scope | Description |
|-------|-------------|
| `data.records:read` | Read records from tables |
| `data.records:write` | Create, update, delete records |
| `schema.bases:read` | View base and table structure |
| `schema.bases:write` | Create tables and fields |
| `webhook:manage` | Create and manage webhooks |

### Step 3: Get Credentials

After registering, you'll receive:
- **Client ID** (required)
- **Client Secret** (click "Generate" - recommended)

### Step 4: Configure

**Option A: Environment Variables**
```bash
export AIRTABLE_CLIENT_ID="your_client_id"
export AIRTABLE_CLIENT_SECRET="your_client_secret"
```

**Option B: Moltbot/Clawdbot Config** (`~/.clawdbot/clawdbot.json`)
```json
{
  "skills": {
    "entries": {
      "airtable": {
        "enabled": true,
        "env": {
          "AIRTABLE_CLIENT_ID": "your_client_id",
          "AIRTABLE_CLIENT_SECRET": "your_client_secret"
        }
      }
    }
  }
}
```

### Step 5: Login (run locally)

**IMPORTANT**: Run this command in your **local terminal** (not through moltbot/WhatsApp):

```bash
airtable auth login
```

This starts a local callback server on port 4000 and opens your browser. After clicking "Grant access", the server receives the authorization code and stores tokens at `~/.clawdbot/credentials/airtable.json`.

Once logged in, you can use moltbot/clawdbot to interact with Airtable.

## Commands

### Authentication

```bash
airtable auth login      # Login via OAuth (opens browser)
airtable auth logout     # Delete stored credentials
airtable auth status     # Check authentication status
airtable auth whoami     # Get current user info
airtable auth check      # Quick connection test
airtable auth setup      # Show setup instructions
```

### Bases

```bash
airtable bases list                    # List all bases
airtable bases list --all              # List all bases (paginated)
airtable bases schema -b <baseId>      # Get base schema
```

### Records

```bash
# List records
airtable records list -b <baseId> -t <table> [options]
  --view <name>           # Use a specific view
  --filter <formula>      # Filter by formula
  --sort <field>          # Sort by field
  --direction asc|desc    # Sort direction
  --fields <f1,f2>        # Select specific fields
  --all                   # Fetch all (auto-paginate)
  --format json|table|csv # Output format

# Get single record
airtable records get -b <baseId> -t <table> -r <recordId>

# Create record
airtable records create -b <baseId> -t <table> \
  --fields '{"Name": "John", "Email": "john@example.com"}'

# Create multiple records (up to 10)
airtable records create-batch -b <baseId> -t <table> \
  --records '[{"fields": {"Name": "John"}}, {"fields": {"Name": "Jane"}}]'

# Update record
airtable records update -b <baseId> -t <table> -r <recordId> \
  --fields '{"Status": "Active"}'

# Update multiple records
airtable records update-batch -b <baseId> -t <table> \
  --records '[{"id": "rec123", "fields": {"Status": "Active"}}]'

# Replace record (full replacement)
airtable records replace -b <baseId> -t <table> -r <recordId> \
  --fields '{"Name": "New Name", "Status": "Active"}'

# Upsert records
airtable records upsert -b <baseId> -t <table> \
  --records '[{"fields": {"Email": "john@example.com", "Name": "John"}}]' \
  --merge-on Email

# Delete record
airtable records delete -b <baseId> -t <table> -r <recordId>

# Delete multiple records
airtable records delete-batch -b <baseId> -t <table> \
  --records rec123,rec456,rec789
```

### Tables

```bash
# Create table
airtable tables create -b <baseId> -n "Table Name" \
  --fields '[{"name": "Name", "type": "singleLineText"}]'

# Update table
airtable tables update -b <baseId> -t <tableId> -n "New Name"
```

### Fields

```bash
# Create field
airtable fields create -b <baseId> -t <tableId> -n "Field Name" --type singleLineText

# Update field
airtable fields update -b <baseId> -t <tableId> -f <fieldId> -n "New Name"

# List field types
airtable fields types
```

### Comments

```bash
# List comments
airtable comments list -b <baseId> -t <table> -r <recordId>

# Create comment
airtable comments create -b <baseId> -t <table> -r <recordId> -m "Comment text"
```

### Webhooks

```bash
# List webhooks
airtable webhooks list -b <baseId>

# Create webhook
airtable webhooks create -b <baseId> -u https://your-server.com/webhook \
  --spec '{"options": {"filters": {"dataTypes": ["tableData"]}}}'

# Toggle webhook
airtable webhooks toggle -b <baseId> -w <webhookId> --enable true

# Delete webhook
airtable webhooks delete -b <baseId> -w <webhookId>

# Refresh expiration
airtable webhooks refresh -b <baseId> -w <webhookId>

# Get payloads
airtable webhooks payloads -b <baseId> -w <webhookId>
```

## Output Formats

All commands support `--format`:
- `json` (default) - Full JSON output
- `table` - ASCII table format
- `csv` - CSV format (for records)

## Examples

### List bases and explore schema
```bash
airtable bases list --format table
airtable bases schema -b appXXXXXX --format json
```

### Query records with filtering
```bash
airtable records list -b appXXXXXX -t "Contacts" \
  --filter "{Status}='Active'" \
  --sort "Created" --direction desc \
  --format table
```

### Export to CSV
```bash
airtable records list -b appXXXXXX -t "Products" --all --format csv > products.csv
```

### Bulk update
```bash
airtable records update-batch -b appXXXXXX -t "Tasks" \
  --records '[
    {"id": "recA", "fields": {"Status": "Complete"}},
    {"id": "recB", "fields": {"Status": "Complete"}}
  ]'
```

## Token Storage

- **OAuth tokens**: `~/.clawdbot/credentials/airtable.json` (mode 0600)
- Tokens auto-refresh when expired (if refresh token available)
- Run `airtable auth login` if refresh fails

## Rate Limits

Airtable API: 5 requests/second/base. The CLI does not implement rate limiting - be mindful with batch operations.

## Development

```bash
npm install          # Install dependencies
npm run build        # Compile TypeScript
npm test             # Run tests (114 tests)
npm run lint         # Run linter
```

## Moltbot/Clawdbot Integration

1. Symlink the skill:
```bash
ln -s /path/to/airtable-cli ~/.clawdbot/skills/airtable
```

2. Configure in `~/.clawdbot/clawdbot.json` (see above)

3. The skill reads `SKILL.md` for command descriptions and injects environment variables automatically.

## License

MIT
