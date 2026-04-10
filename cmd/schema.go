package cmd

import (
	"os"
	"strings"

	"github.com/andrejkostal/airtable-cli/internal/client"
	"github.com/andrejkostal/airtable-cli/internal/config"
	"github.com/andrejkostal/airtable-cli/internal/output"
)

// SchemaCmd inspects base schema (tables, fields, views).
type SchemaCmd struct {
	Base       string `arg:"" optional:"" help:"Base ID or alias (uses default if omitted)."`
	Table      string `short:"t" help:"Filter to a single table (name or ID)."`
	Tables     bool   `help:"List tables only (name, ID, field/view counts)."`
	Compact    bool   `help:"Omit field options and IDs for compact output."`
	FieldsOnly bool   `name:"fields-only" help:"Minimal output: table names with field name:type pairs only (~3KB)."`
}

// TableSummary is the compact tables-only view.
type TableSummary struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description,omitempty"`
	FieldCount  int    `json:"fieldCount"`
	ViewCount   int    `json:"viewCount"`
}

// CompactField is a field without the Options blob or ID.
type CompactField struct {
	Name        string `json:"name"`
	Type        string `json:"type"`
	Description string `json:"description,omitempty"`
}

// CompactView is a view without the ID.
type CompactView struct {
	Name string `json:"name"`
	Type string `json:"type"`
}

// CompactTable is a table with compact fields (no options, no IDs).
type CompactTable struct {
	Name        string         `json:"name"`
	Description string         `json:"description,omitempty"`
	Fields      []CompactField `json:"fields"`
	Views       []CompactView  `json:"views"`
}

// FieldsOnlyTable is the minimal representation for --fields-only.
type FieldsOnlyTable struct {
	Name   string   `json:"name"`
	Fields []string `json:"fields"`
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

	// Filter to single table if requested.
	if c.Table != "" {
		filtered := filterTable(schema, c.Table)
		if filtered == nil {
			out.Error("NOT_FOUND", "Table not found: "+c.Table)
			return nil
		}
		schema = &client.Schema{Tables: []client.Table{*filtered}}
	}

	// Tables-only summary mode.
	if c.Tables {
		summaries := make([]TableSummary, len(schema.Tables))
		for i, t := range schema.Tables {
			summaries[i] = TableSummary{
				ID:          t.ID,
				Name:        t.Name,
				Description: t.Description,
				FieldCount:  len(t.Fields),
				ViewCount:   len(t.Views),
			}
		}
		out.Success(summaries)
		return nil
	}

	// Fields-only: ultra-compact for agent discovery.
	if c.FieldsOnly {
		out.Success(toFieldsOnly(schema.Tables))
		return nil
	}

	// Compact mode: strip field options and IDs.
	if c.Compact {
		out.Success(toCompact(schema.Tables))
		return nil
	}

	out.Success(schema)
	return nil
}

func toCompact(tables []client.Table) []CompactTable {
	result := make([]CompactTable, len(tables))
	for i, t := range tables {
		fields := make([]CompactField, len(t.Fields))
		for j, f := range t.Fields {
			fields[j] = CompactField{Name: f.Name, Type: f.Type, Description: f.Description}
		}
		views := make([]CompactView, len(t.Views))
		for j, v := range t.Views {
			views[j] = CompactView{Name: v.Name, Type: v.Type}
		}
		result[i] = CompactTable{
			Name:        t.Name,
			Description: t.Description,
			Fields:      fields,
			Views:       views,
		}
	}
	return result
}

func toFieldsOnly(tables []client.Table) []FieldsOnlyTable {
	result := make([]FieldsOnlyTable, len(tables))
	for i, t := range tables {
		fields := make([]string, len(t.Fields))
		for j, f := range t.Fields {
			fields[j] = f.Name + " (" + f.Type + ")"
		}
		result[i] = FieldsOnlyTable{Name: t.Name, Fields: fields}
	}
	return result
}

// filterTable finds a table by name (case-insensitive) or ID.
func filterTable(schema *client.Schema, needle string) *client.Table {
	for i, t := range schema.Tables {
		if t.ID == needle {
			return &schema.Tables[i]
		}
		if strings.EqualFold(t.Name, needle) {
			return &schema.Tables[i]
		}
	}
	return nil
}
