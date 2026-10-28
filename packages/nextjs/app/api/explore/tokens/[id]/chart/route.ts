import { getKnownAsset, getTokenChart } from "~~/services/explore";
import { CHART_RANGES, type ChartRange } from "~~/utils/explore/data";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const range = new URL(request.url).searchParams.get("range") ?? "1D";
  if (!CHART_RANGES.includes(range as ChartRange))
    return Response.json({ error: "Unsupported chart range" }, { status: 400 });
  try {
    if (!(await getKnownAsset(id))) return Response.json({ error: "Token not found" }, { status: 404 });
    return Response.json(await getTokenChart(id, range as ChartRange), {
      headers: { "Cache-Control": "public, s-maxage=300" },
    });
  } catch {
    return Response.json(
      { error: "Chart unavailable. Please retry shortly." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
