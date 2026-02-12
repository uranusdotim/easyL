import { useAccount, useReadContracts, useReadContract } from "wagmi";
import { easyLVaultAbi, erc20Abi } from "../abi";
import { VAULT_ADDRESS, USDC_ADDRESS } from "../constants";
import { formatUnits } from "viem";

export function useUserPosition() {
  const { address } = useAccount();

  const { data, isLoading } = useReadContracts({
    contracts: [
      {
        address: VAULT_ADDRESS,
        abi: easyLVaultAbi,
        functionName: "balanceOf",
        args: address ? [address] : undefined,
      },
      {
        address: USDC_ADDRESS,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: address ? [address] : undefined,
      },
      {
        address: USDC_ADDRESS,
        abi: erc20Abi,
        functionName: "allowance",
        args: address ? [address, VAULT_ADDRESS] : undefined,
      },
    ],
    query: {
      enabled: !!address,
      refetchInterval: 15_000,
    },
  });

  const easylBalance = data?.[0]?.result as bigint | undefined;
  const usdcBalance = data?.[1]?.result as bigint | undefined;
  const allowance = data?.[2]?.result as bigint | undefined;

  const { data: positionValue } = useReadContract({
    address: VAULT_ADDRESS,
    abi: easyLVaultAbi,
    functionName: "convertToAssets",
    args: [easylBalance ?? 0n],
    query: {
      enabled: !!address && easylBalance != null && easylBalance > 0n,
      refetchInterval: 15_000,
    },
  });

  return {
    easylBalance,
    usdcBalance,
    allowance,
    positionValue,
    easylFormatted:
      easylBalance != null ? formatUnits(easylBalance, 6) : "0",
    usdcFormatted:
      usdcBalance != null ? formatUnits(usdcBalance, 6) : "0",
    positionValueFormatted:
      positionValue != null ? formatUnits(positionValue, 6) : "0",
    isLoading,
  };
}
