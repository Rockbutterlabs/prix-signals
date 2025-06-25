import { RateLimit } from 'async-sema';

// QuickNode Growth plan allows 100 requests per second
const REQUESTS_PER_SECOND = 100;
const BURST_SIZE = 200; // Allow some burst capacity

// Create a rate limiter
const limiter = RateLimit(REQUESTS_PER_SECOND, {
  timeUnit: 1000, // 1 second
  uniformDistribution: true,
});

// Create a burst limiter for high-priority requests
const burstLimiter = RateLimit(BURST_SIZE, {
  timeUnit: 1000,
  uniformDistribution: false,
});

export async function withRateLimit<T>(
  fn: () => Promise<T>,
  isHighPriority: boolean = false
): Promise<T> {
  const currentLimiter = isHighPriority ? burstLimiter : limiter;
  
  try {
    await currentLimiter();
    return await fn();
  } catch (error) {
    if (error instanceof Error && error.message.includes('429')) {
      // Rate limit exceeded
      console.warn('Rate limit exceeded, retrying with backoff...');
      await new Promise(resolve => setTimeout(resolve, 1000));
      return withRateLimit(fn, isHighPriority);
    }
    throw error;
  }
}

// Helper for batch operations
export async function withBatchRateLimit<T>(
  items: any[],
  fn: (item: any) => Promise<T>,
  batchSize: number = 10,
  isHighPriority: boolean = false
): Promise<T[]> {
  const results: T[] = [];
  
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(item => withRateLimit(() => fn(item), isHighPriority))
    );
    results.push(...batchResults);
  }
  
  return results;
} 