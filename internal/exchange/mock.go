package exchange

import "time"

// MockAdapter is a mock implementation for backtesting and testing
type MockAdapter struct {
	positions map[string]*Position
	balance   float64
	address   string
}

// NewMockAdapter creates a new mock exchange adapter
func NewMockAdapter(initialBalance float64) *MockAdapter {
	return &MockAdapter{
		positions: make(map[string]*Position),
		balance:   initialBalance,
		address:   "mock-address",
	}
}

// OpenPosition simulates opening a position
func (m *MockAdapter) OpenPosition(symbol string, side string, size float64, leverage int) (*Position, error) {
	pos := &Position{
		EntryTime: time.Now().UnixMilli(),
		Side:      side,
		Size:      size,
		IsOpen:    true,
	}
	m.positions[symbol] = pos
	return pos, nil
}

// ClosePosition simulates closing a position
func (m *MockAdapter) ClosePosition(symbol string, size float64) error {
	if pos, exists := m.positions[symbol]; exists {
		pos.IsOpen = false
		pos.ExitTime = time.Now().UnixMilli()
		delete(m.positions, symbol)
	}
	return nil
}

// GetPositions returns all simulated open positions
func (m *MockAdapter) GetPositions() ([]ActivePosition, error) {
	result := make([]ActivePosition, 0, len(m.positions))
	for symbol, pos := range m.positions {
		if pos.IsOpen {
			result = append(result, ActivePosition{
				Coin: symbol,
				Side: pos.Side,
			})
		}
	}
	return result, nil
}

// GetBalance returns the mock balance
func (m *MockAdapter) GetBalance() (float64, error) {
	return m.balance, nil
}

// GetPortfolio returns a mock portfolio summary
func (m *MockAdapter) GetPortfolio() (*PortfolioSummary, error) {
	positions, _ := m.GetPositions()
	return &PortfolioSummary{
		Balance: BalanceInfo{
			AccountValue: "1000.00",
		},
		Positions: positions,
	}, nil
}

// GetAddress returns the mock address
func (m *MockAdapter) GetAddress() string {
	return m.address
}

// SetBalance allows setting the mock balance for testing
func (m *MockAdapter) SetBalance(balance float64) {
	m.balance = balance
}

// Reset clears all positions and resets balance
func (m *MockAdapter) Reset(initialBalance float64) {
	m.positions = make(map[string]*Position)
	m.balance = initialBalance
}

// Verify MockAdapter implements Adapter
var _ Adapter = (*MockAdapter)(nil)
