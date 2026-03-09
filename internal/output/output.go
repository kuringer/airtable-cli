// Package output provides structured output formatting for CLI commands.
// It supports both human-readable and JSON output modes.
package output

import (
	"encoding/json"
	"fmt"
	"io"
	"os"

	"github.com/andrejkostal/airtable-cli/internal/exitcode"
)

// exitCode tracks the exit code to be returned by the CLI.
var exitCode = 0

// GetExitCode returns the current exit code.
func GetExitCode() int {
	return exitCode
}

// Response represents a structured API response for JSON output mode.
type Response struct {
	Success bool       `json:"success"`
	Data    any        `json:"data"`
	Error   *ErrorInfo `json:"error"`
}

// ErrorInfo contains error details for failed operations.
type ErrorInfo struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

// Output handles formatted output to a writer in either human or JSON mode.
type Output struct {
	w     io.Writer
	human bool
}

// New creates a new Output instance.
// If human is true, output is formatted for human readability.
// If human is false, output is JSON formatted.
func New(w io.Writer, human bool) *Output {
	return &Output{w: w, human: human}
}

// Success outputs a successful response with the given data.
func (o *Output) Success(data any) {
	if o.human {
		o.prettyJSON(data)
		return
	}
	o.printJSON(Response{Success: true, Data: data, Error: nil})
}

// Error outputs an error response with the given code and message.
// It also sets the appropriate exit code based on the error code.
func (o *Output) Error(code, message string) {
	switch code {
	case "AUTH_REQUIRED", "AUTH_FAILED":
		exitCode = exitcode.Auth
	case "NOT_FOUND":
		exitCode = exitcode.NotFound
	case "VALIDATION_ERROR":
		exitCode = exitcode.Validation
	case "RATE_LIMITED":
		exitCode = exitcode.RateLimited
	default:
		exitCode = exitcode.General
	}

	if o.human {
		fmt.Fprintf(o.w, "Error: %s\n", message)
		return
	}
	o.printJSON(Response{
		Success: false,
		Data:    nil,
		Error:   &ErrorInfo{Code: code, Message: message},
	})
}

func (o *Output) printJSON(resp Response) {
	enc := json.NewEncoder(o.w)
	if err := enc.Encode(resp); err != nil {
		fmt.Fprintf(os.Stderr, "output: json encoding error: %v\n", err)
	}
}

func (o *Output) prettyJSON(data any) {
	enc := json.NewEncoder(o.w)
	enc.SetIndent("", "  ")
	if err := enc.Encode(data); err != nil {
		fmt.Fprintf(os.Stderr, "output: json encoding error: %v\n", err)
	}
}
