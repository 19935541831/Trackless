// test/TracklessCore.test.js
const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("TracklessCore", function () {
  let tracklessCore, mockTRACK;
  let owner, user1, user2;
  const EID = ethers.encodeBytes32String("TAG123");
  const STAKE = ethers.parseEther("10");
  const QUERY_FEE = ethers.parseEther("0.5");
  const PRIORITY_FEE = ethers.parseEther("2.0");

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();

    // 部署代币
    const MockTRACK = await ethers.getContractFactory("MockTRACK");
    mockTRACK = await MockTRACK.deploy();
    await mockTRACK.waitForDeployment();

    // user1 需要：10 stake + 0.5 query + 0.3 bounty
    await mockTRACK.mint(user1.address, ethers.parseEther("15"));

    // 部署核心合约
    const TracklessCore = await ethers.getContractFactory("TracklessCore");
    tracklessCore = await TracklessCore.deploy(
      await mockTRACK.getAddress(),
      owner.address
    );
    await tracklessCore.waitForDeployment();
  });

  describe("Device Registration & Staking", function () {
    it("Should allow user to register a tracker with stake", async () => {
      await mockTRACK.connect(user1).approve(tracklessCore.getAddress(), STAKE);
      await expect(tracklessCore.connect(user1).registerTracker(EID))
        .to.emit(tracklessCore, "TrackerRegistered")
        .withArgs(EID, user1.address);
      expect(await tracklessCore.trackerToOwner(EID)).to.equal(user1.address);
    });
  });

  describe("Lost Mode & Query Fees", function () {
    beforeEach(async () => {
      await mockTRACK.connect(user1).approve(tracklessCore.getAddress(), STAKE);
      await tracklessCore.connect(user1).registerTracker(EID);
    });

    it("Should activate lost mode with query fee", async () => {
      await mockTRACK.connect(user1).approve(tracklessCore.getAddress(), QUERY_FEE);
      await expect(tracklessCore.connect(user1).activateLostMode(EID))
        .to.emit(tracklessCore, "QueryInitiated")
        .withArgs(EID, user1.address, QUERY_FEE);
      expect(await tracklessCore.isLost(EID)).to.be.true;
      expect(await tracklessCore.queryFeePaid(EID)).to.equal(QUERY_FEE);
    });
  });

  describe("Emergency Mode", function () {
    beforeEach(async () => {
      await mockTRACK.connect(user1).approve(tracklessCore.getAddress(), STAKE);
      await tracklessCore.connect(user1).registerTracker(EID);
    });

    it("Should allow emergency mode with higher fee", async () => {
      await mockTRACK.connect(user1).approve(tracklessCore.getAddress(), PRIORITY_FEE);
      await tracklessCore.connect(user1).activateEmergencyMode(EID, PRIORITY_FEE);
      expect(await tracklessCore.queryFeePaid(EID)).to.equal(PRIORITY_FEE);
    });
  });

  describe("Report Submission & Reward Distribution", function () {
    beforeEach(async () => {
        await mockTRACK.connect(user1).approve(tracklessCore.getAddress(), STAKE + QUERY_FEE + QUERY_FEE);
        await tracklessCore.connect(user1).registerTracker(EID);
        await tracklessCore.connect(user1).activateLostMode(EID);
    });

    it("Should allow owner (relay) to submit report and distribute rewards (70/20/10)", async () => {
        
        const scanner = user2;
        const treasuryAddr = await tracklessCore.treasury();
        const contractAddr = await tracklessCore.getAddress();
        await tracklessCore.connect(user1).activateLostMode(EID);
        
        const tx = await tracklessCore.connect(owner).submitReport(EID, scanner.address, "QmExample");
        const receipt = await tx.wait();
        const totalFee = await tracklessCore.queryFeePaid(EID);
        const reward = (totalFee * 70n) / 100n;
        const treasuryShare = (totalFee * 20n) / 100n;
        const burnAmount = (totalFee * 10n) / 100n;

        
        const balScannerAfter = await mockTRACK.balanceOf(scanner.address);
        const balScannerBefore = await mockTRACK.balanceOf(scanner.address) - reward;
        const balTreasuryAfter = await mockTRACK.balanceOf(treasuryAddr);
        const balTreasuryBefore = await mockTRACK.balanceOf(treasuryAddr) - treasuryShare;
        
        
        expect(balScannerAfter - balScannerBefore).to.equal(reward);
        expect(balTreasuryAfter - balTreasuryBefore).to.equal(treasuryShare);
    });
    });

  describe("Bounty System", function () {
    beforeEach(async () => {
      await mockTRACK.connect(user1).approve(tracklessCore.getAddress(), STAKE);
      await tracklessCore.connect(user1).registerTracker(EID);
    });

    it("Should allow owner to send bounty to scanner", async () => {
      const bounty = ethers.parseEther("0.3");
      const scanner = user2;
      const balBefore = await mockTRACK.balanceOf(scanner.address);

      await mockTRACK.connect(user1).approve(tracklessCore.getAddress(), bounty);
      await tracklessCore.connect(user1).sendBounty(scanner.address, EID, bounty);

      const balAfter = await mockTRACK.balanceOf(scanner.address);
      expect(balAfter - balBefore).to.equal(bounty);
    });
  });

  describe("Unregister (Unstake)", function () {
    beforeEach(async () => {
      await mockTRACK.connect(user1).approve(tracklessCore.getAddress(), STAKE);
      await tracklessCore.connect(user1).registerTracker(EID);
    });

    it("Should allow owner to unregister and get stake back", async () => {
      const balBefore = await mockTRACK.balanceOf(user1.address);
      await tracklessCore.connect(user1).unregisterTracker(EID);
      const balAfter = await mockTRACK.balanceOf(user1.address);
      expect(balAfter - balBefore).to.equal(STAKE);
    });
  });
});