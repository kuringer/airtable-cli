package output

import (
	"bytes"
	"encoding/json"
	"testing"

	"github.com/andrejkostal/airtable-cli/internal/exitcode"
)

func resetExitCode() {
	exitCode = 0
}

func TestJSONSuccess(t *testing.T) {
	resetExitCode()
	var buf bytes.Buffer
	out := New(&buf, false)

	out.Success(map[string]string{"key": "value"})

	var resp Response
	if err := json.Unmarshal(buf.Bytes(), &resp); err != nil {
		t.Fatalf("failed to unmarshal response: %v", err)
	}

	if !resp.Success {
		t.Error("expected success=true")
	}
	if resp.Error != nil {
		t.Error("expected error=null")
	}

	data, ok := resp.Data.(map[string]any)
	if !ok {
		t.Fatalf("expected data to be map, got %T", resp.Data)
	}
	if data["key"] != "value" {
		t.Errorf("expected data.key=value, got %v", data["key"])
	}
}

func TestJSONError(t *testing.T) {
	resetExitCode()
	var buf bytes.Buffer
	out := New(&buf, false)

	out.Error("NOT_FOUND", "record not found")

	var resp Response
	if err := json.Unmarshal(buf.Bytes(), &resp); err != nil {
		t.Fatalf("failed to unmarshal response: %v", err)
	}

	if resp.Success {
		t.Error("expected success=false")
	}
	if resp.Data != nil {
		t.Error("expected data=null")
	}
	if resp.Error == nil {
		t.Fatal("expected error to be non-null")
	}
	if resp.Error.Code != "NOT_FOUND" {
		t.Errorf("expected code=NOT_FOUND, got %s", resp.Error.Code)
	}
	if resp.Error.Message != "record not found" {
		t.Errorf("expected message='record not found', got %s", resp.Error.Message)
	}
}

func TestExitCodeMapping(t *testing.T) {
	tests := []struct {
		code     string
		expected int
	}{
		{"AUTH_REQUIRED", exitcode.Auth},
		{"AUTH_FAILED", exitcode.Auth},
		{"NOT_FOUND", exitcode.NotFound},
		{"VALIDATION_ERROR", exitcode.Validation},
		{"RATE_LIMITED", exitcode.RateLimited},
		{"UNKNOWN_ERROR", exitcode.General},
	}

	for _, tt := range tests {
		t.Run(tt.code, func(t *testing.T) {
			resetExitCode()
			var buf bytes.Buffer
			out := New(&buf, false)

			out.Error(tt.code, "test")

			if got := GetExitCode(); got != tt.expected {
				t.Errorf("Error(%q): exit code = %d, want %d", tt.code, got, tt.expected)
			}
		})
	}
}

func TestHumanSuccess(t *testing.T) {
	resetExitCode()
	var buf bytes.Buffer
	out := New(&buf, true)

	out.Success(map[string]string{"key": "value"})

	got := buf.String()
	// Human mode prints pretty JSON for data
	if got == "" {
		t.Error("expected non-empty output")
	}
	// Should contain the data formatted readably
	if !bytes.Contains(buf.Bytes(), []byte("key")) {
		t.Errorf("expected output to contain 'key', got: %s", got)
	}
}

func TestHumanError(t *testing.T) {
	resetExitCode()
	var buf bytes.Buffer
	out := New(&buf, true)

	out.Error("AUTH_FAILED", "invalid token")

	got := buf.String()
	expected := "Error: invalid token\n"
	if got != expected {
		t.Errorf("expected %q, got %q", expected, got)
	}
}
