require("@nomicfoundation/hardhat-toolbox");
require('@openzeppelin/hardhat-upgrades');
require('dotenv').config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.22",
  defaultNetwork: "polygon_mumbai",
  sourcify: {
    enabled: false
  },
  etherscan: {
    apiKey: {
      polygonMumbai: process.env.POLYGONSCAN_API_KEY,
      optimismSepolia: process.env.SEPOLIA_API_KEY
    },
    customChains: [
      {
        network: "optimismSepolia",
        chainId: 11155420,
        urls: {
          apiURL: "https://api-sepolia-optimistic.etherscan.io/api",
          browserURL: "https://sepolia-optimism.etherscan.io/"
        }
      }
    ]
  },

  networks: {
    polygon_mumbai: {
      url: process.env.MUMBAI_ALCHEMY_URL,
      accounts: [process.env.PRIVATE_KEY],
    },
    optimismSepolia: {
      url: process.env.OP_SEPOLIA_ALCHEMY_URL,
      accounts: [process.env.PRIVATE_KEY]
    },
    shardeum_test: {
      url: 'https://sphinx.shardeum.org/',
      accounts: [process.env.PRIVATE_KEY]
    }
  }
};
