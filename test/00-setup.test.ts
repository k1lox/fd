import { ethers, network } from "hardhat";
import { expect } from "chai";
import { FomoDoge, MockERC20 } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";

// 导出可在所有测试文件中使用的工具函数和变量
export const CONSTANTS = {
  START_PRICE: ethers.parseEther("0.001"),
  PRICE_STEP: ethers.parseEther("0.00008"),
  TWENTY_OFF_LOCK_TIME: 20 * 24 * 60 * 60, // 20天，单位秒
  FIFTY_OFF_LOCK_TIME: 50 * 24 * 60 * 60,  // 50天，单位秒
  SEVENTY_OFF_LOCK_TIME: 80 * 24 * 60 * 60, // 80天，单位秒
  FOMO_TIME_FOR_EACH_NFT: 5 * 60,          // 5分钟，单位秒
  MAX_FOMO_TIME: 24 * 60 * 60,             // 24小时，单位秒
  INVITER_SHARE: 2,                        // 2%
  PROTOCOL_SHARE: 1,                       // 1%
  FOMO_SHARE: 10,                          // 10%
  SELL_SHARE: 95,                          // 95%
  FOMO_WINNER_SHARE: 10,                   // 10%
  FOMO_ALL_SHARE: 50,                      // 50%
}

// 高级工具函数
export const advanceTimeAndBlock = async (seconds: number) => {
  await time.increase(seconds);
  await ethers.provider.send("evm_mine", []);
};

export const deployContracts = async () => {
  const [owner, ...accounts] = await ethers.getSigners();
  
  // 部署FomoDoge合约
  const FomoDogeFactory = await ethers.getContractFactory("FomoDoge");
  const fomodoge = await FomoDogeFactory.deploy();
  await fomodoge.waitForDeployment();
  
  // 部署MockERC20合约用于质押奖励
  const MockERC20Factory = await ethers.getContractFactory("MockERC20");
  const mockERC20 = await MockERC20Factory.deploy("RewardToken", "RWD", 18);
  await mockERC20.waitForDeployment();
  
  // 设置ERC20代币地址
  await fomodoge.setErc20Token(await mockERC20.getAddress());
  
  // 为质押池准备奖励代币
  const mintAmount = ethers.parseEther("100000");
  await mockERC20.mint(owner.address, mintAmount);
  await mockERC20.approve(await fomodoge.getAddress(), mintAmount);
  
  return { 
    fomodoge, 
    mockERC20, 
    owner, 
    accounts,
    buyers: accounts.slice(0, 5),         // 5个买家账户
    referrers: accounts.slice(5, 7),      // 2个推荐人账户
    otherUsers: accounts.slice(7)         // 其他账户
  };
};

// 这是一个示例测试，确保环境正确设置
describe("FomoDoge Setup", function () {
  it("Should deploy contracts successfully", async function () {
    const { fomodoge, mockERC20, owner } = await deployContracts();
    
    // 验证合约部署成功
    expect(await fomodoge.getAddress()).to.be.properAddress;
    expect(await mockERC20.getAddress()).to.be.properAddress;
    
    // 验证ERC20代币设置正确
    expect(await fomodoge.erc20Token()).to.equal(await mockERC20.getAddress());
    
    console.log("FomoDoge deployed to:", await fomodoge.getAddress());
    console.log("MockERC20 deployed to:", await mockERC20.getAddress());
  });
}); 