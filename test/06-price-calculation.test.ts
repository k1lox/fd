import { ethers } from "hardhat";
import { expect } from "chai";
import { deployContracts, CONSTANTS } from "./00-setup.test";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("FomoDoge 价格计算测试", function () {
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

  it("应该正确计算初始购买价格", async function () {
    // 验证购买1个NFT的价格
    const price1 = await fomodoge.getBuyPrice(1);
    expect(price1).to.equal(CONSTANTS.START_PRICE);

    // 验证购买多个NFT的价格
    const amount = 5;
    const price5 = await fomodoge.getBuyPrice(amount);
    
    // 手动计算预期价格：
    // 基础部分：amount * START_PRICE
    // 阶梯部分：PRICE_STEP * (amount * totalSupply + (amount * (amount - 1)) / 2)
    // 其中totalSupply = 0, 所以阶梯部分 = PRICE_STEP * (amount * (amount - 1)) / 2)
    const basePart = CONSTANTS.START_PRICE.mul(amount);
    const stepPart = CONSTANTS.PRICE_STEP.mul(amount * (amount - 1) / 2);
    const expectedPrice = basePart.add(stepPart);
    
    expect(price5).to.equal(expectedPrice);
  });

  it("应该在每次购买后增加价格", async function () {
    const buyer = buyers[0];
    
    // 记录初始价格
    const initialPrice1 = await fomodoge.getBuyPrice(1);
    
    // 购买1个NFT
    await fomodoge.connect(buyer).buy(1, 0, { value: initialPrice1 });
    
    // 验证价格增加
    const priceAfterBuy1 = await fomodoge.getBuyPrice(1);
    expect(priceAfterBuy1).to.be.gt(initialPrice1);
    
    // 计算预期的新价格（总供应量为1）
    const expectedPrice = CONSTANTS.START_PRICE.add(CONSTANTS.PRICE_STEP.mul(1));
    expect(priceAfterBuy1).to.equal(expectedPrice);
    
    // 购买3个NFT
    const price3 = await fomodoge.getBuyPrice(3);
    await fomodoge.connect(buyer).buy(3, 0, { value: price3 });
    
    // 验证价格再次增加
    const priceAfterBuy3 = await fomodoge.getBuyPrice(1);
    expect(priceAfterBuy3).to.be.gt(priceAfterBuy1);
    
    // 计算预期的新价格（总供应量为4）
    const expectedPrice2 = CONSTANTS.START_PRICE.add(CONSTANTS.PRICE_STEP.mul(4));
    expect(priceAfterBuy3).to.equal(expectedPrice2);
  });

  it("应该在每次售卖后减少价格", async function () {
    const buyer = buyers[0];
    
    // 先购买5个NFT，建立初始供应量
    const initialBuyPrice = await fomodoge.getBuyPrice(5);
    await fomodoge.connect(buyer).buy(5, 0, { value: initialBuyPrice });
    
    // 记录售卖前的价格
    const priceBeforeSell = await fomodoge.getBuyPrice(1);
    
    // 售卖2个NFT
    const nftInfo = await fomodoge.getUsrNftInfo(buyer.address);
    const nftIdsToSell = nftInfo.slice(0, 2).map((nft: any) => nft.nftId);
    await fomodoge.connect(buyer).sell(nftIdsToSell);
    
    // 验证价格减少
    const priceAfterSell = await fomodoge.getBuyPrice(1);
    expect(priceAfterSell).to.be.lt(priceBeforeSell);
    
    // 计算预期的新价格（总供应量从5减少到3）
    const expectedPrice = CONSTANTS.START_PRICE.add(CONSTANTS.PRICE_STEP.mul(3));
    expect(priceAfterSell).to.equal(expectedPrice);
  });

  it("应该正确计算折扣价格", async function () {
    // 获取无折扣价格
    const amount = 2;
    const fullPrice = await fomodoge.getBuyPrice(amount);
    
    // 手动计算折扣价格
    const twentyOffPrice = fullPrice.mul(80).div(100); // 20%折扣
    const fiftyOffPrice = fullPrice.mul(50).div(100);  // 50%折扣
    const seventyOffPrice = fullPrice.mul(30).div(100); // 70%折扣
    
    // 验证实际购买时使用的折扣价格
    const buyer = buyers[0];
    
    // 20%折扣购买
    await fomodoge.connect(buyer).buy(amount, 20, { value: twentyOffPrice });
    
    // 验证NFT数量
    expect(await fomodoge.balanceOf(buyer.address)).to.equal(amount);
    
    // 50%折扣购买
    await fomodoge.connect(buyer).buy(amount, 50, { value: fiftyOffPrice });
    
    // 验证总NFT数量
    expect(await fomodoge.balanceOf(buyer.address)).to.equal(amount * 2);
    
    // 70%折扣购买
    await fomodoge.connect(buyer).buy(amount, 70, { value: seventyOffPrice });
    
    // 验证总NFT数量
    expect(await fomodoge.balanceOf(buyer.address)).to.equal(amount * 3);
  });

  it("应该正确计算批量购买的价格", async function () {
    // 验证不同数量NFT的价格
    const prices = await Promise.all([1, 5, 10, 20, 50].map(amount => 
      fomodoge.getBuyPrice(amount)
    ));
    
    // 验证价格随数量增加而增加
    for (let i = 1; i < prices.length; i++) {
      expect(prices[i]).to.be.gt(prices[i-1]);
    }
    
    // 验证批量购买比单个一个一个买便宜
    const price10 = prices[2]; // 10个NFT的价格
    const price5x2 = prices[1].mul(2); // 两次购买5个NFT的价格
    
    // 批量购买应该更便宜，因为阶梯价格的计算方式
    expect(price10).to.be.lt(price5x2);
  });

  it("应该正确计算售卖价格", async function () {
    const buyer = buyers[0];
    
    // 购买10个NFT建立初始状态
    const buyPrice = await fomodoge.getBuyPrice(10);
    await fomodoge.connect(buyer).buy(10, 0, { value: buyPrice });
    
    // 获取售卖5个NFT的价格
    const totalSupply = await fomodoge.totalSupply();
    const sellAmount = 5;
    const sellPrice = await fomodoge.getSellPrice(sellAmount, totalSupply);
    
    // 手动计算预期售卖价格
    // 基础部分：amount * START_PRICE
    // 阶梯部分：PRICE_STEP * (amount * (total - 1) - (amount * (amount - 1)) / 2)
    const basePart = CONSTANTS.START_PRICE.mul(sellAmount);
    const stepPart = CONSTANTS.PRICE_STEP.mul(sellAmount * (totalSupply - 1) - (sellAmount * (sellAmount - 1)) / 2);
    const expectedSellPrice = basePart.add(stepPart);
    
    expect(sellPrice).to.equal(expectedSellPrice);
    
    // 验证实际售卖
    const nftInfo = await fomodoge.getUsrNftInfo(buyer.address);
    const nftIdsToSell = nftInfo.slice(0, sellAmount).map((nft: any) => nft.nftId);
    
    // 记录售卖前余额
    const balanceBefore = await ethers.provider.getBalance(buyer.address);
    
    // 执行售卖
    const sellTx = await fomodoge.connect(buyer).sell(nftIdsToSell);
    const receipt = await sellTx.wait();
    const gasUsed = receipt.gasUsed.mul(receipt.effectiveGasPrice);
    
    // 计算预期获得的ETH（95%的售卖价格）
    const expectedProceeds = sellPrice.mul(CONSTANTS.SELL_SHARE).div(100);
    
    // 获取售卖后余额
    const balanceAfter = await ethers.provider.getBalance(buyer.address);
    
    // 验证余额变化（考虑gas费用）
    expect(balanceAfter.sub(balanceBefore).add(gasUsed)).to.be.closeTo(
      expectedProceeds,
      ethers.utils.parseEther("0.0001") // 允许小误差
    );
  });

  it("应该模拟多用户交叉买卖场景下的价格变化", async function () {
    const [buyer1, buyer2, buyer3] = buyers;
    
    // ===== 第一轮交易 =====
    // buyer1购买5个NFT
    let price = await fomodoge.getBuyPrice(5);
    await fomodoge.connect(buyer1).buy(5, 0, { value: price });
    
    // 记录当前价格
    const priceAfterBuyer1 = await fomodoge.getBuyPrice(1);
    
    // buyer2购买3个NFT
    price = await fomodoge.getBuyPrice(3);
    await fomodoge.connect(buyer2).buy(3, 0, { value: price });
    
    // 记录当前价格
    const priceAfterBuyer2 = await fomodoge.getBuyPrice(1);
    expect(priceAfterBuyer2).to.be.gt(priceAfterBuyer1);
    
    // ===== 第二轮交易 =====
    // buyer1售卖2个NFT
    const nftInfo1 = await fomodoge.getUsrNftInfo(buyer1.address);
    const nftIdsToSell1 = nftInfo1.slice(0, 2).map((nft: any) => nft.nftId);
    await fomodoge.connect(buyer1).sell(nftIdsToSell1);
    
    // 记录当前价格
    const priceAfterSell1 = await fomodoge.getBuyPrice(1);
    expect(priceAfterSell1).to.be.lt(priceAfterBuyer2);
    
    // buyer3购买4个NFT
    price = await fomodoge.getBuyPrice(4);
    await fomodoge.connect(buyer3).buy(4, 0, { value: price });
    
    // 记录当前价格
    const priceAfterBuyer3 = await fomodoge.getBuyPrice(1);
    expect(priceAfterBuyer3).to.be.gt(priceAfterSell1);
    
    // ===== 第三轮交易 =====
    // buyer2售卖所有NFT
    const nftInfo2 = await fomodoge.getUsrNftInfo(buyer2.address);
    const nftIdsToSell2 = nftInfo2.map((nft: any) => nft.nftId);
    await fomodoge.connect(buyer2).sell(nftIdsToSell2);
    
    // 记录当前价格
    const priceAfterSell2 = await fomodoge.getBuyPrice(1);
    expect(priceAfterSell2).to.be.lt(priceAfterBuyer3);
    
    // buyer1再购买2个NFT
    price = await fomodoge.getBuyPrice(2);
    await fomodoge.connect(buyer1).buy(2, 0, { value: price });
    
    // 记录最终价格
    const finalPrice = await fomodoge.getBuyPrice(1);
    expect(finalPrice).to.be.gt(priceAfterSell2);
    
    // 验证总供应量
    const expectedSupply = 5 - 2 + 3 + 4 - 3 + 2; // 初始状态 + 所有交易
    expect(await fomodoge.totalSupply()).to.equal(expectedSupply);
    
    // 验证最终价格符合预期
    const expectedFinalPrice = CONSTANTS.START_PRICE.add(CONSTANTS.PRICE_STEP.mul(expectedSupply));
    expect(finalPrice).to.equal(expectedFinalPrice);
  });
}); 