import {
  IconFacebook,
  IconWhatsapp,
  IconTelegram,
  IconInstagram,
  IconYoutube,
} from "@/components/icons";

const ICONS = {
  facebook: IconFacebook,
  whatsapp: IconWhatsapp,
  telegram: IconTelegram,
  instagram: IconInstagram,
  youtube: IconYoutube,
} as const;

/** Brand colours for the filled-circle variant (matches taazatime footer). */
const BRAND: Record<string, string> = {
  facebook: "#1877f2",
  whatsapp: "#25d366",
  telegram: "#229ed2",
  instagram: "#e1306c",
  youtube: "#ff0000",
};

export type Social = { name: string; href: string };

/**
 * Row of social follow icons (DB-driven — pass the configured links).
 * - `variant="brand"` → filled circles in each platform's brand colour.
 * - default → plain icons that inherit `currentColor`.
 * Renders nothing when no links are configured.
 */
export function SocialLinks({
  socials,
  className = "",
  size = 16,
  variant = "plain",
}: {
  socials: Social[];
  className?: string;
  size?: number;
  variant?: "plain" | "brand";
}) {
  const items = socials.filter((s) => s.href && ICONS[s.name as keyof typeof ICONS]);
  if (items.length === 0) return null;

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {items.map((s) => {
        const Icon = ICONS[s.name as keyof typeof ICONS];

        if (variant === "brand") {
          return (
            <a
              key={s.name}
              href={s.href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={s.name}
              className="grid place-items-center rounded-full text-white transition hover:opacity-85"
              style={{
                backgroundColor: BRAND[s.name],
                width: size + 16,
                height: size + 16,
              }}
            >
              <Icon style={{ width: size, height: size }} />
            </a>
          );
        }

        return (
          <a
            key={s.name}
            href={s.href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={s.name}
            className="grid place-items-center rounded-full p-1.5 opacity-90 transition hover:bg-black/5 hover:opacity-100"
          >
            <Icon style={{ width: size, height: size }} />
          </a>
        );
      })}
    </div>
  );
}
