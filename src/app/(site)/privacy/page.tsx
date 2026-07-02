import type { Metadata } from "next";
import { getPageBySlug } from "@/lib/pages";
import { StaticPageView } from "@/components/static-page";

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const page = await getPageBySlug("privacy");
  return { title: page?.title ?? "Privacy Policy" };
}

export default async function PrivacyPage() {
  const page = await getPageBySlug("privacy");
  return <StaticPageView page={page} />;
}
