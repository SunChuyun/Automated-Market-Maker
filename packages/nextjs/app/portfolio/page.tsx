"use client";

import { Address, Balance } from "@scaffold-ui/components";
import { useAccount } from "wagmi";
import { CheckIcon, ClockIcon, WalletIcon } from "@heroicons/react/24/outline";
import { Metric, Note, PageHeading, PairTitle } from "~~/components/amm/Studio";
import { useTargetNetwork } from "~~/hooks/scaffold-eth";
import { useMarket } from "~~/hooks/useMarket";

export default function PortfolioPage() {
  const { address, chainId } = useAccount();
  const market = useMarket();
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
          <div className="eyebrow">CONNECTED ACCOUNT</div>
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
      <section className="card studio-card mt-6">
        <div className="section-head">
          <h2>On-chain activity</h2>
          <span className="muted">Swaps · Approvals · Liquidity</span>
        </div>
        <p className="body-copy">
          No AMM activity is available yet. Confirmed transactions and explorer links will appear here after contract
          integration. Virtual trades stay in the simulator.
        </p>
      </section>
    </div>
  );
}
