// app/contracts/tracklessContract.ts
import { ethers } from 'ethers';

// 从 .env 或 Hardhat 部署结果获取（本地开发可硬编码）
import deploymentInfo from '../../../trackless-contracts/deployments/localhost.json'; // 相对路径

const CONTRACT_ADDRESS = deploymentInfo.contracts.TracklessCore;
const TRACK_TOKEN_ADDRESS = deploymentInfo.contracts.MockTRACK;

// ✅ 完整 ABI（匹配 TracklessCore.sol 的 public/external 函数）
const TRACKLESS_ABI = [
  // 设备管理
  "function registerTracker(bytes32 eid) external",
  "function unregisterTracker(bytes32 eid) external",
  "function getTrackersByOwner(address _owner) public view returns (bytes32[] memory)",
  "function getTrackerCount(address _owner) public view returns (uint256)",
  "function trackerToOwner(bytes32) public view returns (address)",

  // 丢失模式
  "function activateLostMode(bytes32 eid) external",
  "function activateEmergencyMode(bytes32 eid, uint256 priorityFee) external",
  "function deactivateLostMode(bytes32 eid) external",
  "function isLost(bytes32) public view returns (bool)",
  "function queryFeePaid(bytes32) public view returns (uint256)",

  // 报告与奖励（由后端调用，前端一般不调）
  // "function submitReport(bytes32 eid, address scanner, string ipfsCid) external",

  // Bounty（前端调用）
  "function sendBounty(address to, bytes32 eid, uint256 amount) external",

  // 事件（用于监听）
  "event TrackerRegistered(bytes32 indexed eid, address owner)",
  "event QueryInitiated(bytes32 indexed eid, address querier, uint256 fee)",
  "event EmergencyQuery(bytes32 indexed eid, address querier, uint256 priorityFee)",
  "event BountySent(address indexed to, uint256 amount, bytes32 eid)"
];

// ✅ $TRACK 代币 ABI（最小必要）
const TRACK_TOKEN_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function transfer(address to, uint256 amount) external returns (bool)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)"
];

export function getTracklessContract(providerOrSigner: ethers.Provider | ethers.Signer) {
  return new ethers.Contract(CONTRACT_ADDRESS, TRACKLESS_ABI, providerOrSigner);
}

export function getTrackTokenContract(providerOrSigner: ethers.Provider | ethers.Signer) {
  return new ethers.Contract(TRACK_TOKEN_ADDRESS, TRACK_TOKEN_ABI, providerOrSigner);
}