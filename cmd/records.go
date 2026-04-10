package cmd

import (
	"encoding/json"
	"fmt"
	"io"
	"os"
	"strings"

	"github.com/andrejkostal/airtable-cli/internal/client"
)

// RecordsCmd queries and manages table records.
type RecordsCmd struct {
	List   RecordsListCmd   `cmd:"" help:"List records from a table."`
	Get    RecordsGetCmd    `cmd:"" help:"Get a single record."`
	Create RecordsCreateCmd `cmd:"" help:"Create record(s)."`
	Update RecordsUpdateCmd `cmd:"" help:"Update a record."`
	Delete RecordsDeleteCmd `cmd:"" help:"Delete record(s)."`
}

// RecordsListCmd lists records from a table.
type RecordsListCmd struct {
	Table        string `arg:"" help:"Table name or ID."`
	Filter       string `short:"f" help:"Filter formula."`
	Sort         string `short:"s" help:"Sort by field."`
	Direction    string `short:"d" default:"asc" enum:"asc,desc" help:"Sort direction."`
	View         string `short:"v" help:"View name or ID."`
	Fields       string `help:"Comma-separated fields to return."`
	All          bool   `short:"a" help:"Fetch all records (auto-paginate)."`
	Limit        int    `short:"n" default:"100" help:"Records per page."`
	WithFieldIds bool   `help:"Return field IDs instead of names."`
}

// Run lists records from a table.
func (c *RecordsListCmd) Run(globals *Globals) error {
	out, cl, baseID := mustBase(globals, "")
	if cl == nil {
		return nil
	}

	var fields []string
	if c.Fields != "" {
		for _, f := range strings.Split(c.Fields, ",") {
			trimmed := strings.TrimSpace(f)
			if trimmed != "" {
				fields = append(fields, trimmed)
			}
		}
	}

	params := client.ListParams{
		Filter:                c.Filter,
		Sort:                  c.Sort,
		Direction:             c.Direction,
		View:                  c.View,
		Fields:                fields,
		PageSize:              c.Limit,
		ReturnFieldsByFieldId: c.WithFieldIds,
	}

	if c.All {
		records, err := cl.ListAllRecords(baseID, c.Table, params)
		if err != nil {
			out.Error(errorCode(err), err.Error())
			return nil
		}
		out.Success(records)
	} else {
		resp, err := cl.ListRecords(baseID, c.Table, params)
		if err != nil {
			out.Error(errorCode(err), err.Error())
			return nil
		}
		out.Success(resp)
	}

	return nil
}

// RecordsGetCmd gets a single record by ID.
type RecordsGetCmd struct {
	Table    string `arg:"" help:"Table name or ID."`
	RecordId string `arg:"" name:"record-id" help:"Record ID."`
}

// Run gets a single record.
func (c *RecordsGetCmd) Run(globals *Globals) error {
	out, cl, baseID := mustBase(globals, "")
	if cl == nil {
		return nil
	}

	record, err := cl.GetRecord(baseID, c.Table, c.RecordId)
	if err != nil {
		out.Error(errorCode(err), err.Error())
		return nil
	}

	out.Success(record)
	return nil
}

// RecordsCreateCmd creates one or more records.
type RecordsCreateCmd struct {
	Table    string `arg:"" help:"Table name or ID."`
	Fields   string `help:"Fields as JSON object or array of objects."`
	Typecast bool   `help:"Enable automatic type casting."`
}

// Run creates record(s) from JSON fields flag or stdin.
func (c *RecordsCreateCmd) Run(globals *Globals) error {
	out, cl, baseID := mustBase(globals, "")
	if cl == nil {
		return nil
	}

	jsonStr, err := readFieldsInput(c.Fields)
	if err != nil {
		out.Error("VALIDATION_ERROR", err.Error())
		return nil
	}

	// Try parsing as array first.
	var arr []map[string]any
	if json.Unmarshal([]byte(jsonStr), &arr) == nil {
		records, err := cl.CreateRecords(baseID, c.Table, arr, c.Typecast)
		if err != nil {
			out.Error(errorCode(err), err.Error())
			return nil
		}
		out.Success(records)
		return nil
	}

	// Otherwise parse as single object.
	var obj map[string]any
	if err := json.Unmarshal([]byte(jsonStr), &obj); err != nil {
		out.Error("VALIDATION_ERROR", fmt.Sprintf("invalid JSON: %v", err))
		return nil
	}

	record, err := cl.CreateRecord(baseID, c.Table, obj, c.Typecast)
	if err != nil {
		out.Error(errorCode(err), err.Error())
		return nil
	}
	out.Success(record)
	return nil
}

// RecordsUpdateCmd updates a single record.
type RecordsUpdateCmd struct {
	Table    string `arg:"" help:"Table name or ID."`
	RecordId string `arg:"" name:"record-id" help:"Record ID."`
	Fields   string `help:"Fields as JSON object."`
	Typecast bool   `help:"Enable automatic type casting."`
}

// Run updates a record.
func (c *RecordsUpdateCmd) Run(globals *Globals) error {
	out, cl, baseID := mustBase(globals, "")
	if cl == nil {
		return nil
	}

	jsonStr, err := readFieldsInput(c.Fields)
	if err != nil {
		out.Error("VALIDATION_ERROR", err.Error())
		return nil
	}

	var fields map[string]any
	if err := json.Unmarshal([]byte(jsonStr), &fields); err != nil {
		out.Error("VALIDATION_ERROR", fmt.Sprintf("invalid JSON: %v", err))
		return nil
	}

	record, err := cl.UpdateRecord(baseID, c.Table, c.RecordId, fields, c.Typecast)
	if err != nil {
		out.Error(errorCode(err), err.Error())
		return nil
	}

	out.Success(record)
	return nil
}

// RecordsDeleteCmd deletes one or more records.
type RecordsDeleteCmd struct {
	Table     string   `arg:"" help:"Table name or ID."`
	RecordIds []string `arg:"" name:"record-ids" help:"Record ID(s) to delete."`
}

// Run deletes record(s).
func (c *RecordsDeleteCmd) Run(globals *Globals) error {
	out, cl, baseID := mustBase(globals, "")
	if cl == nil {
		return nil
	}

	if len(c.RecordIds) == 0 {
		out.Error("VALIDATION_ERROR", "at least one record ID is required")
		return nil
	}

	if len(c.RecordIds) == 1 {
		if err := cl.DeleteRecord(baseID, c.Table, c.RecordIds[0]); err != nil {
			out.Error(errorCode(err), err.Error())
			return nil
		}
		out.Success(map[string]any{"deleted": 1, "ids": c.RecordIds})
	} else {
		if err := cl.DeleteRecords(baseID, c.Table, c.RecordIds); err != nil {
			out.Error(errorCode(err), err.Error())
			return nil
		}
		out.Success(map[string]any{"deleted": len(c.RecordIds), "ids": c.RecordIds})
	}

	return nil
}

// readFieldsInput returns JSON from the flag value or stdin.
func readFieldsInput(flagValue string) (string, error) {
	if flagValue != "" {
		return flagValue, nil
	}

	stat, err := os.Stdin.Stat()
	if err != nil {
		return "", fmt.Errorf("no fields provided; use --fields or pipe JSON via stdin")
	}
	isPipe := (stat.Mode() & os.ModeCharDevice) == 0
	if !isPipe {
		return "", fmt.Errorf("no fields provided; use --fields or pipe JSON via stdin")
	}

	data, err := io.ReadAll(os.Stdin)
	if err != nil {
		return "", fmt.Errorf("read stdin: %w", err)
	}

	trimmed := strings.TrimSpace(string(data))
	if trimmed == "" {
		return "", fmt.Errorf("empty stdin input")
	}

	return trimmed, nil
}
