[GitHub - k1lox/fd](https://github.com/k1lox/fd)

## 合约地址
0x580DE219b997aF4d479b39777eeBe3b8f976D913
起始区块：
48415777

测试代币地址：
0x0437c8d767755Ae2Bb3314700C49605cBC0a49a2

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

// 如何deposit
// 如何查看可领取的reward
// 如何领取reward
// 领取reward后，如果该池子质押结束，方可解除质押状态

## 存款和奖励管理

### 存入ETH (Deposit)

```solidity
function deposit() external payable;
```

用户可以向合约存入ETH，用于购买NFT或参与流动性池。

```tsx
// 存入ETH到合约
async function depositETH(amount, contract) {
  try {
    // 金额转换为wei
    const amountInWei = ethers.utils.parseEther(amount.toString());
    
    const tx = await contract.deposit({ value: amountInWei });
    const receipt = await tx.wait();
    
    return {
      success: true,
      txHash: receipt.transactionHash
    };
  } catch (error) {
    console.error("Deposit failed:", error);
    return { success: false, error };
  }
}

// 获取用户在合约中的存款余额
async function getUserBalance(address, contract) {
  const userInfo = await contract.usrInfo(address);
  return ethers.utils.formatEther(userInfo.usrBalance);
}
```

### 查看可领取的奖励 (Check Rewards)

```solidity
function usrCanWithdraw(address usr) external view returns (uint);
```

用户可以查看自己当前可以提取的奖励金额。

```tsx
// 获取用户可提取的奖励金额
async function getClaimableRewards(address, contract) {
  try {
    const rewardsWei = await contract.usrCanWithdraw(address);
    const rewardsETH = ethers.utils.formatEther(rewardsWei);
    
    return {
      success: true,
      rewards: rewardsETH,
      rewardsWei
    };
  } catch (error) {
    console.error("Failed to fetch rewards:", error);
    return { success: false, rewards: "0", error };
  }
}
```

### 领取奖励 (Claim Rewards)

```solidity
function withdraw() external;
```

用户可以提取所有可用奖励，包括邀请奖励和FOMO分配。

```tsx
// 提取用户的奖励
async function claimRewards(contract) {
  try {
    const tx = await contract.withdraw();
    const receipt = await tx.wait();
    
    return {
      success: true,
      txHash: receipt.transactionHash
    };
  } catch (error) {
    console.error("Rewards claim failed:", error);
    return { success: false, error };
  }
}
```

### 解除质押 (Unstake)

在用户领取奖励后，如果该池子的质押周期已结束，则可以解除质押状态。

```tsx
// 检查质押池状态
async function checkStakingPoolStatus(poolId, contract) {
  try {
    const poolInfo = await contract.stakingPools(poolId);
    const currentTime = Math.floor(Date.now() / 1000);
    
    return {
      success: true,
      isEnded: currentTime > poolInfo.endTime,
      endTime: new Date(Number(poolInfo.endTime) * 1000)
    };
  } catch (error) {
    console.error("Failed to check pool status:", error);
    return { success: false, error };
  }
}

// 解除质押
async function unstake(poolId, amount, contract) {
  try {
    const tx = await contract.unstake(poolId, amount);
    const receipt = await tx.wait();
    
    return {
      success: true,
      txHash: receipt.transactionHash
    };
  } catch (error) {
    console.error("Unstaking failed:", error);
    return { success: false, error };
  }
}
```

## 前端集成示例

```jsx
function RewardsManager() {
  const [claimableRewards, setClaimableRewards] = useState("0");
  const [userBalance, setUserBalance] = useState("0");
  const [isLoading, setIsLoading] = useState(false);
  
  useEffect(() => {
    if (account) {
      fetchUserData();
    }
  }, [account]);
  
  async function fetchUserData() {
    const rewards = await getClaimableRewards(account, contract);
    const balance = await getUserBalance(account, contract);
    
    if (rewards.success) setClaimableRewards(rewards.rewards);
    setUserBalance(balance);
  }
  
  const handleDeposit = async (amount) => {
    setIsLoading(true);
    const result = await depositETH(amount, contract);
    setIsLoading(false);
    
    if (result.success) {
      fetchUserData();
      toast.success("存款成功！");
    } else {
      toast.error("存款失败，请重试");
    }
  };
  
  const handleClaim = async () => {
    setIsLoading(true);
    const result = await claimRewards(contract);
    setIsLoading(false);
    
    if (result.success) {
      fetchUserData();
      toast.success("奖励已成功领取！");
    } else {
      toast.error("领取失败，请重试");
    }
  };
  
  return (
    <div className="rewards-container">
      <div className="balance-info">
        <h3>你的余额</h3>
        <p>{userBalance} ETH</p>
      </div>
      
      <div className="rewards-info">
        <h3>可领取奖励</h3>
        <p>{claimableRewards} ETH</p>
        <button 
          disabled={isLoading || claimableRewards === "0"} 
          onClick={handleClaim}
        >
          {isLoading ? "处理中..." : "领取奖励"}
        </button>
      </div>
      
      <div className="deposit-form">
        <h3>存入ETH</h3>
        <input type="number" min="0" step="0.01" placeholder="输入ETH数量" />
        <button 
          disabled={isLoading} 
          onClick={() => handleDeposit(depositAmount)}
        >
          {isLoading ? "处理中..." : "存入"}
        </button>
      </div>
    </div>
  );
}
```
