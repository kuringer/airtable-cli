package client

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestListRecords(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			t.Errorf("method = %s, want GET", r.Method)
		}
		if !strings.Contains(r.URL.Path, "/app1/Tasks") {
			t.Errorf("path = %s, want to contain /app1/Tasks", r.URL.Path)
		}
		if r.URL.Query().Get("pageSize") != "50" {
			t.Errorf("pageSize = %q, want 50", r.URL.Query().Get("pageSize"))
		}
		if r.URL.Query().Get("filterByFormula") != "{Status}='Done'" {
			t.Errorf("filter = %q, want {Status}='Done'", r.URL.Query().Get("filterByFormula"))
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(listRecordsResponse{
			Records: []Record{
				{ID: "rec1", Fields: map[string]any{"Name": "Task 1"}},
				{ID: "rec2", Fields: map[string]any{"Name": "Task 2"}},
			},
		})
	}))
	defer srv.Close()

	c := NewWithBaseURL("pat", srv.URL)
	resp, err := c.ListRecords("app1", "Tasks", ListParams{
		Filter:   "{Status}='Done'",
		PageSize: 50,
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(resp.Records) != 2 {
		t.Fatalf("got %d records, want 2", len(resp.Records))
	}
	if resp.Records[0].ID != "rec1" {
		t.Errorf("records[0].ID = %q, want rec1", resp.Records[0].ID)
	}
}

func TestListRecordsWithSort(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Query().Get("sort[0][field]") != "Name" {
			t.Errorf("sort field = %q, want Name", r.URL.Query().Get("sort[0][field]"))
		}
		if r.URL.Query().Get("sort[0][direction]") != "desc" {
			t.Errorf("sort dir = %q, want desc", r.URL.Query().Get("sort[0][direction]"))
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(listRecordsResponse{Records: []Record{}})
	}))
	defer srv.Close()

	c := NewWithBaseURL("pat", srv.URL)
	_, err := c.ListRecords("app1", "Tasks", ListParams{
		Sort:      "Name",
		Direction: "desc",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestListRecordsURLEncodesTable(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Table name with spaces should be URL-encoded in the path.
		if !strings.Contains(r.URL.RawPath, "My%20Tasks") && !strings.Contains(r.URL.Path, "My Tasks") {
			t.Errorf("path = %s (raw: %s), want My Tasks URL-encoded", r.URL.Path, r.URL.RawPath)
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(listRecordsResponse{Records: []Record{}})
	}))
	defer srv.Close()

	c := NewWithBaseURL("pat", srv.URL)
	_, err := c.ListRecords("app1", "My Tasks", ListParams{})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestListAllRecordsPagination(t *testing.T) {
	page := 0
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		page++
		w.Header().Set("Content-Type", "application/json")

		switch page {
		case 1:
			json.NewEncoder(w).Encode(listRecordsResponse{
				Records: []Record{{ID: "rec1", Fields: map[string]any{"N": "A"}}},
				Offset:  "page2",
			})
		case 2:
			if r.URL.Query().Get("offset") != "page2" {
				t.Errorf("offset = %q, want page2", r.URL.Query().Get("offset"))
			}
			json.NewEncoder(w).Encode(listRecordsResponse{
				Records: []Record{{ID: "rec2", Fields: map[string]any{"N": "B"}}},
				Offset:  "page3",
			})
		case 3:
			json.NewEncoder(w).Encode(listRecordsResponse{
				Records: []Record{{ID: "rec3", Fields: map[string]any{"N": "C"}}},
			})
		default:
			t.Fatalf("unexpected page %d", page)
		}
	}))
	defer srv.Close()

	c := NewWithBaseURL("pat", srv.URL)
	records, err := c.ListAllRecords("app1", "T", ListParams{})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(records) != 3 {
		t.Fatalf("got %d records, want 3", len(records))
	}
	if records[2].ID != "rec3" {
		t.Errorf("records[2].ID = %q, want rec3", records[2].ID)
	}
}

func TestGetRecord(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			t.Errorf("method = %s, want GET", r.Method)
		}
		if !strings.HasSuffix(r.URL.Path, "/recXYZ") {
			t.Errorf("path = %s, want suffix /recXYZ", r.URL.Path)
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(Record{
			ID:     "recXYZ",
			Fields: map[string]any{"Name": "Alpha", "Status": "Active"},
		})
	}))
	defer srv.Close()

	c := NewWithBaseURL("pat", srv.URL)
	rec, err := c.GetRecord("app1", "Tasks", "recXYZ")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if rec.ID != "recXYZ" {
		t.Errorf("ID = %q, want recXYZ", rec.ID)
	}
	if rec.Fields["Name"] != "Alpha" {
		t.Errorf("Name = %v, want Alpha", rec.Fields["Name"])
	}
}

func TestCreateRecord(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			t.Errorf("method = %s, want POST", r.Method)
		}

		body, _ := io.ReadAll(r.Body)
		var req createRecordRequest
		json.Unmarshal(body, &req)

		if req.Fields["Name"] != "New Task" {
			t.Errorf("Fields.Name = %v, want New Task", req.Fields["Name"])
		}
		if req.Typecast != true {
			t.Errorf("Typecast = %v, want true", req.Typecast)
		}

		w.WriteHeader(http.StatusCreated)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(Record{
			ID:     "recNew",
			Fields: map[string]any{"Name": "New Task"},
		})
	}))
	defer srv.Close()

	c := NewWithBaseURL("pat", srv.URL)
	rec, err := c.CreateRecord("app1", "Tasks", map[string]any{"Name": "New Task"}, true)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if rec.ID != "recNew" {
		t.Errorf("ID = %q, want recNew", rec.ID)
	}
}

func TestCreateRecordsAutoChunking(t *testing.T) {
	var calls int
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls++
		body, _ := io.ReadAll(r.Body)
		var req createRecordsRequest
		json.Unmarshal(body, &req)

		if calls == 1 && len(req.Records) != 10 {
			t.Errorf("chunk 1: got %d records, want 10", len(req.Records))
		}
		if calls == 2 && len(req.Records) != 5 {
			t.Errorf("chunk 2: got %d records, want 5", len(req.Records))
		}

		var recs []Record
		for i, r := range req.Records {
			recs = append(recs, Record{
				ID:     fmt.Sprintf("rec%d_%d", calls, i),
				Fields: r.Fields,
			})
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(createRecordsResponse{Records: recs})
	}))
	defer srv.Close()

	// 15 records should be split into chunks of 10 + 5.
	var records []map[string]any
	for i := range 15 {
		records = append(records, map[string]any{"Name": fmt.Sprintf("Task %d", i)})
	}

	c := NewWithBaseURL("pat", srv.URL)
	result, err := c.CreateRecords("app1", "Tasks", records, false)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if calls != 2 {
		t.Errorf("API calls = %d, want 2", calls)
	}
	if len(result) != 15 {
		t.Errorf("got %d records, want 15", len(result))
	}
}

func TestCreateRecordsBatchPayloadStructure(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)

		// Verify top-level typecast is set.
		var raw map[string]json.RawMessage
		json.Unmarshal(body, &raw)
		var topTypecast bool
		json.Unmarshal(raw["typecast"], &topTypecast)
		if !topTypecast {
			t.Error("top-level typecast should be true")
		}

		// Verify per-record entries have NO typecast field.
		var records []map[string]json.RawMessage
		json.Unmarshal(raw["records"], &records)
		for i, rec := range records {
			if _, has := rec["typecast"]; has {
				t.Errorf("record[%d] should not have per-record typecast", i)
			}
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(createRecordsResponse{Records: []Record{{ID: "rec1", Fields: map[string]any{}}}})
	}))
	defer srv.Close()

	c := NewWithBaseURL("pat", srv.URL)
	_, err := c.CreateRecords("app1", "Tasks", []map[string]any{{"Name": "Test"}}, true)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestUpdateRecord(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPatch {
			t.Errorf("method = %s, want PATCH", r.Method)
		}
		if !strings.HasSuffix(r.URL.Path, "/rec1") {
			t.Errorf("path = %s, want suffix /rec1", r.URL.Path)
		}

		body, _ := io.ReadAll(r.Body)
		var req updateRecordRequest
		json.Unmarshal(body, &req)

		if req.Fields["Status"] != "Done" {
			t.Errorf("Fields.Status = %v, want Done", req.Fields["Status"])
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(Record{
			ID:     "rec1",
			Fields: map[string]any{"Name": "Task 1", "Status": "Done"},
		})
	}))
	defer srv.Close()

	c := NewWithBaseURL("pat", srv.URL)
	rec, err := c.UpdateRecord("app1", "Tasks", "rec1", map[string]any{"Status": "Done"}, false)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if rec.Fields["Status"] != "Done" {
		t.Errorf("Status = %v, want Done", rec.Fields["Status"])
	}
}

func TestDeleteRecord(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodDelete {
			t.Errorf("method = %s, want DELETE", r.Method)
		}
		if !strings.HasSuffix(r.URL.Path, "/rec1") {
			t.Errorf("path = %s, want suffix /rec1", r.URL.Path)
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(deleteResponse{
			Records: []struct {
				ID      string `json:"id"`
				Deleted bool   `json:"deleted"`
			}{{ID: "rec1", Deleted: true}},
		})
	}))
	defer srv.Close()

	c := NewWithBaseURL("pat", srv.URL)
	err := c.DeleteRecord("app1", "Tasks", "rec1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestDeleteRecordsAutoChunking(t *testing.T) {
	var calls int
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls++
		if r.Method != http.MethodDelete {
			t.Errorf("method = %s, want DELETE", r.Method)
		}

		ids := r.URL.Query()["records[]"]
		if calls == 1 && len(ids) != 10 {
			t.Errorf("chunk 1: got %d IDs, want 10", len(ids))
		}
		if calls == 2 && len(ids) != 2 {
			t.Errorf("chunk 2: got %d IDs, want 2", len(ids))
		}

		w.Header().Set("Content-Type", "application/json")
		var recs []struct {
			ID      string `json:"id"`
			Deleted bool   `json:"deleted"`
		}
		for _, id := range ids {
			recs = append(recs, struct {
				ID      string `json:"id"`
				Deleted bool   `json:"deleted"`
			}{ID: id, Deleted: true})
		}
		json.NewEncoder(w).Encode(deleteResponse{Records: recs})
	}))
	defer srv.Close()

	// 12 IDs should be split into 10 + 2.
	var ids []string
	for i := range 12 {
		ids = append(ids, fmt.Sprintf("rec%d", i))
	}

	c := NewWithBaseURL("pat", srv.URL)
	err := c.DeleteRecords("app1", "Tasks", ids)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if calls != 2 {
		t.Errorf("API calls = %d, want 2", calls)
	}
}

func TestBuildListQuery(t *testing.T) {
	tests := []struct {
		name   string
		params ListParams
		want   []string // substrings that must appear
		empty  bool     // expect empty string
	}{
		{
			name:  "empty params",
			empty: true,
		},
		{
			name:   "filter only",
			params: ListParams{Filter: "{Name}='X'"},
			want:   []string{"filterByFormula="},
		},
		{
			name:   "sort with direction",
			params: ListParams{Sort: "Name", Direction: "desc"},
			want:   []string{"sort%5B0%5D%5Bfield%5D=Name", "sort%5B0%5D%5Bdirection%5D=desc"},
		},
		{
			name:   "fields array",
			params: ListParams{Fields: []string{"Name", "Status"}},
			want:   []string{"fields%5B%5D=Name", "fields%5B%5D=Status"},
		},
		{
			name:   "view and pageSize",
			params: ListParams{View: "Grid view", PageSize: 25},
			want:   []string{"view=Grid+view", "pageSize=25"},
		},
		{
			name:   "returnFieldsByFieldId",
			params: ListParams{ReturnFieldsByFieldId: true},
			want:   []string{"returnFieldsByFieldId=true"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := buildListQuery(tt.params)
			if tt.empty {
				if got != "" {
					t.Errorf("got %q, want empty", got)
				}
				return
			}
			for _, sub := range tt.want {
				if !strings.Contains(got, sub) {
					t.Errorf("query %q does not contain %q", got, sub)
				}
			}
		})
	}
}

func TestListRecordsWithFields(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		fields := r.URL.Query()["fields[]"]
		if len(fields) != 2 || fields[0] != "Name" || fields[1] != "Status" {
			t.Errorf("fields[] = %v, want [Name Status]", fields)
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(listRecordsResponse{Records: []Record{}})
	}))
	defer srv.Close()

	c := NewWithBaseURL("pat", srv.URL)
	_, err := c.ListRecords("app1", "Tasks", ListParams{
		Fields: []string{"Name", "Status"},
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
}
