import { ethers } from 'ethers';
import abi from './abi.json';

// 配置信息
const CONTRACT_ADDRESS = '0xDa9374179cEd144398bdd218C5a16e1Ab839f2c7'; // 替换为实际合约地址
const RPC_URL = 'https://rpc.ankr.com/bsc/9c9763b95d62a8269670b0aa089f1ba82604d70f86115ee5185f54c6a837166f'; // 替换为您的RPC URL

// 初始化provider和合约实例
const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
const contract = new ethers.Contract(CONTRACT_ADDRESS, abi, provider);

// 获取用户邀请总数和累计佣金
async function getInviterInfo(address: string) {
  try {
    const userInfo = await contract.usrInfo(address);
    
    return {
      inviteTotal: userInfo.inviteTotal.toNumber(),
      commission: ethers.utils.formatEther(userInfo.usrBalance),
      balanceForShare: ethers.utils.formatEther(userInfo.usrBalanceForShare)
    };
  } catch (error) {
    console.error('获取邀请信息失败:', error);
    throw error;
  }
}

// 获取详细的邀请记录
async function getInviteRecords(inviterAddress: string) {
  try {
    // 创建过滤器，查找所有inviter为该地址的Buy事件
    const filter = contract.filters.Buy(null, inviterAddress);
    
    // 获取过去的事件（根据需要调整区块范围）
    // 注意: 生产环境中应该分块查询或使用专业索引服务
    const events = await contract.queryFilter(filter, 48295246, 'latest');
    
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

// 获取地址持有的NFT总数和可出售的NFT数量
async function getNFTStatus(address: string) {
  try {
    // 获取持有的NFT总数量
    const balance = await contract.balanceOf(address);
    
    // 获取NFT详细信息
    const nftsInfo = await contract.getUsrNftInfo(address);
    const currentTimestamp = Math.floor(Date.now() / 1000);
    
    // 过滤出已解锁的NFT
    const sellableNFTs = nftsInfo.filter((nft: any) => 
      nft.unLockTime.toNumber() <= currentTimestamp
    );
    
    return {
      total: balance.toNumber(),
      sellable: sellableNFTs.length
    };
  } catch (error) {
    console.error('获取NFT状态失败:', error);
    throw error;
  }
}

// 示例使用
async function main() {
  const testAddress = '0xYourAddress'; // 替换为要查询的地址
  
  try {
    console.log('======= 邀请信息 =======');
    const inviterInfo = await getInviterInfo(testAddress);
    console.log('邀请总数:', inviterInfo.inviteTotal);
    console.log('累计佣金:', inviterInfo.commission, 'ETH');
    
    console.log('\n======= NFT状态 =======');
    const nftStatus = await getNFTStatus(testAddress);
    console.log('持有NFT总数:', nftStatus.total);
    console.log('可出售NFT数量:', nftStatus.sellable);
    
    console.log('\n======= 邀请记录 =======');
    const records = await getInviteRecords(testAddress);
    console.log(`共有 ${records.length} 条邀请记录:`);
    records.forEach((record, index) => {
      console.log(`\n记录 #${index + 1}:`);
      console.log(`被邀请人: ${record.invitedUser}`);
      console.log(`购买数量: ${record.nftAmount}`);
      console.log(`购买金额: ${record.value} ETH`);
      console.log(`佣金: ${record.commission} ETH`);
      console.log(`时间: ${record.timestamp}`);
      console.log(`交易哈希: ${record.txHash}`);
    });
  } catch (error) {
    console.error('运行失败:', error);
  }
}

// 运行主函数
if (require.main === module) {
  main();
}

// 导出函数供其他模块使用
export {
  getInviterInfo,
  getInviteRecords,
  getNFTStatus
}; 