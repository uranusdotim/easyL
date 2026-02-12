import { useReadContracts } from "wagmi";
import { easyLVaultAbi, bondingCurveAbi, erc20Abi } from "../abi";
import {
  VAULT_ADDRESS,
  BONDING_CURVE_ADDRESS,
  USDC_ADDRESS,
  MM_WALLET_ADDRESS,
} from "../constants";
import { formatUnits } from "viem";

const vaultContract = {
  address: VAULT_ADDRESS,
  abi: easyLVaultAbi,
} as const;

const curveContract = {
  address: BONDING_CURVE_ADDRESS,
  abi: bondingCurveAbi,
} as const;

export function useVaultStats() {
  const { data, isLoading, error } = useReadContracts({
    contracts: [
      // Vault metrics (0-4)
      { ...vaultContract, functionName: "totalAssets" },
      { ...vaultContract, functionName: "sharePrice" },
      { ...vaultContract, functionName: "availableLiquidity" },
      { ...vaultContract, functionName: "managedAssets" },
      { ...vaultContract, functionName: "totalSupply" },
      // MM wallet balances (5-6)
      {
        address: USDC_ADDRESS,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [MM_WALLET_ADDRESS],
      },
      {
        ...curveContract,
        functionName: "balanceOf",
        args: [MM_WALLET_ADDRESS],
      },
      // Bonding curve price & getSellReturn for RSIM valuation (7-8)
      { ...curveContract, functionName: "getPrice" },
      // We read getSellReturn separately when we have the RSIM balance
    ],
    query: {
      refetchInterval: 15_000,
    },
  });

  const totalAssets = data?.[0]?.result as bigint | undefined;
  const sharePrice = data?.[1]?.result as bigint | undefined;
  const availableLiquidity = data?.[2]?.result as bigint | undefined;
  const managedAssets = data?.[3]?.result as bigint | undefined;
  const totalSupply = data?.[4]?.result as bigint | undefined;
  const mmUsdcBalance = data?.[5]?.result as bigint | undefined;
  const mmRsimBalance = data?.[6]?.result as bigint | undefined;
  const rsimPrice = data?.[7]?.result as bigint | undefined;

  // Fetch the exact USDC sell return for the MM's RSIM holdings
  const { data: sellReturnData } = useReadContracts({
    contracts: [
      {
        ...curveContract,
        functionName: "getSellReturn",
        args: [mmRsimBalance ?? 0n],
      },
    ],
    query: {
      enabled: mmRsimBalance != null && mmRsimBalance > 0n,
      refetchInterval: 15_000,
    },
  });

  const rsimValueUsdc = sellReturnData?.[0]?.result as bigint | undefined;

  // Compute total portfolio value (vault USDC + MM USDC + RSIM value)
  const vaultUsdcHeld = availableLiquidity ?? 0n;
  const mmUsdc = mmUsdcBalance ?? 0n;
  const rsimVal = rsimValueUsdc ?? 0n;
  const totalPortfolioValue = vaultUsdcHeld + mmUsdc + rsimVal;

  // Composition percentages
  const pctOf = (part: bigint, whole: bigint): number =>
    whole > 0n ? Number((part * 10000n) / whole) / 100 : 0;

  const vaultUsdcPct = pctOf(vaultUsdcHeld, totalPortfolioValue);
  const mmUsdcPct = pctOf(mmUsdc, totalPortfolioValue);
  const rsimPct = pctOf(rsimVal, totalPortfolioValue);

  return {
    // Original values
    totalAssets,
    sharePrice,
    availableLiquidity,
    managedAssets,
    totalSupply,
    tvlFormatted: totalAssets != null ? formatUnits(totalAssets, 6) : "—",
    sharePriceFormatted: sharePrice != null ? formatUnits(sharePrice, 6) : "—",
    liquidityFormatted:
      availableLiquidity != null ? formatUnits(availableLiquidity, 6) : "—",
    managedFormatted:
      managedAssets != null ? formatUnits(managedAssets, 6) : "—",

    // Composition data
    mmUsdcBalance,
    mmRsimBalance,
    rsimPrice,
    rsimValueUsdc,
    totalPortfolioValue,
    mmUsdcFormatted:
      mmUsdcBalance != null ? formatUnits(mmUsdcBalance, 6) : "—",
    mmRsimFormatted:
      mmRsimBalance != null ? formatUnits(mmRsimBalance, 6) : "—",
    rsimPriceFormatted:
      rsimPrice != null ? formatUnits(rsimPrice, 6) : "—",
    rsimValueUsdcFormatted:
      rsimValueUsdc != null ? formatUnits(rsimValueUsdc, 6) : "0",
    totalPortfolioFormatted: formatUnits(totalPortfolioValue, 6),
    composition: {
      vaultUsdcPct,
      mmUsdcPct,
      rsimPct,
    },

    isLoading,
    error,
  };
}
