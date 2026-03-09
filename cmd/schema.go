package cmd

import (
	"os"

	"github.com/andrejkostal/airtable-cli/internal/client"
	"github.com/andrejkostal/airtable-cli/internal/config"
	"github.com/andrejkostal/airtable-cli/internal/output"
)

// SchemaCmd inspects base schema (tables, fields, views).
type SchemaCmd struct {
	Base string `arg:"" optional:"" help:"Base ID or alias (uses default if omitted)."`
}

// Run fetches and displays the schema for a base.
func (c *SchemaCmd) Run(globals *Globals) error {
	out := output.New(os.Stdout, globals.Human)

	pat := resolvePAT(globals)
	if pat == "" {
		out.Error("AUTH_REQUIRED", "No PAT configured. Set AIRTABLE_PAT env var or run: airtable config set pat <token>")
		return nil
	}

	cfg, err := config.Load(globals.Config)
	if err != nil {
		out.Error("VALIDATION_ERROR", err.Error())
		return nil
	}

	baseID := resolveBase(c.Base, globals, cfg)
	if baseID == "" {
		out.Error("VALIDATION_ERROR", "No base specified. Use: airtable schema <baseId> or set default: airtable config set base <baseId>")
		return nil
	}

	schema, err := client.New(pat).GetSchema(baseID)
	if err != nil {
		code := errorCode(err)
		out.Error(code, err.Error())
		return nil
	}

	out.Success(schema)
	return nil
}
