import type { Metadata } from "next";
import { SITE } from "@/lib/site";

export const metadata: Metadata = { title: "నిబంధనలు (Terms of Service)" };

export default function TermsPage() {
  return (
    <div className="space-y-4 text-neutral-700 dark:text-neutral-300">
      <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-white">
        నిబంధనలు (Terms of Service)
      </h1>
      <p>
        {SITE.name} ను use చేయడం ద్వారా మీరు ఈ terms కు అంగీకరిస్తున్నారు. Content
        మా property — personal, non-commercial use కు మాత్రమే. మా అనుమతి లేకుండా
        content ను copy లేదా republish చేయవద్దు.
      </p>
      <h2 className="text-lg font-semibold">Content usage</h2>
      <p>
        మేము ఎప్పుడైనా content ను update, modify, లేదా remove చేసే హక్కు కలిగి
        ఉంటాం. ఈ site lo ఇచ్చిన information పై ఆధారపడి తీసుకునే decisions కు మీరే
        బాధ్యులు.
      </p>
      <h2 className="text-lg font-semibold">Liability</h2>
      <p>
        Site use వల్ల కలిగే ఏ నష్టానికి కూడా {SITE.name} బాధ్యత వహించదు. Content
        "as is" basis lo అందించబడుతుంది.
      </p>
    </div>
  );
}
