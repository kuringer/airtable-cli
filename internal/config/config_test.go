package config

import (
	"os"
	"path/filepath"
	"testing"
)

func TestDefault(t *testing.T) {
	cfg := Default()

	if cfg.Defaults.Format != "json" {
		t.Errorf("Default format = %q, want %q", cfg.Defaults.Format, "json")
	}
	if cfg.Aliases == nil {
		t.Fatal("Default aliases is nil, want empty map")
	}
	if len(cfg.Aliases) != 0 {
		t.Errorf("Default aliases has %d entries, want 0", len(cfg.Aliases))
	}
	if cfg.Auth.Pat != "" {
		t.Errorf("Default pat = %q, want empty", cfg.Auth.Pat)
	}
	if cfg.Defaults.Base != "" {
		t.Errorf("Default base = %q, want empty", cfg.Defaults.Base)
	}
}

func TestLoadMissingFile(t *testing.T) {
	cfg, err := Load(filepath.Join(t.TempDir(), "nonexistent.toml"))
	if err != nil {
		t.Fatalf("Load missing file: unexpected error: %v", err)
	}
	if cfg.Defaults.Format != "json" {
		t.Errorf("Load missing: format = %q, want %q", cfg.Defaults.Format, "json")
	}
}

func TestLoadValidTOML(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "config.toml")

	content := `
[auth]
pat = "patXXX.abc123"

[defaults]
base = "appABC"
format = "table"

[aliases]
crm = "appCRM123"
sales = "appSALES456"
`
	if err := os.WriteFile(path, []byte(content), 0600); err != nil {
		t.Fatal(err)
	}

	cfg, err := Load(path)
	if err != nil {
		t.Fatalf("Load valid TOML: %v", err)
	}

	if cfg.Auth.Pat != "patXXX.abc123" {
		t.Errorf("pat = %q, want %q", cfg.Auth.Pat, "patXXX.abc123")
	}
	if cfg.Defaults.Base != "appABC" {
		t.Errorf("base = %q, want %q", cfg.Defaults.Base, "appABC")
	}
	if cfg.Defaults.Format != "table" {
		t.Errorf("format = %q, want %q", cfg.Defaults.Format, "table")
	}
	if cfg.Aliases["crm"] != "appCRM123" {
		t.Errorf("alias crm = %q, want %q", cfg.Aliases["crm"], "appCRM123")
	}
	if cfg.Aliases["sales"] != "appSALES456" {
		t.Errorf("alias sales = %q, want %q", cfg.Aliases["sales"], "appSALES456")
	}
}

func TestSaveLoadRoundtrip(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "sub", "config.toml")

	cfg := Default()
	cfg.Auth.Pat = "patRoundtrip"
	cfg.Defaults.Base = "appRT"
	cfg.Aliases["test"] = "appTEST"

	if err := cfg.Save(path); err != nil {
		t.Fatalf("Save: %v", err)
	}

	// Verify file permissions
	info, err := os.Stat(path)
	if err != nil {
		t.Fatalf("Stat: %v", err)
	}
	if perm := info.Mode().Perm(); perm != 0600 {
		t.Errorf("file perm = %o, want 0600", perm)
	}

	loaded, err := Load(path)
	if err != nil {
		t.Fatalf("Load after save: %v", err)
	}

	if loaded.Auth.Pat != "patRoundtrip" {
		t.Errorf("roundtrip pat = %q, want %q", loaded.Auth.Pat, "patRoundtrip")
	}
	if loaded.Defaults.Base != "appRT" {
		t.Errorf("roundtrip base = %q, want %q", loaded.Defaults.Base, "appRT")
	}
	if loaded.Defaults.Format != "json" {
		t.Errorf("roundtrip format = %q, want %q", loaded.Defaults.Format, "json")
	}
	if loaded.Aliases["test"] != "appTEST" {
		t.Errorf("roundtrip alias = %q, want %q", loaded.Aliases["test"], "appTEST")
	}
}

func TestResolveBaseWithAlias(t *testing.T) {
	cfg := Default()
	cfg.Aliases["crm"] = "appCRM999"

	got := cfg.ResolveBase("crm")
	if got != "appCRM999" {
		t.Errorf("ResolveBase(crm) = %q, want %q", got, "appCRM999")
	}
}

func TestResolveBaseWithoutAlias(t *testing.T) {
	cfg := Default()
	cfg.Aliases["crm"] = "appCRM999"

	got := cfg.ResolveBase("appDIRECT")
	if got != "appDIRECT" {
		t.Errorf("ResolveBase(appDIRECT) = %q, want %q", got, "appDIRECT")
	}
}

func TestSetPat(t *testing.T) {
	cfg := Default()
	if err := cfg.Set("pat", "patNEW"); err != nil {
		t.Fatalf("Set pat: %v", err)
	}
	if cfg.Auth.Pat != "patNEW" {
		t.Errorf("pat = %q, want %q", cfg.Auth.Pat, "patNEW")
	}
}

func TestSetBase(t *testing.T) {
	cfg := Default()
	if err := cfg.Set("base", "appBASE"); err != nil {
		t.Fatalf("Set base: %v", err)
	}
	if cfg.Defaults.Base != "appBASE" {
		t.Errorf("base = %q, want %q", cfg.Defaults.Base, "appBASE")
	}
}

func TestSetFormat(t *testing.T) {
	cfg := Default()
	if err := cfg.Set("format", "table"); err != nil {
		t.Fatalf("Set format: %v", err)
	}
	if cfg.Defaults.Format != "table" {
		t.Errorf("format = %q, want %q", cfg.Defaults.Format, "table")
	}
}

func TestSetAlias(t *testing.T) {
	cfg := Default()
	if err := cfg.Set("alias.crm", "appCRM"); err != nil {
		t.Fatalf("Set alias.crm: %v", err)
	}
	if cfg.Aliases["crm"] != "appCRM" {
		t.Errorf("alias crm = %q, want %q", cfg.Aliases["crm"], "appCRM")
	}
}

func TestSetUnknownKey(t *testing.T) {
	cfg := Default()
	err := cfg.Set("bogus", "value")
	if err == nil {
		t.Fatal("Set unknown key: expected error, got nil")
	}
}

func TestSetEmptyAliasName(t *testing.T) {
	cfg := Default()
	err := cfg.Set("alias.", "value")
	if err == nil {
		t.Fatal("Set alias. with empty name: expected error, got nil")
	}
}
