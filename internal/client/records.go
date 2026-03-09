package client

import (
	"fmt"
	"net/http"
	"net/url"
	"strings"
)

// Record represents a single Airtable record.
type Record struct {
	ID          string         `json:"id"`
	CreatedTime string         `json:"createdTime,omitempty"`
	Fields      map[string]any `json:"fields"`
}

// ListParams configures record listing requests.
type ListParams struct {
	Filter              string
	Sort                string
	Direction           string // "asc" or "desc"
	View                string
	Fields              []string
	PageSize            int
	Offset              string
	ReturnFieldsByFieldId bool
}

type listRecordsResponse struct {
	Records []Record `json:"records"`
	Offset  string   `json:"offset,omitempty"`
}

type createRecordRequest struct {
	Fields   map[string]any `json:"fields"`
	Typecast bool           `json:"typecast,omitempty"`
}

type batchRecordEntry struct {
	Fields map[string]any `json:"fields"`
}

type createRecordsRequest struct {
	Records  []batchRecordEntry `json:"records"`
	Typecast bool               `json:"typecast,omitempty"`
}

type createRecordsResponse struct {
	Records []Record `json:"records"`
}

type updateRecordRequest struct {
	Fields   map[string]any `json:"fields"`
	Typecast bool           `json:"typecast,omitempty"`
}

type deleteResponse struct {
	Records []struct {
		ID      string `json:"id"`
		Deleted bool   `json:"deleted"`
	} `json:"records"`
}

// buildListQuery builds URL query string from ListParams.
func buildListQuery(params ListParams) string {
	q := url.Values{}

	if params.Filter != "" {
		q.Set("filterByFormula", params.Filter)
	}
	if params.Sort != "" {
		q.Set("sort[0][field]", params.Sort)
		dir := params.Direction
		if dir == "" {
			dir = "asc"
		}
		q.Set("sort[0][direction]", dir)
	}
	if params.View != "" {
		q.Set("view", params.View)
	}
	for _, f := range params.Fields {
		q.Add("fields[]", f)
	}
	if params.PageSize > 0 {
		q.Set("pageSize", fmt.Sprintf("%d", params.PageSize))
	}
	if params.Offset != "" {
		q.Set("offset", params.Offset)
	}
	if params.ReturnFieldsByFieldId {
		q.Set("returnFieldsByFieldId", "true")
	}

	encoded := q.Encode()
	if encoded == "" {
		return ""
	}
	return "?" + encoded
}

// ListRecords returns a single page of records from a table.
func (c *Client) ListRecords(baseID, table string, params ListParams) (*listRecordsResponse, error) {
	encodedTable := url.PathEscape(table)
	endpoint := fmt.Sprintf("%s/%s%s", baseID, encodedTable, buildListQuery(params))

	resp, err := Request[listRecordsResponse](c, http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, err
	}
	return &resp, nil
}

// ListAllRecords auto-paginates through all records in a table.
func (c *Client) ListAllRecords(baseID, table string, params ListParams) ([]Record, error) {
	var all []Record

	for {
		resp, err := c.ListRecords(baseID, table, params)
		if err != nil {
			return nil, err
		}
		all = append(all, resp.Records...)

		if resp.Offset == "" {
			break
		}
		params.Offset = resp.Offset
	}

	return all, nil
}

// GetRecord returns a single record by ID.
func (c *Client) GetRecord(baseID, table, recordID string) (*Record, error) {
	encodedTable := url.PathEscape(table)
	endpoint := fmt.Sprintf("%s/%s/%s", baseID, encodedTable, recordID)

	resp, err := Request[Record](c, http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, err
	}
	return &resp, nil
}

// CreateRecord creates a single record in a table.
func (c *Client) CreateRecord(baseID, table string, fields map[string]any, typecast bool) (*Record, error) {
	encodedTable := url.PathEscape(table)
	endpoint := fmt.Sprintf("%s/%s", baseID, encodedTable)

	body := createRecordRequest{Fields: fields, Typecast: typecast}
	resp, err := Request[Record](c, http.MethodPost, endpoint, body)
	if err != nil {
		return nil, err
	}
	return &resp, nil
}

// CreateRecords creates multiple records, auto-chunking by 10.
func (c *Client) CreateRecords(baseID, table string, records []map[string]any, typecast bool) ([]Record, error) {
	encodedTable := url.PathEscape(table)
	endpoint := fmt.Sprintf("%s/%s", baseID, encodedTable)

	var all []Record

	for i := 0; i < len(records); i += 10 {
		end := i + 10
		if end > len(records) {
			end = len(records)
		}
		chunk := records[i:end]

		var entries []batchRecordEntry
		for _, fields := range chunk {
			entries = append(entries, batchRecordEntry{Fields: fields})
		}

		body := createRecordsRequest{Records: entries, Typecast: typecast}
		resp, err := Request[createRecordsResponse](c, http.MethodPost, endpoint, body)
		if err != nil {
			return all, fmt.Errorf("create chunk %d-%d: %w", i, end-1, err)
		}
		all = append(all, resp.Records...)
	}

	return all, nil
}

// UpdateRecord updates a single record by ID (PATCH - partial update).
func (c *Client) UpdateRecord(baseID, table, recordID string, fields map[string]any, typecast bool) (*Record, error) {
	encodedTable := url.PathEscape(table)
	endpoint := fmt.Sprintf("%s/%s/%s", baseID, encodedTable, recordID)

	body := updateRecordRequest{Fields: fields, Typecast: typecast}
	resp, err := Request[Record](c, http.MethodPatch, endpoint, body)
	if err != nil {
		return nil, err
	}
	return &resp, nil
}

// DeleteRecord deletes a single record by ID.
func (c *Client) DeleteRecord(baseID, table, recordID string) error {
	encodedTable := url.PathEscape(table)
	endpoint := fmt.Sprintf("%s/%s/%s", baseID, encodedTable, recordID)

	_, err := Request[deleteResponse](c, http.MethodDelete, endpoint, nil)
	return err
}

// DeleteRecords deletes multiple records, auto-chunking by 10.
func (c *Client) DeleteRecords(baseID, table string, ids []string) error {
	encodedTable := url.PathEscape(table)

	for i := 0; i < len(ids); i += 10 {
		end := i + 10
		if end > len(ids) {
			end = len(ids)
		}
		chunk := ids[i:end]

		var params []string
		for _, id := range chunk {
			params = append(params, "records[]="+url.QueryEscape(id))
		}
		endpoint := fmt.Sprintf("%s/%s?%s", baseID, encodedTable, strings.Join(params, "&"))

		_, err := Request[deleteResponse](c, http.MethodDelete, endpoint, nil)
		if err != nil {
			return fmt.Errorf("delete chunk %d-%d: %w", i, end-1, err)
		}
	}

	return nil
}
