import { ethers } from "hardhat";
import { expect } from "chai";
import { deployContracts, advanceTimeAndBlock, CONSTANTS } from "./00-setup.test";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("FomoDoge 奖励提取测试", function () {
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
    
    // 准备一些推荐奖励和FOMO奖励供测试
    // 1. 让买家购买NFT并使用推荐人
    const buyer1 = buyers[0];
    const buyer2 = buyers[1];
    const referrer1 = referrers[0];
    
    // buyer1购买NFT并指定referrer1为推荐人
    const price1 = await fomodoge.getBuyPrice(5);
    await fomodoge.connect(buyer1).buy(5, 0, referrer1.address, { value: price1 });
    
    // buyer2购买NFT并指定referrer1为推荐人
    const price2 = await fomodoge.getBuyPrice(3);
    await fomodoge.connect(buyer2).buy(3, 0, referrer1.address, { value: price2 });
  });

  it("应该允许提取推荐奖励", async function () {
    const referrer = referrers[0];
    
    // 获取推荐人的奖励余额
    const referrerInfo = await fomodoge.usrInfo(referrer.address);
    expect(referrerInfo.usrBalance).to.be.gt(0);
    
    // 获取提取前的ETH余额
    const balanceBefore = await ethers.provider.getBalance(referrer.address);
    
    // 执行提取操作
    const withdrawTx = await fomodoge.connect(referrer).withdraw();
    const receipt = await withdrawTx.wait();
    const gasUsed = receipt.gasUsed.mul(receipt.effectiveGasPrice);
    
    // 获取提取后的ETH余额
    const balanceAfter = await ethers.provider.getBalance(referrer.address);
    
    // 计算预期的余额增加（减去gas费用）
    const expectedIncrease = referrerInfo.usrBalance.sub(gasUsed);
    
    // 验证余额增加了预期的金额
    expect(balanceAfter.sub(balanceBefore)).to.be.closeTo(
      expectedIncrease,
      ethers.utils.parseEther("0.0001") // 允许小误差
    );
    
    // 验证用户余额已清零
    const referrerInfoAfter = await fomodoge.usrInfo(referrer.address);
    expect(referrerInfoAfter.usrBalance).to.equal(0);
  });

  it("应该允许提取FOMO奖励", async function () {
    // 创建FOMO周期并触发奖励分配
    const fomoBuyers = buyers.slice(0, 5);
    
    // 每个买家购买NFT
    for (let i = 0; i < fomoBuyers.length; i++) {
      const buyer = fomoBuyers[i];
      const price = await fomodoge.getBuyPrice(1);
      await fomodoge.connect(buyer).buy(1, 0, { value: price });
    }
    
    // 快进到FOMO周期结束
    await advanceTimeAndBlock(CONSTANTS.MAX_FOMO_TIME + 1);
    
    // 触发FOMO奖励分配
    const extraBuyer = buyers[5];
    const price = await fomodoge.getBuyPrice(1);
    await fomodoge.connect(extraBuyer).buy(1, 0, { value: price });
    
    // 选择一个FOMO获奖者
    const fomoWinner = fomoBuyers[0];
    
    // 获取可提取余额
    const withdrawableBefore = await fomodoge.usrCanWithdraw(fomoWinner.address);
    expect(withdrawableBefore).to.be.gt(0);
    
    // 获取提取前的ETH余额
    const balanceBefore = await ethers.provider.getBalance(fomoWinner.address);
    
    // 执行提取操作
    const withdrawTx = await fomodoge.connect(fomoWinner).withdraw();
    const receipt = await withdrawTx.wait();
    const gasUsed = receipt.gasUsed.mul(receipt.effectiveGasPrice);
    
    // 获取提取后的ETH余额
    const balanceAfter = await ethers.provider.getBalance(fomoWinner.address);
    
    // 验证余额增加了可提取金额（减去gas费用）
    expect(balanceAfter.sub(balanceBefore)).to.be.closeTo(
      withdrawableBefore.sub(gasUsed),
      ethers.utils.parseEther("0.0001") // 允许小误差
    );
    
    // 验证用户可提取余额已清零
    const withdrawableAfter = await fomodoge.usrCanWithdraw(fomoWinner.address);
    expect(withdrawableAfter).to.equal(0);
  });

  it("应该拒绝无余额可提取的提款请求", async function () {
    // 使用一个没有奖励的账户
    const noRewardBuyer = buyers[buyers.length - 1];
    
    // 确认没有可提取余额
    const withdrawable = await fomodoge.usrCanWithdraw(noRewardBuyer.address);
    expect(withdrawable).to.equal(0);
    
    // 尝试提取（应该被拒绝）
    await expect(
      fomodoge.connect(noRewardBuyer).withdraw()
    ).to.be.revertedWith("No balance");
  });

  it("应该在FOMO周期内正确提取累积的奖励", async function () {
    // 第一步：积累推荐奖励
    const referrer = referrers[0];
    const buyer = buyers[2];
    
    // buyer购买NFT并指定referrer为推荐人
    const price = await fomodoge.getBuyPrice(2);
    await fomodoge.connect(buyer).buy(2, 0, referrer.address, { value: price });
    
    // 记录推荐人的余额
    const referrerBalanceBefore = await fomodoge.usrInfo(referrer.address);
    
    // 获取提取前的ETH余额
    const ethBalanceBefore = await ethers.provider.getBalance(referrer.address);
    
    // 提取当前累积的奖励
    const withdrawTx = await fomodoge.connect(referrer).withdraw();
    const receipt = await withdrawTx.wait();
    const gasUsed = receipt.gasUsed.mul(receipt.effectiveGasPrice);
    
    // 获取提取后的ETH余额
    const ethBalanceAfter = await ethers.provider.getBalance(referrer.address);
    
    // 验证余额增加了预期的金额（减去gas费用）
    expect(ethBalanceAfter.sub(ethBalanceBefore)).to.be.closeTo(
      referrerBalanceBefore.usrBalance.sub(gasUsed),
      ethers.utils.parseEther("0.0001") // 允许小误差
    );
    
    // 第二步：在同一个FOMO周期内再积累一些奖励
    const anotherBuyer = buyers[3];
    const price2 = await fomodoge.getBuyPrice(3);
    await fomodoge.connect(anotherBuyer).buy(3, 0, referrer.address, { value: price2 });
    
    // 记录新的推荐人余额
    const referrerBalanceAfterBuy = await fomodoge.usrInfo(referrer.address);
    expect(referrerBalanceAfterBuy.usrBalance).to.be.gt(0);
    
    // 再次提取奖励
    const ethBalanceBeforeSecond = await ethers.provider.getBalance(referrer.address);
    const withdrawTx2 = await fomodoge.connect(referrer).withdraw();
    const receipt2 = await withdrawTx2.wait();
    const gasUsed2 = receipt2.gasUsed.mul(receipt2.effectiveGasPrice);
    const ethBalanceAfterSecond = await ethers.provider.getBalance(referrer.address);
    
    // 验证第二次提款后的余额变化
    expect(ethBalanceAfterSecond.sub(ethBalanceBeforeSecond)).to.be.closeTo(
      referrerBalanceAfterBuy.usrBalance.sub(gasUsed2),
      ethers.utils.parseEther("0.0001") // 允许小误差
    );
  });

  it("应该在多个FOMO周期间正确提取奖励", async function () {
    // 第一个FOMO周期
    const buyer = buyers[0];
    const fomoWinners = buyers.slice(1, 6);
    
    // 让fomoWinners每人购买NFT
    for (const winner of fomoWinners) {
      const price = await fomodoge.getBuyPrice(1);
      await fomodoge.connect(winner).buy(1, 0, { value: price });
    }
    
    // 快进到第一个FOMO周期结束
    await advanceTimeAndBlock(CONSTANTS.MAX_FOMO_TIME + 1);
    
    // 触发第一个FOMO周期奖励分配
    const price = await fomodoge.getBuyPrice(1);
    await fomodoge.connect(buyer).buy(1, 0, { value: price });
    
    // 选一个FOMO获奖者提取奖励
    const firstWinner = fomoWinners[0];
    
    // 记录可提取余额
    const withdrawableBefore = await fomodoge.usrCanWithdraw(firstWinner.address);
    
    // 提取奖励
    await fomodoge.connect(firstWinner).withdraw();
    
    // 第二个FOMO周期
    const secondWinners = buyers.slice(6, 11);
    
    // 让secondWinners每人购买NFT
    for (const winner of secondWinners) {
      const price = await fomodoge.getBuyPrice(1);
      await fomodoge.connect(winner).buy(1, 0, { value: price });
    }
    
    // 快进到第二个FOMO周期结束
    await advanceTimeAndBlock(CONSTANTS.MAX_FOMO_TIME + 1);
    
    // 触发第二个FOMO周期奖励分配
    await fomodoge.connect(buyer).buy(1, 0, { value: price });
    
    // firstWinner从第一个FOMO周期已提取过奖励
    // 但作为NFT持有者在第二个周期也应有奖励
    
    // 获取新的可提取余额
    const withdrawableAfter = await fomodoge.usrCanWithdraw(firstWinner.address);
    
    // 验证可提取余额是新周期的奖励
    expect(withdrawableAfter).to.be.gt(0);
    
    // 提取第二个周期的奖励
    const ethBalanceBefore = await ethers.provider.getBalance(firstWinner.address);
    const withdrawTx = await fomodoge.connect(firstWinner).withdraw();
    const receipt = await withdrawTx.wait();
    const gasUsed = receipt.gasUsed.mul(receipt.effectiveGasPrice);
    const ethBalanceAfter = await ethers.provider.getBalance(firstWinner.address);
    
    // 验证余额变化
    expect(ethBalanceAfter.sub(ethBalanceBefore)).to.be.closeTo(
      withdrawableAfter.sub(gasUsed),
      ethers.utils.parseEther("0.0001") // 允许小误差
    );
  });
}); 