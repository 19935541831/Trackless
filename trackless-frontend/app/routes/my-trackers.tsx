// app/routes/my-trackers.tsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useWallet } from '../context/WalletContext';
import { getTracklessContract } from '../contracts/tracklessContract';
import { ethers } from 'ethers';
import NetworkBackground from '../components/NetworkBackground';

export default function MyTrackersPage() {
  const { account, isConnected } = useWallet();
  const navigate = useNavigate();
  const [trackers, setTrackers] = useState<{ eid: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [trackerStates, setTrackerStates] = useState<Record<string, { isLost: boolean; reportCount: number }>>({});

  // 1. 从链上获取当前账户拥有的所有 tracker EIDs
  useEffect(() => {
    const fetchTrackers = async () => {
      if (!isConnected || !account) {
        setTrackers([]);
        setLoading(false);
        return;
      }

      try {
        const provider = new ethers.BrowserProvider((window as any).ethereum);
        // 使用只读 provider（无需 signer）即可调用 view 函数
        const contract = getTracklessContract(provider); 
        const eids: string[] = await contract.getTrackersByOwner(account);

        // 转换 bytes32（带 0x 前缀）为 64 字符 hex 字符串（无 0x）
        const normalizedTrackers = eids.map((eidWithPrefix) => ({
          eid: eidWithPrefix.startsWith('0x') ? eidWithPrefix.slice(2) : eidWithPrefix,
        }));

        setTrackers(normalizedTrackers);
      } catch (err) {
        console.error('Failed to fetch trackers from contract:', err);
        setTrackers([]);
      } finally {
        setLoading(false);
      }
    };

    fetchTrackers();
  }, [isConnected, account]);

  // 2. 查询每个 tracker 的状态（isLost + 报告数）
  useEffect(() => {
    if (!isConnected || !account || trackers.length === 0) {
      setTrackerStates({});
      return;
    }

    const fetchStates = async () => {
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const contract = getTracklessContract(provider); // read-only is enough

      const states: Record<string, { isLost: boolean; reportCount: number }> = {};

      for (const { eid } of trackers) {
        try {
          // 注意：合约接受 bytes32，所以传入 '0x' + eid
          const isLost = await contract.isLost(ethers.getBytes('0x' + eid));

          // 模拟：从后端获取报告数量
          const res = await fetch(`http://localhost:8000/api/reports/${eid}`);
          const reports = res.ok ? await res.json() : [];
          states[eid] = { isLost, reportCount: reports.length };
        } catch (err) {
          console.error(`Failed to fetch state for ${eid}:`, err);
          states[eid] = { isLost: false, reportCount: 0 };
        }
      }
      setTrackerStates(states);
    };

    fetchStates();
  }, [isConnected, account, trackers]);

  return (
    <>
      <NetworkBackground />
      <div className="min-h-screen bg-transparent flex flex-col">
        <header className="container mx-auto px-4 py-6">
          <a href="/" className="text-indigo-500 hover:underline">← Back to Home</a>
        </header>

        <main className="container mx-auto px-4 py-12 flex-grow">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-10">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-500/10 dark:bg-indigo-500/20 mb-6">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-8 w-8 text-indigo-600 dark:text-indigo-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <h1 className="text-4xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600">
                My Trackers
              </h1>
              <p className="mt-3 text-gray-600 dark:text-gray-300">
                Manage all your registered Trackless devices.
              </p>
            </div>

            {loading ? (
              <div className="text-center py-12">
                <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent"></div>
                <p className="mt-4 text-gray-600 dark:text-gray-400">Loading your trackers...</p>
              </div>
            ) : trackers.length === 0 ? (
              <div className="text-center py-12">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-16 w-16 mx-auto text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                  />
                </svg>
                <p className="mt-4 text-gray-600 dark:text-gray-400">
                  You haven't registered any trackers yet.
                </p>
                <button
                  onClick={() => navigate('/register')}
                  className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                >
                  Register a Tracker
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {trackers.map((tracker) => (
                  <div
                    key={tracker.eid}
                    className="bg-white/80 dark:bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-200/60 dark:border-gray-700/50"
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between">
                      <div>
                        <div className="font-mono text-lg break-all">{tracker.eid}</div>
                        <div className="mt-2 flex items-center space-x-4">
                          {trackerStates[tracker.eid]?.isLost ? (
                            <span className="inline-flex items-center text-green-600 dark:text-green-400">
                              <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                              Lost Mode Active
                            </span>
                          ) : (
                            <span className="text-gray-500 dark:text-gray-400">Lost Mode Inactive</span>
                          )}
                          {trackerStates[tracker.eid]?.reportCount > 0 && (
                            <span className="text-indigo-600 dark:text-indigo-400">
                              {trackerStates[tracker.eid]?.reportCount} report(s)
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="mt-4 md:mt-0 flex space-x-3">
                        <button
                          onClick={() => navigate(`/lost/${tracker.eid}`)}
                          className="px-4 py-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-lg hover:bg-indigo-200 dark:hover:bg-indigo-800"
                        >
                          Manage Lost Mode
                        </button>
                        {trackerStates[tracker.eid]?.isLost && (
                          <button
                            onClick={() => navigate(`/find/${tracker.eid}?account=${account}`)}
                            className="px-4 py-2 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-lg hover:bg-purple-200 dark:hover:bg-purple-800"
                          >
                            View Reports
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
    </>
  );
}