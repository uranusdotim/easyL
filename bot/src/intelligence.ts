/**
 * Market intelligence feeds — placeholder with dummy data.
 *
 * Each provider returns structured data that gets formatted into
 * the LLM prompt so the agent can make better trading decisions.
 *
 * TODO: Replace dummy implementations with real API calls:
 *   - CoinGecko / CoinMarketCap for price feeds
 *   - NewsAPI / CryptoPanic for news
 *   - LunarCrush / Twitter API for social sentiment
 *   - On-chain indexer for historical token prices
 */

// ── Types ──

export interface PriceFeed {
  token: string;
  priceUsd: number;
  change24h: number;
  change7d: number;
  marketCap: number;
  volume24h: number;
  source: string;
}

export interface NewsEvent {
  headline: string;
  source: string;
  sentiment: "bullish" | "bearish" | "neutral";
  relevance: "high" | "medium" | "low";
  timestamp: string;
}

export interface SocialSignal {
  platform: string;
  metric: string;
  value: number;
  change: number;
  sentiment: "positive" | "negative" | "neutral";
}

export interface HistoricalPrice {
  timestamp: string;
  price: number;
  volume: number;
}

export interface MarketIntelligence {
  priceFeeds: PriceFeed[];
  news: NewsEvent[];
  social: SocialSignal[];
  historicalPrices: HistoricalPrice[];
  fetchedAt: string;
}

// ── Dummy data providers ──

function getDummyPriceFeeds(): PriceFeed[] {
  // Simulate CoinGecko-style price data for relevant tokens
  return [
    {
      token: "ETH",
      priceUsd: 2_485.32,
      change24h: 3.2,
      change7d: -1.8,
      marketCap: 298_000_000_000,
      volume24h: 14_500_000_000,
      source: "coingecko",
    },
    {
      token: "USDC",
      priceUsd: 1.0001,
      change24h: 0.01,
      change7d: 0.0,
      marketCap: 32_000_000_000,
      volume24h: 5_200_000_000,
      source: "coingecko",
    },
    {
      token: "BASE (ecosystem index)",
      priceUsd: 0.0,  // synthetic
      change24h: 4.1,
      change7d: 12.3,
      marketCap: 0,
      volume24h: 0,
      source: "coingecko",
    },
  ];
}

function getDummyNews(): NewsEvent[] {
  const now = new Date();
  return [
    {
      headline: "Base L2 TVL reaches new all-time high as DeFi activity surges",
      source: "The Block",
      sentiment: "bullish",
      relevance: "high",
      timestamp: new Date(now.getTime() - 2 * 3600_000).toISOString(),
    },
    {
      headline: "Fed holds interest rates steady, signals cautious optimism on inflation",
      source: "Reuters",
      sentiment: "neutral",
      relevance: "medium",
      timestamp: new Date(now.getTime() - 6 * 3600_000).toISOString(),
    },
    {
      headline: "New bonding curve token launches see increased trader interest on Base",
      source: "CryptoPanic",
      sentiment: "bullish",
      relevance: "high",
      timestamp: new Date(now.getTime() - 1 * 3600_000).toISOString(),
    },
    {
      headline: "SEC delays ruling on major crypto ETF application",
      source: "CoinDesk",
      sentiment: "bearish",
      relevance: "low",
      timestamp: new Date(now.getTime() - 12 * 3600_000).toISOString(),
    },
  ];
}

function getDummySocialSignals(): SocialSignal[] {
  return [
    {
      platform: "Twitter/X",
      metric: "mentions (bonding curve tokens)",
      value: 1_240,
      change: 32,   // +32% vs yesterday
      sentiment: "positive",
    },
    {
      platform: "Twitter/X",
      metric: "mentions (Base L2)",
      value: 8_520,
      change: 18,
      sentiment: "positive",
    },
    {
      platform: "Discord",
      metric: "active community members",
      value: 342,
      change: 5,
      sentiment: "neutral",
    },
    {
      platform: "Telegram",
      metric: "buy/sell signal ratio",
      value: 1.6,   // 1.6 buys per sell signal
      change: 12,
      sentiment: "positive",
    },
  ];
}

function getDummyHistoricalPrices(): HistoricalPrice[] {
  // Simulate the RSIM token price history over the last 24 cycles
  // Base price ~1.0 USDC, with slight uptrend and noise
  const now = Date.now();
  const interval = 15 * 60_000; // 15 min cycles
  const prices: HistoricalPrice[] = [];

  let price = 1.0;
  for (let i = 24; i >= 1; i--) {
    // Random walk with slight upward drift
    const noise = (Math.random() - 0.45) * 0.03; // slight bullish bias
    price = Math.max(0.9, price + noise);
    price = Math.round(price * 10000) / 10000;

    prices.push({
      timestamp: new Date(now - i * interval).toISOString(),
      price,
      volume: Math.round(50 + Math.random() * 200),
    });
  }

  return prices;
}

// ── Public API ──

/**
 * Fetch all market intelligence feeds.
 * Currently returns dummy data; swap implementations for real APIs.
 */
export async function fetchMarketIntelligence(): Promise<MarketIntelligence> {
  // TODO: Replace with real API calls (can run in parallel with Promise.all)
  const [priceFeeds, news, social, historicalPrices] = await Promise.all([
    Promise.resolve(getDummyPriceFeeds()),
    Promise.resolve(getDummyNews()),
    Promise.resolve(getDummySocialSignals()),
    Promise.resolve(getDummyHistoricalPrices()),
  ]);

  return {
    priceFeeds,
    news,
    social,
    historicalPrices,
    fetchedAt: new Date().toISOString(),
  };
}

/**
 * Format intelligence data into a text block for the LLM prompt.
 */
export function formatIntelligenceForPrompt(intel: MarketIntelligence): string {
  // — Price feeds —
  const priceLines = intel.priceFeeds.map(
    (p) =>
      `  ${p.token}: $${p.priceUsd.toLocaleString("en-US", { minimumFractionDigits: 2 })}  ` +
      `24h: ${p.change24h >= 0 ? "+" : ""}${p.change24h}%  ` +
      `7d: ${p.change7d >= 0 ? "+" : ""}${p.change7d}%` +
      (p.volume24h > 0 ? `  vol: $${(p.volume24h / 1e9).toFixed(1)}B` : ""),
  );

  // — News —
  const newsLines = intel.news
    .filter((n) => n.relevance !== "low")
    .map(
      (n) =>
        `  [${n.sentiment.toUpperCase()}] ${n.headline} — ${n.source}`,
    );

  // — Social signals —
  const socialLines = intel.social.map(
    (s) =>
      `  ${s.platform} | ${s.metric}: ${s.value} (${s.change >= 0 ? "+" : ""}${s.change}%) [${s.sentiment}]`,
  );

  // — Historical RSIM prices (last 24 data points) —
  const recent = intel.historicalPrices.slice(-12);
  const priceHistory = recent.map((h) => {
    const t = new Date(h.timestamp);
    const hh = t.getUTCHours().toString().padStart(2, "0");
    const mm = t.getUTCMinutes().toString().padStart(2, "0");
    return `  ${hh}:${mm} UTC  $${h.price.toFixed(4)}  vol: ${h.volume} USDC`;
  });

  const oldest = intel.historicalPrices[0]?.price ?? 0;
  const newest = intel.historicalPrices[intel.historicalPrices.length - 1]?.price ?? 0;
  const trendPct = oldest > 0 ? (((newest - oldest) / oldest) * 100).toFixed(2) : "N/A";

  return `=== EXTERNAL MARKET INTELLIGENCE ===
(fetched: ${intel.fetchedAt})

— PRICE FEEDS (CoinGecko) —
${priceLines.join("\n")}

— NEWS & EVENTS —
${newsLines.join("\n")}

— SOCIAL SENTIMENT —
${socialLines.join("\n")}

— RSIM PRICE HISTORY (last 12 data points, 15min intervals) —
${priceHistory.join("\n")}
  Trend: ${trendPct}% over window (oldest: $${oldest.toFixed(4)}, newest: $${newest.toFixed(4)})`;
}
