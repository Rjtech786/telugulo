import type { Metadata } from "next";
import { getPageBySlug } from "@/lib/pages";
import { StaticPageView } from "@/components/static-page";

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const page = await getPageBySlug("editorial-policy");
  return { title: page?.title ?? "Editorial Policy" };
}

export default async function EditorialPolicyPage() {
  const page = await getPageBySlug("editorial-policy");
  return <StaticPageView page={page} />;
}
