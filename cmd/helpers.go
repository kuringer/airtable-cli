package cmd

import "github.com/andrejkostal/airtable-cli/internal/config"

// resolvePAT returns the PAT from flag, env, or config. Returns empty string if none found.
// Resolution order: --pat flag > AIRTABLE_PAT env (via kong) > config file.
func resolvePAT(globals *Globals) string {
	if globals.Pat != "" {
		return globals.Pat
	}
	// Kong already fills Pat from AIRTABLE_PAT env via the `env` tag.
	// If still empty, try config file.
	cfg, err := config.Load(globals.Config)
	if err != nil {
		return ""
	}
	return cfg.Auth.Pat
}

// resolveBase returns the base ID from the explicit argument (resolved via alias),
// or falls back to the config default.
func resolveBase(base string, globals *Globals, cfg *config.Config) string {
	if base != "" {
		return cfg.ResolveBase(base)
	}
	if globals.Base != "" {
		return cfg.ResolveBase(globals.Base)
	}
	return cfg.Defaults.Base
}
