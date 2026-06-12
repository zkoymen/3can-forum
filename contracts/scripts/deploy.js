const fs = require("fs");
const path = require("path");
const { ethers, network, artifacts } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`Deploying with account: ${deployer.address}`);
  console.log(`Network: ${network.name} (chainId ${network.config.chainId})`);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`Balance: ${ethers.formatEther(balance)} ETH`);

  const Forum = await ethers.getContractFactory("Forum");
  const forum = await Forum.deploy();
  await forum.waitForDeployment();

  const address = await forum.getAddress();
  const deployTx = forum.deploymentTransaction();
  const receipt = deployTx ? await deployTx.wait() : null;
  const deployBlock = receipt ? receipt.blockNumber : 0;

  console.log(`Forum deployed at: ${address}`);
  console.log(`Deployment block: ${deployBlock}`);

  // Write the address + ABI to the frontend so it picks them up automatically.
  const frontendDir = path.resolve(__dirname, "../../frontend/src");
  if (fs.existsSync(frontendDir)) {
    const config = {
      contractAddress: address,
      deployBlock,
      chainId: network.config.chainId,
      network: network.name,
    };
    fs.writeFileSync(
      path.join(frontendDir, "config.json"),
      JSON.stringify(config, null, 2) + "\n"
    );

    const artifact = await artifacts.readArtifact("Forum");
    fs.writeFileSync(
      path.join(frontendDir, "abi.json"),
      JSON.stringify(artifact.abi, null, 2) + "\n"
    );
    console.log(`Wrote frontend/src/config.json and frontend/src/abi.json`);
  } else {
    console.log(
      `Frontend dir not found at ${frontendDir}; skipping config write.`
    );
  }

  console.log(
    `\nTo verify on Etherscan (Sepolia only):\n  npx hardhat verify --network sepolia ${address}\n`
  );
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
