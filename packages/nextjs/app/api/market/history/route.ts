import { getMarketHistory } from "~~/services/market";

export async function GET() {
  try {
    return Response.json(await getMarketHistory(), { headers: { "Cache-Control": "public, s-maxage=300" } });
  } catch {
    return Response.json(
      { error: "Price history is temporarily unavailable. Please try again." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
