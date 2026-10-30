import { deployScript, artifacts } from "../rocketh/deploy.js";

// Run with --tags AMMStack to deploy the required tokens and contracts in
// dependency order, then connect the pool to its price oracle.
// IMPORTANT: finalizeSettings() is deliberately NOT called here.
export default deployScript(
  async env => {
    const chainId = Number(env.network.chain.id);
    if (chainId !== 31337 && chainId !== 11155111) {
      throw new Error(`AMM deployment restricted to local Hardhat or Sepolia (chain ${chainId})`);
    }

    const { deployer } = env.namedAccounts;
    const pool = env.get<typeof artifacts.AMMPool.abi>("AMMPool");
    const oracle = env.get<typeof artifacts.PriceOracle.abi>("PriceOracle");

    const currentOracle = await env.read(pool, { functionName: "priceOracle" });
    const finalized = await env.read(pool, { functionName: "settingsFinalized" });
    const dynamicFees = await env.read(pool, { functionName: "dynamicFeesEnabled" });

    if (finalized) {
      if (currentOracle.toLowerCase() !== oracle.address.toLowerCase() || !dynamicFees) {
        throw new Error("AMMPool settings are finalized but do not match this deployment");
      }
      console.log("AMMPool settings already finalized; leaving them unchanged.");
      return;
    }

    if (currentOracle.toLowerCase() !== oracle.address.toLowerCase()) {
      await env.execute(pool, {
        account: deployer,
        functionName: "setPriceOracle",
        args: [oracle.address],
      });
    }

    if (!dynamicFees) {
      await env.execute(pool, {
        account: deployer,
        functionName: "setDynamicFeesEnabled",
        args: [true],
      });
    }

    console.log("AMMStack configured. Pool:", pool.address);
    console.log("Oracle:", oracle.address);
    console.log("Dynamic fees enabled; settings NOT finalized.");
    console.log("No initial liquidity has been supplied.");
  },
  {
    tags: ["AMMStack"],
    dependencies: ["AMMPool", "PriceOracle"],
  },
);
