import type { Metadata } from "next";
import { getPageBySlug } from "@/lib/pages";
import { StaticPageView } from "@/components/static-page";

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const page = await getPageBySlug("terms");
  return { title: page?.title ?? "Terms of Service" };
}

export default async function TermsPage() {
  const page = await getPageBySlug("terms");
  return <StaticPageView page={page} />;
}
