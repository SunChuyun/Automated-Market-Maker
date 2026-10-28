import { deployScript, artifacts } from "../rocketh/deploy.js";

export default deployScript(
  async env => {
    const { deployer } = env.namedAccounts;

    const usdx = await env.deploy("USDX", {
      account: deployer,
      artifact: artifacts.USDX,
      args: [],
    });

    const balance = await env.read(usdx, {
      functionName: "balanceOf",
      args: [deployer],
    });

    console.log("USDX deployed successfully!");
    console.log("Deployer USDX balance:", balance.toString());
  },
  {
    tags: ["USDX"],
  },
);
