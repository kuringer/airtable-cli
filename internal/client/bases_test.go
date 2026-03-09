package client

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
)

func TestListBases(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			t.Errorf("method = %s, want GET", r.Method)
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(listBasesResponse{
			Bases: []Base{
				{ID: "appABC", Name: "Project Alpha", PermissionLevel: "create"},
				{ID: "appDEF", Name: "Project Beta", PermissionLevel: "read"},
			},
		})
	}))
	defer srv.Close()

	c := NewWithBaseURL("pat", srv.URL)
	bases, err := c.ListBases()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(bases) != 2 {
		t.Fatalf("got %d bases, want 2", len(bases))
	}
	if bases[0].ID != "appABC" {
		t.Errorf("bases[0].ID = %q, want appABC", bases[0].ID)
	}
	if bases[1].Name != "Project Beta" {
		t.Errorf("bases[1].Name = %q, want Project Beta", bases[1].Name)
	}
}

func TestListBasesPagination(t *testing.T) {
	var calls atomic.Int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		n := calls.Add(1)
		w.Header().Set("Content-Type", "application/json")

		if n == 1 {
			// First page with offset.
			json.NewEncoder(w).Encode(listBasesResponse{
				Bases:  []Base{{ID: "app1", Name: "Base 1", PermissionLevel: "create"}},
				Offset: "page2token",
			})
			return
		}
		// Second page, no offset (end of pagination).
		if r.URL.Query().Get("offset") != "page2token" {
			t.Errorf("expected offset=page2token, got %q", r.URL.Query().Get("offset"))
		}
		json.NewEncoder(w).Encode(listBasesResponse{
			Bases: []Base{{ID: "app2", Name: "Base 2", PermissionLevel: "read"}},
		})
	}))
	defer srv.Close()

	c := NewWithBaseURL("pat", srv.URL)
	bases, err := c.ListBases()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(bases) != 2 {
		t.Fatalf("got %d bases, want 2", len(bases))
	}
	if bases[0].ID != "app1" || bases[1].ID != "app2" {
		t.Errorf("got bases %v, want [app1, app2]", bases)
	}
	if calls.Load() != 2 {
		t.Errorf("calls = %d, want 2", calls.Load())
	}
}

func TestListBasesAuthError(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
		w.Write([]byte(`{"error":{"type":"AUTHENTICATION_REQUIRED","message":"Invalid token"}}`))
	}))
	defer srv.Close()

	c := NewWithBaseURL("bad-pat", srv.URL)
	_, err := c.ListBases()
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	assertAPIError(t, err, 401, "AUTHENTICATION_REQUIRED")
}

func TestGetSchema(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			t.Errorf("method = %s, want GET", r.Method)
		}
		wantPath := "/meta/bases/appTEST/tables"
		if r.URL.Path != wantPath {
			t.Errorf("path = %q, want %q", r.URL.Path, wantPath)
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(Schema{
			Tables: []Table{
				{
					ID:   "tbl1",
					Name: "Tasks",
					Fields: []Field{
						{ID: "fld1", Name: "Name", Type: "singleLineText"},
						{ID: "fld2", Name: "Status", Type: "singleSelect", Options: json.RawMessage(`{"choices":[{"name":"Todo"},{"name":"Done"}]}`)},
					},
					Views: []View{
						{ID: "viw1", Name: "Grid view", Type: "grid"},
					},
				},
			},
		})
	}))
	defer srv.Close()

	c := NewWithBaseURL("pat", srv.URL)
	schema, err := c.GetSchema("appTEST")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(schema.Tables) != 1 {
		t.Fatalf("got %d tables, want 1", len(schema.Tables))
	}
	tbl := schema.Tables[0]
	if tbl.ID != "tbl1" || tbl.Name != "Tasks" {
		t.Errorf("table = %+v, want ID=tbl1 Name=Tasks", tbl)
	}
	if len(tbl.Fields) != 2 {
		t.Fatalf("got %d fields, want 2", len(tbl.Fields))
	}
	if tbl.Fields[1].Type != "singleSelect" {
		t.Errorf("fields[1].Type = %q, want singleSelect", tbl.Fields[1].Type)
	}
	if tbl.Fields[1].Options == nil {
		t.Error("fields[1].Options is nil, want non-nil")
	}
	if len(tbl.Views) != 1 || tbl.Views[0].Type != "grid" {
		t.Errorf("views = %+v, want 1 grid view", tbl.Views)
	}
}

func TestGetSchemaNotFound(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusNotFound)
		w.Write([]byte(`{"error":{"type":"NOT_FOUND","message":"Base not found"}}`))
	}))
	defer srv.Close()

	c := NewWithBaseURL("pat", srv.URL)
	_, err := c.GetSchema("appBAD")
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	assertAPIError(t, err, 404, "NOT_FOUND")
}
