import { formatUnits, type PublicClient } from "viem";
import {
  VAULT_ADDRESS,
  BONDING_CURVE_ADDRESS,
  USDC_ADDRESS,
  USDC_DECIMALS,
  RSIM_DECIMALS,
} from "./config.js";
import { easyLVaultAbi, bondingCurveAbi, erc20Abi } from "./abis.js";

export interface MarketState {
  vaultTotalAssets: bigint;
  vaultAvailableLiquidity: bigint;
  vaultManagedAssets: bigint;
  vaultSharePrice: bigint;
  vaultTotalSupply: bigint;
  curvePrice: bigint;
  curveTotalSupply: bigint;
  curveReserveBalance: bigint;
  mmUsdcBalance: bigint;
  mmRsimBalance: bigint;
}

export async function readMarketState(
  publicClient: PublicClient,
  mmAddress: `0x${string}`,
): Promise<MarketState> {
  const results = await publicClient.multicall({
    contracts: [
      { address: VAULT_ADDRESS, abi: easyLVaultAbi, functionName: "totalAssets" },
      { address: VAULT_ADDRESS, abi: easyLVaultAbi, functionName: "availableLiquidity" },
      { address: VAULT_ADDRESS, abi: easyLVaultAbi, functionName: "managedAssets" },
      { address: VAULT_ADDRESS, abi: easyLVaultAbi, functionName: "sharePrice" },
      { address: VAULT_ADDRESS, abi: easyLVaultAbi, functionName: "totalSupply" },
      { address: BONDING_CURVE_ADDRESS, abi: bondingCurveAbi, functionName: "getPrice" },
      { address: BONDING_CURVE_ADDRESS, abi: bondingCurveAbi, functionName: "totalSupply" },
      { address: BONDING_CURVE_ADDRESS, abi: bondingCurveAbi, functionName: "reserveBalance" },
      { address: USDC_ADDRESS, abi: erc20Abi, functionName: "balanceOf", args: [mmAddress] },
      { address: BONDING_CURVE_ADDRESS, abi: bondingCurveAbi, functionName: "balanceOf", args: [mmAddress] },
    ],
  });

  const val = (i: number): bigint => {
    const r = results[i];
    return r.status === "success" ? (r.result as bigint) : 0n;
  };

  return {
    vaultTotalAssets: val(0),
    vaultAvailableLiquidity: val(1),
    vaultManagedAssets: val(2),
    vaultSharePrice: val(3),
    vaultTotalSupply: val(4),
    curvePrice: val(5),
    curveTotalSupply: val(6),
    curveReserveBalance: val(7),
    mmUsdcBalance: val(8),
    mmRsimBalance: val(9),
  };
}

export function formatStateForPrompt(s: MarketState): string {
  const fmtUsdc = (v: bigint) => formatUnits(v, USDC_DECIMALS);
  const fmtRsim = (v: bigint) => formatUnits(v, RSIM_DECIMALS);

  // Build feasibility list so the AI knows what it CAN and CANNOT do
  const feasible: string[] = [];
  const infeasible: string[] = [];

  if (s.vaultAvailableLiquidity > 0n)
    feasible.push(`deploy_funds  (up to ${fmtUsdc(s.vaultAvailableLiquidity)} USDC)`);
  else
    infeasible.push("deploy_funds  — vault liquidity is 0");

  if (s.mmUsdcBalance > 0n)
    feasible.push(`buy_rsim      (up to ${fmtUsdc(s.mmUsdcBalance)} USDC in wallet)`);
  else
    infeasible.push("buy_rsim      — no USDC in wallet");

  if (s.mmRsimBalance > 0n)
    feasible.push(`sell_rsim     (up to ${fmtRsim(s.mmRsimBalance)} RSIM in wallet)`);
  else
    infeasible.push("sell_rsim     — no RSIM in wallet");

  if (s.mmUsdcBalance > 0n)
    feasible.push(`return_funds  (up to ${fmtUsdc(s.mmUsdcBalance)} USDC in wallet)`);
  else
    infeasible.push("return_funds  — no USDC in wallet");

  feasible.push("report_pnl");
  feasible.push("wait");

  return `=== MARKET STATE ===
VAULT:
  Total Assets:        ${fmtUsdc(s.vaultTotalAssets)} USDC
  Available Liquidity: ${fmtUsdc(s.vaultAvailableLiquidity)} USDC
  Managed (deployed):  ${fmtUsdc(s.vaultManagedAssets)} USDC
  Share Price:         ${fmtUsdc(s.vaultSharePrice)} USDC
  Total Shares:        ${fmtUsdc(s.vaultTotalSupply)} easyL

BONDING CURVE (RSIM):
  Current Price:       ${fmtUsdc(s.curvePrice)} USDC per RSIM
  Total Supply:        ${fmtRsim(s.curveTotalSupply)} RSIM
  Reserve Balance:     ${fmtUsdc(s.curveReserveBalance)} USDC

MM WALLET:
  USDC Balance:        ${fmtUsdc(s.mmUsdcBalance)} USDC
  RSIM Balance:        ${fmtRsim(s.mmRsimBalance)} RSIM

=== FEASIBLE ACTIONS THIS CYCLE ===
${feasible.map((a) => `  ✓ ${a}`).join("\n")}
${infeasible.length > 0 ? "\nBLOCKED (do NOT call these):\n" + infeasible.map((a) => `  ✗ ${a}`).join("\n") : ""}`;
}
