# Team Guide

Internal working notes for this team. This folder is separate from `docs/`, which holds course submission materials. Keep internal guides and any future explanatory PDFs here, in English.

## Responsibilities

| Member     | Main responsibility                                                                                               | Main working area                                           |
| ---------- | ----------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Yihan Yao  | Solidity contracts, oracle and fee controls, contract tests, Sepolia deployment and verification.                 | `packages/hardhat/`                                         |
| Chuyun Sun | Website, wallet/account workspace, contract interaction, simulation and backtest interface, transaction feedback. | `packages/nextjs/`                                          |
| Haolin Liu | Financial models, LP/trader simulations and backtests, protocol revenue analysis, model reconciliation examples.  | `docs/analysis/`; agree browser-model integration with Sun. |

Discuss changes to shared dependencies, network configuration, and public interfaces before implementing them. A responsibility describes ownership, not a restriction on collaboration.

## Initial publication

The original generated template is the first local commit. Setup changes and English documentation are kept separate. If the remote repository is still empty, the owner can publish the reviewed local commits with:

```bash
git status
git log --oneline -3
git push -u origin main
```

Only one person should initialize the shared repository. Everyone else clones that same repository. Do not create competing Scaffold projects and copy files over one another.

## Start a new task

Finish or safely preserve any existing work before switching branches. From a clean working directory:

```bash
git switch main
git pull --ff-only origin main
git switch -c feat/sun-wallet
```

Other examples: `feat/yao-amm-pool`, `feat/liu-lp-analysis`, and `fix/swap-quote`. Use a new branch for each task.

## Save and upload your work

For a frontend-only change:

```bash
git status
git diff
git add packages/nextjs
git diff --cached
git commit -m "feat: connect wallet and show balances"
git push -u origin feat/sun-wallet
```

Create a pull request on GitHub from the feature branch to `main`. Explain the behavior, relevant interface changes, and validation. Include a screenshot for visible UI changes. Another team member reviews the change; merge after the checks pass. Later commits on the same tracked branch normally need only `git push`.

Use the actual files you changed in `git add`; do not blindly stage unrelated work. A commit records a local version. A push uploads commits. Saving a file does not upload it.

## Receive a teammate's changes

To update the main branch after changes have been merged:

```bash
git status
git switch main
git pull --ff-only origin main
```

If dependencies changed, run `./yarn install --immutable`. If local contracts or deployment scripts changed, redeploy and check the generated frontend contract information.

To bring the latest main branch into your current feature branch, first make the working directory clean, then run:

```bash
git fetch origin
git switch feat/sun-wallet
git merge origin/main
```

Resolve any conflicts, run the relevant checks, commit the resolution if needed, and push the feature branch. If `--ff-only` reports divergent history, inspect the commits and coordinate; do not force-push over a teammate's work.

## Shared conventions

- Keep `main` runnable. Use feature branches and pull requests for daily work. Branch protection is a separate GitHub setting; this guide does not configure it.
- Use concise commit prefixes such as `feat:`, `fix:`, `docs:`, `test:`, and `chore:`. Keep each commit focused.
- Use the pinned Yarn release and commit `yarn.lock` with dependency changes. Do not add npm or pnpm lockfiles.
- Keep all source code, comments, UI copy, and documentation in English.
- Never commit private keys, seed phrases, `.env` files, `node_modules`, `.next`, or contract build caches. The supplied development accounts are public local-test fixtures.
- Keep non-public course handouts and briefs outside this public repository.
- Every member clones a separate working copy. OneDrive is the location of Sun's local copy; Git commits are the team's synchronization mechanism.

## Contract/frontend/model handoff

Yao should share an interface draft before the final deployment. Agree the network, contract names, functions, parameter order, units/decimals, approval spender, quote behavior, events, and expected errors.

Sun can develop navigation, forms, wallet connectivity, transaction states, and clearly labeled mock views while the contracts are being built. First integrate a runnable local version. After Sepolia deployment, synchronize the addresses and ABI through the deployment output. Generate `packages/nextjs/contracts/deployedContracts.ts` through the deployment scripts; use `externalContracts.ts` for separately deployed external contracts, with a documented source.

Liu supplies model inputs, outputs, and fixed reconciliation examples. Agree how validated calculations will be made callable by the browser. Moving inputs from a simulation to an actual trade requires a new live quote and wallet confirmation.

## Checks before review

Use the checks relevant to the change. For the complete starter setup:

```bash
./yarn compile
./yarn test
./yarn lint
./yarn hardhat:check-types
./yarn next:check-types
./yarn next:build
```

The commit hook uses the repository's Yarn launcher. It checks staged TypeScript files and may apply lint fixes; inspect changes before completing the commit. Formatting the whole repository is available through `./yarn format`, but avoid mixing unrelated formatting into a feature change.

## Release coordination

During development, keep the default local-network configuration. When the team is ready:

1. Run local tests and reconcile model results.
2. Have the contract owner prepare the Sepolia account and RPC configuration, then run `./yarn deploy --network sepolia` and `./yarn verify --network sepolia`.
3. Update `packages/nextjs/scaffold.config.ts` to target Sepolia and confirm contract information and node connectivity.
4. Build and test the website, then publish it to a hosting platform. Publishing the website does not deploy the contracts.
5. Add the report and financial analysis under `docs/`, complete `submission.json`, record the demonstration, and create the required `final` tag for the reviewed submission.

Do not treat a local example deployment or a successful website build as a completed AMM release.
