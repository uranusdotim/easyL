import { parseUnits, formatUnits, maxUint256, type PublicClient, type WalletClient, type Account } from "viem";
import { baseSepolia } from "viem/chains";
import {
  USDC_ADDRESS,
  VAULT_ADDRESS,
  BONDING_CURVE_ADDRESS,
  USDC_DECIMALS,
  RSIM_DECIMALS,
} from "./config.js";
import { erc20Abi, easyLVaultAbi, bondingCurveAbi } from "./abis.js";
import { logMM } from "./logger.js";

// ── Clients bundle ──

export interface Clients {
  publicClient: PublicClient;
  walletClient: WalletClient;
  account: Account;
  address: `0x${string}`;
}

// ── Helpers ──

async function ensureUsdcAllowance(c: Clients, spender: `0x${string}`, needed: bigint): Promise<void> {
  const allowance = await c.publicClient.readContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: "allowance",
    args: [c.address, spender],
  });

  if (allowance < needed) {
    logMM(`Approving USDC for ${spender}...`);
    const hash = await c.walletClient.writeContract({
      chain: baseSepolia,
      account: c.account,
      address: USDC_ADDRESS,
      abi: erc20Abi,
      functionName: "approve",
      args: [spender, maxUint256],
    });
    await c.publicClient.waitForTransactionReceipt({ hash, timeout: 90_000, pollingInterval: 3_000 });
    logMM(`Approval confirmed: ${hash}`);
  }
}

// ── Actions ──

export async function deployFunds(c: Clients, usdcAmount: string): Promise<string> {
  const amount = parseUnits(usdcAmount, USDC_DECIMALS);
  logMM(`Deploying ${usdcAmount} USDC from vault...`);

  const hash = await c.walletClient.writeContract({
    chain: baseSepolia,
    account: c.account,
    address: VAULT_ADDRESS,
    abi: easyLVaultAbi,
    functionName: "deployFunds",
    args: [amount],
  });
  await c.publicClient.waitForTransactionReceipt({ hash, timeout: 90_000, pollingInterval: 3_000 });
  logMM(`Deploy confirmed: ${hash}`);
  return hash;
}

export async function buyRSIM(c: Clients, usdcAmount: string): Promise<string> {
  const amount = parseUnits(usdcAmount, USDC_DECIMALS);
  await ensureUsdcAllowance(c, BONDING_CURVE_ADDRESS, amount);

  logMM(`Buying RSIM with ${usdcAmount} USDC...`);
  const hash = await c.walletClient.writeContract({
    chain: baseSepolia,
    account: c.account,
    address: BONDING_CURVE_ADDRESS,
    abi: bondingCurveAbi,
    functionName: "buy",
    args: [amount],
  });
  await c.publicClient.waitForTransactionReceipt({ hash, timeout: 90_000, pollingInterval: 3_000 });
  logMM(`Buy confirmed: ${hash}`);
  return hash;
}

export async function sellRSIM(c: Clients, rsimAmount: string): Promise<string> {
  let amount = parseUnits(rsimAmount, RSIM_DECIMALS);

  // Clamp to actual balance to prevent InsufficientTokens revert
  const balance = await c.publicClient.readContract({
    address: BONDING_CURVE_ADDRESS,
    abi: bondingCurveAbi,
    functionName: "balanceOf",
    args: [c.address],
  }) as bigint;

  if (balance === 0n) throw new Error("No RSIM to sell (balance is 0)");

  if (amount > balance) {
    logMM(`Clamping sell from ${rsimAmount} to ${formatUnits(balance, RSIM_DECIMALS)} RSIM (wallet balance)`);
    amount = balance;
  }

  logMM(`Selling ${formatUnits(amount, RSIM_DECIMALS)} RSIM...`);

  const hash = await c.walletClient.writeContract({
    chain: baseSepolia,
    account: c.account,
    address: BONDING_CURVE_ADDRESS,
    abi: bondingCurveAbi,
    functionName: "sell",
    args: [amount],
  });
  await c.publicClient.waitForTransactionReceipt({ hash, timeout: 90_000, pollingInterval: 3_000 });
  logMM(`Sell confirmed: ${hash}`);
  return hash;
}

export async function returnFunds(c: Clients, usdcAmount: string): Promise<string> {
  const amount = parseUnits(usdcAmount, USDC_DECIMALS);
  await ensureUsdcAllowance(c, VAULT_ADDRESS, amount);

  logMM(`Returning ${usdcAmount} USDC to vault...`);
  const hash = await c.walletClient.writeContract({
    chain: baseSepolia,
    account: c.account,
    address: VAULT_ADDRESS,
    abi: easyLVaultAbi,
    functionName: "returnFunds",
    args: [amount],
  });
  await c.publicClient.waitForTransactionReceipt({ hash, timeout: 90_000, pollingInterval: 3_000 });
  logMM(`Return confirmed: ${hash}`);
  return hash;
}

export async function reportPnL(c: Clients, usdcAmount: string, isProfit: boolean): Promise<string> {
  const raw = parseUnits(usdcAmount, USDC_DECIMALS);
  const signed = isProfit ? raw : -raw;

  logMM(`Reporting PnL: ${isProfit ? "+" : "-"}${usdcAmount} USDC...`);
  const hash = await c.walletClient.writeContract({
    chain: baseSepolia,
    account: c.account,
    address: VAULT_ADDRESS,
    abi: easyLVaultAbi,
    functionName: "reportPnL",
    args: [signed],
  });
  await c.publicClient.waitForTransactionReceipt({ hash, timeout: 90_000, pollingInterval: 3_000 });
  logMM(`PnL report confirmed: ${hash}`);
  return hash;
}
