# Automated Market Maker

A course project for NYU FRE-GY 6931 Blockchain and Cryptocurrency: a WETH/USDX automated market maker with wallet interaction, liquidity analysis, paper trading, and backtesting.

## Current status

The repository has been initialized from the official **Scaffold-ETH 2 Hardhat template**, generated with `create-eth@2.0.23`. The first commit contains the unmodified generated template. Project setup and documentation follow separately.

The application currently contains the starter `YourContract` example, wallet controls, Debug Contracts, and a local block explorer. The AMM, USDX, LP token, oracle rules, trading interface, and financial models are planned work. There is no project deployment on Sepolia or public website yet.

## Quick start

Requirements: Git, Node.js (24 LTS recommended; see `.nvmrc`), and a browser. MetaMask is needed when testing the external-wallet flow. The template also supplies a local development wallet.

```bash
git clone https://github.com/SunChuyun/Automated-Market-Maker.git
cd Automated-Market-Maker
./yarn install --immutable
```

The executable `./yarn` uses the repository's bundled Yarn 4.13.0, so a global Yarn installation is optional. On Windows, use `node .yarn/releases/yarn-4.13.0.cjs` in place of `./yarn`. An existing Corepack/Yarn installation may also run the normal `yarn` commands.

Run the following from the project root in separate terminals, in this order:

| Terminal | Command         | Purpose                                                                      |
| -------- | --------------- | ---------------------------------------------------------------------------- |
| A        | `./yarn chain`  | Start the local blockchain; leave it running.                                |
| B        | `./yarn deploy` | Compile and deploy the example, then generate frontend contract information. |
| C        | `./yarn start`  | Start the website; leave it running.                                         |

Open <http://localhost:3000>. On **Debug Contracts**, read `greeting` and try `setGreeting` to learn the read/write flow. These are local example operations, not AMM trades.

## Repository structure

| Path                        | Purpose                                                                            |
| --------------------------- | ---------------------------------------------------------------------------------- |
| `packages/hardhat/`         | Solidity contracts, contract tests, deployment scripts, and network configuration. |
| `packages/nextjs/`          | Website pages, components, wallet integration, and contract interaction.           |
| `docs/analysis/`            | Financial notebooks, data, and results; submission reports belong in `docs/`.      |
| `team-guide/`               | Team collaboration procedures and working agreements.                             |
| `.github/workflows/`        | Automated checks for pushes and pull requests.                                     |
| `package.json`, `yarn.lock` | Shared commands, dependency declarations, and locked versions.                     |

## Validation commands

```bash
./yarn compile
./yarn test
./yarn lint
./yarn hardhat:check-types
./yarn next:check-types
./yarn next:build
```

Deployment-helper dependencies are pinned to a compatible Rocketh family. Keep `yarn.lock` under version control and review dependency changes with the team. The CI workflow checks the starter contracts and types; it has not run remotely until this repository is pushed to GitHub.

## Collaboration and development

See the [team guide](team-guide/README.md) for responsibilities, branches, pull requests, and daily Git commands.

Keep source code, comments, interfaces, and repository documentation in English. Store private configuration in local environment files. Do not commit private keys, seed phrases, dependency installations, build output, or non-public course handouts.

## Later deployment

Contract deployment and website deployment are separate steps:

- Contracts: prepare the test account and RPC configuration, deploy to Sepolia, and verify the source on Etherscan.
- Website: configure the frontend for Sepolia and the deployed contracts, pass the production build, and publish the Next.js application to a hosting provider such as Vercel.

Deployment commands and release coordination are described in the team guide. Creating a GitHub repository alone does not publish the website.

## References and license

- [Scaffold-ETH 2 documentation](https://docs.scaffoldeth.io/)
- [Hardhat documentation](https://hardhat.org/docs/)
- [Frontend deployment](https://docs.scaffoldeth.io/deploying/deploy-nextjs-app)
- [OpenZeppelin Contracts](https://docs.openzeppelin.com/contracts/)

Based on Scaffold-ETH 2. The upstream MIT license is retained in [LICENCE](LICENCE).
