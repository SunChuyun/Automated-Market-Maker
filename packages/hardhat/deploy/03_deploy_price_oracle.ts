import { deployScript, artifacts } from "../rocketh/deploy.js";

// Confirmed in Chainlink's official Sepolia ETH/USD documentation.
const SEPOLIA_ETH_USD_FEED = "0x694AA1769357215DE4FAC081bf1f309aDC325306";

// The professor noted a one-hour heartbeat; allow an extra 30-minute buffer.
// Change this constant only after the team finalizes the oracle policy.
const ORACLE_MAX_AGE_SECONDS = 5400n;

export default deployScript(
  async env => {
    const chainId = Number(env.network.chain.id);
    const { deployer } = env.namedAccounts;

    let feedAddress: `0x${string}`;

    if (chainId === 11155111) {
      // Sepolia: actual Chainlink price feed. No mock is deployed.
      feedAddress = SEPOLIA_ETH_USD_FEED;
    } else if (chainId === 31337) {
      // Local Hardhat: deploy a Chainlink-compatible mock at $2,500/ETH.
      const mockFeed = await env.deploy("MockPriceFeed", {
        account: deployer,
        artifact: artifacts.MockPriceFeed,
        args: [8, 250000000000n],
      });
      feedAddress = mockFeed.address;
    } else {
      throw new Error(`AMM deployment restricted to local Hardhat or Sepolia (chain ${chainId})`);
    }

    const oracle = await env.deploy("PriceOracle", {
      account: deployer,
      artifact: artifacts.PriceOracle,
      args: [feedAddress, ORACLE_MAX_AGE_SECONDS],
    });

    // Fail early if the configured feed cannot return a positive, fresh price.
    // This reads the actual Chainlink proxy on Sepolia and the mock locally.
    const currentPrice18 = await env.read(oracle, { functionName: "getEthUsdPrice18" });

    console.log("PriceOracle:", oracle.address);
    console.log("ETH/USD feed:", feedAddress);
    console.log("Oracle max age (seconds):", ORACLE_MAX_AGE_SECONDS.toString());
    console.log("Oracle price (18 decimals):", currentPrice18.toString());
  },
  { tags: ["PriceOracle"] },
);
