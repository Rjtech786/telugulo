import type { Metadata } from "next";

export const metadata: Metadata = { title: "సంప్రదించండి (Contact Us)" };

export default function ContactPage() {
  return (
    <div className="space-y-4 text-neutral-700 dark:text-neutral-300">
      <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-white">
        సంప్రదించండి (Contact Us)
      </h1>
      <p>
        ఏదైనా సందేహం, feedback, లేదా correction ఉంటే మమ్మల్ని సంప్రదించండి. మేము
        త్వరగా respond అవ్వడానికి ప్రయత్నిస్తాం.
      </p>
      <p>
        Email:{" "}
        <a href="mailto:roshanjameer8786@gmail.com" className="underline">
          roshanjameer8786@gmail.com
        </a>
      </p>
      <p className="text-sm text-neutral-500">
        (Owner ఈ details ను తరువాత update చేయవచ్చు.)
      </p>
    </div>
  );
}
