import type { Metadata } from "next";
import { getPageBySlug } from "@/lib/pages";
import { StaticPageView } from "@/components/static-page";

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const page = await getPageBySlug("about");
  return { title: page?.title ?? "About Us" };
}

export default async function AboutPage() {
  const page = await getPageBySlug("about");
  return <StaticPageView page={page} />;
}
