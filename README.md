[GitHub - k1lox/fd](https://github.com/k1lox/fd)

## 核心功能

### 🎮 FOMO 游戏机制

- 每次 NFT 购买都会将买家置于滚动的 FOMO 榜上
- NFT 购买会延长 FOMO 周期（最长可达 24 小时）
- 当 FOMO 周期结束时，奖励将分配给：
    - 最后 5 位买家（FOMO 池的 10%）
    - 所有 NFT 持有者按比例分配（FOMO 池的 50%）

### 💰 代币经济学

- **动态定价**：NFT 价格随每次购买而增加，随每次销售而减少
- **初始价格**：0.001 ETH
- **阶梯增长**：每个代币 0.00008 ETH
- **锁定折扣**：
    - 锁定 20 天可享受 20% 折扣
    - 锁定 50 天可享受 50% 折扣
    - 锁定 80 天可享受 70% 折扣

### 💸 收益分配

- 2% 作为推荐奖励给邀请人
- 1% 进入协议金库
- 10% 进入 FOMO 奖励池
- 卖出 NFT 时，卖家获得 95% 的收益

## 智能合约接口

### NFT 购买

```solidity
// 带邀请人的购买
function buy(uint amount, uint lockType, address inviteAddress) external payable;
// 不带邀请人的购买
function buy(uint amount, uint lockType) external payable;
```

- `amount`：要购买的 NFT 数量
- `lockType`：锁定期折扣（0、20、50 或 70）
- `inviteAddress`：邀请人地址（如适用）

### NFT 出售

```solidity
function sell(uint256[] memory usrTokens) external;
```

- `usrTokens`：要出售的 NFT ID 数组（每笔交易最多 50 个）
- NFT 只能在锁定期过后出售

### 奖励提取

```solidity
function withdraw() external;
```

提取可用奖励（来自邀请和 FOMO 分配）

### 查询功能

```solidity
// 获取给定数量的当前购买价格
function getBuyPrice(uint amount) external view returns (uint);

// 获取给定数量的当前出售价格
function getSellPrice(uint amount, uint total) external view returns (uint);

// 获取特定用户的 NFT 信息
function getUsrNftInfo(address usr) external view returns (NftInfo[] memory);

// 可提取余额
function usrCanWithdraw(address usr) external view returns (uint);

// 用户持有的nft

```

```tsx
// 获取可出售的NFT数量（即已解锁的NFT）
async function getSellableNFTs(address, contract) {
  // 获取用户所有NFT的详细信息
  const nftsInfo = await contract.getUsrNftInfo(address);
  const currentTimestamp = Math.floor(Date.now() / 1000); // 当前时间戳(秒)
  
  // 过滤出已解锁的NFT
  const sellableNFTs = nftsInfo.filter(nft => 
    nft.unLockTime <= currentTimestamp
  );
  
  return {
    total: nftsInfo.length,
    sellable: sellableNFTs.length
  };
}
```

## 限制条件

- 每个地址最多 100 个 NFT
- NFT 只能在锁定期过后出售
- 单笔交易最多可出售 50 个 NFT

## 项目链接

- 网站：[https://fomodoge.com](https://fomodoge.com/)
- Twitter：https://x.com/FomoDogeX
- Telegram：https://t.me/FomodogeETH

## URI

```tsx
{
  "name": "FomoDoge",
  "description": "FomoDoge",
  "image": "https://www.fomodoge.com/pic/430.png",
}

https://www.fomodoge.com/uri/430.json
https://www.fomodoge.com/pic/430.png
```

## 邀请记录

[fd/invite-tracker at main · k1lox/fd](https://github.com/k1lox/fd/tree/main/invite-tracker)