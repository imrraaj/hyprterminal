package maxtrend

import (
	"fmt"
	"math"
	"strconv"

	"terminal/internal/exchange"
	"terminal/internal/strategy"

	hyperliquid "github.com/sonirico/go-hyperliquid"
)

func init() {
	strategy.Register("max-trend", func() strategy.Strategy {
		return New()
	})
}

// Strategy implements the Max Trend Points strategy
// It uses Hull Moving Average to identify trend reversals
type Strategy struct {
	Factor float64

	// Internal state for visualization
	output *visualizationOutput
}

type visualizationOutput struct {
	TrendLines  []float64
	TrendColors []string
	Directions  []int
	Labels      []strategy.Label
	Lines       []strategy.Line
}

// New creates a new MaxTrend strategy with default factor
func New() *Strategy {
	return &Strategy{
		Factor: 2.5,
	}
}

// GetMetadata returns strategy metadata for frontend discovery
func (s *Strategy) GetMetadata() strategy.Metadata {
	minFactor := 0.1
	maxFactor := 10.0
	stepFactor := 0.1

	return strategy.Metadata{
		ID:          "max-trend",
		Name:        "Max Trend Points",
		Version:     "1.0",
		Description: "Trend-following strategy using Hull Moving Average to identify trend reversals",
		Parameters: []strategy.ParameterDef{
			{
				Name:         "factor",
				Label:        "Factor",
				Type:         "number",
				DefaultValue: 2.5,
				Min:          &minFactor,
				Max:          &maxFactor,
				Step:         &stepFactor,
				Required:     true,
			},
		},
	}
}

// ValidateParams validates strategy parameters
func (s *Strategy) ValidateParams(params map[string]any) error {
	factor, ok := params["factor"]
	if !ok {
		return fmt.Errorf("missing required parameter: factor")
	}

	f, ok := factor.(float64)
	if !ok {
		return fmt.Errorf("factor must be a number")
	}

	if f < 0.1 || f > 10.0 {
		return fmt.Errorf("factor must be between 0.1 and 10.0")
	}

	return nil
}

// Initialize sets up the strategy with validated parameters
func (s *Strategy) Initialize(params map[string]any) error {
	if factor, ok := params["factor"].(float64); ok {
		s.Factor = factor
	}
	return nil
}

// GenerateSignals generates trading signals from candle data
func (s *Strategy) GenerateSignals(candles []hyperliquid.Candle) []exchange.Signal {
	if err := s.calculateTrends(candles); err != nil {
		return nil
	}

	signals := []exchange.Signal{}
	for i := 1; i < len(s.output.Directions); i++ {
		prevDirection := s.output.Directions[i-1]
		currDirection := s.output.Directions[i]
		if prevDirection != currDirection {
			candle := candles[i]
			price := parseFloat(candle.Close)
			var signalType exchange.SignalType
			if prevDirection == 1 && currDirection == -1 {
				signalType = exchange.SignalLong
			} else if prevDirection == -1 && currDirection == 1 {
				signalType = exchange.SignalShort
			} else {
				continue
			}

			signals = append(signals, exchange.Signal{
				Index:  i,
				Type:   signalType,
				Price:  price,
				Time:   candle.Timestamp,
				Reason: "Trend Reversal",
			})
		}
	}
	return signals
}

// GetVisualization returns visualization data for charting
func (s *Strategy) GetVisualization(candles []hyperliquid.Candle) *strategy.Visualization {
	if err := s.calculateTrends(candles); err != nil {
		return nil
	}
	return &strategy.Visualization{
		TrendLines:  s.output.TrendLines,
		TrendColors: s.output.TrendColors,
		Directions:  s.output.Directions,
		Labels:      s.output.Labels,
		Lines:       s.output.Lines,
	}
}

// calculateTrends computes trend lines and directions
func (s *Strategy) calculateTrends(candles []hyperliquid.Candle) error {
	n := len(candles)
	s.output = &visualizationOutput{
		TrendLines:  make([]float64, n),
		TrendColors: make([]string, n),
		Lines:       []strategy.Line{},
		Labels:      []strategy.Label{},
		Directions:  make([]int, n),
	}
	if n < 200 {
		return fmt.Errorf("insufficient candles: need at least 200, got %d", n)
	}

	hl2 := make([]float64, n)
	highLowDiff := make([]float64, n)
	for i := range candles {
		high := parseFloat(candles[i].High)
		low := parseFloat(candles[i].Low)
		hl2[i] = (high + low) / 2
		highLowDiff[i] = high - low
	}

	dist := s.hma(highLowDiff, 200)
	upperBand := make([]float64, n)
	lowerBand := make([]float64, n)
	for i := range candles {
		upperBand[i] = hl2[i] + s.Factor*dist[i]
		lowerBand[i] = hl2[i] - s.Factor*dist[i]
	}

	trendLine := make([]float64, n)
	direction := make([]int, n)
	for i := range candles {
		if i == 0 {
			direction[i] = 1
			trendLine[i] = upperBand[i]
		} else {
			close := parseFloat(candles[i-1].Close)
			if lowerBand[i] <= lowerBand[i-1] && close >= lowerBand[i-1] {
				lowerBand[i] = lowerBand[i-1]
			}
			if upperBand[i] >= upperBand[i-1] && close <= upperBand[i-1] {
				upperBand[i] = upperBand[i-1]
			}
			if dist[i-1] == 0 {
				direction[i] = 1
			} else if trendLine[i-1] == upperBand[i-1] {
				if parseFloat(candles[i].Close) > upperBand[i] {
					direction[i] = -1
				} else {
					direction[i] = 1
				}
			} else {
				if parseFloat(candles[i].Close) < lowerBand[i] {
					direction[i] = 1
				} else {
					direction[i] = -1
				}
			}
			if direction[i] == -1 {
				trendLine[i] = lowerBand[i]
			} else {
				trendLine[i] = upperBand[i]
			}
		}
		s.output.TrendLines[i] = trendLine[i]
		s.output.Directions[i] = direction[i]
		if direction[i] == 1 {
			s.output.TrendColors[i] = "#e49013" // Orange for short
		} else {
			s.output.TrendColors[i] = "#1cc2d8" // Cyan for long
		}
	}

	// Build trend lines and labels
	var highest []float64
	var lowest []float64
	var start int
	var currentLineUp *strategy.Line
	var currentLineDn *strategy.Line

	for i := 1; i < n; i++ {
		tChange := direction[i] != direction[i-1]
		if tChange {
			highest = []float64{}
			lowest = []float64{}
			start = i
			if direction[i] == 1 {
				currentLineDn = &strategy.Line{
					StartIndex: i,
					StartPrice: parseFloat(candles[i].Close),
					EndIndex:   i,
					EndPrice:   parseFloat(candles[i].Close),
					Direction:  1,
				}
				if currentLineUp != nil {
					s.output.Lines = append(s.output.Lines, *currentLineUp)
					currentLineUp = nil
				}
			} else {
				currentLineUp = &strategy.Line{
					StartIndex: i,
					StartPrice: parseFloat(candles[i].Close),
					EndIndex:   i,
					EndPrice:   parseFloat(candles[i].Close),
					Direction:  -1,
				}
				if currentLineDn != nil {
					s.output.Lines = append(s.output.Lines, *currentLineDn)
					currentLineDn = nil
				}
			}
		} else {
			if direction[i] == -1 {
				highest = append(highest, parseFloat(candles[i].High))
				if currentLineUp != nil && len(highest) > 0 {
					maxIdx, maxVal := findMax(highest)
					currentLineUp.EndIndex = start + maxIdx + 1
					currentLineUp.EndPrice = maxVal
				}
			} else {
				lowest = append(lowest, parseFloat(candles[i].Low))
				if currentLineDn != nil && len(lowest) > 0 {
					minIdx, minVal := findMin(lowest)
					currentLineDn.EndIndex = start + minIdx + 1
					currentLineDn.EndPrice = minVal
				}
			}
		}
	}

	if currentLineUp != nil {
		s.output.Lines = append(s.output.Lines, *currentLineUp)
	}
	if currentLineDn != nil {
		s.output.Lines = append(s.output.Lines, *currentLineDn)
	}

	// Add percentage labels
	for _, line := range s.output.Lines {
		var percentage float64
		var text string
		if line.Direction == -1 && line.EndPrice > line.StartPrice {
			percentage = ((line.EndPrice - line.StartPrice) / line.StartPrice) * 100
			text = formatPercent(percentage)
			s.output.Labels = append(s.output.Labels, strategy.Label{
				Index:      line.EndIndex,
				Price:      line.EndPrice,
				Text:       text,
				Direction:  -1,
				Percentage: percentage,
			})
		} else if line.Direction == 1 && line.EndPrice < line.StartPrice {
			percentage = ((line.EndPrice - line.StartPrice) / line.StartPrice) * 100
			text = formatPercent(percentage)
			s.output.Labels = append(s.output.Labels, strategy.Label{
				Index:      line.EndIndex,
				Price:      line.EndPrice,
				Text:       text,
				Direction:  1,
				Percentage: percentage,
			})
		}
	}

	return nil
}

// Hull Moving Average
func (s *Strategy) hma(values []float64, period int) []float64 {
	if len(values) < period {
		return make([]float64, len(values))
	}
	halfPeriod := period / 2
	sqrtPeriod := int(math.Sqrt(float64(period)))
	wma1 := wma(values, halfPeriod)
	wma2 := wma(values, period)
	diff := make([]float64, len(values))
	for i := range diff {
		if i >= period-1 {
			diff[i] = 2*wma1[i] - wma2[i]
		}
	}
	return wma(diff, sqrtPeriod)
}

// Weighted Moving Average
func wma(values []float64, period int) []float64 {
	result := make([]float64, len(values))
	if len(values) < period {
		return result
	}
	for i := period - 1; i < len(values); i++ {
		sum := 0.0
		weightSum := 0.0
		for j := 0; j < period; j++ {
			weight := float64(period - j)
			sum += values[i-j] * weight
			weightSum += weight
		}
		result[i] = sum / weightSum
	}
	return result
}

func findMax(arr []float64) (int, float64) {
	if len(arr) == 0 {
		return 0, 0
	}
	maxIdx := 0
	maxVal := arr[0]
	for i, v := range arr {
		if v > maxVal {
			maxVal = v
			maxIdx = i
		}
	}
	return maxIdx, maxVal
}

func findMin(arr []float64) (int, float64) {
	if len(arr) == 0 {
		return 0, 0
	}
	minIdx := 0
	minVal := arr[0]
	for i, v := range arr {
		if v < minVal {
			minVal = v
			minIdx = i
		}
	}
	return minIdx, minVal
}

func formatPercent(percentage float64) string {
	sign := ""
	if percentage > 0 {
		sign = "+"
	}
	return sign + fmt.Sprintf("%.2f%%", percentage)
}

func parseFloat(s string) float64 {
	f, _ := strconv.ParseFloat(s, 64)
	return f
}

// Verify Strategy implements the interface
var _ strategy.Strategy = (*Strategy)(nil)
