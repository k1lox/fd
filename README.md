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

## NFT质押功能

### deposit函数用法

```solidity
function deposit(uint id, uint256[] memory usrTokens) public;
```

- `id`：存款池ID，指定要存入的池子
- `usrTokens`：要存入的NFT ID数组
- 存款条件：
  - 存款池必须存在（startTime > 0）
  - 存款池必须未结束（当前时间 <= endTime）
  - NFT必须属于调用者且未被质押

使用示例：
```javascript
// 存入ID为1、2、3的NFT到存款池1
await fomodoge.deposit(1, [1, 2, 3]);
```

### withdrawDepositReward函数用法

```solidity
function withdrawDepositReward(uint id) public nonReentrant;
```

- `id`：要从中提取奖励的存款池ID
- 提取条件：
  - 存款池必须存在（startTime > 0）
  - 存款池必须已结束（当前时间 > endTime）
  - 用户必须有奖励可提取（奖励金额 > 0）

使用示例：
```javascript
// 从存款池1中提取奖励
await fomodoge.withdrawDepositReward(1);
```

### 如何获取每个deposit池子的基本信息

```solidity
mapping(uint => DepositPool) public depositPool;

struct DepositPool {
    uint startTime;         // 池子开始时间
    uint endTime;           // 池子结束时间
    uint tokenAmount;       // 奖励代币总量
    uint pointsTotalAdv;    // 累积的积分总量（不要读这个）
    uint depositUsrAmounts; // 存款用户数量
    uint depositNFTAmounts; // 存款NFT总数
    uint usrLatestDepositTime; // 最近一次存款时间
}
```

使用示例：
```javascript
// 获取ID为1的存款池信息
const poolInfo = await fomodoge.depositPool(1);
console.log("池子开始时间:", new Date(Number(poolInfo.startTime) * 1000));
console.log("池子结束时间:", new Date(Number(poolInfo.endTime) * 1000));
console.log("奖励代币总量:", ethers.utils.formatEther(poolInfo.tokenAmount));
console.log("存款用户数量:", poolInfo.depositUsrAmounts.toString());
console.log("存款NFT总数:", poolInfo.depositNFTAmounts.toString());
```

### 如何获取指定用户在指定池子的基本信息

```solidity
mapping(address => mapping(uint => UsrDepositInfo)) public usrDepositInfo;

struct UsrDepositInfo {
    uint[] usrDepositNfts;      // 用户存入的NFT ID数组
    uint usrDepositPointsAdv;   // 用户累积的积分（不要读这个）
    uint usrLatestDepositTime;  // 用户最近一次存款时间
    uint usrDepositAmounts;     // 用户存入的NFT数量
}
```

使用示例：
```javascript
// 获取用户在ID为1的存款池中的信息
const userDepositInfo = await fomodoge.usrDepositInfo(userAddress, 1);
console.log("用户存入NFT数量:", userDepositInfo.usrDepositAmounts.toString());
console.log("用户最近存款时间:", new Date(Number(userDepositInfo.usrLatestDepositTime) * 1000));
console.log("用户累积积分:", userDepositInfo.usrDepositPointsAdv.toString());

// 获取用户存入的所有NFT ID
const nftIds = userDepositInfo.usrDepositNfts;
console.log("用户存入的NFT IDs:", nftIds.map(id => id.toString()));
```

### 如何获取指定用户在指定池子质押结束后预计获得的ERC20代币数量

```solidity
function getUsrDepositReward(address usr, uint id) public view returns(uint);
```

- `usr`：用户地址
- `id`：存款池ID
- 返回值：用户可获得的ERC20代币奖励数量

使用示例：
```javascript
// 获取用户在ID为1的存款池中的预计奖励
const reward = await fomodoge.getUsrDepositReward(userAddress, 1);
console.log("预计获得奖励:", ethers.utils.formatEther(reward), "代币");
```

奖励计算方式：
- 基于用户在池中的积分占比分配奖励
- 积分 = 存款NFT数量 × 存款时长
- 用户奖励 = 池子总奖励 × (用户积分 / 池子总积分)