import type { Metadata } from "next";
import { SITE } from "@/lib/site";

export const metadata: Metadata = { title: "గోప్యతా విధానం (Privacy Policy)" };

export default function PrivacyPage() {
  return (
    <div className="space-y-4 text-neutral-700 dark:text-neutral-300">
      <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-white">
        గోప్యతా విధానం (Privacy Policy)
      </h1>
      <p className="text-sm text-neutral-500">Last updated: {new Date().getFullYear()}</p>

      <p>
        {SITE.name} ("we", "us") మీ privacy ను గౌరవిస్తుంది. ఈ policy మేము ఏ
        data collect చేస్తాం, ఎలా use చేస్తాం అని explain చేస్తుంది. ఇది India
        Digital Personal Data Protection (DPDP) Act ను దృష్టిలో ఉంచుకుని
        రూపొందించబడింది.
      </p>

      <h2 className="text-lg font-semibold">Data we collect</h2>
      <ul className="ml-5 list-disc space-y-1">
        <li>Analytics data (pages visited, device, approximate location) — site ను improve చేయడానికి.</li>
        <li>మీరు contact form ద్వారా పంపే వివరాలు (name, email, message).</li>
      </ul>

      <h2 className="text-lg font-semibold">Cookies & ads</h2>
      <p>
        మేము analytics కోసం cookies వాడవచ్చు. Third-party advertising partners
        (ఉదా. Google AdSense) ads చూపించడానికి cookies వాడవచ్చు. మీరు browser
        settings ద్వారా cookies disable చేయవచ్చు.
      </p>

      <h2 className="text-lg font-semibold">మీ rights</h2>
      <p>
        మీ personal data ను access, correct, లేదా delete చేయమని మమ్మల్ని అడగవచ్చు.
        దీని కోసం <a href="/contact" className="underline">contact</a> చేయండి.
      </p>
    </div>
  );
}
