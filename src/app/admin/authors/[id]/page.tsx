import Link from "next/link";
import { notFound } from "next/navigation";
import { getAuthor } from "@/lib/authors";
import { EditAuthorForm } from "./EditAuthorForm";

export const dynamic = "force-dynamic";

export default async function EditAuthorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const author = await getAuthor(id);
  if (!author) notFound();

  return (
    <div className="space-y-4">
      <Link href="/admin/authors" className="text-sm text-neutral-500 hover:underline">
        ← Back to authors
      </Link>
      <EditAuthorForm
        id={author.id}
        avatarUrl={author.avatar}
        initial={{
          name: author.name ?? "",
          slug: author.slug ?? "",
          bio: author.bio ?? "",
        }}
      />
    </div>
  );
}
