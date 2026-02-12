import { useReadContract } from "wagmi";
import { formatUnits } from "viem";
import { useDeposit } from "../hooks/useDeposit";
import { useUserPosition } from "../hooks/useUserPosition";
import { easyLVaultAbi } from "../abi";
import { VAULT_ADDRESS } from "../constants";
import { TransactionStatus } from "./TransactionStatus";

export function DepositForm() {
  const { usdcBalance } = useUserPosition();
  const {
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
  } = useDeposit();

  const { data: previewShares } = useReadContract({
    address: VAULT_ADDRESS,
    abi: easyLVaultAbi,
    functionName: "convertToShares",
    args: [parsedAmount],
    query: { enabled: parsedAmount > 0n },
  });

  const handleMax = () => {
    if (usdcBalance != null) {
      setAmount(formatUnits(usdcBalance, 6));
    }
  };

  const isValidAmount = parsedAmount > 0n;
  const hasEnoughBalance = usdcBalance != null && parsedAmount <= usdcBalance;
  const showApprove = needsApproval && !isApproveConfirmed;

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
      <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-gray-500">
        Deposit USDC
      </h2>

      <div className="relative">
        <input
          type="text"
          inputMode="decimal"
          placeholder="0.00"
          value={amount}
          onChange={(e) => {
            const val = e.target.value;
            if (/^[0-9]*\.?[0-9]*$/.test(val)) setAmount(val);
          }}
          className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 pr-16 text-lg text-gray-100 placeholder-gray-600 focus:border-brand-500 focus:outline-none"
        />
        <button
          onClick={handleMax}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded bg-gray-700 px-2 py-1 text-xs font-medium text-gray-300 hover:bg-gray-600"
        >
          MAX
        </button>
      </div>

      {previewShares != null && parsedAmount > 0n && (
        <p className="mt-2 text-xs text-gray-500">
          You will receive ~{formatUnits(previewShares, 6)} EASYL
        </p>
      )}

      {!hasEnoughBalance && isValidAmount && (
        <p className="mt-2 text-xs text-red-400">Insufficient USDC balance</p>
      )}

      <div className="mt-4 flex gap-2">
        {showApprove ? (
          <button
            onClick={handleApprove}
            disabled={isApproving || isApproveConfirming}
            className="flex-1 rounded-lg bg-gray-700 py-3 font-medium text-gray-100 transition hover:bg-gray-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isApproving || isApproveConfirming
              ? "Approving..."
              : "Approve USDC"}
          </button>
        ) : null}
        <button
          onClick={handleDeposit}
          disabled={
            !isValidAmount ||
            !hasEnoughBalance ||
            needsApproval && !isApproveConfirmed ||
            isDepositing ||
            isDepositConfirming
          }
          className="flex-1 rounded-lg bg-brand-600 py-3 font-medium text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isDepositing || isDepositConfirming ? "Depositing..." : "Deposit"}
        </button>
      </div>

      {(approveError || depositError || isDepositConfirmed) && (
        <TransactionStatus
          isPending={false}
          isConfirming={false}
          isConfirmed={isDepositConfirmed}
          txHash={depositTxHash}
          error={approveError || depositError}
          onReset={reset}
        />
      )}
    </div>
  );
}
