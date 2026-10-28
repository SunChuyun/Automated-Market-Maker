"use client";

import { useQuery } from "@tanstack/react-query";
import type { MarketHistory, MarketQuote } from "~~/utils/amm/model";

async function readMarket<T>(path: string): Promise<T> {
  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok) throw new Error("Market data is unavailable");
  return response.json();
}

export const useMarket = () =>
  useQuery({
    queryKey: ["eth-usd-reference"],
    queryFn: () => readMarket<MarketQuote>("/api/market"),
    refetchInterval: 30_000,
    staleTime: 20_000,
    retry: 1,
  });
export const useMarketHistory = () =>
  useQuery({
    queryKey: ["eth-usd-history"],
    queryFn: () => readMarket<MarketHistory>("/api/market/history"),
    refetchInterval: 300_000,
    staleTime: 300_000,
    retry: 1,
  });
