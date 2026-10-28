import { getKnownAsset } from "~~/services/explore";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const asset = await getKnownAsset((await params).id);
    return asset
      ? Response.json({ asset }, { headers: { "Cache-Control": "public, s-maxage=60" } })
      : Response.json({ error: "Token not found" }, { status: 404 });
  } catch {
    return Response.json({ error: "Market data unavailable" }, { status: 503 });
  }
}
