import { ConnectButton } from "@rainbow-me/rainbowkit";
import logo from "../logo.jpg";

export function Header() {
  return (
    <header className="border-b border-gray-800 bg-gray-900/50 backdrop-blur-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
        <div className="flex items-center">
          <img src={logo} alt="easyL" className="h-36 w-auto" />
        </div>
        <ConnectButton showBalance={false} />
      </div>
    </header>
  );
}
