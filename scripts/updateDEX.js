const { ethers, upgrades } = require("hardhat");

async function main() {

    const tegroDEXAddress = "";
    const [deployer] = await ethers.getSigners();
    console.log(
        "Deploying contracts with the account:",
        await deployer.getAddress()
    );
    const tegroContractFactory = await ethers.getContractFactory("TegroDEX");
    const deployedContract = await upgrades.upgradeProxy(tegroDEXAddress, tegroContractFactory);
    console.log("Tegro DEX upgraded" + deployedContract.getAddress());
}

main();