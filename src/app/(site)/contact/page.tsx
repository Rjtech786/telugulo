import type { Metadata } from "next";
import { getPageBySlug } from "@/lib/pages";
import { StaticPageView } from "@/components/static-page";

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const page = await getPageBySlug("contact");
  return { title: page?.title ?? "Contact Us" };
}

export default async function ContactPage() {
  const page = await getPageBySlug("contact");
  return <StaticPageView page={page} />;
}
