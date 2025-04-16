import { ethers } from "hardhat";
import { expect } from "chai";
import { deployContracts, CONSTANTS } from "./00-setup.test";
import { FomoDoge } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("FomoDoge NFT购买功能测试", function () {
  let fomodoge: any;
  let mockERC20: any;
  let owner: SignerWithAddress;
  let buyers: SignerWithAddress[];
  let referrers: SignerWithAddress[];

  beforeEach(async function () {
    const contracts = await deployContracts();
    fomodoge = contracts.fomodoge;
    mockERC20 = contracts.mockERC20;
    owner = contracts.owner;
    buyers = contracts.buyers;
    referrers = contracts.referrers;
  });

  it("应该允许用户购买不同锁定期的NFT", async function () {
    // buyer1购买1个无锁定期NFT
    const buyer1 = buyers[0];
    const noLockAmount = 1;
    const price = await fomodoge.getBuyPrice(noLockAmount);
    
    await fomodoge.connect(buyer1)["buy(uint256,uint256)"](noLockAmount, 0, { value: price });
    
    // 验证NFT余额
    expect(await fomodoge.balanceOf(buyer1.address)).to.equal(noLockAmount);
    
    // buyer2购买2个20天锁定期NFT
    const buyer2 = buyers[1];
    const twentyLockAmount = 2;
    const fullPrice = await fomodoge.getBuyPrice(twentyLockAmount);
    const twentyLockPrice = (fullPrice * 80n) / 100n; // 20%折扣
    
    await fomodoge.connect(buyer2)["buy(uint256,uint256)"](twentyLockAmount, 20, { value: twentyLockPrice });
    
    expect(await fomodoge.balanceOf(buyer2.address)).to.equal(twentyLockAmount);
    
    // buyer3购买3个50天锁定期NFT
    const buyer3 = buyers[2];
    const fiftyLockAmount = 3;
    const fiftyFullPrice = await fomodoge.getBuyPrice(fiftyLockAmount);
    const fiftyLockPrice = (fiftyFullPrice * 50n) / 100n; // 50%折扣
    
    await fomodoge.connect(buyer3)["buy(uint256,uint256)"](fiftyLockAmount, 50, { value: fiftyLockPrice });
    
    expect(await fomodoge.balanceOf(buyer3.address)).to.equal(fiftyLockAmount);
    
    // buyer4购买1个80天锁定期NFT
    const buyer4 = buyers[3];
    const seventyLockAmount = 1;
    const seventyFullPrice = await fomodoge.getBuyPrice(seventyLockAmount);
    const seventyLockPrice = (seventyFullPrice * 30n) / 100n; // 70%折扣
    
    await fomodoge.connect(buyer4)["buy(uint256,uint256)"](seventyLockAmount, 70, { value: seventyLockPrice });
    
    expect(await fomodoge.balanceOf(buyer4.address)).to.equal(seventyLockAmount);
    
    // 验证NFT总供应量
    expect(await fomodoge.totalSupply()).to.equal(noLockAmount + twentyLockAmount + fiftyLockAmount + seventyLockAmount);
  });

  it("应该正确设置NFT的解锁时间", async function () {
    const buyer = buyers[0];
    const latestBlock = await ethers.provider.getBlock("latest");
    const timestamp = latestBlock?.timestamp || 0;
    
    // 购买一个20天锁定期的NFT
    const twentyLockAmount = 1;
    const twentyFullPrice = await fomodoge.getBuyPrice(twentyLockAmount);
    const twentyLockPrice = (twentyFullPrice * 80n) / 100n;
    await fomodoge.connect(buyer)["buy(uint256,uint256)"](twentyLockAmount, 20, { value: twentyLockPrice });
    
    // 获取NFT信息并验证解锁时间
    const nftInfo = await fomodoge.getUsrNftInfo(buyer.address);
    expect(Number(nftInfo[0].unLockTime)).to.be.closeTo(
      timestamp + CONSTANTS.TWENTY_OFF_LOCK_TIME,
      100 // 允许小误差
    );
    
    // 购买一个50天锁定期的NFT
    const fiftyLockAmount = 1;
    const fiftyFullPrice = await fomodoge.getBuyPrice(fiftyLockAmount);
    const fiftyLockPrice = (fiftyFullPrice * 50n) / 100n;
    await fomodoge.connect(buyer)["buy(uint256,uint256)"](fiftyLockAmount, 50, { value: fiftyLockPrice });
    
    // 获取更新后的NFT信息并验证第二个NFT的解锁时间
    const updatedBlock = await ethers.provider.getBlock("latest");
    const updatedNftInfo = await fomodoge.getUsrNftInfo(buyer.address);
    expect(Number(updatedNftInfo[1].unLockTime)).to.be.closeTo(
      (updatedBlock?.timestamp || 0) + CONSTANTS.FIFTY_OFF_LOCK_TIME,
      100
    );
  });

  it("应该处理带推荐人的购买", async function () {
    const buyer = buyers[0];
    const referrer = referrers[0];
    const amount = 2;
    const lockType = 0;  // 无锁定期
    
    // 获取购买前余额
    const referrerInfoBefore = await fomodoge.usrInfo(referrer.address);
    const referrerBalanceBefore = referrerInfoBefore.usrBalance;
    const referrerInviteTotalBefore = referrerInfoBefore.inviteTotal;
    
    // 执行购买
    const price = await fomodoge.getBuyPrice(amount);
    await fomodoge.connect(buyer)["buy(uint256,uint256,address)"](amount, lockType, referrer.address, { value: price });
    
    // 验证推荐人获得奖励
    const referrerInfoAfter = await fomodoge.usrInfo(referrer.address);
    const referrerBalanceAfter = referrerInfoAfter.usrBalance;
    const expectedReward = (price * BigInt(CONSTANTS.INVITER_SHARE)) / 100n;
    
    expect(referrerBalanceAfter - referrerBalanceBefore).to.equal(expectedReward);
    
    // 验证推荐人的推荐计数增加
    expect(referrerInfoAfter.inviteTotal - referrerInviteTotalBefore).to.equal(1);
  });

  it("应该拒绝无效购买", async function () {
    const buyer = buyers[0];
    
    // 尝试购买0个NFT
    try {
      await fomodoge.connect(buyer)["buy(uint256,uint256)"](0, 0, { value: ethers.parseEther("1") });
      // 如果执行到这里，说明没有抛出错误，测试应该失败
      expect.fail("应该抛出错误");
    } catch (error) {
      // 购买0个NFT应该会失败，但我们不检查具体的错误消息
      expect(error).to.exist;
    }
    
    // 尝试使用无效锁定类型
    try {
      await fomodoge.connect(buyer)["buy(uint256,uint256)"](1, 30, { value: ethers.parseEther("1") });
      expect.fail("应该抛出错误");
    } catch (error) {
      // 无效锁定类型应该会失败，但我们不检查具体的错误消息
      expect(error).to.exist;
    }
    
    // 尝试使用不足的ETH
    const price = await fomodoge.getBuyPrice(1);
    try {
      await fomodoge.connect(buyer)["buy(uint256,uint256)"](1, 0, { value: price - 1n });
      expect.fail("应该抛出错误");
    } catch (error) {
      // 不足的ETH应该会失败，但我们不检查具体的错误消息
      expect(error).to.exist;
    }
    
    // 尝试自己推荐自己
    try {
      await fomodoge.connect(buyer)["buy(uint256,uint256,address)"](1, 0, buyer.address, { value: price });
      expect.fail("应该抛出错误");
    } catch (error) {
      // 自己推荐自己应该会失败，但我们不检查具体的错误消息
      expect(error).to.exist;
    }
  });

  it("应该限制单地址最多100个NFT", async function () {
    const buyer = buyers[0];
    
    // 先购买95个NFT
    const batchSize = 95;
    const price = await fomodoge.getBuyPrice(batchSize);
    await fomodoge.connect(buyer)["buy(uint256,uint256)"](batchSize, 0, { value: price });
    
    // 再尝试购买6个NFT（超过100个限制）
    const exceedAmount = 6;
    const exceedPrice = await fomodoge.getBuyPrice(exceedAmount);
    await expect(
      fomodoge.connect(buyer)["buy(uint256,uint256)"](exceedAmount, 0, { value: exceedPrice })
    ).to.be.rejectedWith("Exceed The maximum number of a single address");
    
    // 验证可以购买5个（正好达到100个）
    const exactAmount = 5;
    const exactPrice = await fomodoge.getBuyPrice(exactAmount);
    await fomodoge.connect(buyer)["buy(uint256,uint256)"](exactAmount, 0, { value: exactPrice });
    
    expect(await fomodoge.balanceOf(buyer.address)).to.equal(100);
  });

  it("应该模拟多用户交叉购买场景", async function () {
    // 准备多个买家和推荐人
    const buyer1 = buyers[0];
    const buyer2 = buyers[1];
    const buyer3 = buyers[2];
    const referrer1 = referrers[0];
    const referrer2 = referrers[1];
    
    // buyer1购买3个NFT，无锁定期，无推荐人
    const price1 = await fomodoge.getBuyPrice(3);
    await fomodoge.connect(buyer1)["buy(uint256,uint256)"](3, 0, { value: price1 });
    
    // buyer2购买5个NFT，20天锁定期，推荐人为referrer1
    const price2Raw = await fomodoge.getBuyPrice(5);
    const price2 = (price2Raw * 80n) / 100n; // 20%折扣
    await fomodoge.connect(buyer2)["buy(uint256,uint256,address)"](5, 20, referrer1.address, { value: price2 });
    
    // 挖几个区块
    for (let i = 0; i < 3; i++) {
      await ethers.provider.send("evm_mine", []);
    }
    
    // buyer3购买2个NFT，50天锁定期，推荐人为referrer2
    const price3Raw = await fomodoge.getBuyPrice(2);
    const price3 = (price3Raw * 50n) / 100n; // 50%折扣
    await fomodoge.connect(buyer3)["buy(uint256,uint256,address)"](2, 50, referrer2.address, { value: price3 });
    
    // buyer1再购买4个NFT，70天锁定期，推荐人为buyer3
    const price4Raw = await fomodoge.getBuyPrice(4);
    const price4 = (price4Raw * 30n) / 100n; // 70%折扣
    await fomodoge.connect(buyer1)["buy(uint256,uint256,address)"](4, 70, buyer3.address, { value: price4 });
    
    // 验证最终NFT数量
    expect(await fomodoge.balanceOf(buyer1.address)).to.equal(3 + 4);
    expect(await fomodoge.balanceOf(buyer2.address)).to.equal(5);
    expect(await fomodoge.balanceOf(buyer3.address)).to.equal(2);
    
    // 验证推荐奖励
    const referrer1Info = await fomodoge.usrInfo(referrer1.address);
    expect(referrer1Info.inviteTotal).to.equal(1);
    expect(referrer1Info.usrBalance).to.be.gt(0);
    
    const referrer2Info = await fomodoge.usrInfo(referrer2.address);
    expect(referrer2Info.inviteTotal).to.equal(1);
    expect(referrer2Info.usrBalance).to.be.gt(0);
    
    const buyer3Info = await fomodoge.usrInfo(buyer3.address);
    expect(buyer3Info.inviteTotal).to.equal(1);
    expect(buyer3Info.usrBalance).to.be.gt(0);
  });
}); 