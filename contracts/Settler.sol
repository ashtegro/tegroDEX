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
        bytes memory sellSignature,
        uint256 matchingAmount
    ) external payable;

    function hashOrder(Order memory order) external view returns (bytes32);
}

contract TegroDEXSettlement is Initializable, OwnableUpgradeable {
    ITradingContract public tradingContract;
    event TradeFailed(
        bytes32 indexed buyOrderHash,
        bytes32 indexed sellOrderHash,
        uint256 matchingAmount
    );

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
        bytes[] memory sellSignatures,
        uint256[] memory matchingAmounts
    ) external {
        if (buyOrders.length != sellOrders.length || buyOrders.length != matchingAmounts.length) {
            revert("Invalid array lengths");
        }

        for (uint i = 0; i < buyOrders.length; i++) {
            try
                tradingContract.settleOrders(
                    buyOrders[i],
                    buySignatures[i],
                    sellOrders[i],
                    sellSignatures[i],
                    matchingAmounts[i]
                )
            {} catch (bytes memory) {
                emit TradeFailed(
                    tradingContract.hashOrder(buyOrders[i]),
                    tradingContract.hashOrder(sellOrders[i]),
                    matchingAmounts[i]
                );
            }
        }
    }
}
