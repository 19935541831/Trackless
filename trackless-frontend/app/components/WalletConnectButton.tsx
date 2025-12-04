// app/components/WalletConnectButton.tsx
import { useWallet } from '../context/WalletContext';

export default function WalletConnectButton() {
  const { account, connect, disconnect } = useWallet();

  if (account) {
    return (
      <div className="flex items-center space-x-3">
        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
        <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
          {account.slice(0, 6)}...{account.slice(-4)}
        </span>
        <button
          onClick={disconnect}
          className="text-xs px-2 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 rounded transition-colors"
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={connect}
      className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white text-sm font-medium rounded-lg shadow-md transition-all duration-300"
    >
      Connect Wallet
    </button>
  );
}