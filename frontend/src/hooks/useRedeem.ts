import { useState, useCallback } from "react";
import {
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { parseUnits } from "viem";
import { easyLVaultAbi } from "../abi";
import { VAULT_ADDRESS } from "../constants";

export function useRedeem() {
  const { address } = useAccount();
  const [amount, setAmount] = useState("");

  const parsedAmount =
    amount && !isNaN(Number(amount)) ? parseUnits(amount, 6) : 0n;

  const {
    writeContract: redeem,
    data: redeemTxHash,
    isPending: isRedeeming,
    error: redeemError,
    reset: resetRedeem,
  } = useWriteContract();

  const { isLoading: isRedeemConfirming, isSuccess: isRedeemConfirmed } =
    useWaitForTransactionReceipt({ hash: redeemTxHash });

  const handleRedeem = useCallback(() => {
    if (!address || parsedAmount === 0n) return;
    redeem({
      address: VAULT_ADDRESS,
      abi: easyLVaultAbi,
      functionName: "redeem",
      args: [parsedAmount, address],
    });
  }, [address, parsedAmount, redeem]);

  const reset = useCallback(() => {
    setAmount("");
    resetRedeem();
  }, [resetRedeem]);

  return {
    amount,
    setAmount,
    parsedAmount,
    handleRedeem,
    reset,
    isRedeeming,
    isRedeemConfirming,
    isRedeemConfirmed,
    redeemTxHash,
    redeemError,
  };
}
