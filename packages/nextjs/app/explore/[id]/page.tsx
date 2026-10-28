import { TokenDetail } from "~~/components/explore/TokenDetail";

export default async function TokenPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TokenDetail id={id} />;
}
