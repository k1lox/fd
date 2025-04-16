.PHONY: test compile clean help test-purchase test-selling test-fomo test-rewards test-staking test-price test-integration

HARDHAT = npx hardhat

test:
	$(HARDHAT) test
compile:
	$(HARDHAT) compile

clean:
	$(HARDHAT) clean

test-purchase:
	npm run test:purchase

test-selling:
	npm run test:selling

test-fomo:
	npm run test:fomo

test-rewards:
	npm run test:rewards

test-staking:
	npm run test:staking

test-price:
	npm run test:price

test-integration:
	npm run test:integration

help:
	@echo "使用说明:"
	@echo "  make compile          - 编译合约"
	@echo "  make test             - 运行所有测试（默认）"
	@echo "  make test-purchase    - 运行NFT购买功能测试"
	@echo "  make test-selling     - 运行NFT售卖功能测试"
	@echo "  make test-fomo        - 运行FOMO机制测试"
	@echo "  make test-rewards     - 运行奖励提取测试"
	@echo "  make test-staking     - 运行质押功能测试"
	@echo "  make test-price       - 运行价格计算测试"
	@echo "  make test-integration - 运行综合场景测试"
	@echo "  make clean            - 清除编译产物"