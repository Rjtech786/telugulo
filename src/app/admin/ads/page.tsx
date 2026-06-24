import { listAds } from "@/lib/ads";
import { AdsClient } from "./AdsClient";

export const dynamic = "force-dynamic";

export default async function AdsPage() {
  const ads = await listAds();
  return <AdsClient ads={ads} />;
}
