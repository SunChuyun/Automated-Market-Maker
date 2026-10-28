import { getTokenMarkets } from "~~/services/explore";

export async function GET(request: Request) {
  try {
    return Response.json(await getTokenMarkets(new URL(request.url).searchParams.get("cursor") ?? "1:0"), {
      headers: { "Cache-Control": "public, s-maxage=60" },
    });
  } catch (error) {
    if (error instanceof RangeError) return Response.json({ error: error.message }, { status: 400 });
    return Response.json(
      { error: "Crypto market data is unavailable. Please retry shortly." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
