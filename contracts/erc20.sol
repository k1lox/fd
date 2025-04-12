// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

// 奖励代币合约
contract RewardToken is ERC20 {
    constructor(string memory name, string memory symbol, uint256 initialSupply) ERC20(name, symbol) {
        // 铸造初始供应量给部署者
        _mint(msg.sender, initialSupply);
    }
}