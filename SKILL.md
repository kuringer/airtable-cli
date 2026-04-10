---
name: airtable-cli
description: "Manage Airtable bases, tables, and records via CLI. Use when the user wants to read/write Airtable data, inspect table schemas, or automate Airtable workflows."
---

# Airtable CLI

Agent-first Go CLI for Airtable API. JSON output by default.

## Auth Setup

```bash
# Option 1: env var (preferred for agents)
export AIRTABLE_PAT="patXXXXXX"

# Option 2: config file
airtable config set pat patXXXXXX

# Option 3: interactive
airtable config init
```

Get a PAT at https://airtable.com/create/tokens. Required scopes:
- `data.records:read` / `data.records:write` - records CRUD
- `schema.bases:read` - bases list + schema

## Config

File: `~/.config/airtable/config.toml`

```bash
airtable config set pat patXXXXXX       # store PAT
airtable config set base appXXXXXX      # set default base
airtable config set alias.crm appABC    # create alias
airtable config show                    # print config
```

## Agent Workflow

### Step 1: Discover bases
```bash
airtable bases list
```

### Step 2: Inspect schema (tables, fields, views)
```bash
airtable schema --tables                 # table list only (~5KB)
airtable schema --fields-only            # table + field name:type (~18KB)
airtable schema --fields-only -t Tasks   # single table fields (~2KB)
airtable schema --compact                # structured, no options/IDs (~47KB)
airtable schema -t Tasks                 # full detail for one table
airtable schema                          # full schema (large ~184KB)
airtable schema -b crm                   # via alias
```

Agent-recommended flow: `--tables` first, then `--fields-only -t X` to drill in.

### Step 3: Read records
```bash
airtable records list Tasks
airtable records list Tasks --all                              # auto-paginate
airtable records list Tasks --filter '{Status}="Active"'
airtable records list Tasks --view "Active Items"
airtable records list Tasks --sort Name --direction asc
airtable records list Tasks --fields "Name,Status,Email"
airtable records list Tasks --limit 10
airtable records list Tasks --with-field-ids

airtable records get Tasks recXXXXXX
```

### Step 4: Write records
```bash
# Create single
airtable records create Tasks --fields '{"Name":"Alice","Status":"Active"}'

# Create with typecast (auto-convert strings to correct types)
airtable records create Tasks --fields '{"Name":"Alice","Date":"2024-01-15"}' --typecast

# Create via stdin (single or bulk)
echo '{"Name":"Alice"}' | airtable records create Tasks
echo '[{"Name":"Alice"},{"Name":"Bob"}]' | airtable records create Tasks

# Update
airtable records update Tasks recXXXXXX --fields '{"Status":"Done"}'

# Delete single or bulk
airtable records delete Tasks recXXXXXX
airtable records delete Tasks recAAA recBBB recCCC
```

## Base Resolution

All commands accept `-b` for base. Resolution order:
1. `-b` flag value (alias resolved via config)
2. Config `defaults.base`

```bash
airtable records list -b crm Contacts     # alias
airtable records list -b appXXX Contacts   # direct ID
airtable records list Contacts             # uses config default
```

## Common Filter Patterns

```
{Status}="Active"
AND({Status}="Active",{Priority}="High")
OR({Type}="Bug",{Type}="Feature")
FIND("keyword",{Name})
{Count}>0
IS_AFTER({Created},"2024-01-01")
BLANK({Email})
NOT(BLANK({Email}))
```

## Output

JSON by default (agent-first). Add `-H` for human-readable.

Success:
```json
{"success":true,"data":[...],"error":null}
```

Error:
```json
{"success":false,"data":null,"error":{"code":"NOT_FOUND","message":"Table not found"}}
```

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | General error |
| 2 | Auth error (no PAT, invalid PAT) |
| 3 | Not found (base, table, record) |
| 4 | Validation error (bad filter, bad JSON) |
| 5 | Rate limited (after retries exhausted) |

## Batch Operations

- `records list --all` auto-paginates (follows offset)
- `records create` with array input auto-chunks by 10
- `records delete` with multiple IDs auto-chunks by 10
- Rate limit 429 retried automatically (up to 3 retries with backoff)

## All Commands

```
airtable bases list                                # list all bases
airtable schema [base] [flags]                     # tables, fields, views
  --tables                                         # table list only (name, ID, counts)
  --fields-only                                    # minimal: table + field name:type
  --compact                                        # no field options, no IDs
  -t <table>                                       # filter to single table

airtable records list <table> [flags]              # list records
airtable records get <table> <recordId>            # get one record
airtable records create <table> [--fields JSON]    # create (or stdin)
airtable records update <table> <id> [--fields J]  # update (or stdin)
airtable records delete <table> <id> [ids...]      # delete single/bulk

airtable config init                               # interactive setup
airtable config show                               # print config
airtable config set <key> <value>                  # set config value
```
