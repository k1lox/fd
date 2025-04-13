# FomoDoge 邀请记录查询工具

这个工具可以帮助查询 FomoDoge NFT 合约中的邀请记录、邀请佣金和 NFT 持有信息。

## 功能

- 查询用户邀请总人数和累计佣金
- 查询用户持有的 NFT 总数和可出售的 NFT 数量
- 查询详细的邀请记录，包括被邀请人、购买数量、购买金额和佣金等信息

## 安装

1. 克隆项目
```bash
git clone [项目地址]
cd invite-tracker
```

2. 安装依赖
```bash
npm install
```

3. 配置合约地址
编辑 `src/inviteTracker.ts` 文件，将 `CONTRACT_ADDRESS` 和 `RPC_URL` 替换为实际的合约地址和 RPC 提供商 URL。

## 使用方法

### 启动服务器

```bash
npm start
```

服务器将在 http://localhost:3000 上运行。

### 使用命令行工具

你也可以直接使用命令行工具查询指定地址的信息：

```bash
# 查询基本信息
npx ts-node src/inviteTracker.ts
```

### API 使用

服务器提供以下 API 端点：

- `GET /api/inviterInfo?address=0x...` - 获取邀请人基本信息
- `GET /api/nftStatus?address=0x...` - 获取 NFT 持有状态
- `GET /api/inviteRecords?address=0x...` - 获取详细邀请记录

## 技术实现详解

### 1. 从合约获取邀请记录的原理

FomoDoge合约在用户使用邀请码购买NFT时会触发`Buy`事件，该事件包含了邀请人和被邀请人的信息：

```solidity
event Buy(address indexed usr, address indexed inviter, uint amount, uint indexed value);
```

这个事件有三个indexed参数，可以被用作过滤条件：
- `usr`: 购买NFT的用户地址（被邀请人）
- `inviter`: 邀请人地址
- `value`: 购买金额

通过查询特定地址作为`inviter`的所有`Buy`事件，我们可以重建完整的邀请记录。

### 2. 区块链事件查询实现

在`inviteTracker.ts`文件中，我们使用ethers.js的事件过滤和查询功能来获取邀请记录：

```typescript
// 获取详细的邀请记录
async function getInviteRecords(inviterAddress: string) {
  try {
    // 创建过滤器，查找所有inviter为该地址的Buy事件
    const filter = contract.filters.Buy(null, inviterAddress);
    
    // 获取过去的事件（根据需要调整区块范围）
    const events = await contract.queryFilter(filter, -10000, 'latest');
    
    // 解析事件数据
    const inviteRecords = await Promise.all(events.map(async (event) => {
      const { usr, inviter, amount, value } = event.args!;
      
      // 获取交易时间
      const block = await provider.getBlock(event.blockNumber);
      
      return {
        invitedUser: usr,
        inviter: inviter,
        nftAmount: amount.toNumber(),
        value: ethers.utils.formatEther(value),
        commission: ethers.utils.formatEther(value.mul(2).div(100)), // INVITER_SHARE = 2
        timestamp: new Date(block.timestamp * 1000).toISOString(),
        txHash: event.transactionHash
      };
    }));
    
    return inviteRecords;
  } catch (error) {
    console.error('获取邀请记录失败:', error);
    throw error;
  }
}
```

关键步骤解析：

1. **创建事件过滤器**:
   ```typescript
   const filter = contract.filters.Buy(null, inviterAddress);
   ```
   - 第一个参数`null`表示我们不过滤`usr`（被邀请人）
   - 第二个参数`inviterAddress`表示我们只关注该地址作为邀请人的事件

2. **查询历史事件**:
   ```typescript
   const events = await contract.queryFilter(filter, -10000, 'latest');
   ```
   - `-10000`表示从当前块往前查询10000个区块
   - `'latest'`表示查询到最新区块

3. **解析事件数据**:
   ```typescript
   const { usr, inviter, amount, value } = event.args!;
   ```
   - 从事件参数中提取出我们需要的数据

4. **获取交易时间**:
   ```typescript
   const block = await provider.getBlock(event.blockNumber);
   ```
   - 根据事件所在区块号获取区块信息，从而得到时间戳

5. **计算佣金**:
   ```typescript
   commission: ethers.utils.formatEther(value.mul(2).div(100)) // INVITER_SHARE = 2
   ```
   - 根据合约中定义的邀请佣金比例（2%）计算

### 3. 前端获取和显示数据

前端通过API调用获取后端处理的数据：

```javascript
// 获取详细的邀请记录
async function fetchInviteRecords(address) {
  const response = await fetch(`${API_BASE_URL}/inviteRecords?address=${address}`);
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || '获取邀请记录失败');
  }
  return await response.json();
}
```

数据获取后，前端会格式化并显示这些记录：

```javascript
function displayResults(inviterInfo, nftStatus, inviteRecords) {
  // ...前面代码省略...
  
  // 显示邀请记录
  if (!inviteRecords || inviteRecords.length === 0) {
    recordsContainer.innerHTML = '<p>暂无邀请记录</p>';
  } else {
    recordsContainer.innerHTML = '';
    inviteRecords.forEach(record => {
      // 格式化地址显示
      const formatAddress = (addr) => addr ? 
        `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}` : 
        '未知地址';
      
      // 格式化时间显示
      const timestamp = record.timestamp ? 
        new Date(record.timestamp).toLocaleString() : 
        '未知时间';
      
      // 创建记录DOM元素...
    });
  }
}
```

### 4. 性能考虑与优化

在实际应用中，直接查询区块链上的事件可能会面临一些性能挑战：

1. **查询范围限制**：
   - 大多数RPC提供商限制了单次查询的区块范围
   - 对于长期运行的合约，需要实现分页查询或使用索引服务

2. **延迟问题**：
   - 区块链查询可能较慢，影响用户体验
   - 可以考虑实现缓存机制或使用专业的区块链索引服务（如The Graph）

3. **优化方案**：
   - 实现本地数据库缓存已查询的事件
   - 只查询新区块中的事件，增量更新数据
   - 使用WebSocket订阅新事件，实时更新数据

## 扩展应用

这个基本框架可以扩展用于跟踪更多链上活动：

1. 追踪特定NFT的交易历史
2. 监控用户提取佣金的操作
3. 分析邀请网络的结构和性能
4. 构建完整的邀请营销分析仪表板

## 技术栈

- TypeScript
- Express.js (后端API)
- ethers.js (区块链交互)
- HTML/CSS/JavaScript (前端界面)

## 注意事项

1. 确保RPC提供商有足够的查询限额支持您的应用程序
2. 生产环境中应实现适当的缓存机制以减少RPC调用
3. 考虑实现用户认证以保护敏感数据
4. 优化大量数据的显示逻辑，例如实现分页或虚拟滚动 