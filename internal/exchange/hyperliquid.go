package exchange

import (
	"context"
	"crypto/ecdsa"
	"fmt"
	"strconv"
	"time"

	"github.com/sonirico/go-hyperliquid"
)

// HyperliquidAdapter implements Adapter for Hyperliquid exchange
type HyperliquidAdapter struct {
	ctx        context.Context
	info       *hyperliquid.Info
	exchange   *hyperliquid.Exchange
	address    string
	privateKey *ecdsa.PrivateKey
}

// NewHyperliquidAdapter creates a new Hyperliquid adapter
func NewHyperliquidAdapter(ctx context.Context, privateKey *ecdsa.PrivateKey, address string, apiURL string) *HyperliquidAdapter {
	exchange := hyperliquid.NewExchange(ctx, privateKey, apiURL, nil, "", "", nil, hyperliquid.ExchangeOptClientOptions())
	info := hyperliquid.NewInfo(ctx, apiURL, true, nil, nil, hyperliquid.InfoOptClientOptions())

	return &HyperliquidAdapter{
		ctx:        ctx,
		exchange:   exchange,
		info:       info,
		address:    address,
		privateKey: privateKey,
	}
}

// OpenPosition opens a new position on Hyperliquid
func (h *HyperliquidAdapter) OpenPosition(symbol string, side string, size float64, leverage int) (*Position, error) {
	_, err := h.exchange.UpdateLeverage(h.ctx, leverage, symbol, false)
	if err != nil {
		return nil, fmt.Errorf("failed to set leverage: %w", err)
	}

	isBuy := side == "long"
	resp, err := h.exchange.MarketOpen(h.ctx, symbol, isBuy, size, nil, 0.05, nil, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to open position: %w", err)
	}

	orderResp := parseOrderResponse(resp)
	if !orderResp.Success {
		return nil, fmt.Errorf("position open failed: %s", orderResp.Message)
	}

	return &Position{
		EntryTime: time.Now().UnixMilli(),
		Side:      side,
		Size:      size,
		IsOpen:    true,
	}, nil
}

// ClosePosition closes an existing position on Hyperliquid
func (h *HyperliquidAdapter) ClosePosition(symbol string, size float64) error {
	userState, err := h.info.UserState(h.ctx, h.address)
	if err != nil {
		return fmt.Errorf("failed to fetch position: %w", err)
	}

	var positionSize float64
	var isBuy bool
	found := false

	for _, assetPos := range userState.AssetPositions {
		if assetPos.Position.Coin == symbol {
			szi := parseFloatSafe(assetPos.Position.Szi)
			if szi == 0 {
				return fmt.Errorf("no open position for %s", symbol)
			}

			isBuy = szi < 0
			if size > 0 {
				positionSize = size
			} else {
				positionSize = abs(szi)
			}
			found = true
			break
		}
	}

	if !found {
		return fmt.Errorf("position not found for %s", symbol)
	}

	slippagePrice, err := h.exchange.SlippagePrice(h.ctx, symbol, isBuy, 0.05, nil)
	if err != nil {
		return fmt.Errorf("failed to get slippage price: %w", err)
	}

	resp, err := h.exchange.Order(h.ctx, hyperliquid.CreateOrderRequest{
		Coin:       symbol,
		IsBuy:      isBuy,
		Size:       positionSize,
		Price:      slippagePrice,
		OrderType:  hyperliquid.OrderType{Limit: &hyperliquid.LimitOrderType{Tif: hyperliquid.TifIoc}},
		ReduceOnly: true,
	}, nil)

	if err != nil {
		return fmt.Errorf("failed to close position: %w", err)
	}

	orderResp := parseOrderResponse(resp)
	if !orderResp.Success {
		return fmt.Errorf("position close failed: %s", orderResp.Message)
	}

	return nil
}

// GetPositions returns all open positions
func (h *HyperliquidAdapter) GetPositions() ([]ActivePosition, error) {
	portfolio, err := h.GetPortfolio()
	if err != nil {
		return nil, err
	}
	return portfolio.Positions, nil
}

// GetBalance returns the account balance
func (h *HyperliquidAdapter) GetBalance() (float64, error) {
	portfolio, err := h.GetPortfolio()
	if err != nil {
		return 0, err
	}
	return parseFloatSafe(portfolio.Balance.AccountValue), nil
}

// GetPortfolio returns the full portfolio summary
func (h *HyperliquidAdapter) GetPortfolio() (*PortfolioSummary, error) {
	userState, err := h.info.UserState(h.ctx, h.address)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch user state: %w", err)
	}

	bal := BalanceInfo{
		AccountValue:    userState.MarginSummary.AccountValue,
		TotalRawUsd:     userState.MarginSummary.TotalRawUsd,
		WithdrawAvail:   userState.Withdrawable,
		TotalMarginUsed: userState.MarginSummary.TotalMarginUsed,
	}

	positions := make([]ActivePosition, 0, len(userState.AssetPositions))

	for _, assetPos := range userState.AssetPositions {
		pos := assetPos.Position
		sizeF := parseFloatSafe(pos.Szi)
		if sizeF == 0 {
			continue
		}

		side := "long"
		if sizeF < 0 {
			side = "short"
			sizeF = -sizeF
		}

		entryPrice := 0.0
		if pos.EntryPx != nil {
			entryPrice = parseFloatSafe(*pos.EntryPx)
		}

		liqPx := 0.0
		if pos.LiquidationPx != nil {
			liqPx = parseFloatSafe(*pos.LiquidationPx)
		}

		positions = append(positions, ActivePosition{
			Coin:           pos.Coin,
			Side:           side,
			EntryPrice:     entryPrice,
			PositionValue:  parseFloatSafe(pos.PositionValue),
			UnrealizedPnL:  parseFloatSafe(pos.UnrealizedPnl),
			ReturnOnEquity: parseFloatSafe(pos.ReturnOnEquity),
			Leverage:       float64(pos.Leverage.Value),
			LiquidationPx:  liqPx,
			MarginUsed:     parseFloatSafe(pos.MarginUsed),
		})
	}

	return &PortfolioSummary{
		Balance:   bal,
		Positions: positions,
	}, nil
}

// GetAddress returns the wallet address
func (h *HyperliquidAdapter) GetAddress() string {
	return h.address
}

// Helper functions

func parseFloatSafe(s string) float64 {
	f, _ := strconv.ParseFloat(s, 64)
	return f
}

func abs(x float64) float64 {
	if x < 0 {
		return -x
	}
	return x
}

func parseOrderResponse(resp hyperliquid.OrderStatus) OrderResponse {
	out := OrderResponse{Success: true}
	if resp.Resting != nil {
		out.Message = resp.Resting.Status
	} else if resp.Filled != nil {
		out.Message = fmt.Sprintf("filled avgPx=%s size=%s", resp.Filled.AvgPx, resp.Filled.TotalSz)
	} else if resp.Error != nil {
		out.Success = false
		out.Message = *resp.Error
	}
	return out
}

// Verify HyperliquidAdapter implements Adapter
var _ Adapter = (*HyperliquidAdapter)(nil)
