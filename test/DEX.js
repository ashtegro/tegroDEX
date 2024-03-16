const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("TegroDEX", function () {
    let Token, baseToken, quoteToken;
    let TegroDEX, TegroDEXContract;
    let owner, addr1, addr2;
    let network;
    const baseDecimals = 2;
    const quoteDecimals = 4;
    const feeBps = 20;

    beforeEach(async function () {
        // Deploy an ERC20 token for testing
        Token = await ethers.getContractFactory("TokenFactory");
        baseToken = await Token.deploy("BaseToken", "BASE", baseDecimals);
        quoteToken = await Token.deploy("QuoteToken", "QUOTE", quoteDecimals);

        // Deploy the TegroDEX contract
        TegroDEX = await ethers.getContractFactory("TegroDEX");
        [owner, addr1, addr2] = await ethers.getSigners();
        TegroDEXContract = await TegroDEX.deploy();
        TegroDEXContract.initialize(owner.address, feeBps);
        network = await ethers.getDefaultProvider().getNetwork();
    });

    async function placeOrder(_makerToken, _takerToken, _isBuy, _price, _totalQuantity, _wallet) {
        rawOrder =
        {
            "baseToken": _makerToken,
            "quoteToken": _takerToken,
            "price": _price.toString(),
            "totalQuantity": _totalQuantity.toString(),
            "isBuy": _isBuy,
            "salt": generateSalt(),
            "maker": _wallet.address,
        }
        return rawOrder;
    }

    async function signOrder(_wallet, _rawOrder, _domain) {
        const signature = await _wallet.signTypedData(_domain, type, _rawOrder);
        return signature;
    }

    function getDomain(_verifyingContract) {
        const domain = {
            name: 'TegroDEX',
            version: '1',
            chainId: 31337,
            verifyingContract: _verifyingContract
        };
        return domain;
    }

    const type = {
        Order: [
            { name: 'baseToken', type: 'address' },
            { name: 'quoteToken', type: 'address' },
            { name: 'price', type: 'uint256' },
            { name: 'totalQuantity', type: 'uint256' },
            { name: 'isBuy', type: 'bool' },
            { name: 'salt', type: 'uint256' },
            { name: 'maker', type: 'address' }
        ]
    };

    function generateSalt() {
        const currentTimeMillis = new Date().getTime();
        const randNum = Math.round(Math.random() * currentTimeMillis);
        return randNum.toString();
    }


    it("should settle full fill orders correctly", async function () {
        const buyPrice = 1 * (10 ** quoteDecimals);
        const quantity = 2 * (10 ** baseDecimals);

        const totalPrice = buyPrice * (quantity / 10 ** baseDecimals);

        // Example to mint and approve tokens for trading
        await baseToken.mint(addr2.address, (quantity));
        await quoteToken.mint(addr1.address, totalPrice);

        let domain = getDomain(TegroDEXContract.target);
        let buyOrder = await placeOrder(baseToken.target, quoteToken.target, true, buyPrice, quantity, addr1);
        let sellOrder = await placeOrder(baseToken.target, quoteToken.target, false, buyPrice, quantity, addr2);
        let buySignature = await signOrder(addr1, buyOrder, domain);
        let sellSignature = await signOrder(addr2, sellOrder, domain);

        await baseToken.connect(addr2).approve(TegroDEXContract.target, ethers.MaxUint256);
        await quoteToken.connect(addr1).approve(TegroDEXContract.target, ethers.MaxUint256);
        const receipt = await (TegroDEXContract.settleOrders(buyOrder, buySignature, sellOrder, sellSignature, quantity));

        const updatedBaseTokenBalance = await baseToken.balanceOf(addr1.address);
        const updatedQuoteTokenBalance = await quoteToken.balanceOf(addr2.address);
        const baseFeeBalance = await baseToken.balanceOf(owner.address);
        const quoteFeeBalance = await quoteToken.balanceOf(owner.address);
        expect(updatedBaseTokenBalance).to.equal(Math.round(quantity - (quantity * (feeBps / 10000))));
        expect(updatedQuoteTokenBalance).to.equal(Math.round(totalPrice - (totalPrice * (feeBps / 10000))));
        expect(baseFeeBalance).to.equal(Math.round(quantity * (feeBps / 10000)));
        expect(quoteFeeBalance).to.equal(Math.round(totalPrice * (feeBps / 10000)));
    });

    it("should settle partial fill orders correctly", async function () {
        const buyPrice = 1 * (10 ** quoteDecimals);
        const quantity = 2 * (10 ** baseDecimals);

        const totalPrice = buyPrice * (quantity / 10 ** baseDecimals);

        // Example to mint and approve tokens for trading
        await baseToken.mint(addr2.address, (quantity));
        await quoteToken.mint(addr1.address, totalPrice);

        let domain = getDomain(TegroDEXContract.target);
        let buyOrder = await placeOrder(baseToken.target, quoteToken.target, true, buyPrice, quantity, addr1);
        let sellOrder = await placeOrder(baseToken.target, quoteToken.target, false, buyPrice, quantity/2, addr2);
        let sellOrder2 = await placeOrder(baseToken.target, quoteToken.target, false, buyPrice, quantity/2, addr2);
        let buySignature = await signOrder(addr1, buyOrder, domain);
        let sellSignature = await signOrder(addr2, sellOrder, domain);
        let sellSignature2 = await signOrder(addr2, sellOrder2, domain);

        await baseToken.connect(addr2).approve(TegroDEXContract.target, ethers.MaxUint256);
        await quoteToken.connect(addr1).approve(TegroDEXContract.target, ethers.MaxUint256);
        const receipt = await (TegroDEXContract.settleOrders(buyOrder, buySignature, sellOrder, sellSignature, quantity/2));
        const receipt2 = await (TegroDEXContract.settleOrders(buyOrder, buySignature, sellOrder2, sellSignature2, quantity/2));
        
        const updatedBaseTokenBalance = await baseToken.balanceOf(addr1.address);
        const updatedQuoteTokenBalance = await quoteToken.balanceOf(addr2.address);
        const baseFeeBalance = await baseToken.balanceOf(owner.address);
        const quoteFeeBalance = await quoteToken.balanceOf(owner.address);
        expect(updatedBaseTokenBalance).to.equal(Math.round(quantity - (quantity * (feeBps / 10000))));
        expect(updatedQuoteTokenBalance).to.equal(Math.round(totalPrice - (totalPrice * (feeBps / 10000))));
        expect(baseFeeBalance).to.equal(Math.round(quantity * (feeBps / 10000)));
        expect(quoteFeeBalance).to.equal(Math.round(totalPrice * (feeBps / 10000)));
    });

    it("should reject settlement with non-matching base/quote tokens", async function () {
        const buyPrice = 1 * (10 ** quoteDecimals);
        const quantity = 2 * (10 ** baseDecimals);

        // Create buy and sell orders with different base or quote tokens
        let buyOrder = await placeOrder(baseToken.target, quoteToken.target, true, buyPrice, quantity, addr1);
        let sellOrder = await placeOrder(quoteToken.target, baseToken.target, false, buyPrice, quantity, addr2);
        let domain = getDomain(TegroDEXContract.target);
        let buySignature = await signOrder(addr1, buyOrder, domain);
        let sellSignature = await signOrder(addr2, sellOrder, domain);

        // Expect the settlement to fail due to non-matching tokens
        await expect(TegroDEXContract.settleOrders(buyOrder, buySignature, sellOrder, sellSignature, quantity)).to.be.revertedWith("Base/Quote tokens do not match");
    });

    // it("should allow makers to cancel their orders", async function () {
    //     const buyPrice = 1 * (10 ** quoteDecimals);
    //     const quantity = 2 * (10 ** baseDecimals);

    //     let buyOrder = await placeOrder(baseToken.target, quoteToken.target, true, buyPrice, quantity, addr1);
    //     let domain = getDomain(TegroDEXContract.target);
    //     let signature = await signOrder(addr1, buyOrder, domain);
    //     let orderHash = await TegroDEXContract.hashOrder(buyOrder);
    //     let signed_message = "cancel " + orderHash;
    //     let cancelHash = ethers.hashMessage(signed_message);
    //     let cancelSignature = await addr1.signMessage(cancelHash);

    //     await TegroDEXContract.cancelOrder(buyOrder, cancelSignature);

    //     let sellOrder = await placeOrder(baseToken.target, quoteToken.target, false, buyPrice, quantity, addr2);
    //     let sellSignature = await signOrder(addr2, sellOrder, domain);
    //     await expect(TegroDEXContract.settleOrders(buyOrder, signature, sellOrder, sellSignature)).to.be.revertedWith("Order already filled or does not exist");
    // });

    it("should reject orders with wrong signatures", async function () {
        const buyPrice = 1 * (10 ** quoteDecimals);
        const quantity = 2 * (10 ** baseDecimals);

        // Create buy and sell orders with different base or quote tokens
        let buyOrder = await placeOrder(baseToken.target, quoteToken.target, true, buyPrice, quantity, addr1);
        let sellOrder = await placeOrder(baseToken.target, quoteToken.target, false, buyPrice, quantity, addr2);

        // Sign the buy order with addr1 and the sell order with addr2
        let domain = getDomain(TegroDEXContract.target);
        let buySignature = await signOrder(addr2, buyOrder, domain);
        let sellSignature = await signOrder(addr1, sellOrder, domain);

        // Attempt to settle orders with the tampered signature
        await expect(TegroDEXContract.settleOrders(buyOrder, buySignature, sellOrder, sellSignature, quantity)).to.be.revertedWith("Invalid order signatures");
    });

    it("should reject settlement when both orders are of the same type", async function () {
        const buyPrice = 1 * (10 ** quoteDecimals);
        const quantity = 2 * (10 ** baseDecimals);

        // Create buy and sell orders with different base or quote tokens
        let buyOrder1 = await placeOrder(baseToken.target, quoteToken.target, true, buyPrice, quantity, addr1);
        let buyOrder2 = await placeOrder(baseToken.target, quoteToken.target, true, buyPrice, quantity, addr2);

        // Sign both orders
        let domain = getDomain(TegroDEXContract.target);
        let buySignature1 = await signOrder(addr1, buyOrder1, domain);
        let buySignature2 = await signOrder(addr2, buyOrder2, domain);

        // Attempt to settle both buy orders
        await expect(TegroDEXContract.settleOrders(buyOrder1, buySignature1, buyOrder2, buySignature2, quantity)).to.be.revertedWith("Both orders cannot be of the same type (buy/sell)");
    });

    it("should prevent refilling an already filled order", async function () {
        const buyPrice = 1 * (10 ** quoteDecimals);
        const quantity = 2 * (10 ** baseDecimals);

        const totalPrice = buyPrice * (quantity / 10 ** baseDecimals);

        // Example to mint and approve tokens for trading
        await baseToken.mint(addr2.address, (quantity));
        await quoteToken.mint(addr1.address, totalPrice);

        let buyOrder = await placeOrder(baseToken.target, quoteToken.target, true, buyPrice, quantity, addr1);
        let sellOrder = await placeOrder(baseToken.target, quoteToken.target, false, buyPrice, quantity, addr2);

        await baseToken.connect(addr2).approve(TegroDEXContract.target, ethers.MaxUint256);
        await quoteToken.connect(addr1).approve(TegroDEXContract.target, ethers.MaxUint256);

        // Sign the orders
        let domain = getDomain(TegroDEXContract.target);
        let buySignature = await signOrder(addr1, buyOrder, domain);
        let sellSignature = await signOrder(addr2, sellOrder, domain);

        // Settle the orders for the first time
        await TegroDEXContract.settleOrders(buyOrder, buySignature, sellOrder, sellSignature, quantity);

        // Attempt to settle the same orders again
        await expect(TegroDEXContract.settleOrders(buyOrder, buySignature, sellOrder, sellSignature, quantity)).to.be.revertedWith("Matched amount is greater than the remaining amount");

        // Additional assertions can be added here if needed, e.g., checking balances to ensure they haven't changed after the failed attempt
    });

    it("should prevent refilling an already filled order from a new order", async function () {
        const buyPrice = 1 * (10 ** quoteDecimals);
        const quantity = 2 * (10 ** baseDecimals);

        const totalPrice = buyPrice * (quantity / 10 ** baseDecimals);

        // Example to mint and approve tokens for trading
        await baseToken.mint(addr2.address, (quantity));
        await quoteToken.mint(addr1.address, totalPrice);

        let buyOrder = await placeOrder(baseToken.target, quoteToken.target, true, buyPrice, quantity, addr1);
        let sellOrder = await placeOrder(baseToken.target, quoteToken.target, false, buyPrice, quantity, addr2);

        await baseToken.connect(addr2).approve(TegroDEXContract.target, ethers.MaxUint256);
        await quoteToken.connect(addr1).approve(TegroDEXContract.target, ethers.MaxUint256);

        // Sign the orders
        let domain = getDomain(TegroDEXContract.target);
        let buySignature = await signOrder(addr1, buyOrder, domain);
        let sellSignature = await signOrder(addr2, sellOrder, domain);

        // Settle the orders for the first time
        await TegroDEXContract.settleOrders(buyOrder, buySignature, sellOrder, sellSignature, quantity);

        let sellOrder2 = await placeOrder(baseToken.target, quoteToken.target, false, buyPrice, quantity, addr2);
        let sellSignature2 = await signOrder(addr2, sellOrder2, domain);
        // Example to mint and approve tokens for trading
        await baseToken.mint(addr2.address, (quantity));
        await quoteToken.mint(addr1.address, totalPrice);


        // Attempt to settle the same orders again
        await expect(TegroDEXContract.settleOrders(buyOrder, buySignature, sellOrder2, sellSignature2, quantity)).to.be.revertedWith("Matched amount is greater than the remaining amount");

        // Additional assertions can be added here if needed, e.g., checking balances to ensure they haven't changed after the failed attempt
    });
});
