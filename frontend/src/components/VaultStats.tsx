import { useVaultStats } from "../hooks/useVaultStats";

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
      <p className="text-xs font-medium uppercase tracking-wider text-gray-500">
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold text-gray-100">{value}</p>
    </div>
  );
}

function CompositionBar({
  segments,
}: {
  segments: { pct: number; color: string; label: string }[];
}) {
  return (
    <div className="flex h-3 w-full overflow-hidden rounded-full bg-gray-800">
      {segments.map(
        (seg) =>
          seg.pct > 0 && (
            <div
              key={seg.label}
              className={`${seg.color} transition-all duration-500`}
              style={{ width: `${seg.pct}%` }}
              title={`${seg.label}: ${seg.pct.toFixed(1)}%`}
            />
          ),
      )}
    </div>
  );
}

export function VaultStats() {
  const {
    tvlFormatted,
    sharePriceFormatted,
    liquidityFormatted,
    managedFormatted,
    mmUsdcFormatted,
    mmRsimFormatted,
    rsimValueUsdcFormatted,
    totalPortfolioFormatted,
    composition,
    isLoading,
  } = useVaultStats();

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-20 animate-pulse rounded-lg border border-gray-800 bg-gray-900"
            />
          ))}
        </div>
        <div className="h-32 animate-pulse rounded-xl border border-gray-800 bg-gray-900" />
      </div>
    );
  }

  const segments = [
    { pct: composition.vaultUsdcPct, color: "bg-blue-500", label: "Vault USDC" },
    { pct: composition.mmUsdcPct, color: "bg-cyan-500", label: "MM USDC" },
    { pct: composition.rsimPct, color: "bg-purple-500", label: "RSIM" },
  ];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="TVL (USDC)" value={tvlFormatted} />
        <StatCard label="Share Price" value={`$${sharePriceFormatted}`} />
        <StatCard label="Liquidity" value={liquidityFormatted} />
        <StatCard label="Deployed" value={managedFormatted} />
      </div>

      {/* Vault asset composition */}
      <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-medium uppercase tracking-wider text-gray-500">
            Vault Assets
          </h2>
          <span className="text-xs text-gray-600">
            Total: ${totalPortfolioFormatted}
          </span>
        </div>

        <CompositionBar segments={segments} />

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {/* Vault USDC */}
          <div className="flex items-start gap-3 rounded-lg border border-gray-800 bg-gray-950 p-3">
            <div className="mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full bg-blue-500" />
            <div className="min-w-0">
              <p className="text-xs text-gray-500">USDC in Vault</p>
              <p className="text-sm font-semibold text-gray-100">
                {liquidityFormatted}
              </p>
              <p className="text-xs text-gray-600">
                {composition.vaultUsdcPct.toFixed(1)}%
              </p>
            </div>
          </div>

          {/* MM Wallet USDC */}
          <div className="flex items-start gap-3 rounded-lg border border-gray-800 bg-gray-950 p-3">
            <div className="mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full bg-cyan-500" />
            <div className="min-w-0">
              <p className="text-xs text-gray-500">USDC (MM Wallet)</p>
              <p className="text-sm font-semibold text-gray-100">
                {mmUsdcFormatted}
              </p>
              <p className="text-xs text-gray-600">
                {composition.mmUsdcPct.toFixed(1)}%
              </p>
            </div>
          </div>

          {/* RSIM Holdings */}
          <div className="flex items-start gap-3 rounded-lg border border-gray-800 bg-gray-950 p-3">
            <div className="mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full bg-purple-500" />
            <div className="min-w-0">
              <p className="text-xs text-gray-500">RSIM (RSIM/USDC)</p>
              <p className="text-sm font-semibold text-gray-100">
                {mmRsimFormatted} RSIM
              </p>
              <p className="text-xs text-gray-600">
                ~${rsimValueUsdcFormatted} &middot;{" "}
                {composition.rsimPct.toFixed(1)}%
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
