import { getTokenMarkets } from "~~/services/explore";
import { MARKET_ORDERS, type MarketOrder } from "~~/utils/explore/pagination";

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const order = params.get("order") ?? "market_cap_desc";
    if (!MARKET_ORDERS.includes(order as MarketOrder)) throw new RangeError("Invalid market order");
    return Response.json(await getTokenMarkets(params.get("cursor"), order as MarketOrder), {
      // Cursors refer to an in-process session; do not cache them on a shared CDN.
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof RangeError) return Response.json({ error: error.message }, { status: 400 });
    return Response.json(
      { error: "Crypto market data is unavailable. Please retry shortly." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
