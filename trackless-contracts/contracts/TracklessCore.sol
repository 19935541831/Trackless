// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
contract TracklessCore is Ownable, ReentrancyGuard {
    // ====== 代币与配置 ======
    IERC20 public immutable TRACK;
    address public treasury;
    uint256 public constant STAKE_PER_TRACKER = 10 * 1e18; // 10 TRACK
    uint256 public constant BASE_QUERY_FEE = 0.5 * 1e18;    // 0.5 TRACK

    // ====== 状态 ======
    mapping(bytes32 => address) public trackerToOwner;
    mapping(address => bytes32[]) public ownerToTrackers;
    mapping(address => uint256) public stakedBalance;
    mapping(bytes32 => bool) public isLost;
    mapping(bytes32 => bool) public isRegistered;
    mapping(bytes32 => uint256) public queryFeePaid; 
    mapping(bytes32 => mapping(address => bool)) public hasReported;

    // ====== 事件 ======
    event TrackerRegistered(bytes32 indexed eid, address owner);
    event TrackerUnstaked(bytes32 indexed eid, address owner);
    event LostModeActivated(bytes32 indexed eid);
    event LostModeDeactivated(bytes32 indexed eid);
    event QueryInitiated(bytes32 indexed eid, address querier, uint256 fee);
    event EmergencyQuery(bytes32 indexed eid, address querier, uint256 priorityFee);
    event ReportSubmitted(bytes32 indexed eid, address indexed scanner, string ipfsCid, uint256 timestamp);
    event RewardDistributed(address indexed scanner, uint256 reward, uint256 treasuryShare, uint256 burnAmount);
    event BountySent(address indexed to, uint256 amount, bytes32 eid);

    modifier onlyOwnerOf(bytes32 eid) {
        require(trackerToOwner[eid] == msg.sender, "Not tracker owner");
        _;
    }

    constructor(address _trackToken, address _treasury)
        Ownable(msg.sender) 
    {
        require(_trackToken != address(0) && _treasury != address(0), "Invalid addresses");
        TRACK = IERC20(_trackToken);
        treasury = _treasury;
    }

    // ====== 设备注册 ======
    function registerTracker(bytes32 eid) external nonReentrant {
        require(!isRegistered[eid], "Already registered");
        require(TRACK.transferFrom(msg.sender, address(this), STAKE_PER_TRACKER), "Stake failed");

        trackerToOwner[eid] = msg.sender;
        stakedBalance[msg.sender] += STAKE_PER_TRACKER;
        ownerToTrackers[msg.sender].push(eid);
        isRegistered[eid] = true;

        emit TrackerRegistered(eid, msg.sender);
    }

    // ====== 解绑设备 ======
    function unregisterTracker(bytes32 eid) external onlyOwnerOf(eid) nonReentrant {
        require(!isLost[eid], "Cannot unregister in lost mode");

        trackerToOwner[eid] = address(0);
        isRegistered[eid] = false;
        stakedBalance[msg.sender] -= STAKE_PER_TRACKER;
        TRACK.transfer(msg.sender, STAKE_PER_TRACKER);

        emit TrackerUnstaked(eid, msg.sender);
    }

    // ====== 普通丢失模式（支付基础查询费） ======
    function activateLostMode(bytes32 eid) external onlyOwnerOf(eid) nonReentrant {
        require(TRACK.transferFrom(msg.sender, address(this), BASE_QUERY_FEE), "Query fee failed");
        isLost[eid] = true;
        queryFeePaid[eid] = BASE_QUERY_FEE; // 
        emit QueryInitiated(eid, msg.sender, BASE_QUERY_FEE);
    }

    // ====== 紧急模式（支付更高优先费） ======
    function activateEmergencyMode(bytes32 eid, uint256 priorityFee) external onlyOwnerOf(eid) nonReentrant {
        require(priorityFee >= BASE_QUERY_FEE, "Priority fee too low");
        require(TRACK.transferFrom(msg.sender, address(this), priorityFee), "Priority fee failed");
        isLost[eid] = true;
        queryFeePaid[eid] = priorityFee; // 
        emit EmergencyQuery(eid, msg.sender, priorityFee);
    }

    function deactivateLostMode(bytes32 eid) external onlyOwnerOf(eid) {
        isLost[eid] = false;
        emit LostModeDeactivated(eid);
    }

    // ====== 提交报告（由可信中继调用） ======
    function submitReport(
        bytes32 eid,
        address scanner,
        string calldata ipfsCid
    ) external onlyOwner nonReentrant {
        require(isLost[eid], "Not in lost mode");
        require(scanner != address(0) && scanner != trackerToOwner[eid], "Invalid or self-report");
        require(bytes(ipfsCid).length > 0, "Invalid CID");
        require(!hasReported[eid][scanner], "Already reported");
        require(queryFeePaid[eid] > 0, "No query fee paid");

        uint256 totalFee = queryFeePaid[eid];
        hasReported[eid][scanner] = true;

        uint256 reward = (totalFee * 70) / 100;
        uint256 treasuryShare = (totalFee * 20) / 100;
        uint256 burnAmount = (totalFee * 10) / 100;

        TRACK.transfer(scanner, reward);
        TRACK.transfer(treasury, treasuryShare);
        TRACK.transfer(address(0x000000000000000000000000000000000000dEaD), burnAmount);

        emit ReportSubmitted(eid, scanner, ipfsCid, block.timestamp);
        emit RewardDistributed(scanner, reward, treasuryShare, burnAmount);
    }

    // ====== 自愿打赏 Bounty ======
    function sendBounty(address to, bytes32 eid, uint256 amount) external onlyOwnerOf(eid) nonReentrant {
        require(to != address(0), "Invalid recipient");
        require(TRACK.transferFrom(msg.sender, to, amount), "Bounty failed");
        emit BountySent(to, amount, eid);
    }

    // ====== 查询接口 ======
    function getTrackersByOwner(address _owner) external view returns (bytes32[] memory) {
        return ownerToTrackers[_owner];
    }

    function getTrackerCount(address _owner) external view returns (uint256) {
        return ownerToTrackers[_owner].length;
    }

    // ====== 金库管理 ======
    function setTreasury(address _newTreasury) external onlyOwner {
        require(_newTreasury != address(0), "Invalid treasury");
        treasury = _newTreasury;
    }
}