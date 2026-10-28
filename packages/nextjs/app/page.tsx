"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AdjustmentsHorizontalIcon, ArrowDownIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { PendingButton, Token } from "~~/components/amm/Studio";
import { EXAMPLE_POOL, number, quoteSwap } from "~~/utils/amm/model";

export default function SwapPage() {
  const [input, setInput] = useState("0.1");
  const [reverse, setReverse] = useState(false);
  const [slippage, setSlippage] = useState(0.5);
  const [settings, setSettings] = useState(false);
  const [review, setReview] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (review && !dialog.current?.open) dialog.current?.showModal();
    else if (!review && dialog.current?.open) dialog.current.close();
  }, [review]);
  const from = reverse ? "USDX" : "WETH",
    to = reverse ? "WETH" : "USDX";
  const quote = quoteSwap(
    Number(input),
    reverse ? EXAMPLE_POOL.usdx : EXAMPLE_POOL.weth,
    reverse ? EXAMPLE_POOL.weth : EXAMPLE_POOL.usdx,
  );
  return (
    <div className="studio-page swap-only-page">
      <section className="card studio-card swap-card">
        <div className="section-head">
          <h1 className="swap-title">Swap</h1>
          <div className="swap-card-actions">
            <span className="badge">Example pool</span>
            <button
              className="btn btn-ghost btn-circle"
              aria-label="Swap settings"
              aria-expanded={settings}
              onClick={() => setSettings(!settings)}
            >
              <AdjustmentsHorizontalIcon className="h-5 w-5" />
            </button>
          </div>
        </div>
        {settings && (
          <div className="settings-panel">
            <span>Slippage tolerance</span>
            <div className="join">
              {[0.1, 0.5, 1].map(s => (
                <button
                  className={`btn btn-sm join-item ${slippage === s ? "selected" : ""}`}
                  aria-pressed={slippage === s}
                  key={s}
                  onClick={() => setSlippage(s)}
                >
                  {s}%
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="swap-field">
          <label htmlFor="swap-amount">You pay</label>
          <div className="amount-row">
            <input
              className="input amount-input"
              id="swap-amount"
              aria-label="Amount to swap"
              type="number"
              min="0"
              step="any"
              value={input}
              placeholder="0"
              onChange={e => setInput(e.target.value)}
            />
            <span className="token-selector">
              <Token symbol={from} size="small" />
              {from}
            </span>
          </div>
        </div>
        <div className="swap-direction">
          <button
            className="btn btn-circle"
            aria-label="Reverse swap direction"
            onClick={() => {
              setReverse(!reverse);
              setInput(quote ? String(Number(quote.output.toFixed(6))) : "");
            }}
          >
            <ArrowDownIcon className="h-4 w-4" />
          </button>
        </div>
        <div className="swap-field receive-field">
          <label>Estimated receive</label>
          <div className="amount-row">
            <output className="amount-output" aria-live="polite">
              {quote ? number(quote.output, 6) : "0"}
            </output>
            <span className="token-selector">
              <Token symbol={to} size="small" />
              {to}
            </span>
          </div>
        </div>
        <div className="quote-details">
          <div>
            <span>Swap fee</span>
            <strong>0.30%</strong>
          </div>
          <div>
            <span>Price impact</span>
            <strong className={quote && quote.impact > 0.03 ? "negative" : ""}>
              {quote ? number(quote.impact * 100, 3) + "%" : "—"}
            </strong>
          </div>
          <div>
            <span>Minimum received</span>
            <strong>{quote ? number(quote.output * (1 - slippage / 100), 6) + " " + to : "—"}</strong>
          </div>
        </div>
        <button className="btn btn-primary primary-action" disabled={!quote} onClick={() => setReview(true)}>
          Preview swap
        </button>
        <div className="swap-preview-status">
          <span className="status-dot" />
          Contract connection pending
        </div>
        <details className="trade-disclosure">
          <summary>Quote details & risks</summary>
          <p>
            Illustrative reserves: 100 WETH / 250,000 USDX. Slippage tolerance: {slippage}%. Fee split: 0.25% LPs /
            0.05% protocol. USDX is an unbacked test token. No funds move in this preview.
          </p>
        </details>
      </section>
      <Link href="/explore" className="swap-explore-link">
        Looking for market prices? Explore crypto ↗
      </Link>
      <dialog ref={dialog} className="modal" onCancel={() => setReview(false)} aria-labelledby="review-title">
        <div className="modal-box review-modal">
          <div className="section-head">
            <h2 id="review-title">Review example swap</h2>
            <button className="btn btn-ghost btn-circle" aria-label="Close review" onClick={() => setReview(false)}>
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>
          <div className="review-amount">
            {number(Number(input) || 0, 6)} {from}
            <ArrowDownIcon className="h-5 w-5" />
            {quote ? number(quote.output, 6) : "—"} {to}
          </div>
          <p className="functional-note">Example quote only. No token approval or transaction is submitted.</p>
          <PendingButton />
          <Link className="btn btn-ghost w-full mt-3" href="/simulate">
            Try paper trading
          </Link>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button aria-label="Close swap review" onClick={() => setReview(false)}>
            Close
          </button>
        </form>
      </dialog>
    </div>
  );
}
