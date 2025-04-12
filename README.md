# FomoDoge 项目

## 项目概述

FomoDoge 是一个基于以太坊区块链的动态 NFT 项目，它结合了可收藏 NFT 与博弈论元素。该项目实现了独特的 FOMO（Fear Of Missing Out，错失恐惧）机制，并结合债券曲线定价模型，为持有者创造了一个引人入胜的生态系统。

## 核心功能

### 🎮 FOMO 游戏机制
- 每次 NFT 购买都会将买家置于滚动的 FOMO 排行榜上
- NFT 购买会延长 FOMO 周期（最长可达 24 小时）
- 当 FOMO 周期结束时，奖励将分配给：
  - 最后 5 位买家（FOMO 池的 10%）
  - 所有 NFT 持有者按比例分配（FOMO 池的 50%）

### 💰 代币经济学
- **动态定价**：NFT 价格随每次购买而增加，随每次销售而减少
- **初始价格**：0.001 ETH（1,000,000,000,000,000 wei）
- **阶梯增长**：每个代币 0.00008 ETH（80,000,000,000,000 wei）
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

// 带邀请人的购买
function buy(uint amount, uint lockType, address inviteAddress) external payable;

// 不带邀请人的购买
function buy(uint amount, uint lockType) external payable;

- `amount`：要购买的 NFT 数量
- `lockType`：锁定期折扣（0、20、50 或 70）
- `inviteAddress`：邀请人地址（如适用）

### NFT 出售

function sell(uint256[] memory usrTokens) external;

- `usrTokens`：要出售的 NFT ID 数组（每笔交易最多 50 个）
- NFT 只能在锁定期过后出售

### 奖励提取

function withdraw() external;

提取可用奖励（来自邀请和 FOMO 分配）

### 查询功能

// 获取给定数量的当前购买价格
function getBuyPrice(uint amount) external view returns (uint);

// 获取给定数量的当前出售价格
function getSellPrice(uint amount, uint total) external view returns (uint);

// 获取特定用户的 NFT 信息
function getUsrNftInfo(address usr) external view returns (NftInfo[] memory);

// 可提取余额
function usrCanWithdraw(address usr) external view returns (uint);

## 限制条件
- 每个地址最多 100 个 NFT
- NFT 只能在锁定期过后出售
- 单笔交易最多可出售 50 个 NFT

## 项目链接
- 网站：https://fomodoge.com
- Twitter：https://x.com/FomoDogeX
- Telegram：https://t.me/FomodogeETH