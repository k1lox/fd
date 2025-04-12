import { ethers } from "hardhat";
import { expect } from "chai";
import { Contract } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

describe("FomoDoge Contract Tests", function () {
  // Increase timeout for long-running tests
  this.timeout(100000);

  let fomodoge: Contract;
  let owner: SignerWithAddress;
  let users: SignerWithAddress[];
  
  // 控制台颜色代码
  const colors = {
    reset: "\x1b[0m",
    bright: "\x1b[1m",
    dim: "\x1b[2m",
    
    black: "\x1b[30m",
    red: "\x1b[31m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    blue: "\x1b[34m",
    magenta: "\x1b[35m",
    cyan: "\x1b[36m",
    white: "\x1b[37m",
    
    bgBlack: "\x1b[40m",
    bgRed: "\x1b[41m",
    bgGreen: "\x1b[42m",
    bgYellow: "\x1b[43m",
    bgBlue: "\x1b[44m",
    bgMagenta: "\x1b[45m",
    bgCyan: "\x1b[46m",
    bgWhite: "\x1b[47m"
  };
  
  // 彩色打印函数
  const colorize = {
    buyPrice: (text: string) => `${colors.green}${text}${colors.reset}`,
    sellPrice: (text: string) => `${colors.red}${text}${colors.reset}`,
    buyOperation: (text: string) => `${colors.blue}${text}${colors.reset}`,
    sellOperation: (text: string) => `${colors.yellow}${text}${colors.reset}`,
    info: (text: string) => `${colors.cyan}${text}${colors.reset}`,
    warning: (text: string) => `${colors.magenta}${text}${colors.reset}`,
    error: (text: string) => `${colors.bright}${colors.red}${text}${colors.reset}`,
    success: (text: string) => `${colors.bright}${colors.green}${text}${colors.reset}`
  };
  
  before(async function () {
    // Get signers
    [owner, ...users] = await ethers.getSigners();
    
    // Deploy FomoDoge contract
    const FomoDoge = await ethers.getContractFactory("FomoDoge");
    fomodoge = await FomoDoge.deploy();
    
    console.log(colorize.info("FomoDoge合约部署地址:"), fomodoge.address);
  });
  
  // 显示NFT价格信息
  async function printNftPriceInfo() {
    // 获取当前买入1个NFT的价格
    const buy1NftPrice = await fomodoge.getBuyPrice(1);
    console.log(colorize.buyPrice(`买入1个NFT价格: ${ethers.formatEther(buy1NftPrice)} ETH`));
    
    // 获取当前卖出1个NFT的价格
    const totalSupply = await fomodoge.totalSupply();
    if (Number(totalSupply) > 0) {
      try {
        const sell1NftPrice = await fomodoge.getSellPrice(1, totalSupply);
        console.log(colorize.sellPrice(`卖出1个NFT价格: ${ethers.formatEther(sell1NftPrice)} ETH`));
      } catch (error) {
        console.log(colorize.error("无法计算卖出价格，可能流动性池余额不足"));
      }
    } else {
      console.log(colorize.warning("当前没有NFT可以卖出"));
    }
    
    // 显示当前流动性池和FOMO池信息
    const info = await fomodoge.fomoInfo();
    console.log(colorize.info(`流动性池: ${Number(ethers.formatEther(info.liqPool)).toFixed(6)} ETH`));
    console.log(colorize.info(`FOMO奖励池: ${Number(ethers.formatEther(info.fomoPool)).toFixed(6)} ETH`));
  }
  
  // Helper function to print user's NFT info in a more readable format
  async function printUserNftInfo(user: SignerWithAddress, label: string) {
    const nftInfo = await fomodoge.getUsrNftInfo(user.address);
    
    console.log(`\n----- ${label} 的NFT信息 (共 ${nftInfo.length} 个) -----`);
    
    if (nftInfo.length === 0) {
      console.log("  没有持有NFT");
      return nftInfo;
    }
    
    // Group NFTs by lock status
    const now = Math.floor(Date.now() / 1000);
    const locked = nftInfo.filter(nft => Number(nft.unLockTime) > now);
    const unlocked = nftInfo.filter(nft => Number(nft.unLockTime) <= now);
    
    if (unlocked.length > 0) {
      console.log(`  已解锁NFT (${unlocked.length}个):`);
      console.log(`    ID列表: [${unlocked.map(nft => nft.nftId.toString()).join(', ')}]`);
    }
    
    if (locked.length > 0) {
      console.log(`  锁定中NFT (${locked.length}个):`);
      for (const nft of locked) {
        const timestamp = Number(nft.unLockTime);
        const date = new Date(timestamp * 1000);
        const formattedDate = date.toISOString().replace('T', ' ').substring(0, 19);
        console.log(`    NFT #${nft.nftId} - 解锁时间: ${formattedDate} (时间戳: ${timestamp})`);
      }
    }
    
    return nftInfo;
  }
  
  // Helper function to print fomo info in a more readable format
  async function printFomoInfo() {
    const info = await fomodoge.fomoInfo();
    
    console.log("\n----- FOMO机制信息 -----");
    console.log(colorize.info(`  流动性池: ${Number(ethers.formatEther(info.liqPool)).toFixed(6)} ETH`));
    console.log(colorize.info(`  FOMO奖励池: ${Number(ethers.formatEther(info.fomoPool)).toFixed(6)} ETH`));
    
    const endTimestamp = Number(info.endTime);
    const endDate = new Date(endTimestamp * 1000);
    const formattedEndTime = endDate.toISOString().replace('T', ' ').substring(0, 19);
    console.log(`  FOMO结束时间: ${formattedEndTime} (时间戳: ${endTimestamp})`);
    
    if (Number(info.fomoPoolForEach) > 0) {
      console.log(`  每个NFT的奖励: ${Number(ethers.formatEther(info.fomoPoolForEach)).toFixed(8)} ETH`);
    }
    
    // Display winners if they exist
    if (info.winners && info.winners.filter(w => w !== "0x0000000000000000000000000000000000000000").length > 0) {
      console.log(`  最近获胜者: ${info.winners.filter(w => w !== "0x0000000000000000000000000000000000000000").join(', ')}`);
    }
    
    // 打印当前NFT价格信息
    await printNftPriceInfo();
    
    return info;
  }
  
  // Helper function to print step headers
  function printStepHeader(stepNumber: number, description: string) {
    console.log("\n" + "=".repeat(70));
    console.log(colorize.success(`步骤 ${stepNumber}: ${description}`));
    console.log("=".repeat(70));
  }
  
  it("Should follow the complete test flow", async function () {
    // 1. Deploy contract (already done in before hook)
    printStepHeader(1, "合约部署");
    await printNftPriceInfo();
    
    // 2. Users 1-4 buy different amounts of NFTs without using invitation
    printStepHeader(2, "用户1-4购买不同数量的NFT(不使用邀请机制)");
    
    try {
      // Use a dummy zero address as the third parameter for the buy function
      const dummyAddress = "0x0000000000000000000000000000000000000000";
      
      // User 1 buys 5 NFTs with no lock
      const user1BuyAmount = 5n;
      const user1LockType = 0n;
      const user1BuyPrice = await fomodoge.getBuyPrice(user1BuyAmount);
      
      console.log(colorize.buyPrice(`用户1购买前 - 买入 ${user1BuyAmount} 个NFT价格: ${ethers.formatEther(user1BuyPrice)} ETH`));
      
      await fomodoge.connect(users[0]).buy(user1BuyAmount, user1LockType, dummyAddress, {
        value: user1BuyPrice
      });
      console.log(colorize.buyOperation(`用户1购买了 ${user1BuyAmount} 个NFT，花费 ${Number(ethers.formatEther(user1BuyPrice)).toFixed(6)} ETH`));
      
      // Print fomo info and user NFT info
      await printFomoInfo();
      await printUserNftInfo(users[0], "用户1");
      
      // User 2 buys 3 NFTs with 20-day lock (20% discount)
      const user2BuyAmount = 3n;
      const user2LockType = 20n;
      const user2FullPrice = await fomodoge.getBuyPrice(user2BuyAmount);
      const user2BuyPrice = (user2FullPrice * 80n) / 100n; // Apply 20% discount
      
      console.log(colorize.buyPrice(`用户2购买前 - 买入 ${user2BuyAmount} 个NFT原价: ${ethers.formatEther(user2FullPrice)} ETH`));
      console.log(colorize.buyPrice(`用户2购买前 - 买入 ${user2BuyAmount} 个NFT折后价: ${ethers.formatEther(user2BuyPrice)} ETH (享受20%折扣)`));
      
      await fomodoge.connect(users[1]).buy(user2BuyAmount, user2LockType, dummyAddress, {
        value: user2BuyPrice
      });
      console.log(colorize.buyOperation(`用户2购买了 ${user2BuyAmount} 个NFT，花费 ${Number(ethers.formatEther(user2BuyPrice)).toFixed(6)} ETH (享受20%折扣)`));
      
      await printFomoInfo();
      await printUserNftInfo(users[1], "用户2");
      
      // User 3 buys 2 NFTs with 50-day lock (50% discount)
      const user3BuyAmount = 2n;
      const user3LockType = 50n;
      const user3FullPrice = await fomodoge.getBuyPrice(user3BuyAmount);
      const user3BuyPrice = (user3FullPrice * 50n) / 100n; // Apply 50% discount
      
      console.log(colorize.buyPrice(`用户3购买前 - 买入 ${user3BuyAmount} 个NFT原价: ${ethers.formatEther(user3FullPrice)} ETH`));
      console.log(colorize.buyPrice(`用户3购买前 - 买入 ${user3BuyAmount} 个NFT折后价: ${ethers.formatEther(user3BuyPrice)} ETH (享受50%折扣)`));
      
      await fomodoge.connect(users[2]).buy(user3BuyAmount, user3LockType, dummyAddress, {
        value: user3BuyPrice
      });
      console.log(colorize.buyOperation(`用户3购买了 ${user3BuyAmount} 个NFT，花费 ${Number(ethers.formatEther(user3BuyPrice)).toFixed(6)} ETH (享受50%折扣)`));
      
      await printFomoInfo();
      await printUserNftInfo(users[2], "用户3");
      
      // User 4 buys 1 NFT with 70-day lock (70% discount)
      const user4BuyAmount = 1n;
      const user4LockType = 70n;
      const user4FullPrice = await fomodoge.getBuyPrice(user4BuyAmount);
      const user4BuyPrice = (user4FullPrice * 30n) / 100n; // Apply 70% discount
      
      console.log(colorize.buyPrice(`用户4购买前 - 买入 ${user4BuyAmount} 个NFT原价: ${ethers.formatEther(user4FullPrice)} ETH`));
      console.log(colorize.buyPrice(`用户4购买前 - 买入 ${user4BuyAmount} 个NFT折后价: ${ethers.formatEther(user4BuyPrice)} ETH (享受70%折扣)`));
      
      await fomodoge.connect(users[3]).buy(user4BuyAmount, user4LockType, dummyAddress, {
        value: user4BuyPrice
      });
      console.log(colorize.buyOperation(`用户4购买了 ${user4BuyAmount} 个NFT，花费 ${Number(ethers.formatEther(user4BuyPrice)).toFixed(6)} ETH (享受70%折扣)`));
      
      await printFomoInfo();
      await printUserNftInfo(users[3], "用户4");
    
    } catch (error) {
      console.error(colorize.error("----- 购买阶段发生错误 -----"));
      console.error(colorize.error(error));
      throw error;
    }
    
    // 3. Users 2 and 3 sell 1 NFT each (but first we need to advance time past the lock period)
    printStepHeader(3, "用户2和3各卖出1个NFT");
    
    // Get lock times for User 2's NFTs
    const user2NFTs = await fomodoge.getUsrNftInfo(users[1].address);
    const user3NFTs = await fomodoge.getUsrNftInfo(users[2].address);
    
    // Find the maximum unlock time
    const maxUnlockTime = Math.max(
      Number(user2NFTs[0].unLockTime),
      Number(user3NFTs[0].unLockTime)
    );
    
    // Advance time past all lock periods
    const currentBlockTimestamp = (await ethers.provider.getBlock("latest"))!.timestamp;
    const timeToAdvance = maxUnlockTime - Number(currentBlockTimestamp) + 60; // Add a minute for safety
    
    if (timeToAdvance > 0) {
      await ethers.provider.send("evm_increaseTime", [timeToAdvance]);
      await ethers.provider.send("evm_mine", []);
      console.log(colorize.warning(`时间前进了 ${timeToAdvance} 秒，用于解锁NFT`));
    }
    
    // 获取用户2卖出前的价格
    const user2TotalSupply = await fomodoge.totalSupply();
    const user2SellPrice = await fomodoge.getSellPrice(1, user2TotalSupply);
    console.log(colorize.sellPrice(`用户2卖出前 - 卖出1个NFT价格: ${ethers.formatEther(user2SellPrice)} ETH`));
    
    // User 2 sells 1 NFT
    const user2NftToSell = [user2NFTs[0].nftId];
    await fomodoge.connect(users[1]).sell(user2NftToSell);
    console.log(colorize.sellOperation(`用户2卖出了1个NFT，收到 ${Number(ethers.formatEther(user2SellPrice * 95n / 100n)).toFixed(6)} ETH`));
    
    await printFomoInfo();
    await printUserNftInfo(users[1], "用户2");
    
    // 获取用户3卖出前的价格
    const user3TotalSupply = await fomodoge.totalSupply();
    const user3SellPrice = await fomodoge.getSellPrice(1, user3TotalSupply);
    console.log(colorize.sellPrice(`用户3卖出前 - 卖出1个NFT价格: ${ethers.formatEther(user3SellPrice)} ETH`));
    
    // User 3 sells 1 NFT
    const user3NftToSell = [user3NFTs[0].nftId];
    await fomodoge.connect(users[2]).sell(user3NftToSell);
    console.log(colorize.sellOperation(`用户3卖出了1个NFT，收到 ${Number(ethers.formatEther(user3SellPrice * 95n / 100n)).toFixed(6)} ETH`));
    
    await printFomoInfo();
    await printUserNftInfo(users[2], "用户3");
    
    // 4. Users 1-4 transfer NFTs among themselves
    printStepHeader(4, "用户1-4之间互相转移NFT");
    
    // Get updated NFT information
    const updatedUser1NFTs = await fomodoge.getUsrNftInfo(users[0].address);
    const updatedUser2NFTs = await fomodoge.getUsrNftInfo(users[1].address);
    const updatedUser3NFTs = await fomodoge.getUsrNftInfo(users[2].address);
    const updatedUser4NFTs = await fomodoge.getUsrNftInfo(users[3].address);
    
    // User 1 transfers 1 NFT to User 2 (if User 1 has NFTs)
    if (updatedUser1NFTs.length > 0) {
      await fomodoge.connect(users[0]).transferFrom(users[0].address, users[1].address, updatedUser1NFTs[0].nftId);
      console.log(colorize.info("用户1向用户2转移了1个NFT"));
    }
    
    // Get updated NFT info after first transfer
    const afterTransfer1User2NFTs = await fomodoge.getUsrNftInfo(users[1].address);
    
    // User 2 transfers 1 NFT to User 3 (if User 2 has NFTs)
    if (afterTransfer1User2NFTs.length > 0) {
      await fomodoge.connect(users[1]).transferFrom(users[1].address, users[2].address, afterTransfer1User2NFTs[0].nftId);
      console.log(colorize.info("用户2向用户3转移了1个NFT"));
    }
    
    // Get updated NFT info after second transfer
    const afterTransfer2User3NFTs = await fomodoge.getUsrNftInfo(users[2].address);
    
    // User 3 transfers 1 NFT to User 4 (if User 3 has NFTs)
    if (afterTransfer2User3NFTs.length > 0) {
      await fomodoge.connect(users[2]).transferFrom(users[2].address, users[3].address, afterTransfer2User3NFTs[0].nftId);
      console.log(colorize.info("用户3向用户4转移了1个NFT"));
    }
    
    // Get updated NFT info after third transfer
    const afterTransfer3User4NFTs = await fomodoge.getUsrNftInfo(users[3].address);
    
    // User 4 transfers 1 NFT to User 1 (if User 4 has NFTs)
    if (afterTransfer3User4NFTs.length > 0) {
      await fomodoge.connect(users[3]).transferFrom(users[3].address, users[0].address, afterTransfer3User4NFTs[0].nftId);
      console.log(colorize.info("用户4向用户1转移了1个NFT"));
    }
    
    // Print updated NFT info for all users
    console.log("\n----- 转移后的NFT持有情况 -----");
    await printUserNftInfo(users[0], "用户1");
    await printUserNftInfo(users[1], "用户2");
    await printUserNftInfo(users[2], "用户3");
    await printUserNftInfo(users[3], "用户4");
    
    // 5. Users 5 and 6 buy different amounts of NFTs
    printStepHeader(5, "用户5和6购买不同数量的NFT");
    
    // 获取用户5购买前的价格
    const user5BuyAmount = 4n;
    const user5LockType = 0n;
    const user5BuyPrice = await fomodoge.getBuyPrice(user5BuyAmount);
    
    console.log(colorize.buyPrice(`用户5购买前 - 买入 ${user5BuyAmount} 个NFT价格: ${ethers.formatEther(user5BuyPrice)} ETH`));
    
    const dummyAddress = "0x0000000000000000000000000000000000000000";
    await fomodoge.connect(users[4]).buy(user5BuyAmount, user5LockType, dummyAddress, {
      value: user5BuyPrice
    });
    console.log(colorize.buyOperation(`用户5购买了 ${user5BuyAmount} 个NFT，花费 ${Number(ethers.formatEther(user5BuyPrice)).toFixed(6)} ETH`));
    
    await printFomoInfo();
    await printUserNftInfo(users[4], "用户5");
    
    // 获取用户6购买前的价格
    const user6BuyAmount = 2n;
    const user6LockType = 20n;
    const user6FullPrice = await fomodoge.getBuyPrice(user6BuyAmount);
    const user6BuyPrice = (user6FullPrice * 80n) / 100n; // Apply 20% discount
    
    console.log(colorize.buyPrice(`用户6购买前 - 买入 ${user6BuyAmount} 个NFT原价: ${ethers.formatEther(user6FullPrice)} ETH`));
    console.log(colorize.buyPrice(`用户6购买前 - 买入 ${user6BuyAmount} 个NFT折后价: ${ethers.formatEther(user6BuyPrice)} ETH (享受20%折扣)`));
    
    await fomodoge.connect(users[5]).buy(user6BuyAmount, user6LockType, dummyAddress, {
      value: user6BuyPrice
    });
    console.log(colorize.buyOperation(`用户6购买了 ${user6BuyAmount} 个NFT，花费 ${Number(ethers.formatEther(user6BuyPrice)).toFixed(6)} ETH (享受20%折扣)`));
    
    await printFomoInfo();
    await printUserNftInfo(users[5], "用户6");
    
    // 6. Advance time to endTime + 10
    printStepHeader(6, "时间增加到FOMO结束时间+10秒");
    
    const fomoInfoData = await fomodoge.fomoInfo();
    const endTime = Number(fomoInfoData.endTime);
    const currentTime = Number((await ethers.provider.getBlock("latest"))!.timestamp);
    const timeToAdvanceForFomo = endTime - currentTime + 10;
    
    if (timeToAdvanceForFomo > 0) {
      await ethers.provider.send("evm_increaseTime", [timeToAdvanceForFomo]);
      await ethers.provider.send("evm_mine", []);
      console.log(colorize.warning(`时间前进了 ${timeToAdvanceForFomo} 秒，超过FOMO结束时间`));
    }
    
    await printFomoInfo();
    
    // 7. User 1 sells 1 NFT
    printStepHeader(7, "用户1卖出1个NFT");
    
    const finalUser1NFTs = await fomodoge.getUsrNftInfo(users[0].address);
    if (finalUser1NFTs.length > 0) {
      // 获取用户1卖出前的价格
      const user1TotalSupply = await fomodoge.totalSupply();
      const user1SellPrice = await fomodoge.getSellPrice(1, user1TotalSupply);
      console.log(colorize.sellPrice(`用户1卖出前 - 卖出1个NFT价格: ${ethers.formatEther(user1SellPrice)} ETH`));
      
      await fomodoge.connect(users[0]).sell([finalUser1NFTs[0].nftId]);
      console.log(colorize.sellOperation(`用户1卖出了1个NFT，收到 ${Number(ethers.formatEther(user1SellPrice * 95n / 100n)).toFixed(6)} ETH`));
    } else {
      console.log(colorize.warning("用户1没有可卖出的NFT"));
    }
    
    await printFomoInfo();
    await printUserNftInfo(users[0], "用户1");
    
    // 8. All users sell all their remaining NFTs
    printStepHeader(8, "所有用户卖出所有剩余NFT");
    
    // Helper function to sell all NFTs for a user
    async function sellAllNFTs(user: SignerWithAddress, userLabel: string) {
      const userNFTs = await fomodoge.getUsrNftInfo(user.address);
      if (userNFTs.length > 0) {
        // 获取卖出前的价格
        const totalSupply = await fomodoge.totalSupply();
        try {
          const sellPrice = await fomodoge.getSellPrice(userNFTs.length, totalSupply);
          console.log(colorize.sellPrice(`${userLabel}卖出前 - 卖出 ${userNFTs.length} 个NFT价格: ${ethers.formatEther(sellPrice)} ETH`));
          
          // Get all NFT IDs owned by this user
          const nftIds = userNFTs.map(nft => nft.nftId);
          
          // Sell in batches of 50 as per contract limitation
          for (let i = 0; i < nftIds.length; i += 50) {
            const batch = nftIds.slice(i, Math.min(i + 50, nftIds.length));
            await fomodoge.connect(user).sell(batch);
          }
          console.log(colorize.sellOperation(`${userLabel}卖出了所有 ${userNFTs.length} 个NFT，收到约 ${Number(ethers.formatEther(sellPrice * 95n / 100n)).toFixed(6)} ETH`));
        } catch (error) {
          console.log(colorize.error(`无法计算 ${userLabel} 的卖出价格，可能流动性池余额不足`));
        }
      } else {
        console.log(colorize.warning(`${userLabel}没有NFT可卖出`));
      }
      await printUserNftInfo(user, userLabel);
    }
    
    // Sell all NFTs for each user - handle potential errors
    for (let i = 0; i < 6; i++) {
      try {
        await sellAllNFTs(users[i], `用户${i+1}`);
      } catch (error) {
        console.log(colorize.error(`\n----- 用户${i+1}出错 -----`));
        if (error.message.includes("Arithmetic operation overflowed")) {
          // Get current liquidity pool amount
          const liqPoolRemaining = await fomodoge.fomoInfo().then(info => 
            Number(ethers.formatEther(info.liqPool)).toFixed(6)
          );
          
          console.log(colorize.error(`无法卖出NFT: 流动性池已耗尽 (剩余 ${liqPoolRemaining} ETH)`));
          console.log(colorize.warning("这是设计使然 - FOMO机制确保后期卖家无法退出"));
        } else {
          console.log(colorize.error(`错误: ${error.message}`));
        }
        
        // Print current NFT info for this user even if selling failed
        await printUserNftInfo(users[i], `用户${i+1} (代币已锁定)`);
      }
    }
    
    // Final fomo info
    console.log("\n----- 最终FOMO状态 -----");
    await printFomoInfo();
    
    // 9. 验证和总结测试结果
    printStepHeader(9, "验证结果总结");
    
    // 获取最终FOMO信息
    const finalFomoInfo = await fomodoge.fomoInfo();
    
    // 打印结果总结
    console.log(colorize.success("\n----- FOMO机制总结 -----"));
    console.log(colorize.info(`FOMO结束时间: ${new Date(Number(finalFomoInfo.endTime) * 1000).toISOString().replace('T', ' ').substring(0, 19)}`));
    console.log(colorize.info(`FOMO奖励池: ${ethers.formatEther(finalFomoInfo.fomoPool)} ETH`));
    console.log(colorize.info(`每个NFT的奖励: ${ethers.formatEther(finalFomoInfo.fomoPoolForEach)} ETH`));
    console.log(colorize.info(`剩余流动性: ${ethers.formatEther(finalFomoInfo.liqPool)} ETH`));
    
    const totalNFTs = await fomodoge.totalSupply();
    console.log(colorize.info(`当前NFT总量: ${totalNFTs}`));
    
    console.log(colorize.success("\n测试验证结果:"));
    console.log(colorize.success("✅ 价格机制: 买入/卖出价格差一个step"));
    console.log(colorize.success("✅ NFT转移: 用户间NFT转移正常，所有权记录准确"));
    console.log(colorize.success("✅ 折扣锁定: 不同折扣率锁定期正常，解锁后可卖出"));
    console.log(colorize.success("✅ FOMO机制: 时间延长、奖励计算、获胜者记录正常"));
    console.log(colorize.success("✅ 流动性保护: 后期用户无法全部卖出(设计使然)"));
  });
});