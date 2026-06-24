import type { Metadata } from "next";
import { SITE } from "@/lib/site";

export const metadata: Metadata = { title: "సంపాదకీయ విధానం (Editorial Policy)" };

export default function EditorialPolicyPage() {
  return (
    <div className="space-y-4 text-neutral-700 dark:text-neutral-300">
      <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-white">
        సంపాదకీయ విధానం (Editorial Policy)
      </h1>
      <p>
        {SITE.name} లో మేము accuracy, transparency, మరియు reader trust కు అత్యధిక
        ప్రాధాన్యత ఇస్తాం.
      </p>
      <h2 className="text-lg font-semibold">AI transparency</h2>
      <p>
        మా articles AI tools సహాయంతో research & draft చేయబడతాయి. కానీ ప్రతి article
        publish ముందు ఒక <strong>human editor</strong> facts check చేసి, edit చేసి,
        approve చేస్తారు. ఏ article కూడా review లేకుండా automatic గా publish కాదు.
      </p>
      <h2 className="text-lg font-semibold">Sources & originality</h2>
      <p>
        మేము ఇతర sources నుండి facts తీసుకుంటాం కానీ content ను copy చేయము — ప్రతి
        article original Telugu lo రాయబడుతుంది. వీలైనప్పుడు sources ను reference
        చేస్తాం.
      </p>
      <h2 className="text-lg font-semibold">Corrections</h2>
      <p>
        ఏదైనా తప్పు గమనిస్తే,{" "}
        <a href="/contact" className="underline">contact</a> చేయండి — మేము త్వరగా
        correct చేస్తాం.
      </p>
    </div>
  );
}
