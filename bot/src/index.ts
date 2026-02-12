import { createPublicClient, createWalletClient, http, parseUnits, type PublicClient } from "viem";
import { privateKeyToAccount, nonceManager } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import type { Env } from "./env.js";
import { readMarketState, type MarketState } from "./state.js";
import { decideAction, type AgentAction } from "./agent.js";
import { type Clients, deployFunds, buyRSIM, sellRSIM, returnFunds, reportPnL } from "./actions.js";
import { loadHistory, saveHistory, nextCycle, addRecord } from "./history.js";
import { USDC_DECIMALS, RSIM_DECIMALS } from "./config.js";
import { logMM, logAgent, logError } from "./logger.js";

function buildClients(env: Env) {
  const transport = http(env.RPC_URL ?? "https://sepolia.base.org");
  const publicClient = createPublicClient({ chain: baseSepolia, transport }) as PublicClient;
  const mmAccount = privateKeyToAccount(env.PRIVATE_KEY as `0x${string}`, { nonceManager });
  const mmWalletClient = createWalletClient({ account: mmAccount, chain: baseSepolia, transport });
  return { publicClient, mmAccount, mmWalletClient };
}

/** Pre-flight check: reject actions that would certainly revert on-chain. */
function validateAction(action: AgentAction, state: MarketState): string | null {
  if (action.action === "wait") return null;

  if (!action.amount) {
    return `Action "${action.action}" requires an amount but none was provided`;
  }

  const decimals = action.action === "sell_rsim" ? RSIM_DECIMALS : USDC_DECIMALS;
  let parsed: bigint;
  try {
    parsed = parseUnits(action.amount!, decimals);
  } catch {
    return `Invalid amount "${action.amount}"`;
  }
  if (parsed <= 0n) return `Amount must be positive, got "${action.amount}"`;

  switch (action.action) {
    case "deploy_funds":
      if (state.vaultAvailableLiquidity < parsed)
        return `Cannot deploy ${action.amount} USDC — vault available liquidity is only ${state.vaultAvailableLiquidity}`;
      break;
    case "buy_rsim":
      if (state.mmUsdcBalance < parsed)
        return `Cannot buy with ${action.amount} USDC — wallet only has ${state.mmUsdcBalance}`;
      break;
    case "sell_rsim":
      if (state.mmRsimBalance === 0n)
        return "Cannot sell RSIM — wallet balance is 0";
      // sell will be clamped in actions.ts, so no hard reject here
      break;
    case "return_funds":
      if (state.mmUsdcBalance < parsed)
        return `Cannot return ${action.amount} USDC — wallet only has ${state.mmUsdcBalance}`;
      break;
    case "report_pnl":
      break; // no simple pre-check
  }
  return null;
}

async function executeAction(c: Clients, action: AgentAction): Promise<string | undefined> {
  switch (action.action) {
    case "deploy_funds":
      return deployFunds(c, action.amount!);
    case "buy_rsim":
      return buyRSIM(c, action.amount!);
    case "sell_rsim":
      return sellRSIM(c, action.amount!);
    case "return_funds":
      return returnFunds(c, action.amount!);
    case "report_pnl":
      return reportPnL(c, action.amount!, action.is_profit ?? true);
    case "wait":
      logMM("Waiting this cycle.");
      return undefined;
    default:
      logError(`Unknown action: ${action.action}`);
      return undefined;
  }
}

async function runCycle(env: Env) {
  const { publicClient, mmAccount, mmWalletClient } = buildClients(env);

  const mmClients: Clients = {
    publicClient,
    walletClient: mmWalletClient,
    account: mmAccount,
    address: mmAccount.address,
  };

  const history = await loadHistory(env.KV);
  const cycle = nextCycle(history);
  logMM(`━━━ Cycle ${cycle} ━━━`);

  try {
    logMM("Reading market state...");
    const state = await readMarketState(publicClient, mmAccount.address);

    const action = await decideAction(env, state, history);
    logAgent(`Decision: ${action.action} — ${action.reasoning}`);

    // Pre-flight validation: catch impossible actions before sending a tx
    const invalid = validateAction(action, state);
    if (invalid) {
      logError(`Validation blocked "${action.action}": ${invalid}`);
      addRecord(history, {
        action: action.action,
        params: {
          ...(action.amount ? { amount: action.amount } : {}),
          ...(action.is_profit !== undefined ? { is_profit: String(action.is_profit) } : {}),
        },
        result: "failed",
        note: `[pre-validation] ${invalid}`,
      });
    } else {
      try {
        const txHash = await executeAction(mmClients, action);
        addRecord(history, {
          action: action.action,
          params: {
            ...(action.amount ? { amount: action.amount } : {}),
            ...(action.is_profit !== undefined ? { is_profit: String(action.is_profit) } : {}),
          },
          result: "success",
          txHash: txHash ?? undefined,
          note: action.reasoning,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logError(`Action failed: ${msg}`);
        addRecord(history, {
          action: action.action,
          params: {
            ...(action.amount ? { amount: action.amount } : {}),
            ...(action.is_profit !== undefined ? { is_profit: String(action.is_profit) } : {}),
          },
          result: "failed",
          note: msg,
        });
      }
    }
  } catch (err) {
    logError("[MM CYCLE]", err instanceof Error ? err.message : err);
  }

  await saveHistory(env.KV, history);
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function json(data: unknown): Response {
  return new Response(JSON.stringify(data, null, 2), {
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

export default {
  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext) {
    await runCycle(env);
  },

  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS_HEADERS });
    }

    if (url.pathname === "/__scheduled" || url.pathname === "/trigger") {
      await runCycle(env);
      return new Response("Cycle executed. Check logs with `wrangler tail`.\n");
    }

    const { mmAccount } = buildClients(env);
    const history = await loadHistory(env.KV);

    if (url.pathname === "/logs") {
      return json({
        status: "running",
        mmWallet: mmAccount.address,
        cycle: history.cycleCounter,
        recentActions: history.records,
      });
    }

    return json({
      status: "running",
      mmWallet: mmAccount.address,
      cycle: history.cycleCounter,
      recentActions: history.records.slice(-5),
    });
  },
} satisfies ExportedHandler<Env>;
