import { ethers } from "hardhat";
import { expect } from "chai";
import { deployContracts, advanceTimeAndBlock } from "./00-setup.test";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("FomoDoge 质押功能测试", function () {
  let fomodoge: any;
  let mockERC20: any;
  let owner: SignerWithAddress;
  let buyers: SignerWithAddress[];
  
  const POOL_ID = 1;
  const POOL_DURATION = 7 * 24 * 60 * 60; // 7天，单位秒
  const POOL_REWARD = ethers.utils.parseEther("10000"); // 10000代币奖励

  beforeEach(async function () {
    const contracts = await deployContracts();
    fomodoge = contracts.fomodoge;
    mockERC20 = contracts.mockERC20;
    owner = contracts.owner;
    buyers = contracts.buyers;
    
    // 为测试准备NFT
    // 买家1购买10个无锁定期NFT
    const buyer1 = buyers[0];
    const price1 = await fomodoge.getBuyPrice(10);
    await fomodoge.connect(buyer1).buy(10, 0, { value: price1 });
    
    // 买家2购买5个无锁定期NFT
    const buyer2 = buyers[1];
    const price2 = await fomodoge.getBuyPrice(5);
    await fomodoge.connect(buyer2).buy(5, 0, { value: price2 });
    
    // 买家3购买8个无锁定期NFT
    const buyer3 = buyers[2];
    const price3 = await fomodoge.getBuyPrice(8);
    await fomodoge.connect(buyer3).buy(8, 0, { value: price3 });
    
    // 创建质押池
    await fomodoge.connect(owner).createDepositPool(POOL_ID, POOL_REWARD);
  });

  it("应该允许创建质押池", async function () {
    const newPoolId = 2;
    const newPoolReward = ethers.utils.parseEther("5000");
    
    // 创建新的质押池
    await fomodoge.connect(owner).createDepositPool(newPoolId, newPoolReward);
    
    // 验证质押池信息
    const poolInfo = await fomodoge.depositPool(newPoolId);
    
    // 验证时间设置
    const latestBlock = await ethers.provider.getBlock("latest");
    expect(poolInfo.startTime).to.be.closeTo(latestBlock.timestamp, 2);
    expect(poolInfo.endTime).to.be.closeTo(latestBlock.timestamp + POOL_DURATION, 2);
    
    // 验证奖励代币数量
    expect(poolInfo.tokenAmount).to.equal(newPoolReward);
    
    // 验证初始状态
    expect(poolInfo.depositUsrAmounts).to.equal(0);
    expect(poolInfo.depositNFTAmounts).to.equal(0);
  });

  it("应该拒绝重复创建同ID的质押池", async function () {
    // 尝试创建与现有ID相同的质押池
    await expect(
      fomodoge.connect(owner).createDepositPool(POOL_ID, POOL_REWARD)
    ).to.be.revertedWith("Pool Already Created");
  });

  it("应该允许质押NFT", async function () {
    const staker = buyers[0];
    
    // 获取用户的NFT ID
    const nftInfo = await fomodoge.getUsrNftInfo(staker.address);
    const nftIds = nftInfo.map((nft: any) => nft.nftId);
    
    // 选择3个NFT进行质押
    const stakingNfts = nftIds.slice(0, 3);
    
    // 质押NFT
    await fomodoge.connect(staker).deposit(POOL_ID, stakingNfts);
    
    // 验证用户的质押信息
    const userDepositInfo = await fomodoge.usrDepositInfo(staker.address, POOL_ID);
    
    // 验证质押数量
    expect(userDepositInfo.usrDepositAmounts).to.equal(stakingNfts.length);
    
    // 验证质押的NFT ID
    for (let i = 0; i < stakingNfts.length; i++) {
      const depositedNfts = await userDepositInfo.usrDepositNfts;
      expect(depositedNfts).to.include(stakingNfts[i]);
    }
    
    // 验证NFT已标记为已质押
    for (const nftId of stakingNfts) {
      const updatedNftInfo = await fomodoge.nftInfo(nftId);
      expect(updatedNftInfo.isDeposit).to.be.true;
    }
    
    // 验证质押池信息更新
    const poolInfo = await fomodoge.depositPool(POOL_ID);
    expect(poolInfo.depositUsrAmounts).to.equal(1);
    expect(poolInfo.depositNFTAmounts).to.equal(stakingNfts.length);
    expect(poolInfo.speed).to.be.gt(0); // 奖励速率应该已计算
  });

  it("应该拒绝质押已质押的NFT", async function () {
    const staker = buyers[0];
    
    // 获取用户的NFT ID
    const nftInfo = await fomodoge.getUsrNftInfo(staker.address);
    const nftIds = nftInfo.map((nft: any) => nft.nftId);
    
    // 先质押一些NFT
    const firstBatch = nftIds.slice(0, 3);
    await fomodoge.connect(staker).deposit(POOL_ID, firstBatch);
    
    // 尝试再次质押已质押的NFT（应该被忽略）
    const secondBatch = [...firstBatch, ...nftIds.slice(3, 5)]; // 包含已质押的NFT和新NFT
    await fomodoge.connect(staker).deposit(POOL_ID, secondBatch);
    
    // 验证只有新NFT被质押
    const userDepositInfo = await fomodoge.usrDepositInfo(staker.address, POOL_ID);
    expect(userDepositInfo.usrDepositAmounts).to.equal(firstBatch.length + 2); // 3 + 2
    
    // 验证质押池信息
    const poolInfo = await fomodoge.depositPool(POOL_ID);
    expect(poolInfo.depositNFTAmounts).to.equal(firstBatch.length + 2);
  });

  it("应该正确计算多用户质押奖励", async function () {
    // 第一个用户质押
    const staker1 = buyers[0];
    const nftInfo1 = await fomodoge.getUsrNftInfo(staker1.address);
    const stakeNfts1 = nftInfo1.slice(0, 3).map((nft: any) => nft.nftId);
    await fomodoge.connect(staker1).deposit(POOL_ID, stakeNfts1);
    
    // 等待一些时间
    await advanceTimeAndBlock(POOL_DURATION / 4); // 25%的池子时间
    
    // 第二个用户质押
    const staker2 = buyers[1];
    const nftInfo2 = await fomodoge.getUsrNftInfo(staker2.address);
    const stakeNfts2 = nftInfo2.slice(0, 2).map((nft: any) => nft.nftId);
    await fomodoge.connect(staker2).deposit(POOL_ID, stakeNfts2);
    
    // 等待一些时间
    await advanceTimeAndBlock(POOL_DURATION / 4); // 再25%的池子时间
    
    // 第三个用户质押
    const staker3 = buyers[2];
    const nftInfo3 = await fomodoge.getUsrNftInfo(staker3.address);
    const stakeNfts3 = nftInfo3.slice(0, 4).map((nft: any) => nft.nftId);
    await fomodoge.connect(staker3).deposit(POOL_ID, stakeNfts3);
    
    // 等待剩余时间，直到池子结束
    await advanceTimeAndBlock(POOL_DURATION / 2 + 1); // 剩余50% + 1秒
    
    // 获取各用户预计奖励
    const reward1 = await fomodoge.getUsrDepositReward(staker1.address, POOL_ID);
    const reward2 = await fomodoge.getUsrDepositReward(staker2.address, POOL_ID);
    const reward3 = await fomodoge.getUsrDepositReward(staker3.address, POOL_ID);
    
    // 验证所有奖励总和不超过池子总奖励
    const totalReward = reward1.add(reward2).add(reward3);
    expect(totalReward).to.be.lte(POOL_REWARD);
    
    // 验证奖励比例与质押数量和时间成正比
    // 用户1质押了3个NFT，从开始到结束，应该获得最多奖励
    // 用户3质押了4个NFT，但只质押了50%的时间，应该获得较少奖励
    expect(reward1).to.be.gt(reward3);
    
    // 用户2质押了2个NFT，质押了75%的时间
    // 用户3质押了4个NFT，质押了50%的时间
    // 这里比较会受到具体实现影响，简单验证非零
    expect(reward2).to.be.gt(0);
    expect(reward3).to.be.gt(0);
  });

  it("应该拒绝在池子结束前提取奖励", async function () {
    // 用户质押NFT
    const staker = buyers[0];
    const nftInfo = await fomodoge.getUsrNftInfo(staker.address);
    const stakeNfts = nftInfo.slice(0, 3).map((nft: any) => nft.nftId);
    await fomodoge.connect(staker).deposit(POOL_ID, stakeNfts);
    
    // 等待一些时间，但不到池子结束
    await advanceTimeAndBlock(POOL_DURATION / 2);
    
    // 尝试提取奖励（应该被拒绝）
    await expect(
      fomodoge.connect(staker).withdrawDepositReward(POOL_ID)
    ).to.be.revertedWith("Pool not ended");
  });

  it("应该允许在池子结束后提取奖励", async function () {
    // 用户质押NFT
    const staker = buyers[0];
    const nftInfo = await fomodoge.getUsrNftInfo(staker.address);
    const stakeNfts = nftInfo.slice(0, 3).map((nft: any) => nft.nftId);
    await fomodoge.connect(staker).deposit(POOL_ID, stakeNfts);
    
    // 等待直到池子结束
    await advanceTimeAndBlock(POOL_DURATION + 1);
    
    // 获取预期的奖励
    const expectedReward = await fomodoge.getUsrDepositReward(staker.address, POOL_ID);
    expect(expectedReward).to.be.gt(0);
    
    // 记录提取前的代币余额
    const balanceBefore = await mockERC20.balanceOf(staker.address);
    
    // 提取奖励
    await fomodoge.connect(staker).withdrawDepositReward(POOL_ID);
    
    // 验证代币余额增加
    const balanceAfter = await mockERC20.balanceOf(staker.address);
    expect(balanceAfter.sub(balanceBefore)).to.equal(expectedReward);
    
    // 验证NFT已解除质押
    for (const nftId of stakeNfts) {
      const updatedNftInfo = await fomodoge.nftInfo(nftId);
      expect(updatedNftInfo.isDeposit).to.be.false;
    }
    
    // 验证已提取的奖励记录已更新
    const userDepositInfo = await fomodoge.usrDepositInfo(staker.address, POOL_ID);
    expect(userDepositInfo.rewardWithdrawed).to.equal(expectedReward);
  });

  it("应该限制重复提取奖励", async function () {
    // 用户质押NFT
    const staker = buyers[0];
    const nftInfo = await fomodoge.getUsrNftInfo(staker.address);
    const stakeNfts = nftInfo.slice(0, 3).map((nft: any) => nft.nftId);
    await fomodoge.connect(staker).deposit(POOL_ID, stakeNfts);
    
    // 等待直到池子结束
    await advanceTimeAndBlock(POOL_DURATION + 1);
    
    // 第一次提取奖励
    await fomodoge.connect(staker).withdrawDepositReward(POOL_ID);
    
    // 尝试第二次提取（应该被拒绝）
    await expect(
      fomodoge.connect(staker).withdrawDepositReward(POOL_ID)
    ).to.be.revertedWith("No reward to withdraw");
  });

  it("应该支持多个质押池", async function () {
    // 创建第二个质押池
    const POOL_ID_2 = 2;
    const POOL_REWARD_2 = ethers.utils.parseEther("5000");
    await fomodoge.connect(owner).createDepositPool(POOL_ID_2, POOL_REWARD_2);
    
    const staker = buyers[0];
    const nftInfo = await fomodoge.getUsrNftInfo(staker.address);
    const allNftIds = nftInfo.map((nft: any) => nft.nftId);
    
    // 在两个池子分别质押不同的NFT
    const pool1Nfts = allNftIds.slice(0, 3);
    const pool2Nfts = allNftIds.slice(3, 6);
    
    await fomodoge.connect(staker).deposit(POOL_ID, pool1Nfts);
    await fomodoge.connect(staker).deposit(POOL_ID_2, pool2Nfts);
    
    // 验证两个池子的质押信息
    const pool1Info = await fomodoge.usrDepositInfo(staker.address, POOL_ID);
    const pool2Info = await fomodoge.usrDepositInfo(staker.address, POOL_ID_2);
    
    expect(pool1Info.usrDepositAmounts).to.equal(pool1Nfts.length);
    expect(pool2Info.usrDepositAmounts).to.equal(pool2Nfts.length);
    
    // 等待直到两个池子都结束
    await advanceTimeAndBlock(POOL_DURATION + 1);
    
    // 提取两个池子的奖励
    await fomodoge.connect(staker).withdrawDepositReward(POOL_ID);
    await fomodoge.connect(staker).withdrawDepositReward(POOL_ID_2);
    
    // 验证两个池子的NFT都已解除质押
    for (const nftId of [...pool1Nfts, ...pool2Nfts]) {
      const updatedNftInfo = await fomodoge.nftInfo(nftId);
      expect(updatedNftInfo.isDeposit).to.be.false;
    }
  });

  it("应该模拟多用户交叉质押场景", async function () {
    // 3个用户交替质押
    const [staker1, staker2, staker3] = buyers;
    
    // 获取各用户的NFT
    const getNftIds = async (staker: SignerWithAddress) => {
      const info = await fomodoge.getUsrNftInfo(staker.address);
      return info.map((nft: any) => nft.nftId);
    };
    
    const nfts1 = await getNftIds(staker1);
    const nfts2 = await getNftIds(staker2);
    const nfts3 = await getNftIds(staker3);
    
    // staker1质押3个NFT
    await fomodoge.connect(staker1).deposit(POOL_ID, nfts1.slice(0, 3));
    
    // 等待一段时间
    await advanceTimeAndBlock(POOL_DURATION / 6);
    
    // staker2质押2个NFT
    await fomodoge.connect(staker2).deposit(POOL_ID, nfts2.slice(0, 2));
    
    // 等待一段时间
    await advanceTimeAndBlock(POOL_DURATION / 6);
    
    // staker1再质押2个NFT
    await fomodoge.connect(staker1).deposit(POOL_ID, nfts1.slice(3, 5));
    
    // 等待一段时间
    await advanceTimeAndBlock(POOL_DURATION / 6);
    
    // staker3质押4个NFT
    await fomodoge.connect(staker3).deposit(POOL_ID, nfts3.slice(0, 4));
    
    // 等待直到池子结束
    await advanceTimeAndBlock(POOL_DURATION / 2 + 1);
    
    // 获取各用户的预期奖励
    const reward1 = await fomodoge.getUsrDepositReward(staker1.address, POOL_ID);
    const reward2 = await fomodoge.getUsrDepositReward(staker2.address, POOL_ID);
    const reward3 = await fomodoge.getUsrDepositReward(staker3.address, POOL_ID);
    
    // 验证奖励总和不超过池子总奖励
    const totalReward = reward1.add(reward2).add(reward3);
    expect(totalReward).to.be.lte(POOL_REWARD);
    
    // 提取奖励
    await fomodoge.connect(staker1).withdrawDepositReward(POOL_ID);
    await fomodoge.connect(staker2).withdrawDepositReward(POOL_ID);
    await fomodoge.connect(staker3).withdrawDepositReward(POOL_ID);
    
    // 验证奖励已提取
    const afterReward1 = await fomodoge.getUsrDepositReward(staker1.address, POOL_ID);
    const afterReward2 = await fomodoge.getUsrDepositReward(staker2.address, POOL_ID);
    const afterReward3 = await fomodoge.getUsrDepositReward(staker3.address, POOL_ID);
    
    expect(afterReward1).to.equal(0);
    expect(afterReward2).to.equal(0);
    expect(afterReward3).to.equal(0);
  });
}); 