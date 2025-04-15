.PHONY: test compile clean help 

HARDHAT = npx hardhat

test: 
	$(HARDHAT) test
compile:
	$(HARDHAT) compile

clean:
	$(HARDHAT) clean

help:
	@echo "使用说明:"
	@echo "  make compile      - 编译合约"
	@echo "  make test         - 运行基本测试（默认）"
	@echo "  make clean        - 清除编译产物" 