package cmd

import "github.com/andrejkostal/airtable-cli/internal/config"

// resolvePAT returns the PAT from flag, env, or config.
// Returns (pat, configError). Empty pat with nil error means no auth configured.
// Resolution order: --pat flag > AIRTABLE_PAT env (via kong) > config file.
func resolvePAT(globals *Globals) string {
	if globals.Pat != "" {
		return globals.Pat
	}
	// Kong already fills Pat from AIRTABLE_PAT env via the `env` tag.
	// If still empty, try config file.
	cfg, _ := config.Load(globals.Config)
	if cfg != nil {
		return cfg.Auth.Pat
	}
	return ""
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
