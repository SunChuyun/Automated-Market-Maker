# Automated Market Maker

A course project for NYU FRE-GY 6931 Blockchain and Cryptocurrency: a WETH/USDX automated market maker with wallet interaction, liquidity analysis, paper trading, and backtesting.

## Current status

The repository has been initialized from the official **Scaffold-ETH 2 Hardhat template**, generated with `create-eth@2.0.23`. The first commit contains the unmodified generated template. Project setup and documentation follow separately.

The frontend now includes an English UI preview with Swap, Explore, token detail, Earn, Portfolio, and research tools, wallet controls, live external ETH/USD references, virtual trading, and a reference-market DCA backtest. The starter `YourContract`, Debug Contracts, and local explorer remain available as development tools. The AMM, USDX, LP token, oracle rules, and Sepolia integration are still pending. There is no public website deployment yet.

| Route                                  | Current behavior                                                                                          |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `/`                                    | Focused WETH/USDX swap preview; fee, impact, slippage settings and expandable risk details.               |
| `/explore`                             | Crypto markets with search, sorting of loaded assets, and cursor-based batches of 100. |
| `/explore/[id]`                        | Real price charts (1H/1D/1W/1M/1Y), market statistics, About/resources and a trade-panel preview.         |
| `/earn`                                | WETH/USDX liquidity preview and an explicitly illustrative fee-APR calculator. `/pools` redirects here.   |
| `/simulate`, `/backtest`, `/portfolio` | Practice/research tools under More; Portfolio is in the primary navigation.                                    |

Real swaps, limit orders and liquidity actions are disabled until the corresponding contracts or execution services are connected. Assets in Explore are for market research; the planned pool supports WETH/USDX only. Example amounts are not on-chain balances. The reference backtest omits gas, spread and pool price impact; it does not replace the final pool model or Sepolia reconciliation.

System, light and dark appearance settings are implemented. Browser verification of themes, infinite scrolling, and MetaMask is in progress. Global market sorting and additional volume periods are planned; current sorting applies to loaded assets.

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

For UI preview and off-chain tools alone, only terminal C (`./yarn start`) is needed; public market data requires internet access. Local blockchain reads and development transactions additionally need terminals A and B.

Open <http://localhost:3000>. On **Debug Contracts**, read `greeting` and try `setGreeting` to learn the read/write flow. These are local example operations, not AMM trades.

## Repository structure

| Path                        | Purpose                                                                            |
| --------------------------- | ---------------------------------------------------------------------------------- |
| `packages/hardhat/`         | Solidity contracts, contract tests, deployment scripts, and network configuration. |
| `packages/nextjs/`          | Website pages, components, wallet integration, and contract interaction.           |
| `docs/analysis/`            | Financial notebooks, data, and results; submission reports belong in `docs/`.      |
| `team-guide/`               | Team collaboration procedures and working agreements.                              |
| `.github/workflows/`        | Automated checks for pushes and pull requests.                                     |
| `package.json`, `yarn.lock` | Shared commands, dependency declarations, and locked versions.                     |

## Market data

Next.js route handlers fetch public data server-side:

- `packages/nextjs/app/api/explore/`: CoinGecko crypto list, chart and token-resource endpoints. The list fetches a larger market-cap-ranked universe, excludes known tokenized commodity/fund and stock/ETF instruments, and returns up to 100 assets per cursor response. The browser appends another batch at the end of the loaded list. This filter is a curated prototype scope, not a comprehensive asset-classification service.
- CoinGecko list polling/cache: one minute. Chart cache: five minutes. Resource cache: one day. Keyless access was verified locally; IP-based rate limits apply. An optional server-only `COINGECKO_DEMO_API_KEY` can be configured later. Do not put it in a `NEXT_PUBLIC_` variable.
- Table mini-charts cover seven days; token detail charts provide separate time ranges. Source retrieval time and provider timestamps are preserved. Cached responses can be marked delayed during a provider outage; no fabricated prices are substituted.
- `packages/nextjs/app/api/market/`: Kraken/Coinbase ETH reference endpoints retained for the research/account tools.

Pool volume, liquidity, daily LP fees and live APR are unavailable until contract/event integration. The Earn scenario APR is daily volume × LP fee × 365 / pool value, without compounding, IL or gas; it is not a live return.

The separate ETH reference hook polls its price every 30 seconds when a component uses it. Price responses are cached for 20 seconds; history for five minutes. The UI reports retrieval time, not an exchange-generated quote timestamp.

- Primary price and history: [Kraken public market data](https://docs.kraken.com/api-reference/market-data/get-ticker-information), ETH/USD and up to approximately 30 days of hourly candles. The unfinished candle is excluded.
- Backup price: [Coinbase public spot price](https://docs.cdp.coinbase.com/coinbase-app/track-apis/prices). History has no fallback; failures show an unavailable state.
- No market-data key is needed for these endpoints. Public rate limits and provider terms still apply. The external reference is separate from the pool's execution quote and future Chainlink/TWAP checks.
- USDX has no redemption promise or USD peg. Any USDX-to-USD equivalence in scenarios is explicitly a modeling assumption.

Deploy this version to a host that runs Next.js server routes, such as Vercel or a Node.js host. A static-only export cannot serve these market endpoints.

## Validation commands

```bash
./yarn compile
./yarn test
./yarn lint
./yarn hardhat:check-types
./yarn next:check-types
./yarn next:build
./yarn workspace @se-2/nextjs exec node --experimental-strip-types --test utils/amm/model.test.mjs utils/explore/data.test.mjs
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

- [CoinGecko API documentation](https://docs.coingecko.com/)
- [Scaffold-ETH 2 documentation](https://docs.scaffoldeth.io/)
- [Hardhat documentation](https://hardhat.org/docs/)
- [Frontend deployment](https://docs.scaffoldeth.io/deploying/deploy-nextjs-app)
- [OpenZeppelin Contracts](https://docs.openzeppelin.com/contracts/)

Based on Scaffold-ETH 2. The upstream MIT license is retained in [LICENCE](LICENCE).
