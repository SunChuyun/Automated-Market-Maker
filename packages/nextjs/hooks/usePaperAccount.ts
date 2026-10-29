"use client";
import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { useTargetNetwork } from "~~/hooks/scaffold-eth";
import { INITIAL_PAPER, type PaperAccount, paperAction } from "~~/utils/amm/risk";

export function usePaperAccount() {
  const { address } = useAccount();
  const { targetNetwork } = useTargetNetwork();
  const key = `amm-paper-v2:${targetNetwork.id}:${address?.toLowerCase() ?? "guest"}`;
  const [state, setState] = useState<{ key: string; account: PaperAccount } | null>(null);
  useEffect(() => {
    const load = () => {
      let account = INITIAL_PAPER;
      try {
        const saved = JSON.parse(localStorage.getItem(key) ?? "null");
        if (
          saved &&
          [saved.weth, saved.usdx, saved.poolWeth, saved.poolUsdx, saved.totalShares, saved.shares].every(
            (v: unknown) => typeof v === "number" && Number.isFinite(v) && v >= 0,
          ) &&
          saved.poolWeth > 0 &&
          saved.poolUsdx > 0 &&
          saved.totalShares > 0 &&
          saved.shares <= saved.totalShares &&
          Array.isArray(saved.events)
        )
          account = saved;
      } catch {
        /* Storage can be unavailable in private browsing. */
      }
      setState({ key, account });
    };
    load();
    window.addEventListener("amm-paper-change", load);
    window.addEventListener("storage", load);
    return () => {
      window.removeEventListener("amm-paper-change", load);
      window.removeEventListener("storage", load);
    };
  }, [key]);
  const ready = state?.key === key;
  const account = ready ? state.account : INITIAL_PAPER;
  const save = (next: PaperAccount) => {
    try {
      localStorage.setItem(key, JSON.stringify(next));
    } catch {
      throw new Error("Browser storage is unavailable; allow local storage to save paper activity.");
    }
    setState({ key, account: next });
    window.dispatchEvent(new Event("amm-paper-change"));
  };
  return {
    account,
    ready,
    scope: address ? "Active wallet / network" : "Guest / network",
    execute: (kind: Parameters<typeof paperAction>[1], amount: number, fee?: number) =>
      save(paperAction(account, kind, amount, fee)),
    reset: () => save(INITIAL_PAPER),
    setDepth: (depth: number) => {
      if (!Number.isFinite(depth) || depth < 0.01 || depth > 1000)
        throw new Error("Choose a depth multiplier from 0.01 to 1,000.");
      save({ ...INITIAL_PAPER, poolWeth: 100 * depth, poolUsdx: 250000 * depth, totalShares: 100 * depth });
    },
  };
}
