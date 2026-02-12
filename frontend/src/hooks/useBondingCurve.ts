import { useAccount, useReadContracts, useReadContract } from "wagmi";
import { formatUnits } from "viem";
import { bondingCurveAbi, erc20Abi } from "../abi";
import { BONDING_CURVE_ADDRESS, USDC_ADDRESS, USDC_DECIMALS, RSIM_DECIMALS } from "../constants";

const curveContract = {
  address: BONDING_CURVE_ADDRESS,
  abi: bondingCurveAbi,
} as const;

export function useBondingCurve() {
  const { address } = useAccount();

  const { data, isLoading, error } = useReadContracts({
    contracts: [
      { ...curveContract, functionName: "getPrice" },
      { ...curveContract, functionName: "totalSupply" },
      { ...curveContract, functionName: "reserveBalance" },
    ],
    query: { refetchInterval: 15_000 },
  });

  const price = data?.[0]?.result as bigint | undefined;
  const totalSupply = data?.[1]?.result as bigint | undefined;
  const reserveBalance = data?.[2]?.result as bigint | undefined;

  // User's RSIM token balance
  const { data: tokenBalance } = useReadContract({
    ...curveContract,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 15_000 },
  });

  // User's USDC allowance for the bonding curve
  const { data: usdcAllowance } = useReadContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: "allowance",
    args: address ? [address, BONDING_CURVE_ADDRESS] : undefined,
    query: { enabled: !!address, refetchInterval: 15_000 },
  });

  return {
    price,
    totalSupply,
    reserveBalance,
    tokenBalance: tokenBalance as bigint | undefined,
    usdcAllowance: usdcAllowance as bigint | undefined,
    priceFormatted: price != null ? price.toString() : "—",
    totalSupplyFormatted:
      totalSupply != null ? formatUnits(totalSupply, RSIM_DECIMALS) : "—",
    reserveFormatted:
      reserveBalance != null
        ? formatUnits(reserveBalance, USDC_DECIMALS)
        : "—",
    tokenBalanceFormatted:
      tokenBalance != null
        ? formatUnits(tokenBalance as bigint, RSIM_DECIMALS)
        : "—",
    isLoading,
    error,
  };
}
