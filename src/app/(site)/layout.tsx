import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { PopupAd } from "@/components/popup-ad";
import { getSiteSettings, socialsArray, getAdsSettings } from "@/lib/settings";
import { listPages } from "@/lib/pages";
import { pickPopupAd } from "@/lib/ads";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const [site, pages, popupAd, adsSettings] = await Promise.all([
    getSiteSettings(),
    listPages(),
    pickPopupAd(),
    getAdsSettings(),
  ]);
  const socials = socialsArray(site);

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <SiteHeader name={site.name} tagline={site.tagline} socials={socials} />
      <main className="mx-auto w-full max-w-[1180px] flex-1 px-4">{children}</main>
      <SiteFooter
        name={site.name}
        about={site.footer_about}
        socials={socials}
        pages={pages.map((p) => ({ slug: p.slug, title: p.title }))}
      />
      <PopupAd ad={popupAd} delaySeconds={adsSettings.popup_delay_seconds} />
    </div>
  );
}
