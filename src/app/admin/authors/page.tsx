import { listAuthors, countArticlesByAuthor } from "@/lib/authors";
import { AuthorsClient } from "./AuthorsClient";

export const dynamic = "force-dynamic";

export default async function AuthorsPage() {
  const [authors, counts] = await Promise.all([listAuthors(), countArticlesByAuthor()]);
  return <AuthorsClient authors={authors} counts={counts} />;
}
