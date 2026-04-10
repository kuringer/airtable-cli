package cmd

import (
	"github.com/andrejkostal/airtable-cli/internal/client"
)

// BasesCmd lists accessible Airtable bases.
type BasesCmd struct {
	List BasesListCmd `cmd:"" help:"List all accessible bases."`
}

// BasesListCmd lists all bases the PAT can access.
type BasesListCmd struct{}

// Run lists all accessible bases.
func (c *BasesListCmd) Run(globals *Globals) error {
	out, cl := mustAuth(globals)
	if cl == nil {
		return nil
	}

	bases, err := cl.ListBases()
	if err != nil {
		code := errorCode(err)
		out.Error(code, err.Error())
		return nil
	}

	out.Success(bases)
	return nil
}

// errorCode maps a client error to an output error code string.
func errorCode(err error) string {
	switch client.ExitCodeForError(err) {
	case 2:
		return "AUTH_FAILED"
	case 3:
		return "NOT_FOUND"
	case 4:
		return "VALIDATION_ERROR"
	case 5:
		return "RATE_LIMITED"
	default:
		return "API_ERROR"
	}
}
