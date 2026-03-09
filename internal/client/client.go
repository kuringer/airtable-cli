// Package client provides the Airtable REST API HTTP client with auth,
// structured error handling, and transparent rate-limit retry.
package client

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/andrejkostal/airtable-cli/internal/exitcode"
)

const defaultBaseURL = "https://api.airtable.com/v0"
const maxRetries = 3

// sleepFn is swapped in tests to avoid real sleeps.
var sleepFn = time.Sleep

// Client is the Airtable API client.
type Client struct {
	baseURL string
	pat     string
	http    *http.Client
}

// New creates a new Airtable client.
func New(pat string) *Client {
	return &Client{
		baseURL: defaultBaseURL,
		pat:     pat,
		http:    &http.Client{Timeout: 30 * time.Second},
	}
}

// NewWithBaseURL creates a client with a custom base URL (for testing).
func NewWithBaseURL(pat, baseURL string) *Client {
	c := New(pat)
	c.baseURL = strings.TrimRight(baseURL, "/")
	return c
}

// APIError represents an Airtable API error response.
type APIError struct {
	StatusCode int
	Type       string
	Message    string
}

func (e *APIError) Error() string {
	return fmt.Sprintf("Airtable API error (%d): %s - %s", e.StatusCode, e.Type, e.Message)
}

// RateLimitError indicates the API returned 429 and retries were exhausted.
type RateLimitError struct {
	RetryAfter time.Duration
}

func (e *RateLimitError) Error() string {
	return fmt.Sprintf("rate limited, retry after %s", e.RetryAfter)
}

// ExitCodeForError maps an error to an appropriate CLI exit code.
func ExitCodeForError(err error) int {
	var apiErr *APIError
	if errors.As(err, &apiErr) {
		switch apiErr.StatusCode {
		case 401, 403:
			return exitcode.Auth
		case 404:
			return exitcode.NotFound
		case 400, 422:
			return exitcode.Validation
		}
		return exitcode.General
	}

	var rlErr *RateLimitError
	if errors.As(err, &rlErr) {
		return exitcode.RateLimited
	}

	return exitcode.General
}

// airtableErrorBody is the JSON envelope Airtable wraps errors in.
type airtableErrorBody struct {
	Error struct {
		Type    string `json:"type"`
		Message string `json:"message"`
	} `json:"error"`
}

// Request performs an HTTP request against the Airtable API and decodes
// the response into T. Rate-limit 429 responses are retried transparently.
func Request[T any](c *Client, method, endpoint string, body any) (T, error) {
	var zero T

	var bodyReader io.Reader
	if body != nil {
		data, err := json.Marshal(body)
		if err != nil {
			return zero, fmt.Errorf("marshal request body: %w", err)
		}
		bodyReader = bytes.NewReader(data)
	}

	url := c.baseURL + "/" + strings.TrimLeft(endpoint, "/")

	for attempt := range maxRetries + 1 {
		// Reset reader for retries.
		if body != nil {
			data, _ := json.Marshal(body)
			bodyReader = bytes.NewReader(data)
		}

		req, err := http.NewRequest(method, url, bodyReader)
		if err != nil {
			return zero, fmt.Errorf("create request: %w", err)
		}
		req.Header.Set("Authorization", "Bearer "+c.pat)
		req.Header.Set("Content-Type", "application/json")

		resp, err := c.http.Do(req)
		if err != nil {
			return zero, fmt.Errorf("execute request: %w", err)
		}

		// Rate limited - retry with backoff.
		if resp.StatusCode == http.StatusTooManyRequests {
			_ = resp.Body.Close()

			wait := retryDelay(resp.Header.Get("Retry-After"), attempt)

			if attempt == maxRetries {
				return zero, &RateLimitError{RetryAfter: wait}
			}
			sleepFn(wait)
			continue
		}

		defer resp.Body.Close()

		// 204 No Content - return zero value.
		if resp.StatusCode == http.StatusNoContent {
			return zero, nil
		}

		respBody, err := io.ReadAll(resp.Body)
		if err != nil {
			return zero, fmt.Errorf("read response body: %w", err)
		}

		// Non-2xx - parse Airtable error envelope.
		if resp.StatusCode < 200 || resp.StatusCode >= 300 {
			var errBody airtableErrorBody
			if json.Unmarshal(respBody, &errBody) != nil || errBody.Error.Message == "" {
				// Non-JSON or empty error - use raw body as message.
				msg := strings.TrimSpace(string(respBody))
				if msg == "" {
					msg = fmt.Sprintf("HTTP %d %s", resp.StatusCode, http.StatusText(resp.StatusCode))
				}
				return zero, &APIError{
					StatusCode: resp.StatusCode,
					Type:       "UNKNOWN_ERROR",
					Message:    msg,
				}
			}
			return zero, &APIError{
				StatusCode: resp.StatusCode,
				Type:       errBody.Error.Type,
				Message:    errBody.Error.Message,
			}
		}

		// Success - decode into T.
		var result T
		if err := json.Unmarshal(respBody, &result); err != nil {
			return zero, fmt.Errorf("decode response: %w", err)
		}
		return result, nil
	}

	return zero, fmt.Errorf("request failed after %d retries", maxRetries+1)
}

// retryDelay returns the duration to wait before retrying.
// Uses Retry-After header (seconds) if present, otherwise exponential backoff.
func retryDelay(retryAfterHeader string, attempt int) time.Duration {
	if retryAfterHeader != "" {
		if secs, err := strconv.Atoi(retryAfterHeader); err == nil {
			return time.Duration(secs) * time.Second
		}
	}
	// Exponential backoff: 1s, 2s, 4s, ...
	return time.Duration(1<<uint(attempt)) * time.Second
}
