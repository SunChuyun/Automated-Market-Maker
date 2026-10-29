# Automated Market Maker

A course project for NYU FRE-GY 6931 Blockchain and Cryptocurrency: a WETH/USDX automated market maker with wallet interaction, liquidity analysis, paper trading, and backtesting.

## Current status

The repository has been initialized from the official **Scaffold-ETH 2 Hardhat template**, generated with `create-eth@2.0.23`. The first commit contains the unmodified generated template. Project setup and documentation follow separately.

The frontend now includes an English UI preview with Swap, Explore, token detail, Earn, Portfolio, and research tools, wallet controls, live external ETH/USD references, virtual trading, and a configurable reference-market strategy backtest. The starter `YourContract`, Debug Contracts, and local explorer remain available as development tools. The AMM, USDX, LP token, oracle rules, and Sepolia integration are still pending. There is no public website deployment yet.

| Route                                  | Current behavior                                                                                                     |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `/`                                    | Focused WETH/USDX swap preview; fee, impact, slippage settings and expandable risk details.                          |
| `/explore`                             | Tokens table; 24H volume ordering across the provider universe, scoped column sorting, and 100-token scroll batches. |
| `/explore/[id]`                        | Real price charts (1H/1D/1W/1M/1Y), market statistics, About/resources and a trade-panel preview.                    |
| `/earn`                                | WETH/USDX liquidity preview and an explicitly illustrative fee-APR calculator. `/pools` redirects here.              |
| `/simulate`, `/backtest`, `/portfolio` | Simulation and Backtest under More; Portfolio in the primary navigation with the connected wallet name.              |

Real swaps, limit orders and liquidity actions are disabled until the corresponding contracts or execution services are connected. Assets in Explore are for market research; the planned pool supports WETH/USDX only. Example amounts are not on-chain balances. The research backtest includes configurable fees, adverse slippage and gas, but does not replay AMM reserves or replace the final pool model and Sepolia reconciliation.

System, Light and Dark settings persist across reloads. Chrome verification confirmed an existing MetaMask connection, readable light/dark surfaces, and 100 → 200 → 300 distinct rows through bottom-triggered scrolling. No wallet signature or transaction was performed. Project-level About navigation has been removed; token-specific About information remains.

## Local location and disk usage

The complete project folder can be moved, for example to `~/Desktop/Automated-Market-Maker`. Moving it together with `.git` preserves branches, history and the GitHub remote. Open the new location in your editor and run commands from that directory. Restart the website after a move. The project does not require a fixed absolute filesystem path. `.next` is generated build/dev output and can be rebuilt. `node_modules` contains installed runtime/tool dependencies, not just cache; after removing it, run `./yarn install --immutable` before starting again. Neither directory belongs in Git. Keep the existing Yarn linker for compatibility; do not change package managers solely to hide the dependency folder.

## Risk and research workspaces

- **Simulation:** paper swaps linked to before/after reserve curves and value-weighted asset distribution. Review output, fee split, price impact and minimum received before a second confirmation. Manual oracle stress tests use a 90-minute feed age and 30-minute TWAP warm-up. The dynamic-fee trigger of 1% is illustrative and requires team validation. Paper fills do not model gas, MEV or external arbitrage.
- **LP risk:** fee-free impermanent loss, holding comparison, assumed volume/horizon, LP fees, gas and protocol revenue. A separate concentrated-range inventory study shows one-sided exposure outside the range. It does not enable concentrated liquidity in the existing constant-product contract and is not a stop-loss.
- **Portfolio:** the central place for wallet balances, future on-chain LP shares and activity, and separately labeled paper balances, redeemable underlying assets and paper activity. Paper data is stored only in this browser, scoped to the configured network and active address (or guest), with up to 500 retained actions. Earn remains the deposit/withdrawal entry point; real execution is pending.
- **Pool arbitrage:** default research mode, calculated entirely in the browser using a synthetic example or an imported local `timestamp,price` CSV (3–5,000 rows, maximum 1 MB). No upload, market API or strategy backend is used in this mode. Quotes include constant-product impact, pool fees, external venue fees/slippage and gas; orders are capped by cash and the configured order limit. The external leg assumes the same assets can settle at the reference venue and 1 USDX = 1 USD. USDX currently has no external market or redemption, so these are scenario opportunities, not executable cross-venue alerts. Competition, latency, failed transactions, bridging and depeg are excluded. Historical reference prices alone do not establish the actual pool reserve path.
- **Indicator strategies:** five presets (SMA, EMA, RSI, Bollinger breakout, MACD) plus editable, restricted indicator expressions. A parser evaluates the expressions in the off-chain TypeScript engine without `eval`, arbitrary JavaScript or Python execution. Parameters are edited in function arguments. Python notebooks can reconcile the results; arbitrary Python would require a separate isolated worker.
- **Research data:** `/api/backtest/candles` fetches public [Coinbase Exchange OHLCV](https://docs.cdp.coinbase.com/api-reference/exchange-api/rest-api/products/get-product-candles). Frequencies: 1 minute, 5 minutes, hourly, daily, and complete UTC months aggregated from daily bars. At most 6,000 source bars per run including warm-up; each upstream request stays below 300 bars. Missing bars fail the run rather than receiving invented prices. Source data is cached for five minutes; public request limits still apply.
- **Execution and reports:** signals use the previous completed bar and fill at the next open; final positions liquidate at the last completed close. Costs are applied to both strategy and buy-and-hold. Both cumulative-return curves begin at 0% before the first fill. Reports include annualized Sharpe (zero risk-free rate, 365-day market), volatility, return, drawdown and recovery duration, win rate, profit factor, exposure, costs, complete paginated trades, and CSV exports of all trades and bar-level positions. Undefined ratios display a dash. The last report is saved locally by address/network. Edited controls do not silently change an existing report.

These are reference-market research tools, not verified AMM execution. Historical ETH prices cannot establish our pool's volume or LP fee revenue. Live pool positions and activity require deployed ABIs/addresses and confirmed event indexing. Source code is English. Debug Contracts remains accessible at `/debug` for developers and is absent from product navigation.

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

- `packages/nextjs/app/api/explore/`: CoinGecko token list, chart and token-resource endpoints. The Tokens table defaults to provider market-cap order. Clicking **Volume (24H)** requests provider-wide ascending/descending volume order before pagination. **Price, 1H, 1D and FDV** sort only the loaded assets; a visible notice identifies that scope. Searching also covers loaded tokens. These controls are not a full-universe price/FDV ranking service.
- Each full scroll response contains **100 distinct tokens**. The server preserves buffered source rows and already-seen IDs in an opaque pagination session; the client appends at the bottom without prefetching above it. Only the last response may contain fewer than 100 when the source is exhausted. Rank numbers are omitted: a provider rank such as 110 is not the number of displayed rows, particularly after filtering.
- The list excludes known tokenized commodity/fund and stock/ETF instruments. This is a curated prototype filter, not a comprehensive asset-classification service.
- List polling and upstream cache: one minute while the page is active. Refresh updates query data in place. This is periodic REST polling, not a streaming exchange feed. Charts cache for five minutes; token resources for one day. Provider failures show an unavailable or delayed state rather than fabricated prices. Retrieval/provider timestamps stay in the data and are not displayed as interface text.
- **24H is the only supported volume period.** The current endpoint does not provide true 1H/1W/1M/1Y/all-time volumes, so the UI does not offer those choices. The historical API's rolling 24-hour volume observations must not be summed to create those periods.
- Keyless access was verified locally; IP-based limits apply. An optional server-only `COINGECKO_DEMO_API_KEY` can be configured later. Do not put it in a `NEXT_PUBLIC_` variable. The [Demo plan](https://www.coingecko.com/en/api/pricing) currently lists 100 calls/minute and 10,000 calls/month with attribution. A single continuously active upstream request per minute is about 43,200 calls per 30 days, before charts, additional source pages or ordering changes. The free plan is suitable for limited demonstrations, not an unlimited always-on service.
- Provider source requests return up to 250 rows per call; a 100-row browser batch need not require 100 individual requests. Fetching every token separately on every refresh would waste quota. The [provider's order enum](https://docs.coingecko.com/reference/coins-markets) supports market-cap, volume and ID order; global price/change/FDV sorting would require a complete cached market snapshot or a different data service.
- `packages/nextjs/app/api/market/`: Kraken/Coinbase ETH reference endpoints retained for the research/account tools.

Pool volume, liquidity, daily LP fees and live APR are unavailable until contract/event integration. The Earn scenario APR is daily volume × LP fee × 365 / pool value, without compounding, IL or gas; it is not a live return.

The separate ETH reference hook polls its price every 30 seconds when a component uses it. Price responses are cached for 20 seconds; history for five minutes. The interface does not display retrieval timestamps; chart labels still identify the historical candle time.

- Primary price and history: [Kraken public market data](https://docs.kraken.com/api-reference/market-data/get-ticker-information), ETH/USD and up to approximately 30 days of hourly candles. The unfinished candle is excluded.
- Backup price: [Coinbase public spot price](https://docs.cdp.coinbase.com/coinbase-app/track-apis/prices). History has no fallback; failures show an unavailable state.
- No market-data key is needed for these endpoints. Public rate limits and provider terms still apply. The external reference is separate from the pool's execution quote and future Chainlink/TWAP checks.
- USDX has no redemption promise or USD peg. Any USDX-to-USD equivalence in scenarios is explicitly a modeling assumption.

The website and these API routes are one Next.js application: deploy both to a **single persistent Node.js process** for this course preview. Static hosting alone cannot run the market endpoints. The current pagination sessions and caches live in process memory, expire after 30 minutes, and reset when the process restarts. Refresh starts a new list. The cursor route intentionally disables CDN response caching.

For Vercel/serverless or multiple application instances, move sessions and provider caches to shared Redis or a database before relying on infinite pagination; otherwise a later request may reach an instance that does not recognize its cursor. Add application-level request limits before public traffic. A domain and frontend hosting do not remove upstream data limits.

Our own pool analytics are a separate future data path: index confirmed `Swap`/liquidity events from the pool's deployment block, deduplicate transaction hash plus log index, store the processed block cursor, handle reorganizations, and aggregate volume and fees in persistent storage. This yields our pool's history since deployment, not market-wide or pre-deployment history. Uniswap-style analytics similarly use protocol-specific indexed data; [its subgraph entities](https://developers.uniswap.org/docs/ecosystem/subgraphs/concepts/v3/entities) include cumulative and hourly/daily metrics. Those values must not be relabeled as CoinGecko market-wide volumes.

## Validation commands

```bash
./yarn compile
./yarn test
./yarn lint
./yarn hardhat:check-types
./yarn next:check-types
./yarn next:build
./yarn workspace @se-2/nextjs exec node --experimental-strip-types --test utils/amm/model.test.mjs utils/amm/risk.test.mjs utils/research/engine.test.mjs utils/research/pool.test.mjs utils/explore/data.test.mjs utils/explore/pagination.test.mjs
```

Deployment-helper dependencies are pinned to a compatible Rocketh family. Keep `yarn.lock` under version control and review dependency changes with the team. The CI workflow checks the starter contracts and types. Local verification does not imply that remote CI has passed.

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
