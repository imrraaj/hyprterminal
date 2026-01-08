package main

import (
	"context"
	"encoding/json"
	"fmt"
	"strconv"
	"time"

	"github.com/redis/go-redis/v9"
	hyperliquid "github.com/sonirico/go-hyperliquid"
)

func parseFloat(s string) float64 {
	f, _ := strconv.ParseFloat(s, 64)
	return f
}

type Source struct {
	info         *hyperliquid.Info
	ctx          context.Context
	redisClient  *redis.Client
	cacheEnabled bool
}

func NewSource(config Config) *Source {
	info := hyperliquid.NewInfo(context.Background(), hyperliquid.MainnetAPIURL, true, nil, nil)
	return &Source{
		info: info,
		ctx:  context.Background(),
	}
}

func (s *Source) SetContext(ctx context.Context) {
	s.ctx = ctx
}

func (s *Source) SetRedis(client *redis.Client) {
	s.redisClient = client
	if client != nil {
		ctx, cancel := context.WithTimeout(s.ctx, 2*time.Second)
		defer cancel()
		if err := client.Ping(ctx).Err(); err == nil {
			s.cacheEnabled = true
		}
	}
}

func (s *Source) buildCacheKey(symbol, interval string, limit int) string {
	return fmt.Sprintf("candles:%s:%s:%d", symbol, interval, limit)
}

func (s *Source) getCacheTTL(interval string) time.Duration {
	switch interval {
	case "1m":
		return 1 * time.Minute
	case "5m":
		return 5 * time.Minute
	case "15m":
		return 15 * time.Minute
	case "1h":
		return 1 * time.Hour
	case "4h":
		return 4 * time.Hour
	case "1d":
		return 24 * time.Hour
	default:
		return 5 * time.Minute
	}
}

func (s *Source) getFromCache(symbol, interval string, limit int) ([]hyperliquid.Candle, bool) {
	if !s.cacheEnabled {
		return nil, false
	}
	key := s.buildCacheKey(symbol, interval, limit)
	ctx, cancel := context.WithTimeout(s.ctx, 500*time.Millisecond)
	defer cancel()
	data, err := s.redisClient.Get(ctx, key).Bytes()
	if err != nil {
		return nil, false
	}
	var candles []hyperliquid.Candle
	if err := json.Unmarshal(data, &candles); err != nil {
		return nil, false
	}
	return candles, true
}

func (s *Source) setToCache(symbol, interval string, limit int, candles []hyperliquid.Candle) {
	if !s.cacheEnabled || len(candles) == 0 {
		return
	}
	key := s.buildCacheKey(symbol, interval, limit)
	ttl := s.getCacheTTL(interval)
	data, err := json.Marshal(candles)
	if err != nil {
		return
	}
	ctx, cancel := context.WithTimeout(s.ctx, 500*time.Millisecond)
	defer cancel()
	s.redisClient.Set(ctx, key, data, ttl)
}

func (s *Source) FetchHistoricalCandles(symbol string, interval string, limit int) ([]hyperliquid.Candle, error) {
	if candles, found := s.getFromCache(symbol, interval, limit); found {
		return candles, nil
	}

	candles, err := s.FetchCandlesBefore(symbol, interval, limit, 0)
	if err != nil {
		return nil, err
	}

	go s.setToCache(symbol, interval, limit, candles)

	return candles, nil
}

func (s *Source) FetchCandlesBefore(symbol string, interval string, limit int, beforeTimestamp int64) ([]hyperliquid.Candle, error) {
	const maxCandlesPerRequest = 5000
	if limit <= maxCandlesPerRequest {
		return s.fetchSingleBatch(symbol, interval, limit, beforeTimestamp)
	}

	var allCandles []hyperliquid.Candle
	remaining := limit
	currentEndTime := beforeTimestamp

	for remaining > 0 {
		batchSize := remaining
		if batchSize > maxCandlesPerRequest {
			batchSize = maxCandlesPerRequest
		}

		batch, err := s.fetchSingleBatch(symbol, interval, batchSize, currentEndTime)
		if err != nil {
			return nil, err
		}

		if len(batch) == 0 {
			break
		}

		allCandles = append(batch, allCandles...)
		currentEndTime = batch[0].Timestamp
		remaining -= len(batch)

		if len(batch) < batchSize {
			break
		}
	}

	if len(allCandles) == 0 {
		return nil, fmt.Errorf("no candles returned")
	}

	return allCandles, nil
}

func (s *Source) fetchSingleBatch(symbol string, interval string, limit int, beforeTimestamp int64) ([]hyperliquid.Candle, error) {
	var endTime time.Time
	if beforeTimestamp > 0 {
		endTime = time.Unix(beforeTimestamp/1000, 0)
	} else {
		endTime = time.Now()
	}

	intervalDuration := s.intervalDuration(interval)
	startTime := endTime.Add(-time.Duration(limit) * intervalDuration)

	// Use proper context with timeout instead of context.TODO()
	ctx, cancel := context.WithTimeout(s.ctx, 30*time.Second)
	defer cancel()

	candles, err := s.info.CandlesSnapshot(
		ctx,
		symbol,
		interval,
		startTime.Unix()*1000,
		endTime.Unix()*1000,
	)

	if err != nil {
		return nil, fmt.Errorf("failed to fetch candles: %w", err)
	}

	return candles, nil
}

func (s *Source) intervalDuration(interval string) time.Duration {
	switch interval {
	case "1m":
		return time.Minute
	case "5m":
		return 5 * time.Minute
	case "15m":
		return 15 * time.Minute
	case "1h":
		return time.Hour
	case "4h":
		return 4 * time.Hour
	case "1d":
		return 24 * time.Hour
	default:
		return 5 * time.Minute
	}
}

func (s *Source) InvalidateCache() error {
	if !s.cacheEnabled {
		return nil
	}
	ctx, cancel := context.WithTimeout(s.ctx, 5*time.Second)
	defer cancel()

	// Collect keys first
	var keys []string
	iter := s.redisClient.Scan(ctx, 0, "candles:*", 100).Iterator()
	for iter.Next(ctx) {
		keys = append(keys, iter.Val())
	}
	if err := iter.Err(); err != nil {
		return err
	}

	// Batch delete using pipeline
	if len(keys) > 0 {
		pipe := s.redisClient.Pipeline()
		for _, key := range keys {
			pipe.Del(ctx, key)
		}
		_, err := pipe.Exec(ctx)
		return err
	}
	return nil
}

func (s *Source) InvalidateCacheForSymbol(symbol string) error {
	if !s.cacheEnabled {
		return nil
	}
	pattern := fmt.Sprintf("candles:%s:*", symbol)
	ctx, cancel := context.WithTimeout(s.ctx, 5*time.Second)
	defer cancel()

	// Collect keys first
	var keys []string
	iter := s.redisClient.Scan(ctx, 0, pattern, 100).Iterator()
	for iter.Next(ctx) {
		keys = append(keys, iter.Val())
	}
	if err := iter.Err(); err != nil {
		return err
	}

	// Batch delete using pipeline
	if len(keys) > 0 {
		pipe := s.redisClient.Pipeline()
		for _, key := range keys {
			pipe.Del(ctx, key)
		}
		_, err := pipe.Exec(ctx)
		return err
	}
	return nil
}
