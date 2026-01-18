package exchange

// Adapter abstracts exchange operations
// This allows strategies to be exchange-agnostic and testable
type Adapter interface {
	// OpenPosition opens a new position
	OpenPosition(symbol string, side string, size float64, leverage int) (*Position, error)

	// ClosePosition closes an existing position
	ClosePosition(symbol string, size float64) error

	// GetPositions returns all open positions
	GetPositions() ([]ActivePosition, error)

	// GetBalance returns the account balance
	GetBalance() (float64, error)

	// GetPortfolio returns the full portfolio summary
	GetPortfolio() (*PortfolioSummary, error)

	// GetAddress returns the wallet address
	GetAddress() string
}
