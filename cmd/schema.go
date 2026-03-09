package cmd

import "fmt"

// SchemaCmd inspects base schema (tables, fields, views).
type SchemaCmd struct{}

// Run executes the schema command.
func (c *SchemaCmd) Run(globals *Globals) error {
	fmt.Println("schema: not implemented yet")
	return nil
}
