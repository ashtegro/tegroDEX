// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

interface ITradingContract {
    struct Order {
        address baseToken;
        address quoteToken;
        uint256 price;
        uint256 totalQuantity;
        bool isBuy;
        uint256 salt;
        address maker;
    }

    function settleOrders(
        Order memory buyOrder,
        bytes memory buySignature,
        Order memory sellOrder,
        bytes memory sellSignature
    ) external payable;
}

contract TegroDEXSettlement is Initializable, OwnableUpgradeable {
    ITradingContract public tradingContract;

    function initialize(
        address _owner,
        address _tradingContract
    ) public initializer {
        __Ownable_init(_owner);
        tradingContract = ITradingContract(_tradingContract);
    }

    function settleBatchOrders(
        ITradingContract.Order[] memory buyOrders,
        bytes[] memory buySignatures,
        ITradingContract.Order[] memory sellOrders,
        bytes[] memory sellSignatures
    ) external {
        if (buyOrders.length != sellOrders.length) {
            revert("Invalid order length");
        }

        for (uint i = 0; i < buyOrders.length; i++) {
            try
                tradingContract.settleOrders(
                    buyOrders[i],
                    buySignatures[i],
                    sellOrders[i],
                    sellSignatures[i]
                )
            {} catch (bytes memory reason) {}
        }
    }
}
