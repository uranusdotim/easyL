import { useState } from "react";
import { useAccount } from "wagmi";
import { Layout } from "./components/Layout";
import { Header } from "./components/Header";
import { VaultStats } from "./components/VaultStats";
import { DepositForm } from "./components/DepositForm";
import { RedeemForm } from "./components/RedeemForm";
import { UserPosition } from "./components/UserPosition";
import { OwnerPanel } from "./components/OwnerPanel";
import { BondingCurvePanel } from "./components/BondingCurvePanel";
import { BotActivity } from "./components/BotActivity";

type Tab = "vault" | "bonding" | "logs";

const tabs: { key: Tab; label: string }[] = [
  { key: "vault", label: "Vault" },
  { key: "bonding", label: "Bonding Curve" },
  { key: "logs", label: "Logs" },
];

export default function App() {
  const { isConnected } = useAccount();
  const [activeTab, setActiveTab] = useState<Tab>("vault");

  return (
    <Layout>
      <Header />
      <main className="mx-auto max-w-7xl px-4 py-8 space-y-6">
        {/* Tabs */}
        <div className="flex gap-1 rounded-lg border border-gray-800 bg-gray-900/50 p-1">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? "bg-gray-800 text-white"
                  : "text-gray-400 hover:text-gray-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === "vault" && (
          <>
            <VaultStats />
            {isConnected ? (
              <>
                <UserPosition />
                <div className="grid gap-6 md:grid-cols-2">
                  <DepositForm />
                  <RedeemForm />
                </div>
                <OwnerPanel />
              </>
            ) : (
              <div className="rounded-xl border border-gray-800 bg-gray-900 p-8 text-center">
                <p className="text-gray-400">
                  Connect your wallet to deposit and redeem.
                </p>
              </div>
            )}
          </>
        )}

        {activeTab === "bonding" && <BondingCurvePanel />}

        {activeTab === "logs" && <BotActivity />}
      </main>
    </Layout>
  );
}
