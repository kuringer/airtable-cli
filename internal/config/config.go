// Package config manages TOML-based CLI configuration.
// Config file lives at ~/.config/airtable/config.toml by default.
package config

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	toml "github.com/pelletier/go-toml/v2"
)

// Config holds all CLI configuration.
type Config struct {
	Auth     AuthConfig        `toml:"auth"`
	Defaults DefaultsConfig    `toml:"defaults"`
	Aliases  map[string]string `toml:"aliases"`
}

// AuthConfig holds authentication credentials.
type AuthConfig struct {
	Pat string `toml:"pat"`
}

// DefaultsConfig holds default values for commands.
type DefaultsConfig struct {
	Base   string `toml:"base"`
	Format string `toml:"format"`
}

// Default returns a Config with sensible defaults.
func Default() *Config {
	return &Config{
		Defaults: DefaultsConfig{Format: "json"},
		Aliases:  map[string]string{},
	}
}

// Load reads config from a TOML file at path.
// Returns defaults (no error) if the file does not exist.
func Load(path string) (*Config, error) {
	expanded, err := expandPath(path)
	if err != nil {
		return nil, fmt.Errorf("config: expand path: %w", err)
	}

	data, err := os.ReadFile(expanded)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return Default(), nil
		}
		return nil, fmt.Errorf("config: read file: %w", err)
	}

	cfg := Default()
	if err := toml.Unmarshal(data, cfg); err != nil {
		return nil, fmt.Errorf("config: parse toml: %w", err)
	}

	if cfg.Aliases == nil {
		cfg.Aliases = map[string]string{}
	}

	return cfg, nil
}

// Save writes config as TOML to path with 0600 permissions.
// Creates parent directories as needed.
func (c *Config) Save(path string) error {
	expanded, err := expandPath(path)
	if err != nil {
		return fmt.Errorf("config: expand path: %w", err)
	}

	if err := os.MkdirAll(filepath.Dir(expanded), 0755); err != nil {
		return fmt.Errorf("config: create dir: %w", err)
	}

	data, err := toml.Marshal(c)
	if err != nil {
		return fmt.Errorf("config: marshal toml: %w", err)
	}

	if err := os.WriteFile(expanded, data, 0600); err != nil {
		return fmt.Errorf("config: write file: %w", err)
	}

	return nil
}

// ResolveBase returns the alias target if input matches an alias key,
// otherwise returns input unchanged.
func (c *Config) ResolveBase(input string) string {
	if resolved, ok := c.Aliases[input]; ok {
		return resolved
	}
	return input
}

// Set updates a config value by dotted key.
// Supported keys: pat, base, format, alias.<name>.
func (c *Config) Set(key, value string) error {
	switch key {
	case "pat":
		c.Auth.Pat = value
	case "base":
		c.Defaults.Base = value
	case "format":
		c.Defaults.Format = value
	default:
		if strings.HasPrefix(key, "alias.") {
			name := strings.TrimPrefix(key, "alias.")
			if name == "" {
				return fmt.Errorf("config: alias name cannot be empty")
			}
			if c.Aliases == nil {
				c.Aliases = map[string]string{}
			}
			c.Aliases[name] = value
			return nil
		}
		return fmt.Errorf("config: unknown key %q (valid: pat, base, format, alias.<name>)", key)
	}
	return nil
}

// expandPath replaces a leading ~ with the user's home directory.
func expandPath(path string) (string, error) {
	if !strings.HasPrefix(path, "~") {
		return path, nil
	}
	home, err := os.UserHomeDir()
	if err != nil {
		return "", fmt.Errorf("resolve home dir: %w", err)
	}
	return filepath.Join(home, path[1:]), nil
}
