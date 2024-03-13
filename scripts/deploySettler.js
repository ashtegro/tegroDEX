const { ethers, upgrades } = require("hardhat");

async function main() {
  // We get the contract to deploy
  const [deployer] = await ethers.getSigners();
  console.log(
    "Deploying contracts with the account:",
    await deployer.getAddress()
  );

  const tradingContractAddress = "0xa478216c53C7cE41d018F5AaAbb5Ae887495979E"; // Polygon mumbai address PRE-DEV
  const ownerAddress = "0x113128f65D830b5295cef847597F4655f3d8E47C"; // Polygon mumbai address


  const TegroContract = await ethers.getContractFactory("TegroDEXSettlement");
  const deployedContract = await upgrades.deployProxy(TegroContract, [ownerAddress, tradingContractAddress], { deployer, initializer: 'initialize' });
  await deployedContract.waitForDeployment();

  console.log("Tegro Settlement deployed to: " + await deployedContract.getAddress());

  //await new Promise(resolve => setTimeout(resolve, 60000));

  //console.log("Verifying contract...");
  //await hre.run("verify:verify", {
  //network: hre.network.name,
  //  address: deployedContract.target,
  // constructorArguments: [tradingContractAddress],
  //});
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
