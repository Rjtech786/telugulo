import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { getSiteSettings, socialsArray } from "@/lib/settings";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const site = await getSiteSettings();
  const socials = socialsArray(site);

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <SiteHeader name={site.name} tagline={site.tagline} socials={socials} />
      <main className="mx-auto w-full max-w-[1180px] flex-1 px-4">{children}</main>
      <SiteFooter name={site.name} about={site.footer_about} socials={socials} />
    </div>
  );
}
