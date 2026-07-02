import { listPages } from "@/lib/pages";
import { PagesClient } from "./PagesClient";

export const dynamic = "force-dynamic";

export default async function PagesPage() {
  const pages = await listPages();
  return <PagesClient pages={pages} />;
}
