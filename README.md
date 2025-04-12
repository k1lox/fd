合约名称与部署
	•	合约名称：FomoDoge
	•	构造参数：无
	•	继承自：ERC721A, Ownable, ReentrancyGuard
	•	编译版本：Solidity ^0.8.20

⸻

主要函数

1. buy(uint amount, uint lockType, address inviteAddress) / buy(uint amount, uint lockType)

功能
	•	用于购买（铸造）NFT，amount 表示要买多少个 NFT，lockType 表示锁定类型（0、20、50 或 70），影响实际付费金额和解锁时间。
	•	可选填邀请人地址 inviteAddress（或者不填，直接调用另一个函数版本）。
	•	购买时会更新 FOMO 池、liquidity 池、协议分成等。

前端调用要点
	•	payable 函数，需要在调用时附带足够的 ETH；msg.value 建议根据 getBuyPrice(amount) * (100 - lockType) / 100（并留意一点余量）进行发送。
	•	如果实际发送的 ETH 超过需求，多余部分会自动退款给调用者。
	•	lockType 仅能是 0, 20, 50, 70。

⸻

2. sell(uint256[] memory usrTokens)

功能
	•	卖出指定的 NFT（最多一次可卖出 50 个 tokenId）。
	•	卖出成功后得到对应的卖出价格（基于 getSellPrice 计算），并从合约的 liqPool 中支付给用户（扣除一定手续费和协议分成）。
	•	只有超过解锁时间 (nftInfo[tokenId].unLockTime <= block.timestamp) 的 NFT 才能卖出。

前端调用要点
	•	需要传入欲卖出的 NFT tokenId 数组。
	•	卖出后，每个成功卖出的 NFT 会被销毁（burn），无法再交易。
	•	由于有数量上限（<= 50），如果想卖出更多则需要分批操作。

⸻

3. withdraw()

功能
	•	提取当前账号可领取的 ETH 余额到钱包。
	•	该余额包含：
	•	直接累计的分成 (usrBalance)
	•	如果 FOMO 已结束，还有用户持有 NFT 数量对应的“全员分红” (usrBalanceForShare * fomoPoolForEach)

前端调用要点
	•	调用后把相应的 ETH 转回调用地址。
	•	可随时调用，但如果尚未产生可提余额，则会失败。

⸻

4. getUsrNftInfo(address usr) → NftInfo[]

功能
	•	获取某个地址当前持有的所有 NFT 的详细信息，包括 unLockTime, nftId, PoolId, pos。
	•	其中 unLockTime 最常用，可以据此判断对应的 NFT 是否可卖。

前端调用要点
	•	无需付费调用，直接可读合约。
	•	可在页面显示用户的 NFT 列表及其解锁状态。

⸻

5. usrCanWithdraw(address usr) → uint

功能
	•	查询指定地址当前可提取的 ETH 数量。
	•	包括未领取的分成和若 FOMO 已结束则包含 FOMO 全员分红。

前端调用要点
	•	建议在用户进入“我的收益”或“提现”界面时调用，显示可提金额。

⸻

6. getBuyPrice(uint amount) → uint

功能
	•	查询购买 amount 个 NFT 的总原价（未考虑 lockType 折扣）。
	•	用于前端实时显示“购买多少个需支付多少 ETH”的数值。

前端调用要点
	•	通常前端要根据 lockType 的折扣来计算实际需要支付的金额：
\text{finalPrice} = \text{getBuyPrice(amount)} \times \bigl(100 - lockType\bigr) / 100

⸻

7. getSellPrice(uint amount, uint total) → uint

功能
	•	计算卖出 amount 个 NFT 所能获得的总基础价格。合约最终会根据此值再扣除一定的分配比例。
	•	通常合约内部调用，不常由前端直接调用。

⸻

8. tokenURI(uint256 tokenId) → string

功能
	•	返回该 NFT 的元数据 URI。默认返回类似 https://www.fomodoge.com/uri/xxx.json 的格式。

前端调用要点
	•	可用来显示 NFT 图像和元数据。
	•	通常在加载 NFT 列表或单个 NFT 信息时调用。

⸻

主要事件
	•	Buy(address indexed usr, address indexed inviter, uint amount, uint value)
当用户购买成功后触发。
	•	Sell(address indexed usr, uint amount, uint value)
当用户卖出成功后触发。
	•	FOMO(address winner1, address winner2, address winner3, address winner4, address winner5, uint fomopool, bool isEnded)
FOMO 相关事件，更新最近 5 位购买用户，或者 FOMO 结束时进行分配时触发。

⸻

注意事项
	1.	锁定期
	•	如果选择了 lockType=20/50/70，则会有对应的解锁时间（20天、50天、80天）。在此期间无法卖出。
	•	lockType=0 则无锁定期，但需要支付全价。
	2.	FOMO 机制
	•	合约中维护了一个 endTime，每当有人购买 NFT，都会往后推延一段时间（每个 NFT 5 分钟，上限 24 小时）。
	•	如果 endTime 到期前无人购买，则 FOMO 结束，最后 5 位购买者各自拿到额外的 FOMO 奖励。
	•	此后，所有持有者也可从 FOMO 池领取分红（提现时自动获取）。
	3.	买卖上限
	•	每个地址最多可铸造 100 个 NFT；
	•	卖出时一次最多操作 50 个。
	4.	安全与重入
	•	合约使用了 ReentrancyGuard 修饰，前端无需关心，但应确保每次 buy / sell / withdraw 都是独立交易，不要嵌套调用。
	5.	调用前的余额检查
	•	购买时请确保在调用 buy 前，准备好足额的 ETH；
	•	如果用户使用了更高的 msg.value，合约会自动将超出部分退回给用户。