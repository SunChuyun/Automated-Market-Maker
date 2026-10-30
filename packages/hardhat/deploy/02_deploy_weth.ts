import { deployScript, artifacts } from "../rocketh/deploy.js";

export default deployScript(
  async env => {
    const { deployer } = env.namedAccounts;

    await env.deploy("WETH", {
      account: deployer,
      artifact: artifacts.WETH,
      args: [],
    });

    console.log("WETH deployed successfully!");
  },
  {
    tags: ["WETH"],
  },
);
