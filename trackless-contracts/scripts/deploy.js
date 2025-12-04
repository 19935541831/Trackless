// scripts/deploy.js
const fs = require('fs');
const path = require('path');

async function main() {
  const [deployer, user1, user2] = await ethers.getSigners(); 
  console.log("Deploying contracts with account:", deployer.address);

  // 1. 部署 MockTRACK 代币
  const MockTRACK = await ethers.getContractFactory("MockTRACK");
  const mockTRACK = await MockTRACK.deploy();
  await mockTRACK.waitForDeployment();
  const trackTokenAddress = await mockTRACK.getAddress();
  console.log("MockTRACK deployed to:", trackTokenAddress);

  // 2. 部署 TracklessCore
  const TracklessCore = await ethers.getContractFactory("TracklessCore");
  const tracklessCore = await TracklessCore.deploy(
    trackTokenAddress,
    deployer.address
  );
  await tracklessCore.waitForDeployment();
  const coreAddress = await tracklessCore.getAddress();
  console.log("TracklessCore deployed to:", coreAddress);

  // 3. 给测试账户铸造代币
  await mockTRACK.mint(deployer.address, ethers.parseEther("1000"));
  await mockTRACK.mint(user1.address, ethers.parseEther("1000"));
  await mockTRACK.mint(user2.address, ethers.parseEther("1000"));

  // 4. 保存地址到文件
  const deploymentInfo = {
    network: 'localhost',
    timestamp: new Date().toISOString(),
    contracts: {
      MockTRACK: trackTokenAddress,
      TracklessCore: coreAddress
    },
    accounts: {
      deployer: deployer.address,
      user1: user1.address,
      user2: user2.address
    }
  };

  // 保存到 JSON 文件
  const deploymentsDir = path.join(__dirname, '../deployments');
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir);
  }
  
  const deploymentPath = path.join(deploymentsDir, 'localhost.json');
  fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
  
  console.log("\nDeployment info saved to:", deploymentPath);
  console.log("\nDeployment complete!");
  console.log("- MockTRACK:", trackTokenAddress);
  console.log("- TracklessCore:", coreAddress);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });