import type { Metadata } from "next";
import { SITE } from "@/lib/site";

export const metadata: Metadata = { title: "నిరాకరణ (Disclaimer)" };

export default function DisclaimerPage() {
  return (
    <div className="space-y-4 text-neutral-700 dark:text-neutral-300">
      <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-white">
        నిరాకరణ (Disclaimer)
      </h1>
      <p>
        {SITE.name} లోని content information & education purposes కోసం మాత్రమే.
        మేము accuracy కోసం ప్రయత్నిస్తాం, కానీ ఏ information కూడా 100% complete
        లేదా up-to-date అని guarantee ఇవ్వలేము.
      </p>
      <p>
        ఈ site లోని articles <strong>AI-assisted</strong> గా తయారవుతాయి మరియు
        publish ముందు <strong>human editor review</strong> చేయబడతాయి. అయినా
        ఏదైనా decision (purchase, financial, technical) తీసుకునే ముందు మీరు
        స్వంతంగా verify చేసుకోవాలి.
      </p>
      <p>
        External links మా control lo లేని third-party sites కు దారి తీయవచ్చు —
        వాటి content కు మేము బాధ్యత వహించము.
      </p>
    </div>
  );
}
