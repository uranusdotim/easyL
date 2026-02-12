import { BASESCAN_URL } from "../constants";

interface TransactionStatusProps {
  isPending: boolean;
  isConfirming: boolean;
  isConfirmed: boolean;
  txHash?: `0x${string}`;
  error: Error | null;
  onReset?: () => void;
}

export function TransactionStatus({
  isPending,
  isConfirming,
  isConfirmed,
  txHash,
  error,
  onReset,
}: TransactionStatusProps) {
  if (error) {
    const message =
      error.message.length > 100
        ? error.message.slice(0, 100) + "..."
        : error.message;
    return (
      <div className="mt-3 rounded-lg border border-red-900 bg-red-950/50 p-3">
        <p className="text-sm text-red-400">{message}</p>
        {onReset && (
          <button
            onClick={onReset}
            className="mt-2 text-xs text-red-500 underline"
          >
            Dismiss
          </button>
        )}
      </div>
    );
  }

  if (isPending) {
    return (
      <div className="mt-3 flex items-center gap-2 text-sm text-yellow-400">
        <Spinner />
        Confirm in wallet...
      </div>
    );
  }

  if (isConfirming) {
    return (
      <div className="mt-3 flex items-center gap-2 text-sm text-yellow-400">
        <Spinner />
        Waiting for confirmation...
      </div>
    );
  }

  if (isConfirmed && txHash) {
    return (
      <div className="mt-3 rounded-lg border border-green-900 bg-green-950/50 p-3">
        <p className="text-sm text-green-400">Transaction confirmed!</p>
        <a
          href={`${BASESCAN_URL}/tx/${txHash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-brand-400 underline"
        >
          View on BaseScan
        </a>
      </div>
    );
  }

  return null;
}

function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}
