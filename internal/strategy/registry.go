package strategy

import (
	"fmt"
	"sync"
)

// Factory creates a new strategy instance
type Factory func() Strategy

// Registry manages available strategies
type Registry struct {
	strategies map[string]Factory
	mu         sync.RWMutex
}

// Global registry instance
var globalRegistry = &Registry{
	strategies: make(map[string]Factory),
}

// Register adds a strategy factory to the registry
func (r *Registry) Register(id string, factory Factory) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.strategies[id] = factory
}

// Get creates a new instance of a strategy by ID
func (r *Registry) Get(id string) (Strategy, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	factory, exists := r.strategies[id]
	if !exists {
		return nil, fmt.Errorf("strategy not found: %s", id)
	}
	return factory(), nil
}

// List returns metadata for all registered strategies
func (r *Registry) List() []Metadata {
	r.mu.RLock()
	defer r.mu.RUnlock()

	result := make([]Metadata, 0, len(r.strategies))
	for _, factory := range r.strategies {
		strategy := factory()
		result = append(result, strategy.GetMetadata())
	}
	return result
}

// Has checks if a strategy with the given ID exists
func (r *Registry) Has(id string) bool {
	r.mu.RLock()
	defer r.mu.RUnlock()
	_, exists := r.strategies[id]
	return exists
}

// Count returns the number of registered strategies
func (r *Registry) Count() int {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return len(r.strategies)
}

// Global convenience functions

// Register adds a strategy to the global registry
func Register(id string, factory Factory) {
	globalRegistry.Register(id, factory)
}

// Get gets a strategy from the global registry
func Get(id string) (Strategy, error) {
	return globalRegistry.Get(id)
}

// List lists all strategies in the global registry
func List() []Metadata {
	return globalRegistry.List()
}

// Has checks if a strategy exists in the global registry
func Has(id string) bool {
	return globalRegistry.Has(id)
}

// Count returns the number of registered strategies
func Count() int {
	return globalRegistry.Count()
}
