import Link from "next/link";
import { notFound } from "next/navigation";
import { getPage } from "@/lib/pages";
import { EditPageForm } from "./EditPageForm";

export const dynamic = "force-dynamic";

export default async function EditPagePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const page = await getPage(id);
  if (!page) notFound();

  return (
    <div className="space-y-4">
      <Link href="/admin/pages" className="text-sm text-neutral-500 hover:underline">
        ← Back to pages
      </Link>
      <EditPageForm
        id={page.id}
        slug={page.slug}
        initial={{ title: page.title, content: page.content }}
      />
    </div>
  );
}
