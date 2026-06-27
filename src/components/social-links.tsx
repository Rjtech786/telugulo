import { SOCIALS } from "@/lib/site";
import {
  IconFacebook,
  IconWhatsapp,
  IconTelegram,
  IconInstagram,
} from "@/components/icons";

const ICONS = {
  facebook: IconFacebook,
  whatsapp: IconWhatsapp,
  telegram: IconTelegram,
  instagram: IconInstagram,
} as const;

/** Brand colours for the filled-circle variant (matches taazatime footer). */
const BRAND: Record<string, string> = {
  facebook: "#1877f2",
  whatsapp: "#25d366",
  telegram: "#229ed2",
  instagram: "#e1306c",
};

/**
 * Row of social follow icons.
 * - `variant="brand"` → filled circles in each platform's brand colour.
 * - default → plain icons that inherit `currentColor`.
 */
export function SocialLinks({
  className = "",
  size = 16,
  variant = "plain",
}: {
  className?: string;
  size?: number;
  variant?: "plain" | "brand";
}) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {SOCIALS.map((s) => {
        const Icon = ICONS[s.name as keyof typeof ICONS];
        if (!Icon) return null;

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
