import { useState } from "react";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { parseUnits, formatUnits } from "viem";
import { easyLVaultAbi, erc20Abi } from "../abi";
import { VAULT_ADDRESS, USDC_ADDRESS } from "../constants";
import { useVaultStats } from "../hooks/useVaultStats";
import { TransactionStatus } from "./TransactionStatus";

export function OwnerPanel() {
  const { address } = useAccount();
  const { data: owner } = useReadContract({
    address: VAULT_ADDRESS,
    abi: easyLVaultAbi,
    functionName: "owner",
  });

  if (!address || !owner || address.toLowerCase() !== owner.toLowerCase()) {
    return null;
  }

  return (
    <div className="rounded-xl border border-yellow-900/50 bg-yellow-950/20 p-5 space-y-4">
      <h2 className="text-sm font-medium uppercase tracking-wider text-yellow-500">
        Owner Panel — Simulate Market Making
      </h2>
      <div className="grid gap-4 md:grid-cols-3">
        <DeployFundsCard />
        <ReturnFundsCard />
        <ReportPnLCard />
      </div>
    </div>
  );
}

function DeployFundsCard() {
  const [amount, setAmount] = useState("");
  const { availableLiquidity } = useVaultStats();
  const parsedAmount =
    amount && !isNaN(Number(amount)) ? parseUnits(amount, 6) : 0n;

  const {
    writeContract,
    data: txHash,
    isPending,
    error,
    reset,
  } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } =
    useWaitForTransactionReceipt({ hash: txHash });

  const handleDeploy = () => {
    if (parsedAmount === 0n) return;
    writeContract({
      address: VAULT_ADDRESS,
      abi: easyLVaultAbi,
      functionName: "deployFunds",
      args: [parsedAmount],
    });
  };

  const handleMax = () => {
    if (availableLiquidity != null) setAmount(formatUnits(availableLiquidity, 6));
  };

  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-400">Deploy USDC (withdraw for MM)</p>
      <div className="relative">
        <input
          type="text"
          inputMode="decimal"
          placeholder="0.00"
          value={amount}
          onChange={(e) => {
            if (/^[0-9]*\.?[0-9]*$/.test(e.target.value)) setAmount(e.target.value);
          }}
          className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 pr-14 text-sm text-gray-100 placeholder-gray-600 focus:border-yellow-500 focus:outline-none"
        />
        <button
          onClick={handleMax}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded bg-gray-700 px-1.5 py-0.5 text-[10px] font-medium text-gray-300 hover:bg-gray-600"
        >
          MAX
        </button>
      </div>
      <button
        onClick={handleDeploy}
        disabled={parsedAmount === 0n || isPending || isConfirming}
        className="w-full rounded-lg bg-yellow-700 py-2 text-sm font-medium text-white hover:bg-yellow-600 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isPending || isConfirming ? "Deploying..." : "Deploy Funds"}
      </button>
      {(error || isSuccess) && (
        <TransactionStatus
          isPending={false}
          isConfirming={false}
          isConfirmed={isSuccess}
          txHash={txHash}
          error={error}
          onReset={reset}
        />
      )}
    </div>
  );
}

function ReturnFundsCard() {
  const { address } = useAccount();
  const [amount, setAmount] = useState("");
  const { managedAssets } = useVaultStats();
  const parsedAmount =
    amount && !isNaN(Number(amount)) ? parseUnits(amount, 6) : 0n;

  // Check owner's USDC allowance to vault (needed for returnFunds)
  const { data: allowance } = useReadContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: "allowance",
    args: address ? [address, VAULT_ADDRESS] : undefined,
    query: { enabled: !!address },
  });

  const needsApproval = allowance != null && parsedAmount > allowance;

  const {
    writeContract: approve,
    data: approveTxHash,
    isPending: isApproving,
  } = useWriteContract();

  const { isLoading: isApproveConfirming, isSuccess: isApproveConfirmed } =
    useWaitForTransactionReceipt({ hash: approveTxHash });

  const {
    writeContract,
    data: txHash,
    isPending,
    error,
    reset,
  } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } =
    useWaitForTransactionReceipt({ hash: txHash });

  const handleApprove = () => {
    approve({
      address: USDC_ADDRESS,
      abi: erc20Abi,
      functionName: "approve",
      args: [VAULT_ADDRESS, BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff")],
    });
  };

  const handleReturn = () => {
    if (parsedAmount === 0n) return;
    writeContract({
      address: VAULT_ADDRESS,
      abi: easyLVaultAbi,
      functionName: "returnFunds",
      args: [parsedAmount],
    });
  };

  const handleMax = () => {
    if (managedAssets != null) setAmount(formatUnits(managedAssets, 6));
  };

  const showApprove = needsApproval && !isApproveConfirmed;

  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-400">Return USDC (deposit back)</p>
      <div className="relative">
        <input
          type="text"
          inputMode="decimal"
          placeholder="0.00"
          value={amount}
          onChange={(e) => {
            if (/^[0-9]*\.?[0-9]*$/.test(e.target.value)) setAmount(e.target.value);
          }}
          className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 pr-14 text-sm text-gray-100 placeholder-gray-600 focus:border-yellow-500 focus:outline-none"
        />
        <button
          onClick={handleMax}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded bg-gray-700 px-1.5 py-0.5 text-[10px] font-medium text-gray-300 hover:bg-gray-600"
        >
          MAX
        </button>
      </div>
      {showApprove ? (
        <button
          onClick={handleApprove}
          disabled={isApproving || isApproveConfirming}
          className="w-full rounded-lg bg-gray-700 py-2 text-sm font-medium text-white hover:bg-gray-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isApproving || isApproveConfirming ? "Approving..." : "Approve USDC"}
        </button>
      ) : (
        <button
          onClick={handleReturn}
          disabled={parsedAmount === 0n || isPending || isConfirming}
          className="w-full rounded-lg bg-yellow-700 py-2 text-sm font-medium text-white hover:bg-yellow-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending || isConfirming ? "Returning..." : "Return Funds"}
        </button>
      )}
      {(error || isSuccess) && (
        <TransactionStatus
          isPending={false}
          isConfirming={false}
          isConfirmed={isSuccess}
          txHash={txHash}
          error={error}
          onReset={reset}
        />
      )}
    </div>
  );
}

function ReportPnLCard() {
  const [amount, setAmount] = useState("");
  const [isProfit, setIsProfit] = useState(true);

  const parsedAmount =
    amount && !isNaN(Number(amount)) ? parseUnits(amount, 6) : 0n;

  const {
    writeContract,
    data: txHash,
    isPending,
    error,
    reset,
  } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } =
    useWaitForTransactionReceipt({ hash: txHash });

  const handleReport = () => {
    if (parsedAmount === 0n) return;
    const pnlValue = isProfit
      ? BigInt(parsedAmount)
      : -BigInt(parsedAmount);
    writeContract({
      address: VAULT_ADDRESS,
      abi: easyLVaultAbi,
      functionName: "reportPnL",
      args: [pnlValue],
    });
  };

  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-400">Report P&L (adjust share price)</p>
      <div className="flex gap-1">
        <button
          onClick={() => setIsProfit(true)}
          className={`flex-1 rounded-lg py-1.5 text-xs font-medium ${
            isProfit
              ? "bg-green-700 text-white"
              : "bg-gray-800 text-gray-400 hover:bg-gray-700"
          }`}
        >
          Profit
        </button>
        <button
          onClick={() => setIsProfit(false)}
          className={`flex-1 rounded-lg py-1.5 text-xs font-medium ${
            !isProfit
              ? "bg-red-700 text-white"
              : "bg-gray-800 text-gray-400 hover:bg-gray-700"
          }`}
        >
          Loss
        </button>
      </div>
      <input
        type="text"
        inputMode="decimal"
        placeholder="0.00"
        value={amount}
        onChange={(e) => {
          if (/^[0-9]*\.?[0-9]*$/.test(e.target.value)) setAmount(e.target.value);
        }}
        className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:border-yellow-500 focus:outline-none"
      />
      <button
        onClick={handleReport}
        disabled={parsedAmount === 0n || isPending || isConfirming}
        className={`w-full rounded-lg py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50 ${
          isProfit
            ? "bg-green-700 hover:bg-green-600"
            : "bg-red-700 hover:bg-red-600"
        }`}
      >
        {isPending || isConfirming
          ? "Reporting..."
          : `Report ${isProfit ? "Profit" : "Loss"}`}
      </button>
      {(error || isSuccess) && (
        <TransactionStatus
          isPending={false}
          isConfirming={false}
          isConfirmed={isSuccess}
          txHash={txHash}
          error={error}
          onReset={reset}
        />
      )}
    </div>
  );
}
