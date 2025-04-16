// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "erc721a/contracts/ERC721A.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract FomoDoge is ERC721A("FomoDoge", "FomoDoge"), Ownable, ReentrancyGuard{
    using Address for address payable;
    using Strings for uint256;

    uint256 public constant START_PRICE = 1000000000000000; 
    uint256 public constant PRICE_STEP = 80000000000000; 

    uint256 public constant TWENTY_OFF_LOCK_TIME = 20 days; 
    uint256 public constant FIFTY_OFF_LOCK_TIME = 50 days; 
    uint256 public constant SEVENTY_OFF_LOCK_TIME = 80 days; 
    uint256 public constant FOMO_TIME_FOR_EACH_NFT = 5 minutes; 
    uint256 public constant MAX_FOMO_TIME = 24 hours; 

    uint256 public constant INVITER_SHARE = 2; 
    uint256 public constant PROTOCOL_SHARE = 1; 
    uint256 public constant FOMO_SHARE = 10; 
    uint256 public constant SELL_SHARE = 95; 

    uint256 public constant FOMO_WINNER_SHARE = 10; 
    uint256 public constant FOMO_ALL_SHARE = 50; 

    uint256 public constant DEPOSIT_TIME = 7 days; 

    string public constant WEB = "https://fomodoge.com";
    string public constant X = "https://x.com/FomoDogeX";
    string public constant TELEGRAM = "https://t.me/FomodogeETH";

    address private _protocol;

    string private baseURI = "https://www.fomodoge.com/uri/";

    struct NftInfo{
        uint unLockTime;
        uint nftId;
        uint PoolId;
        uint pos;
        bool isDeposit;
    }

    mapping(uint => NftInfo) public nftInfo;

    struct UsrInfo{
        uint usrBalance;
        uint usrBalanceForShare;
        uint inviteTotal;
        uint[] ownedNfts;
    }

    struct FomoInfo{
        uint liqPool;
        uint fomoPool;
        uint endTime;
        uint fomoPoolForEach;
        address[5] winners;
    }

    FomoInfo public fomoInfo;

    mapping(address => UsrInfo) public usrInfo;
    
    struct DepositPool{
        uint startTime;
        uint endTime;
        uint tokenAmount;
        uint depositUsrAmounts;
        uint depositNFTAmounts;
        uint usrLatestDepositTime;
        uint speed;
        uint speedSquare;
    }

    struct UsrDepositInfo{
        uint[] usrDepositNfts;
        uint usrDepositPointsAdv;
        uint usrLatestDepositSquare;
        uint usrDepositAmounts;
        uint rewardWithdrawed;
    }

    mapping(address => mapping(uint => UsrDepositInfo)) public usrDepositInfo;
    mapping(uint => DepositPool) public depositPool;
    address public erc20Token;

    event Buy(address indexed usr, address indexed inviter, uint amount, uint indexed value);
    event Sell(address indexed usr, uint amount, uint value);
    event FOMO(address winner1, address winner2, address winner3, address winner4, address winner5, uint fomopool, bool isEnded);

    constructor(){
        fomoInfo.endTime = block.timestamp + MAX_FOMO_TIME;
        _protocol = msg.sender;
    }

    function setErc20Token(address erc20TokenAddress) public onlyOwner() {
        erc20Token = erc20TokenAddress;
    }

    function getUsrNftInfo(address usr) public view returns(NftInfo[] memory) {
        uint[] memory _ownedNfts = usrInfo[usr].ownedNfts;
        NftInfo[] memory nftsInfo = new NftInfo[](_ownedNfts.length);
        
        for(uint i = 0; i < _ownedNfts.length; i++) {
            nftsInfo[i] = nftInfo[_ownedNfts[i]];
        }
        
        return nftsInfo;
    }
    function _afterTokenTransfers(
        address from,
        address to,
        uint256 startTokenId,
        uint256 quantity
    ) internal override {
        if(fomoInfo.endTime > block.timestamp){
            if(to != address(0) && from != address(0)){
                usrInfo[from].usrBalanceForShare = balanceOf(from);
                usrInfo[to].usrBalanceForShare = balanceOf(to);
            }
            else if(to == address(0)){
                usrInfo[from].usrBalanceForShare = balanceOf(from);
            }
            else{
                usrInfo[to].usrBalanceForShare = balanceOf(to);
            }
        }
    }

    function _beforeTokenTransfers(
        address from,
        address to,
        uint256 startTokenId,
        uint256 quantity
    ) internal override {
        if(to != address(0) && from != address(0)){
            require(quantity == 1);
            require(!nftInfo[startTokenId].isDeposit, "NFT not deposited");
            // 移除
            usrInfo[from].ownedNfts[nftInfo[startTokenId].pos]
                = usrInfo[from].ownedNfts[usrInfo[from].ownedNfts.length - 1];
            nftInfo[usrInfo[from].ownedNfts[nftInfo[startTokenId].pos]].pos = nftInfo[startTokenId].pos;
            usrInfo[from].ownedNfts.pop();

            // 新增
            usrInfo[to].ownedNfts.push(startTokenId);

            // 信息变更
            nftInfo[startTokenId].pos = usrInfo[to].ownedNfts.length - 1;
            // nftInfo[startTokenId].owner = to;
        }else if(to == address(0)){
            require(quantity == 1);
            require(!nftInfo[startTokenId].isDeposit, "NFT not deposited");
            // from 移除id
            usrInfo[from].ownedNfts[nftInfo[startTokenId].pos]
                = usrInfo[from].ownedNfts[usrInfo[from].ownedNfts.length - 1];
            // 原本排在最后的nft变更pos信息
            nftInfo[usrInfo[from].ownedNfts[nftInfo[startTokenId].pos]].pos = nftInfo[startTokenId].pos;

            // 移除旧的最后一个id
            usrInfo[from].ownedNfts.pop();

            // 清除被移除的id的信息
            nftInfo[startTokenId] = NftInfo( {
                unLockTime: 0,
                nftId: 0,
                PoolId: 0,
                // owner: address(0),
                pos: 0,
                isDeposit: false
            });  
        }else{
            uint beforeLength = usrInfo[to].ownedNfts.length;
            for(uint i = startTokenId;i < startTokenId + quantity;i++){
                usrInfo[to].ownedNfts.push(i);

                nftInfo[i] = NftInfo( {
                    unLockTime: 0,
                    nftId: i,
                    PoolId: 0,
                    // owner: to,
                    pos: beforeLength + i - startTokenId,
                    isDeposit: false
                });  
            }
        }
    }

    function buy(uint amount, uint lockType, address inviteAddress)public payable nonReentrant{
        require(balanceOf(msg.sender) + amount <= 100, "Exceed The maximum number of a single address");
        uint valueUsed = getBuyPrice(amount) * (100 - lockType) / 100;
        require((lockType == 0 || lockType == 20 || lockType == 50 || lockType == 70) && amount > 0, "Error lockType OR Error amount");
        require(msg.value >= valueUsed, "Insufficient balance");
        require(msg.sender != inviteAddress);
        uint startId = _nextTokenId();
        
        fomoPlay(msg.sender, amount);
        
        _mint(msg.sender, amount);

        for(uint i = startId; i < amount + startId; i++){
            if(lockType == 20){
                nftInfo[i].unLockTime = block.timestamp + TWENTY_OFF_LOCK_TIME;
            }else if(lockType == 50){
                nftInfo[i].unLockTime = block.timestamp + FIFTY_OFF_LOCK_TIME;
            }else if(lockType == 70){
                nftInfo[i].unLockTime = block.timestamp + SEVENTY_OFF_LOCK_TIME;
            }
        }

        usrInfo[inviteAddress].usrBalance += valueUsed * INVITER_SHARE / 100;
        usrInfo[inviteAddress].inviteTotal ++;

        usrInfo[_protocol].usrBalance += valueUsed * PROTOCOL_SHARE / 100;

        if(fomoInfo.endTime > block.timestamp){
            fomoInfo.fomoPool += valueUsed * FOMO_SHARE / 100;
            fomoInfo.liqPool += valueUsed * (100 - INVITER_SHARE - PROTOCOL_SHARE - FOMO_SHARE) / 100;
        }else{
            fomoInfo.liqPool += valueUsed * (100 - INVITER_SHARE - PROTOCOL_SHARE) / 100;
        }
        
        uint256 overPayAmount = msg.value - valueUsed;
        if (overPayAmount > 0){
            payable(msg.sender).sendValue(overPayAmount);
        }

        emit Buy(msg.sender, inviteAddress, amount, valueUsed);
    }

    function buy(uint amount, uint lockType)public payable nonReentrant{
        require(balanceOf(msg.sender) + amount <= 100, "Exceed The maximum number of a single address");
        uint valueUsed = getBuyPrice(amount) * (100 - lockType) / 100;
        require((lockType == 0 || lockType == 20 || lockType == 50 || lockType == 70) && amount > 0, "Error lockType OR Error amount");
        require(msg.value >= valueUsed, "Insufficient balance");
        uint startId = _nextTokenId();
        
        fomoPlay(msg.sender, amount);
        
        _mint(msg.sender, amount);

        for(uint i = startId; i < amount + startId; i++){
            if(lockType == 20){
                nftInfo[i].unLockTime = block.timestamp + TWENTY_OFF_LOCK_TIME;
            }else if(lockType == 50){
                nftInfo[i].unLockTime = block.timestamp + FIFTY_OFF_LOCK_TIME;
            }else if(lockType == 70){
                nftInfo[i].unLockTime = block.timestamp + SEVENTY_OFF_LOCK_TIME;
            }
        }

        usrInfo[_protocol].usrBalance += valueUsed * PROTOCOL_SHARE / 100;
        
        if(fomoInfo.endTime > block.timestamp){
            fomoInfo.fomoPool += valueUsed * (FOMO_SHARE + INVITER_SHARE) / 100;
            fomoInfo.liqPool += valueUsed * (100 - INVITER_SHARE - PROTOCOL_SHARE - FOMO_SHARE) / 100;
        }else{
            fomoInfo.liqPool += valueUsed * (100 - PROTOCOL_SHARE) / 100;
        }

        uint256 overPayAmount = msg.value - valueUsed;
        if (overPayAmount > 0){
            payable(msg.sender).sendValue(overPayAmount);
        }

        emit Buy(msg.sender, address(0), amount, valueUsed);
    }

    function sell(uint256[] memory usrTokens)public nonReentrant{
        require(usrTokens.length <= 50, "Too many sales may lead to execution errors");

        uint sellAmount;
        for(uint i = 0; i < usrTokens.length; i++){
            if(ownerOf(usrTokens[i]) == msg.sender && nftInfo[usrTokens[i]].unLockTime <= block.timestamp){
                _burn(usrTokens[i]);
                sellAmount ++;
            }
        }

        if(fomoInfo.endTime <= block.timestamp){
            fomoPlay(address(0), 0);
        }

        uint sellPrice = getSellPrice(sellAmount, totalSupply() + sellAmount);

        fomoInfo.liqPool -= sellPrice * (SELL_SHARE + PROTOCOL_SHARE) / 100;
        usrInfo[_protocol].usrBalance += sellPrice * PROTOCOL_SHARE / 100;
        payable(msg.sender).sendValue(sellPrice * SELL_SHARE / 100);

        emit Sell(msg.sender, sellAmount, sellPrice);
    }
    
    function fomoPlay(address fomoPlayAddress, uint amount)internal{
        if(fomoInfo.endTime > block.timestamp){
            for (uint i = fomoInfo.winners.length - 1; i > 0; i--) {
                fomoInfo.winners[i] = fomoInfo.winners[i - 1];
            }

            fomoInfo.winners[0] = fomoPlayAddress;

            fomoInfo.endTime += FOMO_TIME_FOR_EACH_NFT * amount;

            if(fomoInfo.endTime > block.timestamp + MAX_FOMO_TIME){
                fomoInfo.endTime = block.timestamp + MAX_FOMO_TIME;
            }

            emit FOMO(
                fomoInfo.winners[0], 
                fomoInfo.winners[1], 
                fomoInfo.winners[2], 
                fomoInfo.winners[3], 
                fomoInfo.winners[4], 
                fomoInfo.fomoPool, 
                false
            );
        }else{
            if(fomoInfo.fomoPoolForEach == 0){
                for(uint i = 0; i < 5; i++){
                    usrInfo[fomoInfo.winners[i]].usrBalance += fomoInfo.fomoPool * FOMO_WINNER_SHARE / 100;
                }

                fomoInfo.fomoPoolForEach = fomoInfo.fomoPool * FOMO_ALL_SHARE / (100 * totalSupply());

                emit FOMO(
                    fomoInfo.winners[0], 
                    fomoInfo.winners[1], 
                    fomoInfo.winners[2], 
                    fomoInfo.winners[3], 
                    fomoInfo.winners[4], 
                    fomoInfo.fomoPool, 
                    true
                );
            }
        }
    }

    function withdraw()public nonReentrant{
        require(usrCanWithdraw(msg.sender) > 0, "No balance");
        uint withdrawAmount = usrCanWithdraw(msg.sender);
        usrInfo[msg.sender].usrBalance = 0;

        if(fomoInfo.endTime <= block.timestamp && usrInfo[msg.sender].usrBalanceForShare != 0){
            usrInfo[msg.sender].usrBalanceForShare = 0;
        }

        payable(msg.sender).sendValue(withdrawAmount);
    }

    function getBuyPrice(uint amount) public view returns (uint) {
        uint sum_i = (amount * (amount - 1)) / 2;
        uint basePart = amount * START_PRICE;

        uint stepPart = PRICE_STEP * (amount * totalSupply() + sum_i);

        return basePart + stepPart;
    }

    function getSellPrice(uint amount, uint total) public pure returns (uint) {
        require(total >= amount, "Not enough NFTs in supply to sell");

        uint sum_i = (amount * (amount - 1)) / 2;

        uint basePart = amount * START_PRICE;

        uint stepPart = PRICE_STEP * (amount * (total - 1) - sum_i);

        return basePart + stepPart;
    }
    
    function usrCanWithdraw(address usr)public view returns(uint){
        uint payAmount = usrInfo[usr].usrBalance;

        if(fomoInfo.endTime <= block.timestamp && usrInfo[usr].usrBalanceForShare != 0){
            payAmount += usrInfo[usr].usrBalanceForShare * fomoInfo.fomoPoolForEach;
        }

        return payAmount;
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) 
    {
        uint256 x = tokenId % 500;
        return string(abi.encodePacked(baseURI, x.toString(),".json"));
    }

    // deposit pool
    function createDepositPool(uint id, uint tokenAmount) public onlyOwner() {
        require(depositPool[id].startTime == 0, "Pool Already Created");

        depositPool[id] = DepositPool({
            startTime:  block.timestamp,
            endTime: block.timestamp + DEPOSIT_TIME,
            tokenAmount: tokenAmount,
            depositUsrAmounts: 0,
            depositNFTAmounts: 0,
            usrLatestDepositTime: block.timestamp,
            speed: 0,
            speedSquare: 0
        });

        require(IERC20(erc20Token).transferFrom(msg.sender, address(this), tokenAmount), "Token transfer failed");
    }

    function deposit(uint id, uint256[] memory usrTokens) public {
        require(depositPool[id].startTime > 0 , "Pool does not exist");
        require(depositPool[id].endTime >= block.timestamp, "Pool ended");

        uint validTokens = 0;
        
        for(uint i = 0; i < usrTokens.length; i++) {
            uint tokenId = usrTokens[i];
            if(ownerOf(tokenId) == msg.sender && !nftInfo[tokenId].isDeposit) {
                nftInfo[tokenId].isDeposit = true;
                                
                usrDepositInfo[msg.sender][id].usrDepositNfts.push(tokenId);
                
                validTokens++;
            }
        }

        // pool
        depositPool[id].depositUsrAmounts += usrDepositInfo[msg.sender][id].usrDepositAmounts == 0 ? 1 : 0;
        depositPool[id].depositNFTAmounts += validTokens;
        // old square
        depositPool[id].speedSquare += depositPool[id].speed * (block.timestamp - depositPool[id].usrLatestDepositTime);
        depositPool[id].usrLatestDepositTime = block.timestamp;
        // new speed
        depositPool[id].speed = depositPool[id].tokenAmount / DEPOSIT_TIME / depositPool[id].depositNFTAmounts;

        // usr
        usrDepositInfo[msg.sender][id].usrDepositPointsAdv += usrDepositInfo[msg.sender][id].usrDepositAmounts * 
            (depositPool[id].speedSquare - usrDepositInfo[msg.sender][id].usrLatestDepositSquare);
        usrDepositInfo[msg.sender][id].usrDepositAmounts += validTokens;
        usrDepositInfo[msg.sender][id].usrLatestDepositSquare = depositPool[id].speedSquare;
        
        require(validTokens > 0, "No valid tokens to deposit");
    }

    function getUsrDepositReward(address usr, uint id) public view returns(uint){
        require(depositPool[id].startTime > 0, "Pool does not exist");

        uint reward = usrDepositInfo[usr][id].usrDepositPointsAdv + 
            usrDepositInfo[usr][id].usrDepositAmounts * 
            (
                block.timestamp >= depositPool[id].endTime ? 
                depositPool[id].speed * (depositPool[id].endTime - depositPool[id].usrLatestDepositTime) : 
                depositPool[id].speed * (block.timestamp - depositPool[id].usrLatestDepositTime)
            ) - 
            usrDepositInfo[usr][id].rewardWithdrawed;

    }

    function withdrawDepositReward(uint id) public nonReentrant {
        require(depositPool[id].startTime > 0, "Pool does not exist");

        uint usrDepositReward = getUsrDepositReward(msg.sender, id);

        require(usrDepositReward > 0, "No reward to withdraw");

        if(block.timestamp >= depositPool[id].endTime){
            for(uint i = 0; i < usrDepositInfo[msg.sender][id].usrDepositNfts.length; i++) {
                require(nftInfo[usrDepositInfo[msg.sender][id].usrDepositNfts[i]].isDeposit, "NFT not deposited");
                nftInfo[usrDepositInfo[msg.sender][id].usrDepositNfts[i]].isDeposit = false;
            }
        }

        usrDepositInfo[msg.sender][id].rewardWithdrawed += usrDepositReward;

        require(IERC20(erc20Token).transfer(msg.sender, usrDepositReward), "Token transfer failed");
    }
}