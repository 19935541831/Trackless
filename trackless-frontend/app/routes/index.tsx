// app/routes/index.tsx
import WalletConnectButton from '../components/WalletConnectButton';
import NetworkBackground from '../components/NetworkBackground';
import { useWallet } from '../context/WalletContext';

export default function Index() {
  const {account, isConnected} = useWallet();
  return (
    <>
      <NetworkBackground />
      <div className="min-h-screen bg-transparent flex flex-col">
        {/* Top Status Bar */}
        <header className="container mx-auto px-4 py-4 flex justify-end">
          <WalletConnectButton />
        </header>

        {/* Hero Section */}
        <main className="container mx-auto px-4 py-12 text-center">
          <div className="max-w-3xl mx-auto">
            {/* Brand Mark (Text-based) */}
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-500/10 dark:bg-indigo-500/20 mb-6">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>

            <h1 className="text-5xl md:text-6xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 via-purple-600 to-fuchsia-600">
              Trackless
            </h1>
            <p className="mt-6 text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto leading-relaxed">
              An open, privacy-first tracking network powered by global smartphone cooperation.
            </p>

            {/* Dual CTA */}
            <div className="mt-16 grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
              {/* Owner */}
              <a
                href="/register"
                className="group block p-6 bg-white dark:bg-gray-800/50 backdrop-blur-sm rounded-2xl border border-gray-200/60 dark:border-gray-700/50 hover:border-indigo-300 dark:hover:border-indigo-500/50 transition-all duration-300 hover:shadow-lg"
              >
                <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center mb-4 mx-auto group-hover:bg-green-500/20 transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h2 className="text-xl font-semibold mb-2">I Lost Something</h2>
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  Register your tracker, activate lost mode, and let the world help you find it—privately.
                </p>
              </a>

              {/* Scanner */}
              <a
                href="/scan"
                className="group block p-6 bg-white dark:bg-gray-800/50 backdrop-blur-sm rounded-2xl border border-gray-200/60 dark:border-gray-700/50 hover:border-purple-300 dark:hover:border-purple-500/50 transition-all duration-300 hover:shadow-lg"
              >
                <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center mb-4 mx-auto group-hover:bg-purple-500/20 transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <h2 className="text-xl font-semibold mb-2">I Want to Help</h2>
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  Your phone can anonymously detect lost items and earn rewards—no extra effort.
                </p>
              </a>
            </div>
          </div>
        </main>
        {isConnected && (
        <div className="mt-8 text-center">
            <a
            href="/my-trackers"
            className="inline-flex items-center text-indigo-600 dark:text-indigo-400 hover:underline text-sm"
            >
            → Manage all your trackers
            </a>
        </div>
        )}
        {/* Footer */}
        <footer className="py-8 text-center text-sm text-gray-500 dark:text-gray-400 border-t border-gray-200/30 dark:border-gray-800">
          <p>Trackless — Open • Private • Decentralized</p>
          <p className="mt-1">Powered by Bluetooth, NFC, and global cooperation.</p>
        </footer>
      </div>
    </>
  );
}