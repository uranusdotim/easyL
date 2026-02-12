import { useState, useEffect } from "react";
import { BASESCAN_URL } from "../constants";

interface TradeRecord {
  timestamp: string;
  cycle: number;
  action: string;
  params: Record<string, string>;
  result: "success" | "failed";
  txHash?: string;
  note?: string;
}

interface BotStatus {
  status: string;
  mmWallet: string;
  cycle: number;
  recentActions: TradeRecord[];
}

const BOT_URL = "https://easyl-mm-bot.uranusim.workers.dev/logs";

const ACTION_COLORS: Record<string, string> = {
  buy: "bg-green-900/50 text-green-400",
  sell: "bg-red-900/50 text-red-400",
  deploy: "bg-blue-900/50 text-blue-400",
  return: "bg-yellow-900/50 text-yellow-400",
  pnl: "bg-purple-900/50 text-purple-400",
  wait: "bg-gray-800 text-gray-400",
};

function relativeTime(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function truncateAddress(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export function BotActivity() {
  const [data, setData] = useState<BotStatus | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function fetchStatus() {
      try {
        const res = await fetch(BOT_URL);
        if (!res.ok) throw new Error("fetch failed");
        const json = await res.json();
        if (mounted) {
          setData(json);
          setError(false);
        }
      } catch {
        if (mounted) setError(true);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    fetchStatus();
    const interval = setInterval(fetchStatus, 15_000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  if (loading) {
    return (
      <div className="rounded-xl border border-cyan-900/50 bg-cyan-950/20 p-5 space-y-3">
        <div className="h-5 w-32 animate-pulse rounded bg-cyan-900/30" />
        <div className="h-4 w-48 animate-pulse rounded bg-cyan-900/20" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="h-12 animate-pulse rounded-lg bg-cyan-900/10"
          />
        ))}
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-xl border border-cyan-900/50 bg-cyan-950/20 p-5">
        <p className="text-sm text-gray-500">Bot offline</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-cyan-900/50 bg-cyan-950/20 p-5 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-medium uppercase tracking-wider text-cyan-400">
            Bot Activity
          </h2>
          <span className="rounded-full bg-cyan-900/40 px-2 py-0.5 text-[10px] font-medium text-cyan-300">
            cycle {data.cycle}
          </span>
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
            <span className="inline-flex h-2 w-2 rounded-full bg-green-500" />
          </span>
        </div>
        <p className="text-xs text-gray-500 font-mono">
          {truncateAddress(data.mmWallet)}
        </p>
      </div>

      {/* Actions */}
      {data.recentActions.length === 0 ? (
        <p className="text-xs text-gray-500">No recent actions</p>
      ) : (
        <div className="space-y-2">
          {[...data.recentActions].reverse().map((action, i) => (
            <div
              key={`${action.timestamp}-${i}`}
              className="rounded-lg border border-gray-800 bg-gray-900/50 px-3 py-2 space-y-1"
            >
              <div className="flex items-center gap-2 text-xs">
                <span className="text-gray-500 whitespace-nowrap">
                  {relativeTime(action.timestamp)}
                </span>
                <span className="text-gray-600 font-mono">#{action.cycle}</span>
                <span
                  className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${ACTION_COLORS[action.action] ?? "bg-gray-800 text-gray-400"}`}
                >
                  {action.action}
                </span>
                {action.params.amount && (
                  <span className="text-gray-300">
                    {action.params.amount}
                  </span>
                )}
                {action.result === "failed" && (
                  <span className="text-red-400">failed</span>
                )}
                {action.txHash && (
                  <a
                    href={`${BASESCAN_URL}/tx/${action.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-auto text-cyan-500 hover:text-cyan-400"
                  >
                    tx &rarr;
                  </a>
                )}
              </div>
              {action.note && (
                <p className="text-[11px] text-gray-500">{action.note}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
