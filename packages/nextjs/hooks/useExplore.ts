"use client";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import type { ChartRange, CryptoAsset, TokenAboutData, TokenChartData, TokenMarkets } from "~~/utils/explore/data";

async function read<T>(url: string): Promise<T> {
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error("Market data is temporarily unavailable");
  return r.json();
}
export const useTokenMarkets = () =>
  useQuery({
    queryKey: ["crypto-markets"],
    queryFn: () => read<TokenMarkets>("/api/explore/tokens"),
    staleTime: 120_000,
    refetchInterval: 120_000,
    retry: 1,
  });
export const useTokenChart = (id: string, range: ChartRange) =>
  useQuery({
    queryKey: ["crypto-chart", id, range],
    queryFn: () => read<TokenChartData>(`/api/explore/tokens/${encodeURIComponent(id)}/chart?range=${range}`),
    staleTime: 300_000,
    refetchInterval: 300_000,
    retry: 1,
  });
export const useTokenAbout = (id: string) =>
  useQuery({
    queryKey: ["crypto-about", id],
    queryFn: () => read<TokenAboutData>(`/api/explore/tokens/${encodeURIComponent(id)}/about`),
    staleTime: 86_400_000,
    retry: 1,
  });

export const useInfiniteTokenMarkets = () =>
  useInfiniteQuery({
    queryKey: ["crypto-market-pages"],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) =>
      read<TokenMarkets>(`/api/explore/tokens${pageParam ? `?cursor=${encodeURIComponent(pageParam)}` : ""}`),
    getNextPageParam: last => last.nextCursor ?? undefined,
    staleTime: 60_000,
    refetchInterval: 60_000,
    retry: 1,
  });
export const useTokenAsset = (id: string) =>
  useQuery({
    queryKey: ["crypto-asset", id],
    queryFn: () => read<{ asset: CryptoAsset }>(`/api/explore/tokens/${encodeURIComponent(id)}`),
    staleTime: 60_000,
    refetchInterval: 60_000,
    retry: 1,
  });
