package client

import (
	"encoding/json"
	"fmt"
	"net/http"
)

// Base represents an Airtable base.
type Base struct {
	ID              string `json:"id"`
	Name            string `json:"name"`
	PermissionLevel string `json:"permissionLevel"`
}

// listBasesResponse is the API response for listing bases.
type listBasesResponse struct {
	Bases  []Base `json:"bases"`
	Offset string `json:"offset,omitempty"`
}

// Schema represents the full schema of a base.
type Schema struct {
	Tables []Table `json:"tables"`
}

// Table represents a table within a base.
type Table struct {
	ID          string  `json:"id"`
	Name        string  `json:"name"`
	Description string  `json:"description,omitempty"`
	Fields      []Field `json:"fields"`
	Views       []View  `json:"views"`
}

// Field represents a column within a table.
type Field struct {
	ID          string          `json:"id"`
	Name        string          `json:"name"`
	Type        string          `json:"type"`
	Description string          `json:"description,omitempty"`
	Options     json.RawMessage `json:"options,omitempty"`
}

// View represents a view within a table.
type View struct {
	ID   string `json:"id"`
	Name string `json:"name"`
	Type string `json:"type"`
}

// ListBases returns all accessible bases, auto-paginating through results.
func (c *Client) ListBases() ([]Base, error) {
	var all []Base
	endpoint := "meta/bases"

	for {
		resp, err := Request[listBasesResponse](c, http.MethodGet, endpoint, nil)
		if err != nil {
			return nil, err
		}
		all = append(all, resp.Bases...)

		if resp.Offset == "" {
			break
		}
		endpoint = fmt.Sprintf("meta/bases?offset=%s", resp.Offset)
	}

	return all, nil
}

// GetSchema returns the full schema (tables, fields, views) for a base.
func (c *Client) GetSchema(baseID string) (*Schema, error) {
	endpoint := fmt.Sprintf("meta/bases/%s/tables", baseID)
	resp, err := Request[Schema](c, http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, err
	}
	return &resp, nil
}
