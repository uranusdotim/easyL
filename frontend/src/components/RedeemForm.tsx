import { useReadContract } from "wagmi";
import { formatUnits } from "viem";
import { useRedeem } from "../hooks/useRedeem";
import { useUserPosition } from "../hooks/useUserPosition";
import { useVaultStats } from "../hooks/useVaultStats";
import { easyLVaultAbi } from "../abi";
import { VAULT_ADDRESS } from "../constants";
import { TransactionStatus } from "./TransactionStatus";

export function RedeemForm() {
  const { easylBalance } = useUserPosition();
  const {
    availableLiquidity,
    totalSupply,
    mmUsdcBalance,
    mmRsimBalance,
    rsimValueUsdc,
    totalPortfolioValue,
  } = useVaultStats();
  const {
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
  } = useRedeem();

  const { data: previewAssets } = useReadContract({
    address: VAULT_ADDRESS,
    abi: easyLVaultAbi,
    functionName: "convertToAssets",
    args: [parsedAmount],
    query: { enabled: parsedAmount > 0n },
  });

  // Proportional breakdown: what portion of each asset the user's shares represent
  const supply = totalSupply ?? 0n;
  const hasProportionalData =
    parsedAmount > 0n && supply > 0n && totalPortfolioValue > 0n;

  // USDC portion = (shares / totalSupply) * (vaultUSDC + mmUSDC)
  const totalUsdc = (availableLiquidity ?? 0n) + (mmUsdcBalance ?? 0n);
  const proportionalUsdc = hasProportionalData
    ? (parsedAmount * totalUsdc) / supply
    : 0n;
  // RSIM portion = (shares / totalSupply) * mmRsimBalance
  const proportionalRsim = hasProportionalData
    ? (parsedAmount * (mmRsimBalance ?? 0n)) / supply
    : 0n;
  // USDC value of the RSIM portion
  const proportionalRsimValue =
    hasProportionalData && (mmRsimBalance ?? 0n) > 0n
      ? (parsedAmount * (rsimValueUsdc ?? 0n)) / supply
      : 0n;

  const handleMax = () => {
    if (easylBalance != null) {
      setAmount(formatUnits(easylBalance, 6));
    }
  };

  const isValidAmount = parsedAmount > 0n;
  const hasEnoughShares = easylBalance != null && parsedAmount <= easylBalance;
  const insufficientLiquidity =
    previewAssets != null &&
    availableLiquidity != null &&
    previewAssets > availableLiquidity;

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
      <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-gray-500">
        Redeem EASYL
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

      {/* Proportional redemption breakdown */}
      {hasProportionalData && previewAssets != null && (
        <div className="mt-3 rounded-lg border border-gray-800 bg-gray-950 p-3">
          <p className="mb-2 text-xs font-medium text-gray-400">
            You will receive proportionally:
          </p>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-blue-500" />
                <span className="text-xs text-gray-300">USDC</span>
              </div>
              <span className="text-xs font-semibold text-gray-100">
                {formatUnits(proportionalUsdc, 6)}
              </span>
            </div>
            {proportionalRsim > 0n && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-purple-500" />
                  <span className="text-xs text-gray-300">RSIM</span>
                </div>
                <span className="text-xs font-semibold text-gray-100">
                  {formatUnits(proportionalRsim, 6)}{" "}
                  <span className="font-normal text-gray-500">
                    (~${formatUnits(proportionalRsimValue, 6)})
                  </span>
                </span>
              </div>
            )}
            <div className="border-t border-gray-800 pt-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">Total value</span>
                <span className="text-xs font-semibold text-gray-200">
                  ~${formatUnits(previewAssets, 6)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {!hasEnoughShares && isValidAmount && (
        <p className="mt-2 text-xs text-red-400">
          Insufficient EASYL balance
        </p>
      )}

      {insufficientLiquidity && (
        <p className="mt-2 text-xs text-yellow-400">
          Insufficient vault liquidity. Some funds are deployed for market
          making.
        </p>
      )}

      <div className="mt-4">
        <button
          onClick={handleRedeem}
          disabled={
            !isValidAmount ||
            !hasEnoughShares ||
            insufficientLiquidity ||
            isRedeeming ||
            isRedeemConfirming
          }
          className="w-full rounded-lg bg-brand-600 py-3 font-medium text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isRedeeming || isRedeemConfirming ? "Redeeming..." : "Redeem"}
        </button>
      </div>

      {(redeemError || isRedeemConfirmed) && (
        <TransactionStatus
          isPending={false}
          isConfirming={false}
          isConfirmed={isRedeemConfirmed}
          txHash={redeemTxHash}
          error={redeemError}
          onReset={reset}
        />
      )}
    </div>
  );
}
