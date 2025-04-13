import express, { Request, Response } from 'express';
import path from 'path';
import { getInviterInfo, getInviteRecords, getNFTStatus } from './inviteTracker';

const app = express();
const port = process.env.PORT || 3000;

// 静态文件服务
app.use(express.static(path.join(__dirname, '../public')));

// API路由
app.get('/api/inviterInfo', async (req: Request, res: Response) => {
  try {
    const address = req.query.address as string;
    if (!address || !address.startsWith('0x')) {
      return res.status(400).json({ error: '无效的地址' });
    }
    
    const inviterInfo = await getInviterInfo(address);
    res.json(inviterInfo);
  } catch (error) {
    console.error('获取邀请信息失败:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

app.get('/api/nftStatus', async (req: Request, res: Response) => {
  try {
    const address = req.query.address as string;
    if (!address || !address.startsWith('0x')) {
      return res.status(400).json({ error: '无效的地址' });
    }
    
    const nftStatus = await getNFTStatus(address);
    res.json(nftStatus);
  } catch (error) {
    console.error('获取NFT状态失败:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

app.get('/api/inviteRecords', async (req: Request, res: Response) => {
  try {
    const address = req.query.address as string;
    if (!address || !address.startsWith('0x')) {
      return res.status(400).json({ error: '无效的地址' });
    }
    
    const inviteRecords = await getInviteRecords(address);
    res.json(inviteRecords);
  } catch (error) {
    console.error('获取邀请记录失败:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 主页路由
app.get('/', (req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// 启动服务器
app.listen(port, () => {
  console.log(`服务器运行在 http://localhost:${port}`);
}); 