export class CircuitBreaker {
    /**
     * Logic to prevent runaway model usage and costs.
     * Monitors token consumption and halts execution if limits are exceeded.
     */
    private static tokenCount: number = 0;
    private static limit: number = 100000; // Default token limit

    static checkLimit(newTokens: number): boolean {
        this.tokenCount += newTokens;
        if (this.tokenCount > this.limit) {
            console.error("Circuit Breaker Tripped: Token limit exceeded.");
            return false;
        }
        return true;
    }

    static setLimit(limit: number) {
        this.limit = limit;
    }
}
