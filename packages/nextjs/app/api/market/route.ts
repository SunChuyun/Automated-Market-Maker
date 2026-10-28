import { getMarketQuote } from "~~/services/market";

export async function GET() {
  try {
    return Response.json(await getMarketQuote(), { headers: { "Cache-Control": "public, s-maxage=20" } });
  } catch {
    return Response.json(
      { error: "Market price is temporarily unavailable. Please try again." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
