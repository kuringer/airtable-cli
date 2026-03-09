package client

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"

	"github.com/andrejkostal/airtable-cli/internal/exitcode"
)

func init() {
	// Eliminate real sleeps in tests.
	sleepFn = func(_ time.Duration) {}
}

// testResponse is a simple type used to assert JSON decoding.
type testResponse struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

func TestAuthHeader(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		got := r.Header.Get("Authorization")
		want := "Bearer test-pat-123"
		if got != want {
			t.Errorf("auth header = %q, want %q", got, want)
		}
		w.WriteHeader(http.StatusNoContent)
	}))
	defer srv.Close()

	c := NewWithBaseURL("test-pat-123", srv.URL)
	_, _ = Request[struct{}](c, http.MethodGet, "bases", nil)
}

func TestGetSuccess(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			t.Errorf("method = %s, want GET", r.Method)
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(testResponse{ID: "rec1", Name: "Alpha"})
	}))
	defer srv.Close()

	c := NewWithBaseURL("pat", srv.URL)
	got, err := Request[testResponse](c, http.MethodGet, "bases/app1/Table/rec1", nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got.ID != "rec1" || got.Name != "Alpha" {
		t.Errorf("got %+v, want {ID:rec1 Name:Alpha}", got)
	}
}

func TestPostSuccess(t *testing.T) {
	type reqBody struct {
		Fields map[string]string `json:"fields"`
	}

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			t.Errorf("method = %s, want POST", r.Method)
		}
		if ct := r.Header.Get("Content-Type"); ct != "application/json" {
			t.Errorf("content-type = %q, want application/json", ct)
		}

		body, _ := io.ReadAll(r.Body)
		var parsed reqBody
		if err := json.Unmarshal(body, &parsed); err != nil {
			t.Fatalf("unmarshal request body: %v", err)
		}
		if parsed.Fields["Name"] != "Beta" {
			t.Errorf("body.Fields.Name = %q, want Beta", parsed.Fields["Name"])
		}

		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(testResponse{ID: "rec2", Name: "Beta"})
	}))
	defer srv.Close()

	c := NewWithBaseURL("pat", srv.URL)
	got, err := Request[testResponse](c, http.MethodPost, "bases/app1/Table", reqBody{
		Fields: map[string]string{"Name": "Beta"},
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got.ID != "rec2" || got.Name != "Beta" {
		t.Errorf("got %+v, want {ID:rec2 Name:Beta}", got)
	}
}

func TestError401(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
		fmt.Fprint(w, `{"error":{"type":"AUTHENTICATION_REQUIRED","message":"Invalid token"}}`)
	}))
	defer srv.Close()

	c := NewWithBaseURL("bad-pat", srv.URL)
	_, err := Request[testResponse](c, http.MethodGet, "bases", nil)
	assertAPIError(t, err, 401, "AUTHENTICATION_REQUIRED")
}

func TestError404(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusNotFound)
		fmt.Fprint(w, `{"error":{"type":"NOT_FOUND","message":"Base not found"}}`)
	}))
	defer srv.Close()

	c := NewWithBaseURL("pat", srv.URL)
	_, err := Request[testResponse](c, http.MethodGet, "bases/appXXX", nil)
	assertAPIError(t, err, 404, "NOT_FOUND")
}

func TestError422(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusUnprocessableEntity)
		fmt.Fprint(w, `{"error":{"type":"INVALID_REQUEST_UNKNOWN","message":"Field 'x' does not exist"}}`)
	}))
	defer srv.Close()

	c := NewWithBaseURL("pat", srv.URL)
	_, err := Request[testResponse](c, http.MethodPost, "bases/app1/Table", nil)

	var apiErr *APIError
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	if !isAPIError(err, &apiErr) {
		t.Fatalf("expected *APIError, got %T", err)
	}
	if apiErr.StatusCode != 422 {
		t.Errorf("status = %d, want 422", apiErr.StatusCode)
	}
	if apiErr.Message != "Field 'x' does not exist" {
		t.Errorf("message = %q, want \"Field 'x' does not exist\"", apiErr.Message)
	}
}

func TestRateLimitRetrySuccess(t *testing.T) {
	var calls atomic.Int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		n := calls.Add(1)
		if n == 1 {
			w.Header().Set("Retry-After", "1")
			w.WriteHeader(http.StatusTooManyRequests)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(testResponse{ID: "rec3", Name: "Gamma"})
	}))
	defer srv.Close()

	c := NewWithBaseURL("pat", srv.URL)
	got, err := Request[testResponse](c, http.MethodGet, "bases", nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got.ID != "rec3" {
		t.Errorf("got.ID = %q, want rec3", got.ID)
	}
	if calls.Load() != 2 {
		t.Errorf("calls = %d, want 2", calls.Load())
	}
}

func TestRateLimitExhausted(t *testing.T) {
	var calls atomic.Int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		calls.Add(1)
		w.Header().Set("Retry-After", "30")
		w.WriteHeader(http.StatusTooManyRequests)
	}))
	defer srv.Close()

	c := NewWithBaseURL("pat", srv.URL)
	_, err := Request[testResponse](c, http.MethodGet, "bases", nil)
	if err == nil {
		t.Fatal("expected error, got nil")
	}

	var rlErr *RateLimitError
	if !isRateLimitError(err, &rlErr) {
		t.Fatalf("expected *RateLimitError, got %T: %v", err, err)
	}

	// Should have made maxRetries+1 = 4 calls total.
	if calls.Load() != int32(maxRetries+1) {
		t.Errorf("calls = %d, want %d", calls.Load(), maxRetries+1)
	}
}

func TestExitCodeForError(t *testing.T) {
	tests := []struct {
		name string
		err  error
		want int
	}{
		{"401", &APIError{StatusCode: 401}, exitcode.Auth},
		{"403", &APIError{StatusCode: 403}, exitcode.Auth},
		{"404", &APIError{StatusCode: 404}, exitcode.NotFound},
		{"422", &APIError{StatusCode: 422}, exitcode.Validation},
		{"500", &APIError{StatusCode: 500}, exitcode.General},
		{"rate limited", &RateLimitError{RetryAfter: 30 * time.Second}, exitcode.RateLimited},
		{"generic", fmt.Errorf("network error"), exitcode.General},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := ExitCodeForError(tt.err)
			if got != tt.want {
				t.Errorf("ExitCodeForError(%v) = %d, want %d", tt.err, got, tt.want)
			}
		})
	}
}

// helpers

func isAPIError(err error, target **APIError) bool {
	return err != nil && func() bool {
		var a *APIError
		ok := false
		if apiErr, is := err.(*APIError); is {
			a = apiErr
			ok = true
		}
		if ok {
			*target = a
		}
		return ok
	}()
}

func isRateLimitError(err error, target **RateLimitError) bool {
	if rlErr, ok := err.(*RateLimitError); ok {
		*target = rlErr
		return true
	}
	return false
}

func assertAPIError(t *testing.T, err error, wantStatus int, wantType string) {
	t.Helper()
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	var apiErr *APIError
	if !isAPIError(err, &apiErr) {
		t.Fatalf("expected *APIError, got %T: %v", err, err)
	}
	if apiErr.StatusCode != wantStatus {
		t.Errorf("status = %d, want %d", apiErr.StatusCode, wantStatus)
	}
	if apiErr.Type != wantType {
		t.Errorf("type = %q, want %q", apiErr.Type, wantType)
	}
}
