import type { Env } from "./env.js";
import { type MarketState, formatStateForPrompt } from "./state.js";
import type { HistoryData } from "./history.js";
import { getHistorySummary } from "./history.js";
import { fetchMarketIntelligence, formatIntelligenceForPrompt } from "./intelligence.js";
import { logAgent, logError } from "./logger.js";

export interface AgentAction {
  action: "deploy_funds" | "buy_rsim" | "sell_rsim" | "return_funds" | "report_pnl" | "wait";
  amount?: string;
  is_profit?: boolean;
  reasoning: string;
}

function buildTools(env: Env) {
  const maxDeploy = env.MAX_DEPLOY_USDC ?? "100";
  const maxTrade = env.MAX_TRADE_USDC ?? "50";

  return [
    {
      type: "function" as const,
      function: {
        name: "deploy_funds",
        description: `Pull USDC from the vault into your wallet for trading. Max ${maxDeploy} USDC.`,
        parameters: {
          type: "object",
          properties: {
            amount: { type: "string", description: "USDC amount as decimal string (e.g. '10.5')" },
            reasoning: { type: "string", description: "Brief explanation of why" },
          },
          required: ["amount", "reasoning"],
        },
      },
    },
    {
      type: "function" as const,
      function: {
        name: "buy_rsim",
        description: `Buy RSIM tokens on the bonding curve with USDC. Max ${maxTrade} USDC per trade.`,
        parameters: {
          type: "object",
          properties: {
            amount: { type: "string", description: "USDC amount to spend (e.g. '5.0')" },
            reasoning: { type: "string", description: "Brief explanation of why" },
          },
          required: ["amount", "reasoning"],
        },
      },
    },
    {
      type: "function" as const,
      function: {
        name: "sell_rsim",
        description: "Sell RSIM tokens back to the bonding curve for USDC. Amount MUST NOT exceed your MM Wallet RSIM Balance shown in market state.",
        parameters: {
          type: "object",
          properties: {
            amount: { type: "string", description: "RSIM token amount to sell — must be <= your RSIM balance (e.g. '0.5')" },
            reasoning: { type: "string", description: "Brief explanation of why" },
          },
          required: ["amount", "reasoning"],
        },
      },
    },
    {
      type: "function" as const,
      function: {
        name: "return_funds",
        description: "Return USDC from your wallet back to the vault.",
        parameters: {
          type: "object",
          properties: {
            amount: { type: "string", description: "USDC amount to return (e.g. '10.0')" },
            reasoning: { type: "string", description: "Brief explanation of why" },
          },
          required: ["amount", "reasoning"],
        },
      },
    },
    {
      type: "function" as const,
      function: {
        name: "report_pnl",
        description: "Report profit or loss to the vault, adjusting the share price for LPs.",
        parameters: {
          type: "object",
          properties: {
            amount: { type: "string", description: "USDC amount of profit or loss (e.g. '2.5')" },
            is_profit: { type: "boolean", description: "true for profit, false for loss" },
            reasoning: { type: "string", description: "Brief explanation of why" },
          },
          required: ["amount", "is_profit", "reasoning"],
        },
      },
    },
    {
      type: "function" as const,
      function: {
        name: "wait",
        description: "Do nothing this cycle. Use when no good trading opportunity exists.",
        parameters: {
          type: "object",
          properties: {
            reasoning: { type: "string", description: "Brief explanation of why waiting" },
          },
          required: ["reasoning"],
        },
      },
    },
  ];
}

const SYSTEM_PROMPT = `You are an autonomous market-making bot for the easyL vault on Base Sepolia.

How the system works:
- The EasyL Vault holds USDC from LPs. You (the owner) deploy USDC out to trade on a bonding curve.
- The Bonding Curve mints/burns RSIM tokens. Price = BASE_PRICE + SLOPE * totalSupply. Price rises on buys, falls on sells.
- USDC has 6 decimals. RSIM has 6 decimals.

Your goal: Make profitable trades and report gains to the vault so the share price increases.

You are also provided with external market intelligence each cycle:
- CoinGecko price feeds for major tokens (ETH, USDC, Base ecosystem)
- Relevant crypto news and macro events with sentiment tags
- Social listening signals (Twitter/X, Discord, Telegram) with sentiment
- Historical RSIM price data with volume and trend analysis

Strategy:
- Be conservative. Don't deploy all vault liquidity at once.
- If you have no USDC in wallet but vault has liquidity, deploy some funds first.
- Buy RSIM when price is low relative to its history AND sentiment/news is favorable.
- Sell when RSIM price has risen, sentiment is turning, or news suggests caution.
- Use the price trend, social signals, and news to time entries and exits.
- Track cost basis from history — if you bought at a certain price and it's now higher, sell.
- After selling at a profit, return the original capital and report the profit.
- Waiting is valid when there's no good opportunity or when signals are mixed.

CRITICAL constraints on amounts:
- sell_rsim amount MUST be <= your MM Wallet RSIM Balance. Never sell more than you hold.
- buy_rsim amount MUST be <= your MM Wallet USDC Balance. Never spend more than you have.
- deploy_funds amount MUST be <= the Vault Available Liquidity.
- return_funds amount MUST be <= your MM Wallet USDC Balance.

IMPORTANT: The market state includes a "FEASIBLE ACTIONS" section. NEVER call a function listed under BLOCKED — it WILL fail. Only choose from the feasible actions. If you have USDC in your wallet, you can buy or return. If you have RSIM, you can sell. Think about ALL available options, not just deploying from vault.

You MUST call exactly one of the provided functions each cycle.`;

export async function decideAction(
  env: Env,
  state: MarketState,
  history: HistoryData,
): Promise<AgentAction> {
  const stateText = formatStateForPrompt(state);
  const historyText = getHistorySummary(history);
  const model = env.CF_MODEL ?? "@cf/meta/llama-3.1-70b-instruct";

  // Fetch external market intelligence
  let intelText = "";
  try {
    const intel = await fetchMarketIntelligence();
    intelText = formatIntelligenceForPrompt(intel);
    logAgent("Market intelligence fetched successfully.");
  } catch (err) {
    logError("Failed to fetch market intelligence:", err);
    intelText = "=== EXTERNAL MARKET INTELLIGENCE ===\n(unavailable this cycle)";
  }

  const messages = [
    { role: "system" as const, content: SYSTEM_PROMPT },
    {
      role: "user" as const,
      content: `${stateText}\n\n${intelText}\n\n=== RECENT HISTORY ===\n${historyText}\n\nUsing the market state, intelligence feeds, and history above, choose an action for this cycle by calling one of the available functions.`,
    },
  ];

  logAgent(`Calling Workers AI (${model})...`);

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await (env.AI as any).run(model, {
      messages,
      tools: buildTools(env),
    });

    logAgent(`Raw response: ${JSON.stringify(response)}`);

    // Handle tool_calls response
    const res = response as { response?: string | null; tool_calls?: Array<{ name: string; arguments: unknown }> };

    if (res.tool_calls && res.tool_calls.length > 0) {
      const call = res.tool_calls[0];
      const args = (typeof call.arguments === "string" ? JSON.parse(call.arguments) : call.arguments) as Record<string, unknown>;
      const validActions = ["deploy_funds", "buy_rsim", "sell_rsim", "return_funds", "report_pnl", "wait"];

      if (!validActions.includes(call.name)) {
        logError(`Invalid function call: ${call.name}`);
        return { action: "wait", reasoning: `Model called unknown function: ${call.name}` };
      }

      return {
        action: call.name as AgentAction["action"],
        amount: args.amount as string | undefined,
        is_profit: args.is_profit as boolean | undefined,
        reasoning: (args.reasoning as string) ?? "No reasoning provided",
      };
    }

    // Fallback: text response
    if (res.response) {
      logAgent(`Text response (no tool call): ${res.response}`);
      try {
        const cleaned = res.response.replace(/```(?:json)?\s*/g, "").replace(/```\s*/g, "").trim();
        const parsed = JSON.parse(cleaned) as AgentAction;
        return parsed;
      } catch {
        // Not parseable
      }
    }

    return { action: "wait", reasoning: "Model did not call a function, defaulting to wait." };
  } catch (err) {
    logError("AI call failed:", err);
    return { action: "wait", reasoning: `AI error: ${err instanceof Error ? err.message : String(err)}` };
  }
}
