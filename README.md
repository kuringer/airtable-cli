# Airtable CLI

Lightweight Go CLI for the Airtable API. Agent-first: JSON output by default, structured errors, auto-pagination, auto-chunking.

## Install

```bash
git clone https://github.com/kuringer/airtable-cli.git
cd airtable-cli
make install-mac    # copies to ~/.local/bin/
```

## Quick Start

```bash
# Set your PAT (get one at https://airtable.com/create/tokens)
export AIRTABLE_PAT="patXXXXXX"

# Or store in config
airtable config set pat patXXXXXX
airtable config set base appXXXXXX

# Discover
airtable bases list
airtable schema

# Read
airtable records list Tasks --all
airtable records list Tasks --filter '{Status}="Active"'
airtable records get Tasks recXXXXXX

# Write
airtable records create Tasks --fields '{"Name":"Alice"}'
echo '{"Status":"Done"}' | airtable records update Tasks recXXXXXX
airtable records delete Tasks recXXXXXX
```

## Auth

PAT resolution order: `--pat` flag > `AIRTABLE_PAT` env > config file.

Required PAT scopes: `data.records:read`, `data.records:write`, `schema.bases:read`.

## Output

JSON by default. Use `-H` for human-readable.

```bash
airtable bases list         # JSON
airtable bases list -H      # human
```

## Config

```bash
airtable config init                     # interactive setup
airtable config set pat patXXX           # set PAT
airtable config set base appXXX          # default base
airtable config set alias.crm appXXX     # base alias
airtable config show                     # print config
```

Config file: `~/.config/airtable/config.toml`

## Development

```bash
make           # build
make test      # run tests
make clean     # remove binaries
```

## License

MIT
