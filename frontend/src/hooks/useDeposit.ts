import { useState, useCallback } from "react";
import {
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { parseUnits, maxUint256 } from "viem";
import { easyLVaultAbi, erc20Abi } from "../abi";
import { VAULT_ADDRESS, USDC_ADDRESS } from "../constants";
import { useUserPosition } from "./useUserPosition";

export function useDeposit() {
  const { address } = useAccount();
  const { allowance } = useUserPosition();
  const [amount, setAmount] = useState("");

  const parsedAmount =
    amount && !isNaN(Number(amount)) ? parseUnits(amount, 6) : 0n;

  const needsApproval = allowance != null && parsedAmount > allowance;

  const {
    writeContract: approve,
    data: approveTxHash,
    isPending: isApproving,
    error: approveError,
    reset: resetApprove,
  } = useWriteContract();

  const { isLoading: isApproveConfirming, isSuccess: isApproveConfirmed } =
    useWaitForTransactionReceipt({ hash: approveTxHash });

  const {
    writeContract: deposit,
    data: depositTxHash,
    isPending: isDepositing,
    error: depositError,
    reset: resetDeposit,
  } = useWriteContract();

  const { isLoading: isDepositConfirming, isSuccess: isDepositConfirmed } =
    useWaitForTransactionReceipt({ hash: depositTxHash });

  const handleApprove = useCallback(() => {
    if (!address) return;
    approve({
      address: USDC_ADDRESS,
      abi: erc20Abi,
      functionName: "approve",
      args: [VAULT_ADDRESS, maxUint256],
    });
  }, [address, approve]);

  const handleDeposit = useCallback(() => {
    if (!address || parsedAmount === 0n) return;
    deposit({
      address: VAULT_ADDRESS,
      abi: easyLVaultAbi,
      functionName: "deposit",
      args: [parsedAmount, address],
    });
  }, [address, parsedAmount, deposit]);

  const reset = useCallback(() => {
    setAmount("");
    resetApprove();
    resetDeposit();
  }, [resetApprove, resetDeposit]);

  return {
    amount,
    setAmount,
    parsedAmount,
    needsApproval,
    handleApprove,
    handleDeposit,
    reset,
    isApproving,
    isApproveConfirming,
    isApproveConfirmed,
    approveError,
    isDepositing,
    isDepositConfirming,
    isDepositConfirmed,
    depositTxHash,
    depositError,
  };
}
