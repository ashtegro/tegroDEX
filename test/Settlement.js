const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("TegroDEX", function () {
    let Token, baseToken, quoteToken;
    let TegroDEX, TegroDEXContract;
    let owner, addr1, addr2;
    let network;
    const baseDecimals = 2;
    const quoteDecimals = 4;


    beforeEach(async function () {
        // Deploy an ERC20 token for testing
        Token = await ethers.getContractFactory("TokenFactory");
        baseToken = await Token.deploy("BaseToken", "BASE", baseDecimals);
        quoteToken = await Token.deploy("QuoteToken", "QUOTE", quoteDecimals);

        // Deploy the TegroDEX contract
        TegroDEX = await ethers.getContractFactory("TegroDEX");
        [owner, addr1, addr2] = await ethers.getSigners();
        TegroDEXContract = await TegroDEX.deploy();
        TegroDEXContract.initialize(owner.address, 100);
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


    it("should settle orders correctly", async function () {
        const buyPrice = 1 * (10 ** quoteDecimals);
        const quantity = 5 * (10 ** baseDecimals);

        const totalPrice = buyPrice * (quantity / 10 ** baseDecimals);
        console.log("Buy price is: " + buyPrice);
        console.log("Total price is: " + totalPrice);

        // Example to mint and approve tokens for trading
        await baseToken.mint(addr2.address, (quantity));
        await quoteToken.mint(addr1.address, totalPrice);

        let domain = getDomain(TegroDEXContract.target);
        // Assuming you have functions to create and sign orders
        // This is pseudocode to demonstrate the idea
        let buyOrder = await placeOrder(baseToken.target, quoteToken.target, true, buyPrice, quantity, addr1);
        let sellOrder = await placeOrder(baseToken.target, quoteToken.target, false, buyPrice, quantity, addr2);
        let buySignature = await signOrder(addr1, buyOrder, domain);
        let sellSignature = await signOrder(addr2, sellOrder, domain);

        console.log("Address 1. Base Token balance:" + await baseToken.balanceOf(addr1.address) + " Quote Token balance:" + await quoteToken.balanceOf(addr1.address));
        console.log("Address 2. Base Token balance:" + await baseToken.balanceOf(addr2.address) + " Quote Token balance:" + await quoteToken.balanceOf(addr2.address));
        // Approve the TegroDEX contract to spend tokens
        await baseToken.connect(addr2).approve(TegroDEXContract.target, ethers.MaxUint256);
        await quoteToken.connect(addr1).approve(TegroDEXContract.target, ethers.MaxUint256);
        //console.log(buyOrder, buySignature, sellOrder, sellSignature);  
        const receipt = await (TegroDEXContract.settleOrders(buyOrder, buySignature, sellOrder, sellSignature));

        // Check final token balances
        console.log("Address 1. Base Token balance:" + await baseToken.balanceOf(addr1.address) + " Quote Token balance:" + await quoteToken.balanceOf(addr1.address));
        console.log("Address 2. Base Token balance:" + await baseToken.balanceOf(addr2.address) + " Quote Token balance:" + await quoteToken.balanceOf(addr2.address));

        //const updatedBaseTokenBalance = await baseToken.balanceOf(addr1.address);
        //const updatedQuoteTokenBalance = await quoteToken.balanceOf(addr2.address);
        //expect(updatedBaseTokenBalance).to.equal(quantity);
        //expect(updatedQuoteTokenBalance).to.equal(quoteToken);
    });

    // it("should fail to fill orders correctly", async function () {
    //     const buyPrice = 1;
    //     const quantity = 1;
    //     const totalPrice = ((buyPrice * quantity) * (10 ** quoteDecimals));

    //     // Example to mint and approve tokens for trading
    //     await baseToken.mint(addr2.address, (quantity * (10 ** baseDecimals)).toString());
    //     await quoteToken.mint(addr1.address, 1);

    //     let domain = getDomain(TegroDEXContract.target);
    //     // Assuming you have functions to create and sign orders
    //     // This is pseudocode to demonstrate the idea
    //     let buyOrder = await placeOrder(baseToken.target, quoteToken.target, true, (buyPrice * (10 ** quoteDecimals)), (quantity * (10 ** baseDecimals)), addr1);
    //     let sellOrder = await placeOrder(quoteToken.target, quoteToken.target, false, (buyPrice * (10 ** quoteDecimals)), (quantity * (10 ** baseDecimals)), addr2);
    //     let buySignature = await signOrder(addr1, buyOrder, domain);
    //     let sellSignature = await signOrder(addr2, sellOrder, domain);

    //     console.log("Address 1. Base Token balance:" + await baseToken.balanceOf(addr1.address) + " Quote Token balance:" + await quoteToken.balanceOf(addr1.address));
    //     console.log("Address 2. Base Token balance:" + await baseToken.balanceOf(addr2.address) + " Quote Token balance:" + await quoteToken.balanceOf(addr2.address));
    //     // Approve the TegroDEX contract to spend tokens
    //     await baseToken.connect(addr2).approve(TegroDEXContract.target, ethers.MaxUint256);
    //     await quoteToken.connect(addr1).approve(TegroDEXContract.target, ethers.MaxUint256);

    //     const receipt = await (TegroDEXContract.settleOrders(buyOrder, buySignature, sellOrder, sellSignature));

    //     // Check final token balances
    //     console.log("Address 1. Base Token balance:" + await baseToken.balanceOf(addr1.address) + " Quote Token balance:" + await quoteToken.balanceOf(addr1.address));
    //     console.log("Address 2. Base Token balance:" + await baseToken.balanceOf(addr2.address) + " Quote Token balance:" + await quoteToken.balanceOf(addr2.address));
    //     //expect(await baseToken.balanceOf(addr2.target)).to.equal(ethers.parseEther("10"));
    //     //expect(await quoteToken.balanceOf(addr1.target)).to.equal(ethers.parseUnits("1000", 6));
    // });
});
