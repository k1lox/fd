import { ethers } from "hardhat";
import { expect } from "chai";
import { deployContracts, advanceTimeAndBlock, CONSTANTS } from "./00-setup.test";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("FomoDoge 综合场景测试", function () {
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

  it("应该模拟完整游戏周期", async function () {
    // 第一阶段：初始NFT购买和FOMO周期
    
    // 准备多个用户
    const [buyer1, buyer2, buyer3, buyer4, buyer5] = buyers;
    const referrer = referrers[0];
    
    // 用户1购买5个NFT
    let price = await fomodoge.getBuyPrice(5);
    await fomodoge.connect(buyer1).buy(5, 0, { value: price });
    
    // 用户2购买3个带20%折扣的NFT，使用推荐人
    price = await fomodoge.getBuyPrice(3);
    const discountPrice = price.mul(80).div(100);
    await fomodoge.connect(buyer2).buy(3, 20, referrer.address, { value: discountPrice });
    
    // 用户3购买2个带50%折扣的NFT
    price = await fomodoge.getBuyPrice(2);
    const halfPrice = price.mul(50).div(100);
    await fomodoge.connect(buyer3).buy(2, 50, { value: halfPrice });
    
    // 快进一些时间，但不到FOMO结束
    await advanceTimeAndBlock(CONSTANTS.MAX_FOMO_TIME / 2);
    
    // 用户4和用户5在FOMO接近结束时竞争最后买家位置
    // 用户4购买1个NFT
    price = await fomodoge.getBuyPrice(1);
    await fomodoge.connect(buyer4).buy(1, 0, { value: price });
    
    // 等待一小段时间
    await advanceTimeAndBlock(60); // 1分钟
    
    // 用户5购买2个NFT
    price = await fomodoge.getBuyPrice(2);
    await fomodoge.connect(buyer5).buy(2, 0, { value: price });
    
    // 获取FOMO信息
    const fomoInfoBeforeEnd = await fomodoge.fomoInfo();
    
    // 验证用户5是最后一个买家
    expect(fomoInfoBeforeEnd.winners[0]).to.equal(buyer5.address);
    // 验证用户4是倒数第二个买家
    expect(fomoInfoBeforeEnd.winners[1]).to.equal(buyer4.address);
    
    // 快进到FOMO周期结束
    await advanceTimeAndBlock(CONSTANTS.MAX_FOMO_TIME / 2 + 1);
    
    // 记录每个用户的FOMO前余额
    const balancesBefore: any = {};
    for (const buyer of [buyer1, buyer2, buyer3, buyer4, buyer5]) {
      balancesBefore[buyer.address] = await ethers.provider.getBalance(buyer.address);
    }
    
    // 第二阶段：FOMO周期结束，触发奖励分配
    
    // 使用一个新的买家触发FOMO奖励分配
    const newBuyer = buyers[5];
    price = await fomodoge.getBuyPrice(1);
    await fomodoge.connect(newBuyer).buy(1, 0, { value: price });
    
    // 验证FOMO奖励已分配
    const fomoInfoAfter = await fomodoge.fomoInfo();
    expect(fomoInfoAfter.fomoPoolForEach).to.be.gt(0);
    
    // 第三阶段：用户提取奖励
    
    // 最后5位买家应该获得FOMO奖励
    const lastFiveBuyers = [buyer5, buyer4, buyer3, buyer2, buyer1].slice(0, 5);
    
    // 其中的一些用户提取奖励
    for (let i = 0; i < 3; i++) {
      const buyer = lastFiveBuyers[i];
      const withdrawableBefore = await fomodoge.usrCanWithdraw(buyer.address);
      expect(withdrawableBefore).to.be.gt(0);
      
      await fomodoge.connect(buyer).withdraw();
      
      const withdrawableAfter = await fomodoge.usrCanWithdraw(buyer.address);
      expect(withdrawableAfter).to.equal(0);
    }
    
    // 推荐人提取奖励
    const referrerWithdrawable = await fomodoge.usrCanWithdraw(referrer.address);
    expect(referrerWithdrawable).to.be.gt(0);
    await fomodoge.connect(referrer).withdraw();
    
    // 第四阶段：解锁部分NFT并售卖
    
    // 快进到20天锁定期结束
    await advanceTimeAndBlock(CONSTANTS.TWENTY_OFF_LOCK_TIME);
    
    // 用户2售卖刚解锁的NFT
    const nftInfo2 = await fomodoge.getUsrNftInfo(buyer2.address);
    const unlocked2 = nftInfo2
      .filter((nft: any) => nft.unLockTime <= (await ethers.provider.getBlock("latest"))!.timestamp)
      .map((nft: any) => nft.nftId);
    expect(unlocked2.length).to.be.gt(0);
    
    await fomodoge.connect(buyer2).sell(unlocked2);
    
    // 第五阶段：创建质押池并参与质押
    
    // 创建质押池
    const POOL_ID = 1;
    const POOL_REWARD = ethers.utils.parseEther("5000");
    await fomodoge.connect(owner).createDepositPool(POOL_ID, POOL_REWARD);
    
    // 用户1质押一些NFT
    const nftInfo1 = await fomodoge.getUsrNftInfo(buyer1.address);
    const stakingNfts1 = nftInfo1.slice(0, 2).map((nft: any) => nft.nftId);
    await fomodoge.connect(buyer1).deposit(POOL_ID, stakingNfts1);
    
    // 用户3质押一些NFT
    const nftInfo3 = await fomodoge.getUsrNftInfo(buyer3.address);
    const stakingNfts3 = nftInfo3.slice(0, 1).map((nft: any) => nft.nftId);
    await fomodoge.connect(buyer3).deposit(POOL_ID, stakingNfts3);
    
    // 用户5质押一些NFT
    const nftInfo5 = await fomodoge.getUsrNftInfo(buyer5.address);
    const stakingNfts5 = nftInfo5.slice(0, 1).map((nft: any) => nft.nftId);
    await fomodoge.connect(buyer5).deposit(POOL_ID, stakingNfts5);
    
    // 第六阶段：新的FOMO周期
    
    // 几位新用户加入，开始新的FOMO周期
    const newBuyers = buyers.slice(6, 10);
    
    for (const buyer of newBuyers) {
      price = await fomodoge.getBuyPrice(1);
      await fomodoge.connect(buyer).buy(1, 0, { value: price });
      
      // 等待一小段时间
      await advanceTimeAndBlock(60); // 1分钟
    }
    
    // 验证新的FOMO周期已经开始
    const newFomoInfo = await fomodoge.fomoInfo();
    expect(newFomoInfo.fomoPool).to.be.gt(0);
    expect(newFomoInfo.winners[0]).to.equal(newBuyers[newBuyers.length - 1].address);
    
    // 第七阶段：质押池结束，提取质押奖励
    
    // 快进到质押池结束
    await advanceTimeAndBlock(7 * 24 * 60 * 60 + 1); // 7天+1秒
    
    // 用户提取质押奖励
    for (const buyer of [buyer1, buyer3, buyer5]) {
      const reward = await fomodoge.getUsrDepositReward(buyer.address, POOL_ID);
      expect(reward).to.be.gt(0);
      
      const balanceBefore = await mockERC20.balanceOf(buyer.address);
      await fomodoge.connect(buyer).withdrawDepositReward(POOL_ID);
      const balanceAfter = await mockERC20.balanceOf(buyer.address);
      
      expect(balanceAfter.sub(balanceBefore)).to.equal(reward);
    }
    
    // 验证总奖励分配合理
    const totalRewards = (await mockERC20.balanceOf(buyer1.address))
      .add(await mockERC20.balanceOf(buyer3.address))
      .add(await mockERC20.balanceOf(buyer5.address));
    
    expect(totalRewards).to.be.lte(POOL_REWARD);
  });

  it("应该模拟压力测试场景", async function () {
    // 创建两个质押池
    const POOL_ID_1 = 1;
    const POOL_ID_2 = 2;
    const POOL_REWARD = ethers.utils.parseEther("10000");
    
    await fomodoge.connect(owner).createDepositPool(POOL_ID_1, POOL_REWARD);
    await fomodoge.connect(owner).createDepositPool(POOL_ID_2, POOL_REWARD);
    
    // 准备10个活跃用户
    const activeUsers = buyers.slice(0, 10);
    
    // 第一轮：每个用户购买一些NFT
    for (let i = 0; i < activeUsers.length; i++) {
      const buyer = activeUsers[i];
      const amount = Math.min(3, 10 - i); // 不同用户购买不同数量
      const price = await fomodoge.getBuyPrice(amount);
      await fomodoge.connect(buyer).buy(amount, 0, { value: price });
    }
    
    // 第二轮：一些用户质押NFT到第一个池，一些用户售卖
    for (let i = 0; i < activeUsers.length; i++) {
      const buyer = activeUsers[i];
      const nftInfo = await fomodoge.getUsrNftInfo(buyer.address);
      
      if (i % 3 === 0) {
        // 质押到池1
        const stakingNfts = nftInfo.slice(0, 1).map((nft: any) => nft.nftId);
        await fomodoge.connect(buyer).deposit(POOL_ID_1, stakingNfts);
      } else if (i % 3 === 1) {
        // 售卖一个NFT
        const sellNfts = nftInfo.slice(0, 1).map((nft: any) => nft.nftId);
        await fomodoge.connect(buyer).sell(sellNfts);
      }
      // i % 3 === 2的用户不做操作
    }
    
    // 第三轮：FOMO周期接近结束，用户竞争最后位置
    await advanceTimeAndBlock(CONSTANTS.MAX_FOMO_TIME - 5 * 60); // 还剩5分钟
    
    for (let i = activeUsers.length - 1; i >= activeUsers.length - 5; i--) {
      const buyer = activeUsers[i];
      const price = await fomodoge.getBuyPrice(1);
      await fomodoge.connect(buyer).buy(1, 0, { value: price });
      
      // 等待30秒
      await advanceTimeAndBlock(30);
    }
    
    // 第一个FOMO周期结束
    await advanceTimeAndBlock(5 * 60 + 1); // 剩余时间+1秒
    
    // 触发FOMO奖励分配
    const newBuyer = buyers[10];
    let price = await fomodoge.getBuyPrice(1);
    await fomodoge.connect(newBuyer).buy(1, 0, { value: price });
    
    // 第四轮：所有用户同时提取FOMO奖励
    for (const buyer of activeUsers) {
      const withdrawable = await fomodoge.usrCanWithdraw(buyer.address);
      if (withdrawable.gt(0)) {
        await fomodoge.connect(buyer).withdraw();
      }
    }
    
    // 第五轮：一些用户质押到第二个池，一些用户继续买卖
    for (let i = 0; i < activeUsers.length; i++) {
      const buyer = activeUsers[i];
      const nftInfo = await fomodoge.getUsrNftInfo(buyer.address);
      
      if (i % 3 === 2) {
        // 质押到池2
        const availableNfts = nftInfo
          .filter((nft: any) => !nft.isDeposit)
          .map((nft: any) => nft.nftId);
        
        if (availableNfts.length > 0) {
          await fomodoge.connect(buyer).deposit(POOL_ID_2, availableNfts.slice(0, 1));
        }
      } else if (i % 3 === 0) {
        // 购买新NFT
        price = await fomodoge.getBuyPrice(1);
        await fomodoge.connect(buyer).buy(1, 0, { value: price });
      }
      // i % 3 === 1的用户不做操作
    }
    
    // 第六轮：第一个质押池结束，提取奖励
    await advanceTimeAndBlock(7 * 24 * 60 * 60 + 1); // 7天+1秒
    
    for (const buyer of activeUsers) {
      try {
        const reward = await fomodoge.getUsrDepositReward(buyer.address, POOL_ID_1);
        if (reward.gt(0)) {
          await fomodoge.connect(buyer).withdrawDepositReward(POOL_ID_1);
        }
      } catch (e) {
        // 忽略错误，有些用户可能没有参与质押
      }
    }
    
    // 第七轮：第二个质押池结束，提取奖励
    await advanceTimeAndBlock(7 * 24 * 60 * 60 + 1); // 再过7天+1秒
    
    for (const buyer of activeUsers) {
      try {
        const reward = await fomodoge.getUsrDepositReward(buyer.address, POOL_ID_2);
        if (reward.gt(0)) {
          await fomodoge.connect(buyer).withdrawDepositReward(POOL_ID_2);
        }
      } catch (e) {
        // 忽略错误，有些用户可能没有参与质押
      }
    }
    
    // 第八轮：极端操作 - 一个用户购买大量NFT
    const bulkBuyer = buyers[11];
    const largeAmount = 90; // 接近单地址上限的100个
    price = await fomodoge.getBuyPrice(largeAmount);
    await fomodoge.connect(bulkBuyer).buy(largeAmount, 0, { value: price });
    
    // 验证用户拥有正确数量的NFT
    expect(await fomodoge.balanceOf(bulkBuyer.address)).to.equal(largeAmount);
    
    // 第九轮：极端操作 - 用户尝试售卖最大数量NFT
    const nftInfoBulk = await fomodoge.getUsrNftInfo(bulkBuyer.address);
    const bulkSellNfts = nftInfoBulk.slice(0, 50).map((nft: any) => nft.nftId); // 最大50个
    
    await fomodoge.connect(bulkBuyer).sell(bulkSellNfts);
    
    // 验证售卖成功
    expect(await fomodoge.balanceOf(bulkBuyer.address)).to.equal(largeAmount - 50);
    
    // 验证整个系统状态
    const systemState = {
      totalSupply: await fomodoge.totalSupply(),
      fomoPool: (await fomodoge.fomoInfo()).fomoPool,
      currentPrice: await fomodoge.getBuyPrice(1)
    };
    
    // 打印最终状态供分析
    console.log("系统最终状态:", {
      totalSupply: systemState.totalSupply.toString(),
      fomoPool: ethers.utils.formatEther(systemState.fomoPool),
      currentPrice: ethers.utils.formatEther(systemState.currentPrice)
    });
  });

  it("应该模拟质押和交易交叉场景", async function () {
    // 创建质押池
    const POOL_ID_1 = 1;
    const POOL_ID_2 = 2;
    const POOL_REWARD = ethers.utils.parseEther("10000");
    
    await fomodoge.connect(owner).createDepositPool(POOL_ID_1, POOL_REWARD);
    
    // 准备用户
    const [staker1, staker2, trader1, trader2] = buyers;
    
    // 第一步：用户购买NFT
    for (const buyer of [staker1, staker2, trader1, trader2]) {
      const price = await fomodoge.getBuyPrice(5);
      await fomodoge.connect(buyer).buy(5, 0, { value: price });
    }
    
    // 第二步：部分用户质押NFT
    const staker1NftInfo = await fomodoge.getUsrNftInfo(staker1.address);
    const staker1StakingNfts = staker1NftInfo.slice(0, 3).map((nft: any) => nft.nftId);
    await fomodoge.connect(staker1).deposit(POOL_ID_1, staker1StakingNfts);
    
    const staker2NftInfo = await fomodoge.getUsrNftInfo(staker2.address);
    const staker2StakingNfts = staker2NftInfo.slice(0, 2).map((nft: any) => nft.nftId);
    await fomodoge.connect(staker2).deposit(POOL_ID_1, staker2StakingNfts);
    
    // 第三步：交易者继续买卖
    // trader1售卖2个NFT
    const trader1NftInfo = await fomodoge.getUsrNftInfo(trader1.address);
    const trader1SellingNfts = trader1NftInfo.slice(0, 2).map((nft: any) => nft.nftId);
    await fomodoge.connect(trader1).sell(trader1SellingNfts);
    
    // trader2再购买3个NFT
    const price = await fomodoge.getBuyPrice(3);
    await fomodoge.connect(trader2).buy(3, 0, { value: price });
    
    // 第四步：staker1尝试售卖已质押的NFT（应该失败或被忽略）
    await fomodoge.connect(staker1).sell(staker1StakingNfts);
    
    // 验证仍然拥有这些NFT
    expect(await fomodoge.balanceOf(staker1.address)).to.equal(5);
    
    // 第五步：staker2再质押剩余的NFT
    const staker2RemainingNftInfo = await fomodoge.getUsrNftInfo(staker2.address);
    const staker2RemainingNfts = staker2RemainingNftInfo
      .filter((nft: any) => !nft.isDeposit)
      .map((nft: any) => nft.nftId);
    
    await fomodoge.connect(staker2).deposit(POOL_ID_1, staker2RemainingNfts);
    
    // 第六步：池1结束，创建池2
    await advanceTimeAndBlock(7 * 24 * 60 * 60 + 1); // 7天+1秒
    await fomodoge.connect(owner).createDepositPool(POOL_ID_2, POOL_REWARD);
    
    // 第七步：用户从池1提取奖励后立即质押到池2
    // staker1提取池1奖励
    await fomodoge.connect(staker1).withdrawDepositReward(POOL_ID_1);
    
    // 获取解除质押的NFT
    const staker1NewNftInfo = await fomodoge.getUsrNftInfo(staker1.address);
    const staker1NewStakingNfts = staker1NewNftInfo.map((nft: any) => nft.nftId);
    
    // 立即质押到池2
    await fomodoge.connect(staker1).deposit(POOL_ID_2, staker1NewStakingNfts.slice(0, 3));
    
    // 第八步：trader1购买NFT并直接质押到池2
    const newPrice = await fomodoge.getBuyPrice(2);
    await fomodoge.connect(trader1).buy(2, 0, { value: newPrice });
    
    const trader1NewNftInfo = await fomodoge.getUsrNftInfo(trader1.address);
    const trader1NewNfts = trader1NewNftInfo.slice(0, 2).map((nft: any) => nft.nftId);
    
    await fomodoge.connect(trader1).deposit(POOL_ID_2, trader1NewNfts);
    
    // 第九步：结束池2并提取奖励
    await advanceTimeAndBlock(7 * 24 * 60 * 60 + 1); // 7天+1秒
    
    for (const staker of [staker1, trader1]) {
      const reward = await fomodoge.getUsrDepositReward(staker.address, POOL_ID_2);
      
      if (reward.gt(0)) {
        const balanceBefore = await mockERC20.balanceOf(staker.address);
        await fomodoge.connect(staker).withdrawDepositReward(POOL_ID_2);
        const balanceAfter = await mockERC20.balanceOf(staker.address);
        
        expect(balanceAfter.sub(balanceBefore)).to.equal(reward);
      }
    }
    
    // 验证所有操作后的系统状态
    const finalNftCounts = {
      staker1: await fomodoge.balanceOf(staker1.address),
      staker2: await fomodoge.balanceOf(staker2.address),
      trader1: await fomodoge.balanceOf(trader1.address),
      trader2: await fomodoge.balanceOf(trader2.address)
    };
    
    // 验证NFT总数
    const totalNfts = Object.values(finalNftCounts).reduce((a: any, b: any) => a.add(b), ethers.BigNumber.from(0));
    expect(await fomodoge.totalSupply()).to.equal(totalNfts);
  });
}); 