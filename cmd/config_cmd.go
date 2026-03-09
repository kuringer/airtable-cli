package cmd

import (
	"bufio"
	"fmt"
	"os"
	"strings"

	"github.com/andrejkostal/airtable-cli/internal/config"
	"github.com/andrejkostal/airtable-cli/internal/output"
)

// ConfigCmd manages CLI configuration.
type ConfigCmd struct {
	Show ConfigShowCmd `cmd:"" help:"Show current configuration."`
	Init ConfigInitCmd `cmd:"" help:"Interactive setup."`
	Set  ConfigSetCmd  `cmd:"" help:"Set a config value."`
}

// ConfigShowCmd displays current configuration.
type ConfigShowCmd struct{}

// ConfigInitCmd runs interactive setup.
type ConfigInitCmd struct{}

// ConfigSetCmd sets a single config value non-interactively.
type ConfigSetCmd struct {
	Key   string `arg:"" help:"Config key (pat, base, format, alias.<name>)."`
	Value string `arg:"" help:"Value to set."`
}

// Run shows the current configuration.
func (c *ConfigShowCmd) Run(globals *Globals) error {
	out := output.New(os.Stdout, globals.Human)

	cfg, err := config.Load(globals.Config)
	if err != nil {
		out.Error("VALIDATION_ERROR", err.Error())
		return nil
	}

	out.Success(cfg)
	return nil
}

// Run performs interactive setup: prompts for PAT and default base.
func (c *ConfigInitCmd) Run(globals *Globals) error {
	out := output.New(os.Stdout, globals.Human)
	scanner := bufio.NewScanner(os.Stdin)

	cfg, err := config.Load(globals.Config)
	if err != nil {
		out.Error("VALIDATION_ERROR", err.Error())
		return nil
	}

	fmt.Println("Airtable CLI setup")
	fmt.Println()
	fmt.Println("Get your Personal Access Token at: https://airtable.com/create/tokens")
	fmt.Print("PAT: ")
	if scanner.Scan() {
		pat := strings.TrimSpace(scanner.Text())
		if pat != "" {
			cfg.Auth.Pat = pat
		}
	}

	fmt.Print("Default base ID (e.g. appXXX, leave empty to skip): ")
	if scanner.Scan() {
		base := strings.TrimSpace(scanner.Text())
		if base != "" {
			cfg.Defaults.Base = base
		}
	}

	if err := cfg.Save(globals.Config); err != nil {
		out.Error("VALIDATION_ERROR", err.Error())
		return nil
	}

	fmt.Println()
	fmt.Printf("Config saved to %s\n", globals.Config)
	if cfg.Auth.Pat != "" {
		fmt.Printf("PAT: %s\n", maskPat(cfg.Auth.Pat))
	}
	if cfg.Defaults.Base != "" {
		fmt.Printf("Default base: %s\n", cfg.Defaults.Base)
	}

	return nil
}

// Run sets a config value non-interactively.
func (c *ConfigSetCmd) Run(globals *Globals) error {
	out := output.New(os.Stdout, globals.Human)

	cfg, err := config.Load(globals.Config)
	if err != nil {
		out.Error("VALIDATION_ERROR", err.Error())
		return nil
	}

	if err := cfg.Set(c.Key, c.Value); err != nil {
		out.Error("VALIDATION_ERROR", err.Error())
		return nil
	}

	if err := cfg.Save(globals.Config); err != nil {
		out.Error("VALIDATION_ERROR", err.Error())
		return nil
	}

	out.Success(map[string]string{
		"message": fmt.Sprintf("set %s", c.Key),
		"key":     c.Key,
		"value":   c.Value,
	})
	return nil
}

// maskPat shows first 5 and last 4 chars, masking the middle.
func maskPat(pat string) string {
	if len(pat) <= 9 {
		return "***"
	}
	return pat[:5] + "..." + pat[len(pat)-4:]
}
