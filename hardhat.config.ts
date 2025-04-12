import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "hardhat-deploy";
import "hardhat-gas-reporter";
import "solidity-coverage";
import "@typechain/hardhat";
import "@openzeppelin/hardhat-upgrades";
import "hardhat-abi-exporter";
import "hardhat-contract-sizer";
import "hardhat-docgen";
import "hardhat-watcher";
import "hardhat-tracer";
import "dotenv/config";

// Load environment variables
// process.env loads environment variables from command line
const PRIVATE_KEY = process.env.PRIVATE_KEY || "0000000000000000000000000000000000000000000000000000000000000000";
const BSC_TESTNET_URL = process.env.BSC_TESTNET_URL || "https://data-seed-prebsc-1-s1.binance.org:8545";
const BSC_MAINNET_URL = process.env.BSC_MAINNET_URL || "https://bsc-dataseed.binance.org/";
const BSCSCAN_API_KEY = process.env.BSCSCAN_API_KEY || "";
const COINMARKETCAP_API_KEY = process.env.COINMARKETCAP_API_KEY || "";
const REPORT_GAS = process.env.REPORT_GAS === "true";

const config: HardhatUserConfig = {
  // Solidity compiler configuration - supports multiple versions
  solidity: {
    compilers: [
      {
        version: "0.8.20",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200
          }
        }
      }
    ]
  },
  
  // Network configuration
  networks: {
    // Local development network
    hardhat: {
      chainId: 31337,
      // If you need to simulate a specific blockchain, you can enable the following comment
      // forking: {
      //   url: BSC_MAINNET_URL,
      //   blockNumber: 15795688,
      // }
    },
    
    // Locally running node
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 31337,
    },
    
    // BSC Testnet
    bscTestnet: {
      url: BSC_TESTNET_URL,
      chainId: 97,
      accounts: [PRIVATE_KEY],
      gasPrice: 10000000000, // 10 Gwei
      gas: 5000000,
    },
    
    // BSC Mainnet
    bsc: {
      url: BSC_MAINNET_URL,
      chainId: 56,
      accounts: [PRIVATE_KEY],
      gasPrice: 5000000000, // 5 Gwei
      gas: 5000000,
    },
  },
  
  // Deployment configuration
  namedAccounts: {
    deployer: {
      default: 0, // Default uses the first account as the deployer
      1: 0, // Similarly on the mainnet, the first account is used
    },
    user: {
      default: 1,
    },
  },
  
  // Gas reporting configuration
  gasReporter: {
    enabled: REPORT_GAS,
    currency: "USD",
    coinmarketcap: COINMARKETCAP_API_KEY,
    token: "BNB", // Set to BNB to match BSC network
    gasPriceApi: "https://api.bscscan.com/api?module=proxy&action=eth_gasPrice",
    outputFile: "gas-report.txt",
    noColors: true,
  },
  
  // Contract verification configuration
  etherscan: {
    apiKey: {
      bscTestnet: BSCSCAN_API_KEY,
      bsc: BSCSCAN_API_KEY
    },
  },
  
  // TypeScript type generation configuration
  typechain: {
    outDir: "typechain",
    target: "ethers-v6",
  },
  
  // ABI export configuration
  abiExporter: {
    path: "./abi",
    runOnCompile: true,
    clear: true,
    flat: true,
    only: [],
    spacing: 2,
  },
  
  // Contract size check configuration
  contractSizer: {
    alphaSort: true,
    disambiguatePaths: false,
    runOnCompile: true,
    strict: false,
  },
  
  // Documentation generation configuration
  docgen: {
    path: './docs',
    clear: true,
    runOnCompile: false,
  },
  
  // File monitoring configuration
  watcher: {
    compile: {
      tasks: ["compile"],
      files: ["./contracts/**/*.sol"],
      verbose: true,
    },
    test: {
      tasks: ["test"],
      files: ["./contracts/**/*.sol", "./test/**/*.ts"],
      verbose: true,
    },
  },
  
  // Path configuration
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
    deploy: "./scripts/deploy",
    deployments: "./deployments",
  },
  
  // Mocha test configuration
  mocha: {
    timeout: 40000, // 40 seconds
  },
};

export default config;