// Package cmd implements CLI commands for Airtable.
package cmd

// Globals contains shared CLI flags available to all commands.
type Globals struct {
	Human  bool   `short:"H" help:"Human-readable output."`
	Config string `short:"c" env:"AIRTABLE_CONFIG" default:"~/.config/airtable/config.toml" type:"path" help:"Config file path."`
	Base   string `short:"b" env:"AIRTABLE_BASE" help:"Base ID or alias (overrides config default)."`
	Pat    string `env:"AIRTABLE_PAT" help:"Personal Access Token (overrides config)."`
}
