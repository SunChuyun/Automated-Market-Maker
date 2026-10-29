"use client";

import { useState } from "react";
import Link from "next/link";
import { Address, Balance } from "@scaffold-ui/components";
import { useAccount } from "wagmi";
import { CheckIcon, ClockIcon, WalletIcon } from "@heroicons/react/24/outline";
import { Metric, Note, PageHeading, PairTitle } from "~~/components/amm/Studio";
import { useTargetNetwork } from "~~/hooks/scaffold-eth";
import { useMarket } from "~~/hooks/useMarket";
import { usePaperAccount } from "~~/hooks/usePaperAccount";
import { number } from "~~/utils/amm/model";

export default function PortfolioPage() {
  const { address, chainId, connector } = useAccount();
  const market = useMarket();
  const { account: paper, scope } = usePaperAccount();
  const [activity, setActivity] = useState("paper");
  const share = paper.shares / paper.totalShares;
  const reference = paper.poolUsdx / paper.poolWeth;
  const { targetNetwork } = useTargetNetwork();
  const correctNetwork = chainId === targetNetwork.id;
  return (
    <div className="studio-page">
      <PageHeading
        eyebrow="YOUR WORKSPACE"
        title="Your wallet. Your positions."
        description="Account details, pool exposure and a clear view of what is connected."
      />
      <div className="account-card card studio-card">
        <span className="account-avatar">
          <WalletIcon className="h-6 w-6" />
        </span>
        <div>
          <div className="eyebrow">{address ? `CONNECTED · ${connector?.name ?? "Wallet"}` : "YOUR ACCOUNT"}</div>
          {address ? <Address address={address} chain={targetNetwork} /> : <h2>Connect a wallet to get started</h2>}
          <p className="muted">
            Use the wallet button above to connect, disconnect, or manage the active account in your wallet.
          </p>
        </div>
        <span className="badge status-badge">
          {targetNetwork.id === 31337 ? "Local devnet · Sepolia planned" : targetNetwork.name}
        </span>
      </div>
      <div className="metrics-grid three">
        <Metric
          label="Native ETH balance"
          value={address && correctNetwork ? <Balance address={address} /> : "—"}
          detail={address && !correctNetwork ? "Switch to the configured network" : "Native ETH pays network gas"}
        />
        <Metric label="WETH / USDX balances" value="— / —" detail="Token contracts not connected" />
        <Metric label="LP position value" value="—" detail="Pool contract not connected" />
      </div>
      <div className="portfolio-layout">
        <section className="card studio-card">
          <div className="section-head">
            <h2>Your liquidity</h2>
            <span className="badge">WETH / USDX</span>
          </div>
          <PairTitle />
          <div className="empty-state position-empty">
            <ClockIcon className="h-8 w-8" />
            <h3>Positions will appear here.</h3>
            <p>LP shares and underlying assets will load after the pool contract is connected.</p>
          </div>
          <Note>
            Connecting a wallet does not grant token approval. Every future approval and transaction will require a
            separate wallet confirmation.
          </Note>
        </section>
        <section className="card studio-card">
          <div className="section-head">
            <h2>Connection & trust</h2>
            <span className="badge preview-badge">Build status</span>
          </div>
          <div className="status-list">
            <div>
              <CheckIcon className="h-4 w-4 positive" />
              <span>Public ETH/USD reference</span>
              <strong>{market.isError ? "Unavailable" : market.data ? "Available" : "Loading"}</strong>
            </div>
            <div>
              <CheckIcon className="h-4 w-4 positive" />
              <span>Off-chain practice tools</span>
              <strong>Available</strong>
            </div>
            <div>
              <ClockIcon className="h-4 w-4" />
              <span>AMM / token addresses</span>
              <strong>Pending</strong>
            </div>
            <div>
              <ClockIcon className="h-4 w-4" />
              <span>Verified Sepolia code</span>
              <strong>Pending</strong>
            </div>
            <div>
              <ClockIcon className="h-4 w-4" />
              <span>Admin rights disclosure</span>
              <strong>Pending</strong>
            </div>
            <div>
              <ClockIcon className="h-4 w-4" />
              <span>Chainlink / pool TWAP</span>
              <strong>Pending</strong>
            </div>
          </div>
          <p className="body-copy">
            Before swaps go live, this panel will show the verified pool and token addresses, the admin role, and the
            parameters that role may change.
          </p>
        </section>
      </div>
      <section className="card studio-card mt-6 paper-portfolio">
        <div className="section-head">
          <div>
            <div className="eyebrow">PRACTICE ACCOUNT</div>
            <h2>Paper positions</h2>
          </div>
          <span className="badge simulation-badge">Virtual assets · {scope}</span>
        </div>
        <div className="metrics-grid three">
          <Metric
            label="Paper wallet"
            value={`${number(paper.weth, 4)} WETH`}
            detail={`${number(paper.usdx)} USDX available`}
          />
          <Metric
            label="Paper LP shares"
            value={number(paper.shares, 6)}
            detail={`${number(share * 100, 3)}% of the paper pool`}
          />
          <Metric
            label="Redeemable paper position"
            value={`${number(share * (paper.poolUsdx + paper.poolWeth * reference))} USDX`}
            detail="Valued at paper pool spot; fees remain in reserves"
          />
        </div>
        <div className="overflow-x-auto">
          <table className="table studio-table">
            <thead>
              <tr>
                <th>Position</th>
                <th>Underlying WETH</th>
                <th>Underlying USDX</th>
                <th>Management</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>WETH / USDX · Full range</td>
                <td>{number(share * paper.poolWeth, 6)}</td>
                <td>{number(share * paper.poolUsdx)}</td>
                <td>
                  <Link className="text-link" href="/simulate">
                    Manage paper liquidity →
                  </Link>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="form-caption">
          Separate from your connected wallet. No on-chain assets or income are represented by these paper balances.
          Entry cost and fee-only attribution await a reconciled accounting model.
        </p>
      </section>
      <section className="card studio-card mt-6">
        <div className="section-head">
          <h2>History & activity</h2>
          <div className="tabs studio-tabs" role="tablist" aria-label="Activity source">
            {["paper", "chain"].map(id => (
              <button
                role="tab"
                aria-selected={activity === id}
                className={`tab ${activity === id ? "tab-active" : ""}`}
                key={id}
                onClick={() => setActivity(id)}
              >
                {id === "paper" ? "Paper activity" : "On-chain activity"}
              </button>
            ))}
          </div>
        </div>
        {activity === "chain" ? (
          <p className="body-copy">
            Confirmed swaps, approvals, deposits and withdrawals will appear here after contract integration, with
            status, amounts, fees and explorer links.
          </p>
        ) : paper.events.length ? (
          <div className="overflow-x-auto">
            <table className="table studio-table">
              <thead>
                <tr>
                  <th>Time (UTC)</th>
                  <th>Action</th>
                  <th>WETH change</th>
                  <th>USDX change</th>
                  <th>LP shares</th>
                  <th>Trading fee (USDX)</th>
                </tr>
              </thead>
              <tbody>
                {paper.events.slice(0, 50).map(e => (
                  <tr key={e.id}>
                    <td>{new Date(e.time).toISOString().slice(0, 19).replace("T", " ")}</td>
                    <td>{e.action}</td>
                    <td>{number(e.weth, 6)}</td>
                    <td>{number(e.usdx)}</td>
                    <td>{number(e.shares, 6)}</td>
                    <td>{number(e.feeUsdx, 4)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="form-caption">
              Latest 50 actions. Up to 500 retained in this browser for this account and network.
            </p>
          </div>
        ) : (
          <p className="body-copy">
            No paper actions yet. Make a swap or add paper liquidity in Simulation to populate this history.
          </p>
        )}
      </section>
    </div>
  );
}
