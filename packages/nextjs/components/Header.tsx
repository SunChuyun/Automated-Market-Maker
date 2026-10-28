"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useSwitchChain } from "wagmi";
import { ArrowUpRightIcon, WalletIcon } from "@heroicons/react/24/outline";
import { AppearanceControl } from "~~/components/AppearanceControl";
import { useTargetNetwork } from "~~/hooks/scaffold-eth";

const links = [
  { label: "Swap", href: "/" },
  { label: "Explore", href: "/explore" },
  { label: "Earn", href: "/earn" },
  { label: "Portfolio", href: "/portfolio" },
];
const moreLinks = [
  { label: "Simulation", href: "/simulate" },
  { label: "Backtest", href: "/backtest" },
];

export const Header = () => {
  const pathname = usePathname();
  const { targetNetwork } = useTargetNetwork();
  const { switchChain, isPending } = useSwitchChain();
  return (
    <header className="studio-header">
      <div className="navbar studio-navbar">
        <Link href="/" className="studio-brand" aria-label="AMM Studio home">
          <span className="brand-mark">
            <i />
            <i />
            <i />
          </span>
          <span>
            AMM<span className="brand-light"> Studio</span>
          </span>
        </Link>
        <nav className="studio-nav" aria-label="Main navigation">
          {links.map(link => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={
                (link.href === "/" ? pathname === "/" : pathname.startsWith(link.href)) ? "page" : undefined
              }
              className={(link.href === "/" ? pathname === "/" : pathname.startsWith(link.href)) ? "active" : ""}
            >
              {link.label}
            </Link>
          ))}
          <details className="dropdown more-navigation" key={pathname}>
            <summary
              role="button"
              aria-label="More"
              className={moreLinks.some(l => pathname.startsWith(l.href)) ? "active" : ""}
            >
              More <span aria-hidden="true">⌄</span>
            </summary>
            <ul className="menu dropdown-content">
              {moreLinks.map(l => (
                <li key={l.href}>
                  <Link href={l.href} aria-label={l.label}>
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </details>
        </nav>
        <div className="header-actions">
          <AppearanceControl />
          <span className="network-label">
            <span className="status-dot" />
            {targetNetwork.id === 31337 ? "Local devnet" : targetNetwork.name}
          </span>
          <ConnectButton.Custom>
            {({ account, chain, mounted, openConnectModal, openAccountModal }) => {
              const connected = mounted && account && chain;
              const wrongNetwork = connected && chain.id !== targetNetwork.id;
              return (
                <button
                  type="button"
                  className="btn wallet-button"
                  disabled={isPending}
                  onClick={() =>
                    wrongNetwork
                      ? switchChain({ chainId: targetNetwork.id })
                      : connected
                        ? openAccountModal()
                        : openConnectModal()
                  }
                >
                  <WalletIcon className="h-4 w-4" />
                  {wrongNetwork ? "Switch network" : connected ? account.displayName : "Connect wallet"}
                  <ArrowUpRightIcon className="h-3.5 w-3.5" />
                </button>
              );
            }}
          </ConnectButton.Custom>
        </div>
      </div>
    </header>
  );
};
