// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract TokenFactory is ERC20, Ownable {
    uint8 tokenDecimals;

    constructor(
        string memory _tokenName,
        string memory _tokenSymbol,
        uint8 _decimals
    ) ERC20(_tokenName, _tokenSymbol) Ownable(msg.sender) {
        tokenDecimals = _decimals;
    }

    function decimals() public view virtual override returns (uint8) {
        return tokenDecimals;
    }


    function mint(address to, uint256 amount) public onlyOwner {
        _mint(to, amount);
    }
}
