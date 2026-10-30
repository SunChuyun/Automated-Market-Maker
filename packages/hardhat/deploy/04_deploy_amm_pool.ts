import { deployScript, artifacts } from "../rocketh/deploy.js";

export default deployScript(
  async env => {
    const chainId = Number(env.network.chain.id);
    if (chainId !== 31337 && chainId !== 11155111) {
      throw new Error(`AMM deployment restricted to local Hardhat or Sepolia (chain ${chainId})`);
    }

    const { deployer } = env.namedAccounts;
    const weth = env.get<typeof artifacts.WETH.abi>("WETH");
    const usdx = env.get<typeof artifacts.USDX.abi>("USDX");

    const pool = await env.deploy("AMMPool", {
      account: deployer,
      artifact: artifacts.AMMPool,
      args: [weth.address, usdx.address],
    });

    console.log("AMMPool:", pool.address);
    console.log("WETH:", weth.address);
    console.log("USDX (demo stablecoin):", usdx.address);
  },
  {
    tags: ["AMMPool"],
    dependencies: ["USDX", "WETH"],
  },
);
