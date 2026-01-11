package position

import (
	"fmt"
	"time"

	"terminal/internal/exchange"
)

// ExecutionConfig contains runtime configuration for position management
type ExecutionConfig struct {
	PositionSize      float64
	TradeDirection    string // "long", "short", "both"
	TakeProfitPercent float64
	StopLossPercent   float64
}

// LivePosition represents a live trading position context
// This interface allows the position manager to work without importing engine
type LivePosition interface {
	GetID() string
	GetSymbol() string
	GetConfig() ExecutionConfig
	GetPosition() *exchange.Position
	SetPosition(pos *exchange.Position)
}

// Manager handles all position operations
// This decouples position management from strategy logic
type Manager struct {
	exchange exchange.Adapter
	leverage int
}

// NewManager creates a new position manager
func NewManager(exchg exchange.Adapter) *Manager {
	return &Manager{
		exchange: exchg,
		leverage: 10, // Default leverage
	}
}

// SetLeverage sets the default leverage for new positions
func (m *Manager) SetLeverage(leverage int) {
	m.leverage = leverage
}

// HandleSignal processes a trading signal for a live strategy
func (m *Manager) HandleSignal(live LivePosition, signal exchange.Signal, price float64) {
	config := live.GetConfig()

	fmt.Printf("[%s] Signal Received: Type=%d at %.2f - %s\n", live.GetID(), signal.Type, price, signal.Reason)

	if signal.Type != exchange.SignalLong && signal.Type != exchange.SignalShort {
		fmt.Printf("[%s] Invalid signal type: %d\n", live.GetID(), signal.Type)
		return
	}

	side := "long"
	if signal.Type == exchange.SignalShort {
		side = "short"
	}

	// Filter by trade direction
	if config.TradeDirection == "long" && side == "short" {
		fmt.Printf("[%s] Signal filtered: SHORT signal ignored (trade direction: long only)\n", live.GetID())
		return
	}
	if config.TradeDirection == "short" && side == "long" {
		fmt.Printf("[%s] Signal filtered: LONG signal ignored (trade direction: short only)\n", live.GetID())
		return
	}

	// Close existing position on reversal
	pos := live.GetPosition()
	if pos != nil && pos.IsOpen {
		if pos.Side == side {
			fmt.Printf("[%s] Already in %s position, ignoring signal\n", live.GetID(), side)
			return
		}
		fmt.Printf("[%s] Closing existing %s position before opening new %s position\n", live.GetID(), pos.Side, side)
		m.ClosePosition(live, price, "Trend Reversal")
	}

	// Open new position
	fmt.Printf("[%s] Opening %s position: size=%.4f, leverage=%dx\n", live.GetID(), side, config.PositionSize, m.leverage)
	newPos, err := m.exchange.OpenPosition(live.GetSymbol(), side, config.PositionSize, m.leverage)
	if err != nil {
		fmt.Printf("[%s] Failed to open position: %v\n", live.GetID(), err)
		return
	}

	newPos.EntryPrice = price
	live.SetPosition(newPos)
	fmt.Printf("[%s] Position opened successfully: %s %.4f @ %.2f\n", live.GetID(), side, config.PositionSize, price)
}

// ClosePosition closes an existing position
func (m *Manager) ClosePosition(live LivePosition, price float64, reason string) {
	pos := live.GetPosition()
	if pos == nil || !pos.IsOpen {
		return
	}

	fmt.Printf("[%s] Closing position: %s\n", live.GetID(), reason)
	err := m.exchange.ClosePosition(live.GetSymbol(), pos.Size)
	if err != nil {
		fmt.Printf("[%s] Failed to close position: %v\n", live.GetID(), err)
		return
	}

	pos.IsOpen = false
	pos.ExitPrice = price
	pos.ExitReason = reason
	pos.ExitTime = time.Now().UnixMilli()

	// Calculate PnL
	var pnl float64
	if pos.Side == "long" {
		pnl = (price - pos.EntryPrice) * pos.Size
	} else {
		pnl = (pos.EntryPrice - price) * pos.Size
	}
	pos.PnL = pnl

	fmt.Printf("[%s] Position closed: %s, PnL: %.2f\n", live.GetID(), reason, pnl)
}

// CheckTPSL checks if take profit or stop loss should be triggered
func (m *Manager) CheckTPSL(live LivePosition, currentPrice float64) {
	pos := live.GetPosition()
	if pos == nil || !pos.IsOpen {
		return
	}

	config := live.GetConfig()
	entry := pos.EntryPrice

	var pnlPercent float64
	if pos.Side == "long" {
		pnlPercent = ((currentPrice - entry) / entry) * 100
	} else {
		pnlPercent = ((entry - currentPrice) / entry) * 100
	}

	if config.TakeProfitPercent > 0 && pnlPercent >= config.TakeProfitPercent {
		m.ClosePosition(live, currentPrice, "Take Profit")
	} else if config.StopLossPercent > 0 && pnlPercent <= -config.StopLossPercent {
		m.ClosePosition(live, currentPrice, "Stop Loss")
	}
}

// GetExchange returns the underlying exchange adapter
func (m *Manager) GetExchange() exchange.Adapter {
	return m.exchange
}
