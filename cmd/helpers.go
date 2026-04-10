package cmd

import (
	"os"

	"github.com/andrejkostal/airtable-cli/internal/client"
	"github.com/andrejkostal/airtable-cli/internal/config"
	"github.com/andrejkostal/airtable-cli/internal/output"
)

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

// mustAuth creates output and resolves auth. Returns nil client if auth fails.
func mustAuth(globals *Globals) (*output.Output, *client.Client) {
	out := output.New(os.Stdout, globals.Human)

	pat := resolvePAT(globals)
	if pat == "" {
		out.Error("AUTH_REQUIRED", "No PAT configured. Set AIRTABLE_PAT env var or run: airtable config set pat <token>")
		return out, nil
	}

	return out, client.New(pat)
}

// mustBase resolves auth, config, and base. Returns nil client if any step fails.
func mustBase(globals *Globals, explicitBase string) (*output.Output, *client.Client, string) {
	out, cl := mustAuth(globals)
	if cl == nil {
		return out, nil, ""
	}

	cfg, err := config.Load(globals.Config)
	if err != nil {
		out.Error("VALIDATION_ERROR", err.Error())
		return out, nil, ""
	}

	baseID := resolveBase(explicitBase, globals, cfg)
	if baseID == "" {
		out.Error("VALIDATION_ERROR", "No base specified. Use -b <baseId> or set default: airtable config set base <baseId>")
		return out, nil, ""
	}

	return out, cl, baseID
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
