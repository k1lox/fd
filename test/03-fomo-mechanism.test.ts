import { ethers } from "hardhat";
import { expect } from "chai";
import { deployContracts, advanceTimeAndBlock, CONSTANTS } from "./00-setup.test";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("FomoDoge FOMO机制测试", function () {
  let fomodoge: any;
  let mockERC20: any;
  let owner: SignerWithAddress;
  let buyers: SignerWithAddress[];

  beforeEach(async function () {
    const contracts = await deployContracts();
    fomodoge = contracts.fomodoge;
    mockERC20 = contracts.mockERC20;
    owner = contracts.owner;
    buyers = contracts.buyers;
  });

  it("应该在NFT购买时延长FOMO周期", async function () {
    const buyer = buyers[0];
    
    // 获取初始FOMO结束时间
    const initialFomoInfo = await fomodoge.fomoInfo();
    const initialEndTime = initialFomoInfo.endTime;
    
    // 购买1个NFT
    const amount = 1;
    const price = await fomodoge.getBuyPrice(amount);
    await fomodoge.connect(buyer).buy(amount, 0, { value: price });
    
    // 验证FOMO时间延长了5分钟
    const updatedFomoInfo = await fomodoge.fomoInfo();
    expect(updatedFomoInfo.endTime).to.equal(
      initialEndTime.add(CONSTANTS.FOMO_TIME_FOR_EACH_NFT)
    );
    
    // 购买10个NFT
    const largeAmount = 10;
    const largePrice = await fomodoge.getBuyPrice(largeAmount);
    await fomodoge.connect(buyer).buy(largeAmount, 0, { value: largePrice });
    
    // 验证FOMO时间延长，但不超过24小时上限
    const latestFomoInfo = await fomodoge.fomoInfo();
    
    // 计算预期的结束时间
    const expectedEndTime = Math.min(
      updatedFomoInfo.endTime.add(CONSTANTS.FOMO_TIME_FOR_EACH_NFT.mul(largeAmount)).toNumber(),
      (await ethers.provider.getBlock("latest")).timestamp + CONSTANTS.MAX_FOMO_TIME
    );
    
    expect(latestFomoInfo.endTime).to.be.closeTo(expectedEndTime, 60); // 允许60秒误差
  });

  it("应该正确更新FOMO获奖者队列", async function () {
    // 准备5个不同的买家
    const fomoBuyers = buyers.slice(0, 5);
    
    // 每个买家依次购买NFT
    for (let i = 0; i < fomoBuyers.length; i++) {
      const buyer = fomoBuyers[i];
      const price = await fomodoge.getBuyPrice(1);
      await fomodoge.connect(buyer).buy(1, 0, { value: price });
      
      // 挖一个区块确保交易有序
      await ethers.provider.send("evm_mine", []);
    }
    
    // 获取FOMO信息并验证winners队列
    const fomoInfo = await fomodoge.fomoInfo();
    
    // winners[0]应该是最后一个买家，winners[4]应该是第一个买家
    for (let i = 0; i < fomoBuyers.length; i++) {
      expect(fomoInfo.winners[i]).to.equal(
        fomoBuyers[fomoBuyers.length - 1 - i].address
      );
    }
  });

  it("应该在FOMO周期结束后正确分配奖励", async function () {
    // 准备6个买家
    const fomoBuyers = buyers.slice(0, 6);
    
    // 每个买家购买1个NFT，建立FOMO获奖者队列
    for (let i = 0; i < fomoBuyers.length; i++) {
      const buyer = fomoBuyers[i];
      const price = await fomodoge.getBuyPrice(1);
      await fomodoge.connect(buyer).buy(1, 0, { value: price });
      
      // 挖一个区块确保交易有序
      await ethers.provider.send("evm_mine", []);
    }
    
    // 获取FOMO周期结束前的信息
    const fomoInfoBefore = await fomodoge.fomoInfo();
    const fomoPool = fomoInfoBefore.fomoPool;
    
    // 记录各买家FOMO前的余额
    const balancesBefore: any = {};
    for (let i = 0; i < fomoBuyers.length; i++) {
      const buyer = fomoBuyers[i];
      const usrInfo = await fomodoge.usrInfo(buyer.address);
      balancesBefore[buyer.address] = usrInfo.usrBalance;
    }
    
    // 快进到FOMO周期结束
    await advanceTimeAndBlock(CONSTANTS.MAX_FOMO_TIME + 1);
    
    // 执行一个操作触发FOMO奖励分配
    const lastBuyer = buyers[buyers.length - 1]; // 使用一个未参与FOMO的买家
    const price = await fomodoge.getBuyPrice(1);
    await fomodoge.connect(lastBuyer).buy(1, 0, { value: price });
    
    // 获取FOMO奖励分配后的信息
    const fomoInfoAfter = await fomodoge.fomoInfo();
    
    // 验证FOMO池已为每个NFT计算了份额
    expect(fomoInfoAfter.fomoPoolForEach).to.be.gt(0);
    
    // 验证获奖者获得的奖励
    for (let i = 0; i < 5; i++) {
      const winner = fomoInfoBefore.winners[i];
      const expectedWinnerReward = fomoPool.mul(CONSTANTS.FOMO_WINNER_SHARE).div(500); // 每人2%，共5人
      
      // 通过usrCanWithdraw函数获取可提取余额
      const withdrawableBalance = await fomodoge.usrCanWithdraw(winner);
      const usrInfoBalance = await fomodoge.usrInfo(winner);
      
      // 确认余额增加了预期的金额
      expect(withdrawableBalance.sub(balancesBefore[winner] || 0)).to.be.closeTo(
        expectedWinnerReward,
        expectedWinnerReward.div(100) // 允许1%误差
      );
    }
    
    // 计算每个NFT持有者应获得的奖励
    const fomoAllPoolShare = fomoPool.mul(CONSTANTS.FOMO_ALL_SHARE).div(100);
    const totalSupply = await fomodoge.totalSupply();
    const rewardPerNft = fomoAllPoolShare.div(totalSupply);
    
    // 验证NFT持有者按持有比例获得奖励
    for (const buyer of fomoBuyers) {
      const nftBalance = await fomodoge.balanceOf(buyer.address);
      const expectedHolderReward = rewardPerNft.mul(nftBalance);
      
      // 获取该用户可提取余额
      const withdrawableBalance = await fomodoge.usrCanWithdraw(buyer.address);
      
      // 从总可提取余额中减去之前的余额和可能的赢家奖励(如果是前5名买家)
      let winnerBonus = ethers.BigNumber.from(0);
      for (let i = 0; i < 5; i++) {
        if (fomoInfoBefore.winners[i] === buyer.address) {
          winnerBonus = fomoPool.mul(CONSTANTS.FOMO_WINNER_SHARE).div(500);
          break;
        }
      }
      
      const holderReward = withdrawableBalance.sub(balancesBefore[buyer.address] || 0).sub(winnerBonus);
      
      // 验证持有者奖励
      expect(holderReward).to.be.closeTo(
        expectedHolderReward,
        expectedHolderReward.div(100) // 允许1%误差
      );
    }
  });

  it("应该支持连续的FOMO周期", async function () {
    // 第一个FOMO周期
    // 准备买家
    const firstFomoBuyers = buyers.slice(0, 3);
    
    // 每个买家购买NFT
    for (const buyer of firstFomoBuyers) {
      const price = await fomodoge.getBuyPrice(1);
      await fomodoge.connect(buyer).buy(1, 0, { value: price });
    }
    
    // 快进到第一个FOMO周期结束
    await advanceTimeAndBlock(CONSTANTS.MAX_FOMO_TIME + 1);
    
    // 触发FOMO奖励分配
    const triggerBuyer = buyers[3];
    let price = await fomodoge.getBuyPrice(1);
    await fomodoge.connect(triggerBuyer).buy(1, 0, { value: price });
    
    // 验证第一个FOMO周期已结束且奖励已分配
    const fomoInfoAfterFirst = await fomodoge.fomoInfo();
    expect(fomoInfoAfterFirst.fomoPoolForEach).to.be.gt(0);
    
    // 第二个FOMO周期
    // 注意：新的FOMO周期应该在第一个周期结束时自动开始
    
    // 获取第二个FOMO周期的初始信息
    const secondFomoStart = await fomodoge.fomoInfo();
    expect(secondFomoStart.fomoPool).to.equal(0); // 新的FOMO池应该为0
    
    // 新买家参与第二个FOMO周期
    const secondFomoBuyers = buyers.slice(4, 7);
    
    for (const buyer of secondFomoBuyers) {
      price = await fomodoge.getBuyPrice(1);
      await fomodoge.connect(buyer).buy(1, 0, { value: price });
    }
    
    // 验证FOMO池增加
    const fomoInfoDuringSecond = await fomodoge.fomoInfo();
    expect(fomoInfoDuringSecond.fomoPool).to.be.gt(0);
    
    // 验证winners队列更新
    for (let i = 0; i < secondFomoBuyers.length; i++) {
      expect(fomoInfoDuringSecond.winners[i]).to.equal(
        secondFomoBuyers[secondFomoBuyers.length - 1 - i].address
      );
    }
    
    // 快进到第二个FOMO周期结束
    await advanceTimeAndBlock(CONSTANTS.MAX_FOMO_TIME + 1);
    
    // 触发第二个FOMO周期的奖励分配
    const lastBuyer = buyers[7];
    price = await fomodoge.getBuyPrice(1);
    await fomodoge.connect(lastBuyer).buy(1, 0, { value: price });
    
    // 验证第二个FOMO周期已结束
    const fomoInfoAfterSecond = await fomodoge.fomoInfo();
    expect(fomoInfoAfterSecond.fomoPoolForEach).to.be.gt(0);
    expect(fomoInfoAfterSecond.fomoPoolForEach).to.not.equal(fomoInfoAfterFirst.fomoPoolForEach);
  });
}); 