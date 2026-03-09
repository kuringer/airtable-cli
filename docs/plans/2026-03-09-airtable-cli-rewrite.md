# Airtable CLI Rewrite - Go, Agent-First

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Lightweight Go CLI for Airtable API, agent-first design. PAT auth, records CRUD, schema inspection. Matches orchestra/slack-cli patterns.

**Architecture:** Single binary Go CLI. Kong for args. TOML config at `~/.config/airtable/config.toml`. PAT token in config or env var. JSON default output (agent-first), `-H` for human. Same `internal/` layout as orchestra/slack.

**Tech Stack:** Go, kong, go-toml/v2, stdlib net/http

---

## Agent-First Design Principles

The primary consumer is an AI agent (Claude Code, pi, etc.), not a human. Every design decision flows from this:

### 1. Structured JSON output by default
All commands return `{"success": true, "data": {...}}` or `{"success": false, "error": {"code": "...", "message": "..."}}`. No free-form text in default mode. Agent parses JSON, never scrapes stdout.

### 2. Schema discovery
Agent needs to understand the data before querying. Key commands:
- `airtable bases list` - what bases exist, their IDs
- `airtable schema [base]` - full schema: tables, fields with types, views. This is the most important command for an agent - it provides the context needed to construct filters, pick fields, and understand relationships.

### 3. Predictable exit codes
Agents use exit codes for control flow:
- 0 = success
- 1 = general error
- 2 = auth error (PAT invalid/missing)
- 3 = not found (record, table, base)
- 4 = validation error (bad filter, bad JSON)
- 5 = rate limited (agent should retry)

### 4. No interactive prompts in command flow
`config init` can be interactive (human runs it once). All other commands fail fast with clear error JSON if config/auth is missing. Agent never gets stuck on a prompt.

Non-interactive auth setup for agents:
```bash
# Option 1: env var (agent-preferred)
export AIRTABLE_PAT="patXXXXXX"
airtable bases list

# Option 2: config set (one-time)
airtable config set pat patXXXXXX
airtable config set base appXXXXXX
```

### 5. Stdin support for data
Agent can pipe JSON data via stdin instead of cramming it into `--fields '...'` args:
```bash
echo '{"Name": "Test"}' | airtable records create Tasks
airtable records create Tasks --fields '{"Name": "Test"}'  # also works
```

### 6. Batch-friendly
- `records list` with `--all` auto-paginates and returns full array
- `records create` accepts array via stdin for bulk create (auto-chunks by 10)
- `records delete` accepts multiple IDs: `airtable records delete Tasks rec1 rec2 rec3`

### 7. Rate limit handling
Client detects HTTP 429, reads `Retry-After` header, and retries automatically (up to 3 retries with backoff). Agent never sees rate limit errors unless sustained.

### 8. Auth resolution order
1. `--pat` flag (explicit per-command)
2. `AIRTABLE_PAT` env var
3. Config file `[auth] pat = "..."`
4. Fail with exit code 2 and actionable error JSON

---

## Patterns from orchestra/slack-cli

| Pattern | Source | Apply |
|---|---|---|
| Kong CLI framework | both | yes |
| `Globals` struct with `-H`, `-q`, `--config` | orchestra | yes, plus `-b` for base |
| `internal/output` with `Response{Success,Data,Error}` | orchestra | yes |
| `internal/config` TOML with defaults + aliases | orchestra | yes (base aliases) |
| `Makefile` with build/install-mac/install-arch | both | yes |
| Positional args where natural | slack `send` | yes |
| Exit codes (structured) | orchestra | yes |

---

## Config design

```toml
[auth]
pat = "patXXXXXXXXXXXX"

[defaults]
base = "appXXXXXXXX"     # default base - skip -b every time
format = "json"           # json | table

[aliases]
crm = "appABC123"
content = "appDEF456"
projects = "appGHI789"
```

---

## Commands

```
# Discovery (agent's first step)
airtable bases list                              # list all bases with IDs
airtable schema [base]                           # full schema: tables, fields, views

# Records CRUD
airtable records list <table> [--filter F] [--sort F] [--view V] [--fields f1,f2] [--all] [--limit N] [--with-field-ids]
airtable records get <table> <recordId>
airtable records create <table> --fields '{...}' [--typecast]   # or stdin
airtable records update <table> <recordId> --fields '{...}' [--typecast]
airtable records delete <table> <recordId> [recordId2...]       # single or bulk

# Config (human runs once, or agent uses `config set`)
airtable config init                             # interactive PAT setup
airtable config show                             # print current config
airtable config set <key> <value>                # non-interactive: pat, base, alias.<name>
```

Key UX decisions:
- `<table>` is positional, accepts name or ID
- Base is implicit from config default (override with `-b appXXX` or alias `-b crm`)
- `--all` auto-paginates; default returns first page (100 records)
- `schema` is top-level command (not under `bases`) because agents use it constantly
- `--view` flag on records list - agents can use Airtable views instead of rebuilding filters
- `--typecast` on create/update - Airtable auto-converts string values to correct field types
- `--with-field-ids` on records list - include field IDs alongside names
- Multiple record IDs for delete = bulk delete
- Stdin JSON piping for create/update

---

## File structure

```
airtable-cli/
  main.go
  cmd/
    globals.go          # Globals struct (Human, Quiet, Config, Base, Pat)
    bases.go            # bases list
    schema.go           # schema command
    records.go          # records list/get/create/update/delete
    config_cmd.go       # config init/show/set
  internal/
    client/
      client.go         # HTTP client, auth, request[T](), retry with backoff
      records.go        # record operations + auto-pagination + auto-chunking
      bases.go          # base list + schema
    config/
      config.go         # TOML load/save/defaults/aliases/set
    output/
      output.go         # Response{Success,Data,Error}, JSON/human modes
    exitcode/
      exitcode.go       # exit code constants
  Makefile
  go.mod
  README.md
  SKILL.md
```

---

## Tasks

### Task 1: Scaffold + build

**Files:**
- Create: `go.mod`
- Create: `main.go`
- Create: `cmd/globals.go`
- Create: `Makefile`

**Steps:**
1. Remove all TS/Node files: `package.json`, `package-lock.json`, `tsconfig.json`, `vitest.config.ts`, `.env.example`, `.gitignore`, `src/`, `tests/`, `node_modules/`, `dist/`, old `README.md`, old `SKILL.md`
2. Write new `.gitignore` for Go (binary, vendor, .env)
3. `go mod init github.com/andrejkostal/airtable-cli`
4. `go get github.com/alecthomas/kong`
5. `go get github.com/pelletier/go-toml/v2`
6. Write `main.go`:
   - Kong setup with CLI struct
   - Version flag via ldflags
   - Command groups: setup (config), data (bases, schema, records)
   - `kong.ExplicitGroups` like orchestra
7. Write `cmd/globals.go`:
   - `Globals{Human bool, Quiet bool, Config string, Base string, Pat string}`
   - `-H` for human, `-q` for quiet, `--config` with default path, `-b` for base override, `--pat` for explicit PAT
8. Write `Makefile`: build/build-linux/test/clean/install-mac/install-arch (copy orchestra pattern, binary name `airtable`)
9. Verify: `go build -o airtable`
10. Commit: `feat: scaffold Go project with kong`

### Task 2: Exit codes + output

**Files:**
- Create: `internal/exitcode/exitcode.go`
- Create: `internal/output/output.go`
- Create: `internal/output/output_test.go`

**Steps:**
1. Write `exitcode.go`:
   ```go
   const (
       Success     = 0
       General     = 1
       Auth        = 2
       NotFound    = 3
       Validation  = 4
       RateLimited = 5
   )
   ```
2. Write `output.go` - follow orchestra pattern exactly:
   - `Response{Success bool, Data any, Error *ErrorInfo}`
   - `ErrorInfo{Code string, Message string}`
   - `Output` struct with `w io.Writer` and `human bool`
   - `New(w, human)`, `Success(data)`, `Error(code, message)`
   - JSON mode: encode Response
   - Human mode: format nicely (pretty JSON for data, "Error: ..." for errors)
   - Track exit code via `exitCode` package var, `GetExitCode()` accessor
3. Write `output_test.go`:
   - Test JSON success output structure
   - Test JSON error output structure
   - Test human mode output
   - Test exit code mapping
4. Run: `go test ./internal/... -v`
5. Commit: `feat: add structured output and exit codes`

### Task 3: Config

**Files:**
- Create: `internal/config/config.go`
- Create: `internal/config/config_test.go`
- Create: `cmd/config_cmd.go`

**Steps:**
1. Write `config.go`:
   ```go
   type Config struct {
       Auth     AuthConfig     `toml:"auth"`
       Defaults DefaultsConfig `toml:"defaults"`
       Aliases  map[string]string `toml:"aliases"`
   }
   type AuthConfig struct {
       Pat string `toml:"pat"`
   }
   type DefaultsConfig struct {
       Base   string `toml:"base"`
       Format string `toml:"format"`
   }
   ```
   - `Default()` returns sensible defaults (format="json")
   - `Load(path)` - read TOML, return defaults if missing
   - `Save(path)` - write TOML with 0600 perms
   - `ResolveBase(input)` - check aliases map, passthrough if not alias
   - `Set(key, value)` - set nested key: "pat" -> Auth.Pat, "base" -> Defaults.Base, "alias.X" -> Aliases[X]
   - `expandPath(path)` for ~ expansion
2. Write `config_test.go`:
   - Load missing file returns defaults
   - Load valid TOML parses correctly
   - Save + Load roundtrip
   - ResolveBase with alias
   - ResolveBase passthrough
   - Set various keys
3. Run: `go test ./internal/config/ -v`
4. Write `cmd/config_cmd.go`:
   - `ConfigCmd` with subcommands: `Show`, `Init`, `Set`
   - `config show` - load and print config
   - `config init` - interactive: prompt for PAT, default base
   - `config set <key> <value>` - non-interactive set + save
5. Wire into `main.go`
6. Verify: `go build && ./airtable config show`
7. Commit: `feat: add config management with non-interactive set`

### Task 4: HTTP client

**Files:**
- Create: `internal/client/client.go`
- Create: `internal/client/client_test.go`

**Steps:**
1. Write `client.go`:
   - `Client` struct: `baseURL string`, `pat string`, `http *http.Client`
   - `New(pat string) *Client`
   - `request[T](ctx, method, endpoint, body) (T, error)` - generic helper
   - Auth header: `Authorization: Bearer <pat>`
   - Error parsing: Airtable returns `{"error": {"type": "...", "message": "..."}}` - extract and wrap
   - Custom error types: `APIError{StatusCode, Type, Message}`, `RateLimitError{RetryAfter}`
   - Rate limit handling: on 429, read `Retry-After` header, sleep and retry (max 3 retries, exponential backoff as fallback if no header)
   - Map errors to exit codes: 401/403->Auth, 404->NotFound, 422->Validation, 429->RateLimited
2. Write `client_test.go`:
   - `httptest.Server` for all tests
   - Auth header is sent correctly
   - Successful JSON response parsed
   - Airtable error response -> APIError with correct fields
   - 429 response -> retry (mock server returns 429 once, then 200)
   - 401 -> Auth error type
   - 404 -> NotFound error type
3. Run: `go test ./internal/client/ -v`
4. Commit: `feat: add HTTP client with auth, error handling, and retry`

### Task 5: Bases + schema

**Files:**
- Create: `internal/client/bases.go`
- Create: `cmd/bases.go`
- Create: `cmd/schema.go`

**Steps:**
1. Write `internal/client/bases.go`:
   - Types:
     ```go
     type Base struct { ID, Name, PermissionLevel string }
     type Schema struct { Tables []Table }
     type Table struct { ID, Name, Description string; Fields []Field; Views []View }
     type Field struct { ID, Name, Type, Description string; Options json.RawMessage }
     type View struct { ID, Name, Type string }
     ```
   - `ListBases() ([]Base, error)` - auto-paginate with offset
   - `GetSchema(baseId string) (*Schema, error)`
2. Write `cmd/bases.go`:
   - `BasesCmd` with `List` subcommand
   - `bases list` - resolve PAT (flag -> env -> config), create client, list bases, output
3. Write `cmd/schema.go`:
   - `SchemaCmd` with optional `Base` positional arg
   - `schema [base]` - uses default base if omitted, resolve via aliases
   - Output full schema JSON (tables, fields with types, views)
4. Wire into `main.go`
5. Verify: `go build`
6. Commit: `feat: add bases list and schema commands`

### Task 6: Records CRUD

**Files:**
- Create: `internal/client/records.go`
- Create: `cmd/records.go`

**Steps:**
1. Write `internal/client/records.go`:
   - Types:
     ```go
     type Record struct { ID, CreatedTime string; Fields map[string]any }
     type ListParams struct {
         Filter, Sort, Direction, View string
         Fields []string
         PageSize int
         Offset string
         ReturnFieldsByFieldId bool
     }
     type ListResponse struct { Records []Record; Offset string }
     ```
   - `ListRecords(baseId, table string, params ListParams) (*ListResponse, error)` - single page
   - `ListAllRecords(baseId, table string, params ListParams) ([]Record, error)` - auto-paginate
   - `GetRecord(baseId, table, recordId string) (*Record, error)`
   - `CreateRecord(baseId, table string, fields map[string]any, typecast bool) (*Record, error)`
   - `CreateRecords(baseId, table string, records []map[string]any, typecast bool) ([]Record, error)` - auto-chunk by 10
   - `UpdateRecord(baseId, table, recordId string, fields map[string]any, typecast bool) (*Record, error)`
   - `DeleteRecord(baseId, table, recordId string) error`
   - `DeleteRecords(baseId, table string, ids []string) error` - auto-chunk by 10
2. Write `cmd/records.go`:
   - `RecordsCmd` with subcommands: `List`, `Get`, `Create`, `Update`, `Delete`
   - `records list <table>`:
     - Flags: `--filter`, `--sort`, `--direction` (asc/desc), `--view`, `--fields` (comma-separated), `--all`, `--limit`, `--with-field-ids`
     - Uses `--all` -> ListAllRecords, otherwise ListRecords with limit as pageSize
   - `records get <table> <recordId>`
   - `records create <table>`:
     - `--fields` flag OR detect stdin (if !isatty, read stdin)
     - `--typecast` flag
     - If input is array, use CreateRecords (bulk); if object, use CreateRecord
   - `records update <table> <recordId>`:
     - `--fields` flag OR stdin
     - `--typecast` flag
   - `records delete <table> <recordId> [moreIds...]`:
     - Positional args: first is required, rest are optional variadic
     - Single ID -> DeleteRecord; multiple -> DeleteRecords
   - All commands: resolve base (flag -> alias -> config default), resolve PAT (flag -> env -> config)
3. Wire into `main.go`
4. Verify: `go build`
5. Commit: `feat: add records CRUD with pagination, chunking, stdin support`

### Task 7: Tests for commands

**Files:**
- Create: `internal/client/bases_test.go`
- Create: `internal/client/records_test.go`

**Steps:**
1. Write `bases_test.go`:
   - ListBases: mock paginated response (2 pages), verify all bases returned
   - GetSchema: mock schema response, verify fields/views parsed
2. Write `records_test.go`:
   - ListRecords: single page, verify query params built correctly
   - ListAllRecords: mock 2-page pagination, verify all records concatenated
   - CreateRecord: verify POST body, typecast flag
   - CreateRecords: verify auto-chunking (send 15 records, expect 2 API calls)
   - UpdateRecord: verify PATCH body
   - DeleteRecord: verify DELETE call
   - DeleteRecords: verify auto-chunking (12 IDs -> 2 calls)
3. Run: `go test ./... -v`
4. Commit: `test: add client tests for bases and records`

### Task 8: SKILL.md + README + install + verify

**Files:**
- Create: `SKILL.md`
- Create: `README.md`

**Steps:**
1. Write `SKILL.md` - agent integration guide:
   - Name/description/metadata header
   - Auth setup: env var (`AIRTABLE_PAT`) or `config set`
   - Discovery workflow: `bases list` -> `schema` -> `records list`
   - Common filter formula patterns:
     ```
     {Status}="Active"
     AND({Status}="Active",{Priority}="High")
     FIND("keyword",{Name})
     IF({Count}>0,TRUE(),FALSE())
     ```
   - Batch operation patterns (stdin piping, bulk delete)
   - Error handling (exit codes table)
   - All commands with examples
2. Write `README.md` - human-facing quick docs
3. `make install-mac`
4. E2E verify with real API (if PAT configured):
   - `airtable bases list`
   - `airtable schema`
   - `airtable records list <table> --limit 3`
5. Commit: `docs: add SKILL.md and README`
6. Push

---

## Estimated size

~600-700 LOC total Go code. Single binary, zero runtime deps, instant startup.
