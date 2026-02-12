export interface TradeRecord {
  timestamp: string;
  cycle: number;
  action: string;
  params: Record<string, string>;
  result: "success" | "failed";
  txHash?: string;
  note?: string;
}

export interface HistoryData {
  records: TradeRecord[];
  cycleCounter: number;
}

const MAX_SIZE = 20;
const KV_KEY = "history";

export async function loadHistory(kv: KVNamespace): Promise<HistoryData> {
  const raw = await kv.get(KV_KEY, "json") as HistoryData | null;
  return raw ?? { records: [], cycleCounter: 0 };
}

export async function saveHistory(kv: KVNamespace, data: HistoryData): Promise<void> {
  await kv.put(KV_KEY, JSON.stringify(data));
}

export function nextCycle(data: HistoryData): number {
  data.cycleCounter++;
  return data.cycleCounter;
}

export function addRecord(data: HistoryData, record: Omit<TradeRecord, "timestamp" | "cycle">): void {
  const entry: TradeRecord = {
    ...record,
    timestamp: new Date().toISOString(),
    cycle: data.cycleCounter,
  };
  data.records.push(entry);
  if (data.records.length > MAX_SIZE) {
    data.records.shift();
  }
}

export function getHistorySummary(data: HistoryData): string {
  if (data.records.length === 0) return "No actions taken yet.";

  return data.records
    .map((r) => {
      const params = Object.entries(r.params)
        .map(([k, v]) => `${k}=${v}`)
        .join(", ");
      const hash = r.txHash ? ` tx=${r.txHash.slice(0, 10)}...` : "";
      const note = r.note ? ` (${r.note})` : "";
      return `[Cycle ${r.cycle}] ${r.action}(${params}) → ${r.result}${hash}${note}`;
    })
    .join("\n");
}
