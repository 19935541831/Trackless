// app/routes/register.tsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useWallet } from '../context/WalletContext';
import { getTracklessContract, getTrackTokenContract } from '../contracts/tracklessContract';
import NetworkBackground from '../components/NetworkBackground';
import { ethers } from 'ethers';
import { useTrackerStorage } from '../hooks/useTrackerStorage';

export default function RegisterPage() {
  const [eid, setEid] = useState('');
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [step, setStep] = useState<'input' | 'approve' | 'register'>('input');
  const { account, isConnected } = useWallet();  
  const navigate = useNavigate();
  const { addTracker } = useTrackerStorage(account); 

  // 验证 EID 格式
  const isValidEid = (id: string): boolean => {
    return /^[0-9a-fA-F]{64}$/.test(id);
  };

  // ✅ 检查 EID 是否已注册
  const checkIfRegistered = async (inputEid: string): Promise<boolean> => {
    if (!isConnected || !isValidEid(inputEid)) return false;
    
    setChecking(true);
    try {
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const contract = getTracklessContract(await provider.getSigner());
      
      // ✅ 统一格式：0x + 64 hex chars
      const eidBytes32 = '0x' + inputEid.toLowerCase();
      const owner = await contract.trackerToOwner(eidBytes32);
      
      if (owner !== ethers.ZeroAddress) {
        alert('This EID is already registered. Redirecting to Lost Mode...');
        navigate(`/lost/${inputEid.toLowerCase()}`);
        return true;
      }
      return false;
    } catch (err) {
      console.warn('Check registration failed:', err);
      return false;
    } finally {
      setChecking(false);
    }
  };

  // ✅ 检查 allowance
  const checkAllowance = async (): Promise<boolean> => {
    try {
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const signer = await provider.getSigner();
      const tracklessContract = getTracklessContract(signer);
      const trackTokenContract = getTrackTokenContract(signer);
      
      const STAKE_AMOUNT = ethers.parseEther('10');
      const requiredAllowance = STAKE_AMOUNT;
      
      const currentAllowance = await trackTokenContract.allowance(
        account, 
        await tracklessContract.getAddress()
      );
      
      return currentAllowance >= requiredAllowance;
    } catch (err) {
      console.error('Check allowance failed:', err);
      return false;
    }
  };

  // ✅ 执行 approve
  const executeApprove = async (): Promise<boolean> => {
    setLoading(true);
    setStep('approve');
    
    try {
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const signer = await provider.getSigner();
      const tracklessContract = getTracklessContract(signer);
      const trackTokenContract = getTrackTokenContract(signer);
      
      const STAKE_AMOUNT = ethers.parseEther('10');
      
      const approveTx = await trackTokenContract.approve(
        await tracklessContract.getAddress(),
        STAKE_AMOUNT
      );
      
      await approveTx.wait();
      return true;
    } catch (err: any) {
      console.error('Approve failed:', err);
      alert('Approval failed: ' + (err.reason || err.message || 'Unknown error'));
      return false;
    } finally {
      setLoading(false);
    }
  };

  // ✅ 执行注册
  const executeRegister = async (): Promise<boolean> => {
    setLoading(true);
    setStep('register');
    
    try {
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const signer = await provider.getSigner();
      const tracklessContract = getTracklessContract(signer);
      
      // ✅ 统一格式：0x + 64 hex chars
      const eidBytes32 = '0x' + eid.toLowerCase();
      
      const tx = await tracklessContract.registerTracker(eidBytes32);
      await tx.wait();
      
      addTracker(eid.toLowerCase());
      return true;
    } catch (err: any) {
      console.error('Registration failed:', err);
      
      if (err.message?.includes('user aborted')) {
        alert('You canceled the transaction.');
      } else if (err.message?.includes('Stake failed')) {
        alert('Insufficient $TRACK balance.');
      } else if (err.message?.includes('Already registered')) {
        alert('This EID is already registered.');
        navigate(`/lost/${eid.toLowerCase()}`);
      } else {
        alert('Registration failed: ' + (err.reason || err.message || 'Unknown error'));
      }
      return false;
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isConnected) {
      alert('Please connect your wallet first.');
      return;
    }
    
    if (!isValidEid(eid)) {
      alert('EID must be 64 hexadecimal characters (0-9, a-f, A-F).');
      return;
    }

    // 检查是否已注册
    const isRegistered = await checkIfRegistered(eid);
    if (isRegistered) return;

    // 检查是否需要 approve
    const hasAllowance = await checkAllowance();
    
    if (!hasAllowance) {
      // 需要先 approve
      const approved = await executeApprove();
      if (!approved) return;
    }
    
    // 执行注册
    const registered = await executeRegister();
    if (registered) {
      alert('Tracker registered successfully!');
      navigate(`/lost/${eid.toLowerCase()}`);
    }
  };

  // 处理输入变化
  const handleInputChange = (value: string) => {
    // 只允许十六进制字符，自动转小写
    const cleanValue = value.toLowerCase().replace(/[^0-9a-f]/g, '');
    setEid(cleanValue);
  };

  // 渲染步骤指示器
  const renderStepIndicator = () => (
    <div className="flex items-center justify-center mb-6">
      <div className="flex items-center">
        <div className={`flex items-center justify-center w-8 h-8 rounded-full ${step === 'input' ? 'bg-indigo-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-500'}`}>
          1
        </div>
        <div className={`h-1 w-12 ${step === 'input' ? 'bg-gray-300' : 'bg-indigo-600'}`}></div>
        
        <div className={`flex items-center justify-center w-8 h-8 rounded-full ${step === 'approve' ? 'bg-indigo-600 text-white' : step === 'register' ? 'bg-indigo-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-500'}`}>
          2
        </div>
        <div className={`h-1 w-12 ${step === 'input' ? 'bg-gray-300' : 'bg-indigo-600'}`}></div>
        
        <div className={`flex items-center justify-center w-8 h-8 rounded-full ${step === 'register' ? 'bg-indigo-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-500'}`}>
          3
        </div>
      </div>
    </div>
  );

  // 渲染步骤文本
  const renderStepText = () => {
    switch (step) {
      case 'input':
        return 'Enter EID';
      case 'approve':
        return 'Approving $TRACK';
      case 'register':
        return 'Registering Tracker';
      default:
        return '';
    }
  };

  return (
    <>
      <NetworkBackground />
      <div className="min-h-screen bg-transparent flex flex-col">
        <header className="container mx-auto px-4 py-6">
          <a href="/" className="text-indigo-500 hover:underline text-sm font-medium">
            ← Back to Home
          </a>
        </header>

        <main className="container mx-auto px-4 py-12 flex-grow">
          <div className="max-w-2xl mx-auto">
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
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
              </div>
              <h1 className="text-4xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600">
                Register or Access Tracker
              </h1>
              <p className="mt-3 text-gray-600 dark:text-gray-300">
                Enter your EID to register a new tracker or access an existing one.
              </p>
            </div>

            {renderStepIndicator()}

            <form
              onSubmit={handleSubmit}
              className="bg-white/80 dark:bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-200/60 dark:border-gray-700/50 shadow-sm"
            >
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Ephemeral ID (EID)
                </label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
                    0x
                  </div>
                  <input
                    type="text"
                    value={eid}
                    onChange={(e) => handleInputChange(e.target.value)}
                    placeholder="a1b2c3..."
                    maxLength={64}
                    className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700/50 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-mono"
                    required
                    disabled={loading || checking}
                  />
                </div>
                <div className="mt-2 flex justify-between">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Format: 64 hex characters (32 bytes)
                  </p>
                  <p className="text-xs font-mono">
                    {eid.length}/64
                  </p>
                </div>
                {eid.length > 0 && !isValidEid(eid) && (
                  <p className="text-xs text-red-500 mt-1 flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Must be 64 hex characters (0-9, a-f)
                  </p>
                )}
              </div>

              <div className="mb-6 p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg border border-indigo-200 dark:border-indigo-800">
                <div className="flex items-start">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5 text-indigo-600 dark:text-indigo-400 mt-0.5 mr-2 flex-shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <div>
                    <p className="text-sm font-medium text-indigo-700 dark:text-indigo-300 mb-1">
                      Registration Requirements
                    </p>
                    <ul className="text-xs text-indigo-600 dark:text-indigo-400 space-y-1">
                      <li>• Stake: <strong>10 $TRACK</strong> (locked until unstaked)</li>
                      <li>• EID must be unique and not previously registered</li>
                      <li>• Requires one-time contract approval for $TRACK</li>
                      <li>• After registration, you can activate Lost Mode</li>
                    </ul>
                  </div>
                </div>
              </div>

              {loading && (
                <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mr-3"></div>
                    <span className="text-sm text-blue-700 dark:text-blue-300">
                      {renderStepText()}... Please confirm in your wallet
                    </span>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || checking || !isValidEid(eid) || !isConnected}
                className={`w-full py-3 px-4 font-medium rounded-lg shadow-md transition-all duration-300 flex items-center justify-center ${
                  !isConnected || !isValidEid(eid) || loading || checking
                    ? 'bg-gray-400 dark:bg-gray-600 cursor-not-allowed'
                    : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white hover:shadow-lg'
                }`}
              >
                {checking ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Checking EID...
                  </>
                ) : loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Processing...
                  </>
                ) : !isConnected ? (
                  'Connect Wallet'
                ) : (
                  'Continue to Registration'
                )}
              </button>

              <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                  Already registered? Enter your EID above to access Lost Mode
                </p>
              </div>
            </form>

            {/* EID 格式说明 */}
            <div className="mt-8 bg-white/50 dark:bg-gray-800/30 backdrop-blur-sm rounded-xl p-5 border border-gray-200/50 dark:border-gray-700/50">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                EID Format & Examples
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="text-xs">
                  <p className="font-medium text-gray-600 dark:text-gray-400 mb-1">Valid Examples:</p>
                  <div className="font-mono bg-gray-100 dark:bg-gray-900 p-2 rounded text-gray-800 dark:text-gray-300 break-all">
                    0x6b175474e89094c44da98b954eedeac495271d0f...
                  </div>
                  <div className="font-mono bg-gray-100 dark:bg-gray-900 p-2 rounded text-gray-800 dark:text-gray-300 break-all mt-1">
                    0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef
                  </div>
                </div>
                <div className="text-xs">
                  <p className="font-medium text-gray-600 dark:text-gray-400 mb-1">Where to find:</p>
                  <ul className="space-y-1 text-gray-600 dark:text-gray-400">
                    <li>• Physical tracker device label</li>
                    <li>• Mobile app device settings</li>
                    <li>• Original packaging QR code</li>
                    <li>• Purchase receipt/confirmation</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}