package main

import (
	"fmt"
	"os"

	"github.com/alecthomas/kong"
	"github.com/andrejkostal/airtable-cli/cmd"
	"github.com/andrejkostal/airtable-cli/internal/output"
)

var version = "dev"

type CLI struct {
	cmd.Globals `embed:""`
	Version     kong.VersionFlag `short:"V" help:"Show version."`
	Config      cmd.ConfigCmd    `cmd:"" group:"setup" help:"Manage configuration."`
	Bases       cmd.BasesCmd     `cmd:"" group:"data" help:"List accessible bases."`
	Schema      cmd.SchemaCmd    `cmd:"" group:"data" help:"Inspect base schema (tables, fields, views)."`
	Records     cmd.RecordsCmd   `cmd:"" group:"data" help:"Query and manage table records."`
}

func main() {
	var cli CLI
	ctx := kong.Parse(&cli,
		kong.Name("airtable"),
		kong.Description(fmt.Sprintf(`Airtable CLI (v%s)

Agent-first CLI for Airtable. JSON output by default, -H for human-readable.

Examples:
  airtable bases list                      # List all bases
  airtable schema -b appXXX                # Show base schema
  airtable records list -b appXXX Tasks    # List records from Tasks table
  airtable config set pat patXXX           # Store PAT in config`, version)),
		kong.Vars{"version": version},
		kong.UsageOnError(),
		kong.ExplicitGroups([]kong.Group{
			{Key: "setup", Title: "Setup"},
			{Key: "data", Title: "Data"},
		}),
	)
	err := ctx.Run(&cli.Globals)
	if err != nil {
		fmt.Fprintf(os.Stderr, "error: %v\n", err)
		os.Exit(1)
	}

	// Commands signal errors via output.Error() which sets exit code.
	if code := output.GetExitCode(); code != 0 {
		os.Exit(code)
	}
}
