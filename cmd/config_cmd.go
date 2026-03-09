package cmd

import "fmt"

// ConfigCmd manages CLI configuration.
type ConfigCmd struct{}

// Run executes the config command.
func (c *ConfigCmd) Run(globals *Globals) error {
	fmt.Println("config: not implemented yet")
	return nil
}
