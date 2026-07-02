import type { Metadata } from "next";
import { getPageBySlug } from "@/lib/pages";
import { StaticPageView } from "@/components/static-page";

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const page = await getPageBySlug("disclaimer");
  return { title: page?.title ?? "Disclaimer" };
}

export default async function DisclaimerPage() {
  const page = await getPageBySlug("disclaimer");
  return <StaticPageView page={page} />;
}
