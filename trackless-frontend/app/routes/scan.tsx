// app/routes/scan.tsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import NetworkBackground from '../components/NetworkBackground';
import { ethers } from 'ethers';
import { Buffer } from 'buffer';

// // ✅ 从 sessionStorage 获取或创建临时钱包
// const getOrCreateTempWallet = () => {
//   const existing = sessionStorage.getItem('trackless_temp_wallet');
//   if (existing) {
//     const { privateKey } = JSON.parse(existing);
//     return new ethers.Wallet(privateKey);
//   }
//   const wallet = ethers.Wallet.createRandom();
//   sessionStorage.setItem('trackless_temp_wallet', JSON.stringify({
//     address: wallet.address,
//     privateKey: wallet.privateKey
//   }));
//   return wallet;
// };

// ✅ 端到端加密模拟（使用 EID 作为密钥）
const encryptLocation = async (eid: string, location: { lat: number; lng: number }) => {
  const encoder = new TextEncoder();
  const data = JSON.stringify(location);
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(eid.slice(0, 32)),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );
  const aesKey = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: new Uint8Array(16), iterations: 1000, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"]
  );
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    aesKey,
    encoder.encode(data)
  );
  return { 
    encrypted: Buffer.from(encrypted).toString('base64'),
    iv: Buffer.from(iv).toString('base64')
  };
};

export default function ScanPage() {
  const [eid, setEid] = useState('');
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'scanning' | 'success' | 'error'>('idle');
  const [detectedEids, setDetectedEids] = useState<string[]>([]);
  const [scanning, setScanning] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  // const [tempWallet, setTempWallet] = useState<ethers.Wallet | null>(null);
  const navigate = useNavigate();

  // 初始化临时钱包
  const tempWallet = ethers.Wallet.createRandom();
  const sampleEids = [
    'a1b2c3d4e5f67890123456789012345678901234567890123456789012345678',
    'e1d2c3b4a5678901234567890123456789012345678901234567890123456789',
    '9a8b7c6d5e4f3210987654321098765432109876543210987654321098765432',
    '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    'fedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321'
  ];

  const startScanning = () => {
    setScanning(true);
    setDetectedEids([]);
    let currentIndex = 0;
    const scanInterval = setInterval(() => {
      if (currentIndex < sampleEids.length) {
        setDetectedEids(prev => [...prev, sampleEids[currentIndex]]);
        currentIndex++;
      } else {
        clearInterval(scanInterval);
        setScanning(false);
      }
    }, 1500);
  };

  useEffect(() => {
    startScanning();
  }, []);

  const handleEidClick = (clickedEid: string) => {
    setEid(clickedEid);
    document.getElementById('eid-input')?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleRescan = () => startScanning();

  const getCurrentLocation = () => {
    setLocationLoading(true);
    setLocationError(null);
    if (!navigator.geolocation) {
      const errorMsg = 'Geolocation is not supported by your browser.';
      setLocationError(errorMsg);
      setLocationLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const newLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        setLocation(newLocation);
        setLocationLoading(false);
      },
      (error) => {
        setLocationError('Unable to get location. Please try again.');
        setLocationLoading(false);
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tempWallet) {
      alert('Temporary wallet not ready. Please refresh.');
      return;
    }
    if (eid.length !== 64 || !/^[a-f0-9]+$/.test(eid)) {
      alert('EID must be 64 lowercase hex characters.');
      return;
    }
    if (!location) {
      alert('Please allow location access.');
      return;
    }

    setLoading(true);
    setStatus('scanning');

    try {
      // ✅ 步骤 1: 端到端加密
      const encryptedData = await encryptLocation(eid, location);
      const encryptedPayload = JSON.stringify(encryptedData);

      // ✅ 步骤 2: 上传 IPFS
      const ipfsRes = await fetch('http://localhost:8000/api/ipfs/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payload: encryptedPayload }),
      });
      const { cid } = await ipfsRes.json();

      // ✅ 步骤 3: 提交报告（使用临时地址）
      const scanRes = await fetch('http://localhost:8000/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eid,
          ipfs_cid: cid,
          scanner_addr: tempWallet.address, // ✅ 临时地址（将接收 $TRACK）
          timestamp: Math.floor(Date.now() / 1000),
        }),
      });

      if (!scanRes.ok) throw new Error('Scan submission failed');
      setStatus('success');
    } catch (err: any) {
      console.error(err);
      setStatus('error');
      alert('Scan failed: ' + (err.message || 'Unknown error'));
    } finally {
      setLoading(false);
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
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-10">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-500/10 dark:bg-indigo-500/20 mb-6">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <h1 className="text-4xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600">
                Help Find Lost Items
              </h1>
              <p className="mt-3 text-gray-600 dark:text-gray-300">
                Your phone anonymously detects lost trackers and earns <strong>$TRACK rewards</strong>.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* 左侧：检测到的 EID 列表（保持不变） */}
              <div className="bg-white/80 dark:bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-200/60 dark:border-gray-700/50">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-lg font-semibold text-gray-800 dark:text-white">
                    Nearby Detected EIDs
                  </h2>
                  <button
                    onClick={handleRescan}
                    disabled={scanning}
                    className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline disabled:opacity-50 flex items-center"
                  >
                    {scanning ? (
                      <>
                        <svg className="animate-spin mr-1 h-3 w-3 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Scanning...
                      </>
                    ) : (
                      <>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Rescan
                      </>
                    )}
                  </button>
                </div>

                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {detectedEids.length === 0 ? (
                    <div className="text-center py-8">
                      <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-700 mb-3">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <p className="text-gray-500 dark:text-gray-400 text-sm">
                        {scanning ? 'Scanning for nearby devices...' : 'No devices detected nearby'}
                      </p>
                    </div>
                  ) : (
                    detectedEids.map((detectedEid, index) => (
                      <div
                        key={index}
                        onClick={() => handleEidClick(detectedEid)}
                        className={`p-3 rounded-lg border cursor-pointer transition-all duration-200 ${
                          eid === detectedEid
                            ? 'border-indigo-300 bg-indigo-50 dark:border-indigo-600 dark:bg-indigo-900/20'
                            : 'border-gray-200 dark:border-gray-600 hover:border-indigo-200 dark:hover:border-indigo-500 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                        }`}
                      >
                        <div className="flex items-start space-x-2">
                          <div className={`flex-shrink-0 w-2 h-2 mt-2 rounded-full ${
                            scanning && index === detectedEids.length - 1
                              ? 'bg-green-500 animate-pulse'
                              : 'bg-green-500'
                          }`} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                                Device #{index + 1}
                              </span>
                              {eid === detectedEid && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200">
                                  Selected
                                </span>
                              )}
                            </div>
                            <p className="font-mono text-xs text-gray-800 dark:text-gray-200 break-all">
                              {detectedEid}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                              Click to select for reporting
                            </p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <div className="flex items-start">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-xs text-blue-700 dark:text-blue-300">
                      This list shows nearby trackers detected by your device. Click any EID to automatically fill the report form.
                    </p>
                  </div>
                </div>
              </div>

              {/* 右侧：报告表单 */}
              <div className="bg-white/80 dark:bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-200/60 dark:border-gray-700/50">
                {status === 'success' ? (
                  <div className="text-center">
                    <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <h2 className="text-xl font-semibold text-green-700 dark:text-green-300">Report Submitted!</h2>
                    <p className="mt-2 text-gray-600 dark:text-gray-400">
                      $TRACK rewards will be sent to your anonymous address:
                    </p>
                    <div className="mt-3 p-3 bg-gray-100 dark:bg-gray-700/50 rounded-lg font-mono text-sm break-all">
                      {tempWallet?.address}
                    </div>
                    <div className="mt-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                      <p className="text-xs text-yellow-700 dark:text-yellow-300">
                        💡 Save your private key to claim rewards later:<br />
                        <span className="font-mono">{tempWallet?.privateKey}</span>
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setStatus('idle');
                        setEid('');
                        setLocation(null);
                      }}
                      className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                    >
                      Scan Another
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit}>
                    <div className="mb-6">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Detected EID (64 hex chars)
                      </label>
                      <input
                        id="eid-input"
                        type="text"
                        value={eid}
                        onChange={(e) => setEid(e.target.value.toLowerCase().replace(/[^a-f0-9]/g, ''))}
                        placeholder="a1b2c3d4... (from nearby tracker)"
                        maxLength={64}
                        className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700/50 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                        required
                      />
                      {eid && eid.length !== 64 && (
                        <p className="mt-1 text-xs text-red-500">{eid.length}/64 characters</p>
                      )}
                    </div>

                    <div className="mb-6">
                      <div className="flex justify-between items-center mb-2">
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          Your Location (Automatically Detected)
                        </label>
                        <button
                          type="button"
                          onClick={getCurrentLocation}
                          disabled={locationLoading || loading}
                          className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline disabled:opacity-50"
                        >
                          {locationLoading ? 'Getting Location...' : 'Refresh Location'}
                        </button>
                      </div>
                      {locationError && (
                        <div className="mb-3 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                          <p className="text-xs text-red-700 dark:text-red-300">{locationError}</p>
                        </div>
                      )}
                      {location && (
                        <div className="p-3 bg-gray-100 dark:bg-gray-700/50 rounded-lg">
                          <p className="text-xs text-gray-600 dark:text-gray-300">
                            Detected: {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="mb-6 p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg border border-indigo-200 dark:border-indigo-800">
                      <div className="flex items-start">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-indigo-600 dark:text-indigo-400 mt-0.5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                        </svg>
                        <p className="text-xs text-indigo-700 dark:text-indigo-300">
                          Your location is <strong>end-to-end encrypted</strong>. Only the item owner can decrypt it. 
                          You earn <strong>$TRACK rewards</strong> sent to your anonymous address.
                        </p>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={loading || !tempWallet || eid.length !== 64 || !location}
                      className={`w-full py-3 px-4 font-medium rounded-lg ${
                        tempWallet && eid.length === 64 && location
                          ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-700 hover:to-purple-700'
                          : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      }`}
                    >
                      {loading ? 'Submitting...' : 'Submit Anonymous Report & Earn $TRACK'}
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}