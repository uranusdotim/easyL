import { useUserPosition } from "../hooks/useUserPosition";

export function UserPosition() {
  const {
    easylFormatted,
    usdcFormatted,
    positionValueFormatted,
    isLoading,
  } = useUserPosition();

  if (isLoading) {
    return (
      <div className="h-24 animate-pulse rounded-xl border border-gray-800 bg-gray-900" />
    );
  }

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
      <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-gray-500">
        Your Position
      </h2>
      <div className="grid grid-cols-3 gap-4">
        <div>
          <p className="text-xs text-gray-500">EASYL Balance</p>
          <p className="text-base font-semibold">{easylFormatted}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Position Value</p>
          <p className="text-base font-semibold">${positionValueFormatted}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">USDC Balance</p>
          <p className="text-base font-semibold">{usdcFormatted}</p>
        </div>
      </div>
    </div>
  );
}
