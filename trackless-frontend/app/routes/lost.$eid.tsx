// app/routes/lost.$eid.tsx
import { useState, useEffect } from 'react';
import { useLoaderData } from 'react-router';
import { useWallet } from '../context/WalletContext';
import { getTracklessContract, getTrackTokenContract } from '../contracts/tracklessContract'; // ✅ 新增 $TRACK 合约
import { ethers } from 'ethers';
import NetworkBackground from '../components/NetworkBackground';

// ✅ 费用配置（与合约一致）
const BASE_QUERY_FEE = ethers.parseEther('0.5');    // 0.5 $TRACK
const PRIORITY_FEE = ethers.parseEther('2.0');     // 2.0 $TRACK

export async function loader({ params }: { params: { eid: string } }) {
  return { eid: params.eid };
}

export default function LostModePage() {
  const { eid } = useLoaderData<typeof loader>();
  const { account, isConnected } = useWallet();
  const [isLost, setIsLost] = useState<boolean | null>(null);
  const [isOwner, setIsOwner] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);

  const eidToBytes32 = (hexStr: string): Uint8Array => {
    const clean = hexStr.startsWith('0x') ? hexStr.slice(2) : hexStr;
    if (clean.length !== 64) {
      throw new Error('EID must be 64 hex characters (32 bytes)');
    }
    return ethers.getBytes('0x' + clean);
  };

  useEffect(() => {
    const checkOwnershipAndStatus = async () => {
      if (!isConnected || !eid || !account) {
        setIsOwner(false);
        setIsLost(false);
        return;
      }

      try {
        const provider = new ethers.BrowserProvider((window as any).ethereum);
        const signer = await provider.getSigner();
        const contract = getTracklessContract(signer);

        const owner = await contract.trackerToOwner(eidToBytes32(eid));
        const _isOwner = owner.toLowerCase() === account.toLowerCase();
        setIsOwner(_isOwner);

        if (_isOwner) {
          const status = await contract.isLost(eidToBytes32(eid));
          setIsLost(status);
        } else {
          setIsLost(false);
        }
      } catch (err) {
        console.error('Failed to check ownership or status:', err);
        setIsOwner(false);
        setIsLost(false);
      }
    };

    checkOwnershipAndStatus();
  }, [isConnected, eid, account]);

  // ✅ 通用激活函数（支持基础/紧急模式）
  const activateLostMode = async (feeAmount: bigint) => {
    if (!isConnected || !eid || !isOwner) return;
    setLoading(true);
    try {
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const signer = await provider.getSigner();
      const tracklessContract = getTracklessContract(signer);
      const trackTokenContract = getTrackTokenContract(signer);

      const contractAddr = await tracklessContract.getAddress();
      
      // 1. 检查并授权
      const allowance = await trackTokenContract.allowance(account, contractAddr);
      if (allowance < feeAmount) {
        const approveTx = await trackTokenContract.approve(contractAddr, feeAmount);
        await approveTx.wait();
      }

      const eidBytes = eidToBytes32(eid);
      
      // 2. 调用对应函数
      let tx;
      if (feeAmount === BASE_QUERY_FEE) {
        tx = await tracklessContract.activateLostMode(eidBytes);
      } else {
        tx = await tracklessContract.activateEmergencyMode(eidBytes, feeAmount);
      }
      await tx.wait();
      
      setIsLost(true);
      alert(feeAmount === BASE_QUERY_FEE 
        ? 'Lost Mode activated!' 
        : 'Emergency Mode activated! High-priority scanning enabled.');
    } catch (err: any) {
      console.error(err);
      if (err.message?.includes('user aborted')) {
        alert('Transaction canceled.');
      } else if (err.message?.includes('Query fee failed')) {
        alert('Insufficient $TRACK balance or approval failed.');
      } else {
        alert('Activation failed: ' + (err.reason || err.message || 'Unknown error'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleActivate = () => activateLostMode(BASE_QUERY_FEE);
  const handleActivateEmergency = () => activateLostMode(PRIORITY_FEE);

  const handleDeactivate = async () => {
    if (!isConnected || !eid || !isOwner) return;
    setLoading(true);
    try {
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const signer = await provider.getSigner();
      const contract = getTracklessContract(signer);
      const tx = await contract.deactivateLostMode(eidToBytes32(eid));
      await tx.wait();
      setIsLost(false);
    } catch (err: any) {
      alert('Deactivation failed: ' + (err.reason || err.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <NetworkBackground />
      <div className="min-h-screen bg-transparent flex flex-col">
        <header className="container mx-auto px-4 py-6">
          <a href="/" className="text-indigo-500 hover:underline">← Back to Home</a>
        </header>

        <main className="container mx-auto px-4 py-12 flex-grow">
          <div className="max-w-2xl mx-auto text-center">
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
              Lost Mode
            </h1>
            <p className="mt-3 text-gray-600 dark:text-gray-300 max-w-lg mx-auto">
              Activate global scanning for your tracker. Pay in $TRACK to enable network-wide discovery.
            </p>

            <div className="mt-6 p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg border border-indigo-200 dark:border-indigo-800">
              <div className="text-sm text-indigo-700 dark:text-indigo-300">
                <p>• <strong>Base Fee:</strong> 0.5 $TRACK for standard scanning</p>
                <p>• <strong>Emergency Fee:</strong> 2.0 $TRACK for high-priority alerts (e.g., pets, safety)</p>
              </div>
            </div>

            <div className="mt-6 p-6 bg-white/80 dark:bg-gray-800/50 backdrop-blur-sm rounded-2xl border border-gray-200/60 dark:border-gray-700/50">
              <div className="mb-4">
                <span className="text-sm font-medium text-gray-500 dark:text-gray-400">EID</span>
                <div className="mt-1 p-3 bg-gray-100 dark:bg-gray-700/50 rounded-lg font-mono text-sm break-all">
                  {eid}
                </div>
              </div>

              <div className="mt-6">
                {!isConnected ? (
                  <p className="text-gray-500">Please connect your wallet to continue.</p>
                ) : isOwner === null ? (
                  <p className="text-gray-500">Verifying ownership...</p>
                ) : !isOwner ? (
                  <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                    <p className="text-red-600 dark:text-red-400 font-medium">
                      ❌ Access Denied
                    </p>
                    <p className="text-sm mt-1">
                      You are not the registered owner of this tracker.
                    </p>
                  </div>
                ) : isLost === null ? (
                  <p className="text-gray-500">Checking Lost Mode status...</p>
                ) : isLost ? (
                  <div className="space-y-4">
                    <div className="flex flex-col items-center">
                      <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse mb-2"></div>
                      <p className="text-green-600 dark:text-green-400 font-medium">
                        ✅ Active — Your item is being tracked globally
                      </p>
                    </div>
                    <button
                      onClick={handleDeactivate}
                      disabled={loading}
                      className="py-3 px-6 w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-medium rounded-lg shadow-md transition-all duration-300 disabled:opacity-50"
                    >
                      {loading ? 'Deactivating...' : 'Deactivate Lost Mode'}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <button
                      onClick={handleActivate}
                      disabled={loading}
                      className="py-3 px-6 w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-medium rounded-lg shadow-md transition-all duration-300 disabled:opacity-50"
                    >
                      {loading ? 'Activating...' : 'Activate Standard Mode (0.5 $TRACK)'}
                    </button>
                    <button
                      onClick={handleActivateEmergency}
                      disabled={loading}
                      className="py-3 px-6 w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-medium rounded-lg shadow-md transition-all duration-300 disabled:opacity-50"
                    >
                      {loading ? 'Activating...' : 'Activate Emergency Mode (2.0 $TRACK)'}
                    </button>
                  </div>
                )}
              </div>
            </div>

            {isOwner && isLost && (
              <div className="mt-8">
                <a
                  href={`/find/${eid}?account=${account}`}
                  className="inline-flex items-center text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  View location reports →
                </a>
              </div>
            )}
          </div>
        </main>
      </div>
    </>
  );
}