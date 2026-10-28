import { getKnownAsset, getTokenAbout } from "~~/services/explore";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    if (!(await getKnownAsset(id))) return Response.json({ error: "Token not found" }, { status: 404 });
    return Response.json(await getTokenAbout(id), { headers: { "Cache-Control": "public, s-maxage=86400" } });
  } catch {
    return Response.json(
      { error: "Token information unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
