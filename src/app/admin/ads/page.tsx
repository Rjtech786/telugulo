import { listAds, getAdAnalytics } from "@/lib/ads";
import { getAdsSettings } from "@/lib/settings";
import { AdsClient } from "./AdsClient";

export const dynamic = "force-dynamic";

export default async function AdsPage() {
  const [ads, analytics, adsSettings] = await Promise.all([
    listAds(),
    getAdAnalytics(14),
    getAdsSettings(),
  ]);
  return <AdsClient ads={ads} analytics={analytics} adsSettings={adsSettings} />;
}
