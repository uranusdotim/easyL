import { useMemo, useState } from "react";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { parseUnits, formatUnits, maxUint256 } from "viem";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceDot,
  ResponsiveContainer,
} from "recharts";
import { bondingCurveAbi, erc20Abi } from "../abi";
import {
  BONDING_CURVE_ADDRESS,
  USDC_ADDRESS,
  USDC_DECIMALS,
  RSIM_DECIMALS,
} from "../constants";
import { useBondingCurve } from "../hooks/useBondingCurve";
import { useUserPosition } from "../hooks/useUserPosition";
import { TransactionStatus } from "./TransactionStatus";

export function BondingCurvePanel() {
  const { isConnected } = useAccount();
  const {
    price,
    totalSupply,
    priceFormatted,
    totalSupplyFormatted,
    reserveFormatted,
    tokenBalanceFormatted,
  } = useBondingCurve();

  return (
    <div className="rounded-xl border border-purple-900/50 bg-purple-950/20 p-5 space-y-4">
      <h2 className="text-sm font-medium uppercase tracking-wider text-purple-400">
        Bonding Curve — RSIM Token
      </h2>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Price (raw)" value={priceFormatted} />
        <StatCard label="Total Supply" value={totalSupplyFormatted} suffix="RSIM" />
        <StatCard label="Reserve" value={reserveFormatted} suffix="USDC" />
        <StatCard label="Your Balance" value={tokenBalanceFormatted} suffix="RSIM" />
      </div>

      {/* Price chart */}
      <PriceChart currentSupply={totalSupply} currentPrice={price} />

      {/* Buy / Sell forms */}
      {isConnected && (
        <div className="grid gap-4 md:grid-cols-2">
          <BuyCard />
          <SellCard />
        </div>
      )}
    </div>
  );
}

function PriceChart({
  currentSupply,
  currentPrice,
}: {
  currentSupply: bigint | undefined;
  currentPrice: bigint | undefined;
}) {
  const data = useMemo(() => {
    const supplyTokens =
      currentSupply != null
        ? Number(formatUnits(currentSupply, RSIM_DECIMALS))
        : 0;
    const maxSupply = Math.max(supplyTokens * 2, 100);
    const step = maxSupply / 50;
    const points: { supply: number; price: number }[] = [];
    for (let i = 0; i <= 50; i++) {
      const s = +(i * step).toFixed(4);
      points.push({ supply: s, price: +(0.01 + 0.01 * s).toFixed(6) });
    }
    return points;
  }, [currentSupply]);

  const currentSupplyNum =
    currentSupply != null
      ? Number(formatUnits(currentSupply, RSIM_DECIMALS))
      : undefined;
  const currentPriceNum =
    currentPrice != null
      ? Number(formatUnits(currentPrice, USDC_DECIMALS))
      : undefined;

  return (
    <div className="h-52 rounded-lg border border-gray-800 bg-gray-900/50 p-3">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="purpleGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#c084fc" stopOpacity={0.4} />
              <stop offset="100%" stopColor="#c084fc" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#4b5563" />
          <XAxis
            dataKey="supply"
            tick={{ fill: "#9ca3af", fontSize: 10 }}
            stroke="#4b5563"
            label={{ value: "Supply (RSIM)", position: "insideBottom", offset: -2, fill: "#9ca3af", fontSize: 10 }}
          />
          <YAxis
            tick={{ fill: "#9ca3af", fontSize: 10 }}
            stroke="#4b5563"
            label={{ value: "Price (USDC)", angle: -90, position: "insideLeft", fill: "#9ca3af", fontSize: 10 }}
          />
          <Tooltip
            contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #4b5563", borderRadius: 8, fontSize: 12 }}
            labelStyle={{ color: "#d1d5db" }}
            itemStyle={{ color: "#c084fc" }}
            formatter={(value: number | undefined) => value != null ? [`$${value.toFixed(4)}`, "Price"] : []}
            labelFormatter={(label) => `Supply: ${label} RSIM`}
          />
          <Area
            type="monotone"
            dataKey="price"
            stroke="#c084fc"
            strokeWidth={2}
            fill="url(#purpleGrad)"
          />
          {currentSupplyNum != null && currentPriceNum != null && (
            <ReferenceDot
              x={currentSupplyNum}
              y={currentPriceNum}
              r={5}
              fill="#a855f7"
              stroke="#fff"
              strokeWidth={2}
            />
          )}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function StatCard({
  label,
  value,
  suffix,
}: {
  label: string;
  value: string;
  suffix?: string;
}) {
  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-3">
      <p className="text-[10px] uppercase tracking-wider text-gray-500">
        {label}
      </p>
      <p className="mt-1 truncate text-sm font-medium text-gray-100">
        {value}
        {suffix && (
          <span className="ml-1 text-xs text-gray-500">{suffix}</span>
        )}
      </p>
    </div>
  );
}

function BuyCard() {
  const { address } = useAccount();
  const { usdcBalance } = useUserPosition();
  const { usdcAllowance } = useBondingCurve();
  const [amount, setAmount] = useState("");

  const parsedAmount =
    amount && !isNaN(Number(amount))
      ? parseUnits(amount, USDC_DECIMALS)
      : 0n;

  const needsApproval =
    usdcAllowance != null && parsedAmount > usdcAllowance;

  // Preview: how many tokens for this USDC?
  // We can't easily invert the curve on-chain in a view, so we call buy cost
  // The contract's buy() solves the quadratic. We'll show an approximation
  // by reading getPrice and dividing (rough estimate)
  const { data: currentPrice } = useReadContract({
    address: BONDING_CURVE_ADDRESS,
    abi: bondingCurveAbi,
    functionName: "getPrice",
    query: { refetchInterval: 15_000 },
  });

  const previewTokens =
    currentPrice && currentPrice > 0n && parsedAmount > 0n
      ? (parsedAmount * BigInt(10 ** RSIM_DECIMALS)) / currentPrice
      : undefined;

  // Approve USDC
  const {
    writeContract: approve,
    data: approveTxHash,
    isPending: isApproving,
    reset: resetApprove,
  } = useWriteContract();

  const { isLoading: isApproveConfirming, isSuccess: isApproveConfirmed } =
    useWaitForTransactionReceipt({ hash: approveTxHash });

  // Buy
  const {
    writeContract: buy,
    data: buyTxHash,
    isPending: isBuying,
    error: buyError,
    reset: resetBuy,
  } = useWriteContract();

  const { isLoading: isBuyConfirming, isSuccess: isBuyConfirmed } =
    useWaitForTransactionReceipt({ hash: buyTxHash });

  const handleApprove = () => {
    if (!address) return;
    approve({
      address: USDC_ADDRESS,
      abi: erc20Abi,
      functionName: "approve",
      args: [BONDING_CURVE_ADDRESS, maxUint256],
    });
  };

  const handleBuy = () => {
    if (!address || parsedAmount === 0n) return;
    buy({
      address: BONDING_CURVE_ADDRESS,
      abi: bondingCurveAbi,
      functionName: "buy",
      args: [parsedAmount],
    });
  };

  const handleMax = () => {
    if (usdcBalance != null) setAmount(formatUnits(usdcBalance, USDC_DECIMALS));
  };

  const reset = () => {
    setAmount("");
    resetApprove();
    resetBuy();
  };

  const showApprove = needsApproval && !isApproveConfirmed;
  const isValidAmount = parsedAmount > 0n;
  const hasEnoughBalance =
    usdcBalance != null && parsedAmount <= usdcBalance;

  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-400">Buy RSIM with USDC</p>
      <div className="relative">
        <input
          type="text"
          inputMode="decimal"
          placeholder="0.00 USDC"
          value={amount}
          onChange={(e) => {
            if (/^[0-9]*\.?[0-9]*$/.test(e.target.value))
              setAmount(e.target.value);
          }}
          className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 pr-14 text-sm text-gray-100 placeholder-gray-600 focus:border-purple-500 focus:outline-none"
        />
        <button
          onClick={handleMax}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded bg-gray-700 px-1.5 py-0.5 text-[10px] font-medium text-gray-300 hover:bg-gray-600"
        >
          MAX
        </button>
      </div>

      {previewTokens != null && parsedAmount > 0n && (
        <p className="text-xs text-gray-500">
          ~{formatUnits(previewTokens, RSIM_DECIMALS)} RSIM (estimate)
        </p>
      )}

      {!hasEnoughBalance && isValidAmount && (
        <p className="text-xs text-red-400">Insufficient USDC balance</p>
      )}

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
          onClick={handleBuy}
          disabled={
            !isValidAmount ||
            !hasEnoughBalance ||
            isBuying ||
            isBuyConfirming
          }
          className="w-full rounded-lg bg-purple-700 py-2 text-sm font-medium text-white hover:bg-purple-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isBuying || isBuyConfirming ? "Buying..." : "Buy RSIM"}
        </button>
      )}

      {(buyError || isBuyConfirmed) && (
        <TransactionStatus
          isPending={false}
          isConfirming={false}
          isConfirmed={isBuyConfirmed}
          txHash={buyTxHash}
          error={buyError}
          onReset={reset}
        />
      )}
    </div>
  );
}

function SellCard() {
  const { address } = useAccount();
  const { tokenBalance } = useBondingCurve();
  const [amount, setAmount] = useState("");

  const parsedAmount =
    amount && !isNaN(Number(amount))
      ? parseUnits(amount, RSIM_DECIMALS)
      : 0n;

  // Preview: USDC returned for selling
  const { data: previewUsdc } = useReadContract({
    address: BONDING_CURVE_ADDRESS,
    abi: bondingCurveAbi,
    functionName: "getSellReturn",
    args: [parsedAmount],
    query: { enabled: parsedAmount > 0n },
  });

  const {
    writeContract: sell,
    data: sellTxHash,
    isPending: isSelling,
    error: sellError,
    reset: resetSell,
  } = useWriteContract();

  const { isLoading: isSellConfirming, isSuccess: isSellConfirmed } =
    useWaitForTransactionReceipt({ hash: sellTxHash });

  const handleSell = () => {
    if (!address || parsedAmount === 0n) return;
    sell({
      address: BONDING_CURVE_ADDRESS,
      abi: bondingCurveAbi,
      functionName: "sell",
      args: [parsedAmount],
    });
  };

  const handleMax = () => {
    if (tokenBalance != null)
      setAmount(formatUnits(tokenBalance, RSIM_DECIMALS));
  };

  const reset = () => {
    setAmount("");
    resetSell();
  };

  const isValidAmount = parsedAmount > 0n;
  const hasEnoughBalance =
    tokenBalance != null && parsedAmount <= tokenBalance;

  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-400">Sell RSIM for USDC</p>
      <div className="relative">
        <input
          type="text"
          inputMode="decimal"
          placeholder="0.00 RSIM"
          value={amount}
          onChange={(e) => {
            if (/^[0-9]*\.?[0-9]*$/.test(e.target.value))
              setAmount(e.target.value);
          }}
          className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 pr-14 text-sm text-gray-100 placeholder-gray-600 focus:border-purple-500 focus:outline-none"
        />
        <button
          onClick={handleMax}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded bg-gray-700 px-1.5 py-0.5 text-[10px] font-medium text-gray-300 hover:bg-gray-600"
        >
          MAX
        </button>
      </div>

      {previewUsdc != null && parsedAmount > 0n && (
        <p className="text-xs text-gray-500">
          ~{formatUnits(previewUsdc, USDC_DECIMALS)} USDC
        </p>
      )}

      {!hasEnoughBalance && isValidAmount && (
        <p className="text-xs text-red-400">Insufficient RSIM balance</p>
      )}

      <button
        onClick={handleSell}
        disabled={
          !isValidAmount ||
          !hasEnoughBalance ||
          isSelling ||
          isSellConfirming
        }
        className="w-full rounded-lg bg-purple-700 py-2 text-sm font-medium text-white hover:bg-purple-600 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isSelling || isSellConfirming ? "Selling..." : "Sell RSIM"}
      </button>

      {(sellError || isSellConfirmed) && (
        <TransactionStatus
          isPending={false}
          isConfirming={false}
          isConfirmed={isSellConfirmed}
          txHash={sellTxHash}
          error={sellError}
          onReset={reset}
        />
      )}
    </div>
  );
}
