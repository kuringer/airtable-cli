package cmd

import "fmt"

// RecordsCmd queries and manages table records.
type RecordsCmd struct{}

// Run executes the records command.
func (c *RecordsCmd) Run(globals *Globals) error {
	fmt.Println("records: not implemented yet")
	return nil
}
