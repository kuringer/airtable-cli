package cmd

import "fmt"

// BasesCmd lists accessible Airtable bases.
type BasesCmd struct{}

// Run executes the bases command.
func (c *BasesCmd) Run(globals *Globals) error {
	fmt.Println("bases: not implemented yet")
	return nil
}
