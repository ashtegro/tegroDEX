const { ethers, upgrades } = require("hardhat");

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log(
        "Deploying contracts with the account:",
        await deployer.getAddress()
    );

    const ownerAddress = "0x113128f65D830b5295cef847597F4655f3d8E47C"; // Polygon mumbai address
    const feeAmount = 100;
    const TegroContract = await ethers.getContractFactory("TegroDEX");
    const deployedContract = await upgrades.deployProxy(TegroContract, [ownerAddress, feeAmount]);
    await deployedContract.waitForDeployment();

    console.log("Tegro DEX deployed to: " + await deployedContract.getAddress());
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
