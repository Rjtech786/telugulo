import type { Metadata } from "next";
import { SITE } from "@/lib/site";

export const metadata: Metadata = { title: "మా గురించి (About Us)" };

export default function AboutPage() {
  return (
    <div className="prose-page">
      <h1 className="text-2xl font-bold tracking-tight">మా గురించి</h1>
      <p>
        {SITE.name} అనేది తెలుగు readers కోసం ఒక tech & AI news platform. మా goal
        — latest technology, gadgets, apps, AI updates ను simple Telugu lo, రోజూ
        అందించడం. ఇక్కడ content English tech words తో natural Telugu style lo
        ఉంటుంది — ఎందుకంటే అదే మనం రోజూ మాట్లాడే భాష.
      </p>
      <p>
        మా articles AI tools సహాయంతో research & draft చేయబడతాయి, కానీ ప్రతి article
        ను publish చేసే ముందు ఒక human editor review చేస్తారు. Accuracy, clarity,
        మరియు local relevance మాకు ముఖ్యం.
      </p>
      <h2 className="mt-6 text-lg font-semibold">మా focus</h2>
      <ul className="ml-5 list-disc space-y-1">
        <li>AI & technology news (Telugu lo)</li>
        <li>Smartphones, apps, gadgets reviews & updates</li>
        <li>India / Telugu readers కోసం relevant angle</li>
      </ul>
      <p className="mt-6 text-sm text-neutral-500">
        Contact: <a href="/contact" className="underline">సంప్రదించండి</a>
      </p>
    </div>
  );
}
