// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts-upgradeable/utils/cryptography/EIP712Upgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

//Interface required because IERC20 does not return decimals
interface IERC20WithDecimals is IERC20 {
    function decimals() external view returns (uint8);
}

contract TegroDEX is
    Initializable,
    OwnableUpgradeable,
    EIP712Upgradeable,
    ReentrancyGuardUpgradeable
{
    using ECDSA for bytes32;
    //To work with older ERC20 tokens
    using SafeERC20 for IERC20;

    //Order statuses for tracking
    uint256 private constant _ORDER_DOES_NOT_EXIST = 0;
    uint256 private constant _ORDER_FILLED = 1;

    //Tracks remaining quantity of each order to ensure no orders are filled twice
    mapping(bytes32 => uint256) public remaining;

    //EIP712 config
    string private constant SIGNING_DOMAIN = "TegroDEX";
    string private constant SIGNATURE_VERSION = "1";

    struct Order {
        address baseToken; //Address of the token being traded
        address quoteToken; //Address of the token being used to quote price
        uint256 price; //Real price in quoteToken for 1 whole unit of base token
        uint256 totalQuantity; //Total quantity required to buy or sell
        bool isBuy; //Whether the order is a sell order or buy order
        uint256 salt; //Random value to ensure orders are unique
        address maker; //Address of the maker
    }

    event OrderSettled(
        address baseToken,
        address quoteToken,
        uint256 price,
        uint256 totalQuantity,
        uint256 totalPrice,
        bytes32 indexed buyOrderHash,
        bytes32 indexed sellOrderHash
    );

    //Fee component to be taken from each trade
    uint16 public feeAmount; //Calculated in terms of basis points
    address public feeRecipient;
    uint16 public constant MAX_FEE_AMOUNT = 100; //Always ensure fee never crosses 1%

    function initialize(address _owner, uint16 _feeAmount) public initializer {
        __Ownable_init(_owner);
        __EIP712_init(SIGNING_DOMAIN, SIGNATURE_VERSION);
        __ReentrancyGuard_init();

        feeAmount = _feeAmount;
        feeRecipient = _owner;
    }

    //Settle a trade
    function settleOrders(
        Order memory buyOrder,
        bytes memory buySignature,
        Order memory sellOrder,
        bytes memory sellSignature,
        uint256 matchedAmount
    ) external nonReentrant {
        //Hash the orders based on EIP712
        bytes32 buyOrderHash = hashOrder(buyOrder);
        bytes32 sellOrderHash = hashOrder(sellOrder);

        require(
            buyOrder.isBuy == true && sellOrder.isBuy == false,
            "Both orders cannot be of the same type (buy/sell)"
        );

        //Require both orders to have the same base and quote tokens
        require(
            buyOrder.baseToken == sellOrder.baseToken &&
                buyOrder.quoteToken == sellOrder.quoteToken,
            "Base/Quote tokens do not match"
        );

        //Require the buy price to always be higher than the sell price. Otherwise the trade is invalid
        require(
            buyOrder.price >= sellOrder.price,
            "Buy order price must be higher or equal to the sell order price"
        );

        //Signature verification to avoid spoofing
        require(
            _verifySignature(buyOrderHash, buySignature, buyOrder.maker) &&
                _verifySignature(sellOrderHash, sellSignature, sellOrder.maker),
            "Invalid order signatures"
        );

        //Auto calculate the matched amount based on how much is remaining
        _validateAndProcessMatchedAmount(
            buyOrderHash,
            sellOrderHash,
            buyOrder.totalQuantity,
            sellOrder.totalQuantity,
            matchedAmount
        );

        //If all validations pass, transfer the tokens between the two parties
        _transferTokens(
            buyOrder,
            sellOrder,
            matchedAmount,
            buyOrderHash,
            sellOrderHash
        );
    }

    function _verifySignature(
        bytes32 hash,
        bytes memory signature,
        address signer
    ) internal pure returns (bool) {
        return hash.recover(signature) == signer;
    }

    function _validateAndProcessMatchedAmount(
        bytes32 buyOrderHash,
        bytes32 sellOrderHash,
        uint256 buyTotalQuantity,
        uint256 sellTotalQuantity,
        uint256 matchedAmount
    ) internal {
        uint256 buyRemaining = remaining[buyOrderHash];
        uint256 sellRemaining = remaining[sellOrderHash];

        if (buyRemaining == _ORDER_DOES_NOT_EXIST && buyTotalQuantity > 0) {
            buyRemaining = buyTotalQuantity + 1;
        }
        if (sellRemaining == _ORDER_DOES_NOT_EXIST && sellTotalQuantity > 0) {
            sellRemaining = sellTotalQuantity + 1;
        }

        if (
            matchedAmount > buyRemaining - 1 ||
            matchedAmount > sellRemaining - 1
        ) {
            revert("Matched amount is greater than the remaining amount");
        }

        if (buyRemaining > matchedAmount + 1) {
            remaining[buyOrderHash] = buyRemaining - matchedAmount;
        } else {
            remaining[buyOrderHash] = _ORDER_FILLED;
        }

        if (sellRemaining > matchedAmount + 1) {
            remaining[sellOrderHash] = sellRemaining - matchedAmount;
        } else {
            remaining[sellOrderHash] = _ORDER_FILLED;
        }
    }

    function _transferTokens(
        Order memory buyOrder,
        Order memory sellOrder,
        uint256 matchedAmount,
        bytes32 buyOrderHash,
        bytes32 sellOrderHash
    ) internal {
        IERC20 baseToken = IERC20(buyOrder.baseToken);
        IERC20 quoteToken = IERC20(buyOrder.quoteToken);

        uint8 baseDecimals = IERC20WithDecimals(buyOrder.baseToken).decimals();
        uint8 quoteDecimals = IERC20WithDecimals(buyOrder.quoteToken)
            .decimals();

        uint256 matchedPrice = buyOrder.price < sellOrder.price
            ? buyOrder.price
            : sellOrder.price;

        uint256 totalPrice = calculateTotalPrice(
            matchedPrice,
            quoteDecimals,
            matchedAmount,
            baseDecimals
        );

        require(totalPrice > 0, "Total price needs to be greater than 0");

        baseToken.safeTransferFrom(
            sellOrder.maker,
            buyOrder.maker,
            matchedAmount
        );

        quoteToken.safeTransferFrom(
            buyOrder.maker,
            sellOrder.maker,
            totalPrice
        );

        emit OrderSettled(
            buyOrder.baseToken,
            buyOrder.quoteToken,
            matchedPrice,
            matchedAmount,
            totalPrice,
            buyOrderHash,
            sellOrderHash
        );

        //uint256 baseFeeAmount = (matchedAmount * feeAmount) / 10000;
        //uint256 quoteFeeAmount = (totalPrice * feeAmount) / 10000;

        // //Calculate fees and transfer the amount to the recipient
        // baseToken.safeTransferFrom(buyOrder.maker, owner(), baseFeeAmount);
        // quoteToken.safeTransferFrom(sellOrder.maker, owner(), quoteFeeAmount);
    }

    function calculateTotalPrice(
        uint256 price,
        uint8 quoteTokenDecimals,
        uint256 quantity,
        uint8 baseTokenDecimals
    ) public pure returns (uint256) {
        //First scale up the values to the highest decimals to ensure consistency in multiplication
        uint16 higherDecimal = baseTokenDecimals >= quoteTokenDecimals
            ? baseTokenDecimals
            : quoteTokenDecimals;

        if (baseTokenDecimals != higherDecimal) {
            quantity = quantity * 10 ** (higherDecimal - baseTokenDecimals);
        }

        if (quoteTokenDecimals != higherDecimal) {
            price = price * 10 ** (higherDecimal - quoteTokenDecimals);
        }

        uint256 totalPrice = price * quantity;

        //Scale down the total price value to quote token's decimals
        if (quoteTokenDecimals != higherDecimal) {
            totalPrice =
                totalPrice /
                10 ** (higherDecimal + quoteTokenDecimals);
        }

        if (baseTokenDecimals != higherDecimal) {
            totalPrice = totalPrice / 10 ** (higherDecimal);
        } else {
            totalPrice = totalPrice / 10 ** (quoteTokenDecimals);
        }

        return totalPrice;
    }

    function setFeeRecipient(address _feeRecipient) external onlyOwner {
        feeRecipient = _feeRecipient;
    }

    function setFeeAmount(uint16 _feeAmount) external onlyOwner {
        require(_feeAmount <= MAX_FEE_AMOUNT, "Fee amount is too high");
        feeAmount = _feeAmount;
    }

    function cancelOrder(Order memory order, bytes memory signature) external {
        bytes32 orderHash = hashOrder(order);
        require(
            remaining[orderHash] != _ORDER_FILLED,
            "Order already filled or does not exist"
        );

        bytes32 messageHash = keccak256(abi.encodePacked("cancel ", orderHash));
        bytes32 ethSignedMessageHash = MessageHashUtils.toEthSignedMessageHash(
            messageHash
        );

        address signer = ECDSA.recover(ethSignedMessageHash, signature);

        require(signer == order.maker, "Invalid signature or not the maker");

        remaining[orderHash] = _ORDER_FILLED;
    }

    function hashOrder(Order memory order) public view returns (bytes32) {
        return
            _hashTypedDataV4(
                keccak256(
                    abi.encode(
                        keccak256(
                            "Order(address baseToken,address quoteToken,uint256 price,uint256 totalQuantity,bool isBuy,uint256 salt,address maker)"
                        ),
                        order.baseToken,
                        order.quoteToken,
                        order.price,
                        order.totalQuantity,
                        order.isBuy,
                        order.salt,
                        order.maker
                    )
                )
            );
    }
}
