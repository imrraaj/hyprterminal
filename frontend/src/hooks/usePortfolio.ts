import { useState, useEffect, useCallback, useRef } from 'react';
import { GetPortfolioSummary, GetWalletAddress } from '@/../wailsjs/go/main/App';
import { main } from "@/../wailsjs/go/models";

export function usePortfolio() {
    const [portfolio, setPortfolio] = useState<main.PortfolioSummary | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [address, setAddress] = useState<string>('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Track previous data to avoid unnecessary re-renders
    const prevPortfolioRef = useRef<string>('');

    const fetchPortfolio = useCallback(async () => {
        // Skip if tab is not visible
        if (document.hidden) return;

        if (!GetPortfolioSummary) {
            setError('Wallet functions not available');
            return;
        }

        try {
            setLoading(true);
            setError(null);

            const addr = await GetWalletAddress();
            setAddress(addr);

            const data = await GetPortfolioSummary();

            // Only update state if data actually changed
            const newDataStr = JSON.stringify(data);
            if (newDataStr !== prevPortfolioRef.current) {
                prevPortfolioRef.current = newDataStr;
                setPortfolio(data);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch portfolio');
            console.error('Portfolio fetch error:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchPortfolio();

        // Refresh every 30 seconds instead of 10 (reduced frequency)
        const interval = setInterval(fetchPortfolio, 30000);

        // Also fetch when tab becomes visible
        const handleVisibilityChange = () => {
            if (!document.hidden) {
                fetchPortfolio();
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            clearInterval(interval);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [fetchPortfolio]);

    // Force refresh (resets cache check)
    const refresh = useCallback(() => {
        prevPortfolioRef.current = ''; // Force update
        return fetchPortfolio();
    }, [fetchPortfolio]);

    return {
        portfolio,
        isConnected,
        address,
        loading,
        error,
        refresh,
    };
}
