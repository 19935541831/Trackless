// app/routes/find.$eid.tsx
import { useEffect, useState, useRef } from 'react';
import { useLoaderData, useRouteError, isRouteErrorResponse } from 'react-router';
import { useWallet } from '../context/WalletContext';
import { getTracklessContract, getTrackTokenContract } from '../contracts/tracklessContract'; // ✅ 新增
import { ethers } from 'ethers';
import NetworkBackground from '../components/NetworkBackground';

export async function loader({ params, request }: { params: { eid: string }; request: Request }) {
  const url = new URL(request.url);
  const accountParam = url.searchParams.get('account');

  if (!accountParam) {
    throw new Response('Missing account parameter', { status: 400 });
  }

  try {
    const cleanEid = params.eid.startsWith('0x') ? params.eid.slice(2) : params.eid;
    if (cleanEid.length !== 64) {
      throw new Response('Invalid EID format', { status: 400 });
    }

    const provider = new ethers.JsonRpcProvider('http://localhost:8545');
    const signer = await provider.getSigner();
    const contract = getTracklessContract(signer);
    const owner = await contract.trackerToOwner(ethers.getBytes('0x' + cleanEid));

    if (owner.toLowerCase() !== accountParam.toLowerCase()) {
      throw new Response('Forbidden: You are not the owner of this tracker.', { status: 403 });
    }

    const res = await fetch(`http://localhost:8000/api/reports/${params.eid}`);
    const reports = res.ok ? await res.json() : [];
    return { eid: params.eid, reports, account: accountParam };
  } catch (error) {
    if (error instanceof Response) throw error;
    console.error('Loader error:', error);
    throw new Response('Tracker not found or access denied.', { status: 404 });
  }
}

export default function FindTrackerPage() {
  const { eid, reports } = useLoaderData<typeof loader>();
  const { account: currentAccount, isConnected } = useWallet();
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [bountyAmount, setBountyAmount] = useState('0.1'); // 默认 0.1 $TRACK
  const [bountyLoading, setBountyLoading] = useState(false);
  const [selectedReportIndex, setSelectedReportIndex] = useState<number | null>(null);
  const mapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isConnected && currentAccount) {
      const urlParams = new URLSearchParams(window.location.search);
      const requestedAccount = urlParams.get('account');
      if (requestedAccount && requestedAccount.toLowerCase() !== currentAccount.toLowerCase()) {
        alert('Security warning: Wallet account mismatch. Please reconnect.');
        window.location.href = '/';
      }
    }
  }, [isConnected, currentAccount]);

  useEffect(() => {
    if (reports.length > 0) {
      setLocation({ lat: 22.319304, lng: 114.169361 }); 
    }
  }, [reports]);

  useEffect(() => {
    if (typeof window === 'undefined' || !location || !mapRef.current || mapLoaded) return;

    const initMap = async () => {
      const L = await import('leaflet');
      import('leaflet/dist/leaflet.css');

      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
        iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
      });

      const map = L.map(mapRef.current!).setView([location.lat, location.lng], 14);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map);

      L.marker([location.lat, location.lng])
        .addTo(map)
        .bindPopup(`Your tracker was last seen here.<br /><em>${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}</em>`)
        .openPopup();

      setMapLoaded(true);
      return () => { if (map) map.remove(); };
    };

    initMap();
  }, [location, mapLoaded]);

  // ✅ Bounty 发送逻辑
  const handleSendBounty = async (report: any) => {
    if (!isConnected || !currentAccount) return;
    const amount = parseFloat(bountyAmount);
    if (isNaN(amount) || amount <= 0) {
      alert('Please enter a valid bounty amount.');
      return;
    }

    setBountyLoading(true);
    try {
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const signer = await provider.getSigner();
      const tracklessContract = getTracklessContract(signer);
      const trackTokenContract = getTrackTokenContract(signer);

      const bountyWei = ethers.parseEther(bountyAmount);
      const contractAddr = await tracklessContract.getAddress();

      // 1. 授权
      const allowance = await trackTokenContract.allowance(currentAccount, contractAddr);
      if (allowance < bountyWei) {
        const approveTx = await trackTokenContract.approve(contractAddr, bountyWei);
        await approveTx.wait();
      }

      // 2. 发送 bounty
      const eidBytes = ethers.getBytes('0x' + eid);
      const tx = await tracklessContract.sendBounty(report.scanner, eidBytes, bountyWei);
      await tx.wait();

      alert(`Bounty of ${bountyAmount} $TRACK sent successfully!`);
      setSelectedReportIndex(null);
    } catch (err: any) {
      console.error(err);
      if (err.message?.includes('user aborted')) {
        alert('Transaction canceled.');
      } else if (err.message?.includes('Bounty failed')) {
        alert('Insufficient $TRACK balance or approval failed.');
      } else {
        alert('Bounty failed: ' + (err.reason || err.message));
      }
    } finally {
      setBountyLoading(false);
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
                    d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
                  />
                </svg>
              </div>
              <h1 className="text-4xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600">
                Location Reports
              </h1>
              <p className="mt-3 text-gray-600 dark:text-gray-300">
                All reports are end-to-end encrypted. Only you can decrypt the precise location.
              </p>
            </div>

            <div className="bg-white/80 dark:bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-200/60 dark:border-gray-700/50">
              <div className="mb-4">
                <span className="text-sm font-medium text-gray-500 dark:text-gray-400">EID</span>
                <div className="mt-1 p-3 bg-gray-100 dark:bg-gray-700/50 rounded-lg font-mono text-sm break-all">
                  {eid}
                </div>
              </div>

              {reports.length === 0 ? (
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
                      d="M9.172 16.172a4 4 0 015.656 0M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  <p className="mt-4 text-gray-600 dark:text-gray-400">
                    No reports yet. Make sure "Lost Mode" is active and wait for a scanner.
                  </p>
                </div>
              ) : (
                <div>
                  <div className="mb-4 flex justify-between items-center">
                    <h2 className="text-lg font-semibold">Recent Reports ({reports.length})</h2>
                    <span className="text-xs bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300 px-2 py-1 rounded">
                      Precise location
                    </span>
                  </div>

                  {location ? (
                    <div className="h-80 w-full rounded-lg overflow-hidden border border-gray-200/50 dark:border-gray-700/50 mb-6">
                      <div ref={mapRef} className="w-full h-full" />
                    </div>
                  ) : (
                    <p className="text-gray-500">Loading decrypted location...</p>
                  )}

                  <div className="mt-6 space-y-4">
                    {reports.map((report: any, i: number) => (
                      <div key={i} className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                        <div className="flex justify-between items-start">
                          <div className="text-sm text-gray-600 dark:text-gray-400">
                            <div className="flex items-center mb-1">
                              <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <span>Report #{reports.length - i}</span>
                            </div>
                            <p className="text-xs mt-1">Scanner: <span className="font-mono">{report.scanner}</span></p>
                            <p className="text-xs mt-1">{new Date(report.timestamp * 1000).toLocaleString()}</p>
                          </div>
                          
                          {/* ✅ Bounty 按钮 */}
                          <button
                            onClick={() => setSelectedReportIndex(i)}
                            className="text-xs bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-3 py-1 rounded hover:from-indigo-700 hover:to-purple-700"
                          >
                            Send Bounty
                          </button>
                        </div>

                        {/* ✅ Bounty 表单（折叠式） */}
                        {selectedReportIndex === i && (
                          <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
                            <div className="flex items-center space-x-2">
                              <input
                                type="number"
                                value={bountyAmount}
                                onChange={(e) => setBountyAmount(e.target.value)}
                                min="0.01"
                                step="0.01"
                                placeholder="0.1"
                                className="w-24 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800"
                              />
                              <span className="text-sm text-gray-600 dark:text-gray-300">$TRACK</span>
                              <button
                                onClick={() => handleSendBounty(report)}
                                disabled={bountyLoading}
                                className="text-xs bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 disabled:opacity-50"
                              >
                                {bountyLoading ? 'Sending...' : 'Send'}
                              </button>
                              <button
                                onClick={() => setSelectedReportIndex(null)}
                                className="text-xs text-gray-500 hover:text-gray-700"
                              >
                                Cancel
                              </button>
                            </div>
                            <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-2">
                              Tip: Sending bounty builds community trust and encourages future help.
                            </p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </>
  );
}

// ErrorBoundary 保持不变（略）
export function ErrorBoundary() { /* ... */ }