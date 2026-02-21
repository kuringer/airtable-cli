# Airtable CLI

A fast, fully-featured command-line interface for the [Airtable API](https://airtable.com/developers/web/api/introduction). Manage bases, tables, records, fields, webhooks, and comments — all from your terminal.

[![Tests](https://img.shields.io/badge/tests-113%20passing-brightgreen)](#testing)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

---

## Features

- 📋 **Records** — list, get, create, update, replace, delete (single + bulk)
- 🗄️ **Bases** — list all bases, inspect schema
- 📊 **Tables** — create and update tables
- 🔧 **Fields** — create and update fields
- 💬 **Comments** — list, create, update, delete record comments
- 🔔 **Webhooks** — create, list, refresh, delete; fetch payloads
- 🔐 **OAuth auth** — browser-based login with automatic token refresh
- 🔑 **PAT support** — use a Personal Access Token instead of OAuth

---

## Installation

```bash
git clone https://github.com/robertjurvanen-max/airtable-cli.git
cd airtable-cli
npm install
npm run build
npm link          # makes `airtable` available globally
```

---

## Authentication

### Option A: Personal Access Token (quickest)

```bash
export AIRTABLE_PAT="patXXXXXXXXXXXXXX"
airtable records list <baseId> <tableId>
```

Get a PAT at [airtable.com/create/tokens](https://airtable.com/create/tokens). Required scopes depend on the commands you use.

### Option B: OAuth (recommended for teams)

1. Register an OAuth integration at [airtable.com/create/oauth](https://airtable.com/create/oauth)
   - Redirect URL: `http://localhost:4000/callback`
2. Set credentials:
   ```bash
   export AIRTABLE_CLIENT_ID="your_client_id"
   export AIRTABLE_CLIENT_SECRET="your_client_secret"
   ```
3. Log in:
   ```bash
   airtable auth login          # opens browser automatically
   airtable auth login --manual # for remote/headless environments
   ```

Tokens are stored locally at `~/.airtable/tokens.json` and refreshed automatically.

---

## Usage

### Records

```bash
# List records
airtable records list <baseId> <tableId>
airtable records list <baseId> <tableId> --view "Grid view" --max-records 50
airtable records list <baseId> <tableId> --filter '{Status}="Active"'

# Get a single record
airtable records get <baseId> <tableId> <recordId>

# Create records
airtable records create <baseId> <tableId> '{"Name":"Alice","Status":"Active"}'
airtable records create <baseId> <tableId> --file records.json    # bulk from file

# Update records (PATCH — partial update)
airtable records update <baseId> <tableId> <recordId> '{"Status":"Done"}'

# Replace records (PUT — full replace)
airtable records replace <baseId> <tableId> <recordId> '{"Name":"Alice","Status":"Active"}'

# Delete records
airtable records delete <baseId> <tableId> <recordId>
airtable records delete <baseId> <tableId> recA recB recC    # bulk delete
```

### Bases

```bash
airtable bases list                   # list all accessible bases
airtable bases schema <baseId>        # show tables, fields, and views
```

### Tables

```bash
airtable tables create <baseId> --name "New Table" --fields fields.json
airtable tables update <baseId> <tableId> --name "Renamed Table"
```

### Fields

```bash
airtable fields create <baseId> <tableId> --name "Score" --type number
airtable fields update <baseId> <tableId> <fieldId> --name "Total Score"
```

### Comments

```bash
airtable comments list <baseId> <tableId> <recordId>
airtable comments create <baseId> <tableId> <recordId> "Great work!"
airtable comments update <baseId> <tableId> <recordId> <commentId> "Updated text"
airtable comments delete <baseId> <tableId> <recordId> <commentId>
```

### Webhooks

```bash
airtable webhooks list <baseId>
airtable webhooks create <baseId> --url https://example.com/hook
airtable webhooks refresh <baseId> <webhookId>
airtable webhooks delete <baseId> <webhookId>
airtable webhooks payloads <baseId> <webhookId>
```

### Auth

```bash
airtable auth login            # OAuth login (opens browser)
airtable auth login --manual   # OAuth login (manual URL copy)
airtable auth logout           # clear stored tokens
airtable auth status           # check current auth state
airtable auth whoami           # show current user info
```

---

## Output Formats

All commands support `--output` / `-o`:

```bash
airtable records list <baseId> <tableId> --output json    # raw JSON
airtable records list <baseId> <tableId> --output table   # formatted table (default)
airtable records list <baseId> <tableId> --output csv     # CSV
```

---

## Environment Variables

| Variable | Description |
|---|---|
| `AIRTABLE_PAT` | Personal Access Token |
| `AIRTABLE_CLIENT_ID` | OAuth client ID |
| `AIRTABLE_CLIENT_SECRET` | OAuth client secret |

---

## Testing

```bash
npm test               # run all tests (113 tests across 4 suites)
npm run test:watch     # watch mode
npm run test:coverage  # with coverage report
```

Test suites:
- `client.test.ts` — API client (41 tests)
- `oauth.test.ts` — auth flow (31 tests)
- `commands.test.ts` — CLI commands (18 tests)
- `output.test.ts` — output formatting (23 tests)

---

## Development

```bash
npm run dev    # run with tsx (no build step)
npm run build  # compile TypeScript → dist/
npm run lint   # lint source files
```

---

## License

MIT
