/** Lightweight Lucide-style line icons (SVG, no emoji). 24px, currentColor. */
import type { SVGProps } from "react";

function Svg(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    />
  );
}

export function IconDashboard(p: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...p}>
      <rect x="3" y="3" width="7" height="9" rx="1" />
      <rect x="14" y="3" width="7" height="5" rx="1" />
      <rect x="14" y="12" width="7" height="9" rx="1" />
      <rect x="3" y="16" width="7" height="5" rx="1" />
    </Svg>
  );
}

export function IconArticles(p: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...p}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
      <path d="M8 13h8M8 17h8M8 9h2" />
    </Svg>
  );
}

export function IconSettings(p: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...p}>
      <path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3" />
      <path d="M1 14h6M9 8h6M17 16h6" />
    </Svg>
  );
}

export function IconKey(p: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...p}>
      <circle cx="7.5" cy="15.5" r="5.5" />
      <path d="m21 2-9.6 9.6" />
      <path d="m15.5 7.5 3 3L22 7l-3-3" />
    </Svg>
  );
}

export function IconPlug(p: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...p}>
      <path d="M12 22v-5" />
      <path d="M9 8V2M15 8V2" />
      <path d="M18 8v5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V8Z" />
    </Svg>
  );
}

export function IconChart(p: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...p}>
      <path d="M3 3v18h18" />
      <path d="M18 17V9M13 17V5M8 17v-3" />
    </Svg>
  );
}

export function IconMegaphone(p: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...p}>
      <path d="m3 11 18-5v12L3 14v-3z" />
      <path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" />
    </Svg>
  );
}

export function IconLogout(p: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...p}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="m16 17 5-5-5-5" />
      <path d="M21 12H9" />
    </Svg>
  );
}

export function IconMenu(p: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...p}>
      <path d="M4 6h16M4 12h16M4 18h16" />
    </Svg>
  );
}

export function IconClose(p: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...p}>
      <path d="M18 6 6 18M6 6l12 12" />
    </Svg>
  );
}

export function IconDraft(p: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...p}>
      <path d="M12 22h6a2 2 0 0 0 2-2V7l-5-5H6a2 2 0 0 0-2 2v9" />
      <path d="M14 2v4a2 2 0 0 0 2 2h4" />
      <path d="M10.4 12.6a2 2 0 1 1 3 3L8 21l-4 1 1-4Z" />
    </Svg>
  );
}

export function IconCheck(p: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...p}>
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <path d="m22 4-10 10.01-3-3" />
    </Svg>
  );
}

export function IconStack(p: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...p}>
      <path d="m12 2 9 5-9 5-9-5 9-5Z" />
      <path d="m3 12 9 5 9-5" />
      <path d="m3 17 9 5 9-5" />
    </Svg>
  );
}

export function IconWallet(p: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...p}>
      <path d="M19 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0 0 4h15a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5" />
      <path d="M17 13h.01" />
    </Svg>
  );
}

/* ─── Brand / social glyphs (filled, currentColor) ─── */
function Brand(props: SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props} />;
}

export function IconFacebook(p: SVGProps<SVGSVGElement>) {
  return (
    <Brand {...p}>
      <path d="M14 13.5h2.5l1-4H14v-2c0-1.03 0-2 2-2h1.5V2.14c-.33-.04-1.55-.14-2.84-.14C11.93 2 10 3.66 10 6.7v2.8H7v4h3V22h4v-8.5Z" />
    </Brand>
  );
}

export function IconWhatsapp(p: SVGProps<SVGSVGElement>) {
  return (
    <Brand {...p}>
      <path d="M12 2a10 10 0 0 0-8.6 15.05L2 22l5.1-1.34A10 10 0 1 0 12 2Zm5.86 14.13c-.25.7-1.44 1.33-2 1.4-.51.06-1.16.09-1.87-.12-.43-.13-.99-.32-1.7-.62-2.99-1.29-4.94-4.3-5.09-4.5-.15-.2-1.22-1.62-1.22-3.09s.77-2.19 1.04-2.49c.27-.3.59-.37.79-.37l.57.01c.18.01.43-.07.67.51.25.6.84 2.07.91 2.22.07.15.12.32.02.52-.1.2-.15.32-.3.5-.15.17-.31.39-.45.52-.15.15-.3.31-.13.61.18.3.79 1.3 1.69 2.11 1.16 1.03 2.14 1.35 2.44 1.5.3.15.48.13.66-.08.18-.2.76-.89.96-1.19.2-.3.4-.25.67-.15.27.1 1.72.81 2.01.96.3.15.5.22.57.35.07.12.07.72-.18 1.42Z" />
    </Brand>
  );
}

export function IconTelegram(p: SVGProps<SVGSVGElement>) {
  return (
    <Brand {...p}>
      <path d="M21.94 4.5 18.6 19.2c-.25 1.1-.92 1.37-1.86.85l-5.14-3.79-2.48 2.39c-.27.27-.5.5-1.03.5l.37-5.23 9.52-8.6c.41-.37-.09-.57-.64-.2L5.1 12.07.04 10.5c-1.1-.34-1.12-1.1.23-1.63L20.5 2.96c.92-.34 1.72.2 1.44 1.54Z" />
    </Brand>
  );
}

export function IconInstagram(p: SVGProps<SVGSVGElement>) {
  return (
    <Brand {...p}>
      <path d="M12 2c-2.72 0-3.06.01-4.12.06-1.07.05-1.8.22-2.43.46a4.9 4.9 0 0 0-1.77 1.15A4.9 4.9 0 0 0 2.53 5.4c-.24.63-.41 1.36-.46 2.43C2.01 8.9 2 9.24 2 12s.01 3.06.06 4.12c.05 1.07.22 1.8.46 2.43.25.66.59 1.22 1.15 1.77.55.56 1.11.9 1.77 1.15.63.24 1.36.41 2.43.46C8.9 21.99 9.24 22 12 22s3.06-.01 4.12-.06c1.07-.05 1.8-.22 2.43-.46a4.9 4.9 0 0 0 1.77-1.15 4.9 4.9 0 0 0 1.15-1.77c.24-.63.41-1.36.46-2.43.05-1.06.06-1.4.06-4.12s-.01-3.06-.06-4.12c-.05-1.07-.22-1.8-.46-2.43a4.9 4.9 0 0 0-1.15-1.77 4.9 4.9 0 0 0-1.77-1.15c-.63-.24-1.36-.41-2.43-.46C15.06 2.01 14.72 2 12 2Zm0 1.8c2.67 0 2.99.01 4.04.06.98.04 1.5.21 1.86.35.47.18.8.4 1.15.75.35.35.57.68.75 1.15.14.36.31.88.35 1.86.05 1.05.06 1.37.06 4.04s-.01 2.99-.06 4.04c-.04.98-.21 1.5-.35 1.86-.18.47-.4.8-.75 1.15-.35.35-.68.57-1.15.75-.36.14-.88.31-1.86.35-1.05.05-1.37.06-4.04.06s-2.99-.01-4.04-.06c-.98-.04-1.5-.21-1.86-.35a3.1 3.1 0 0 1-1.15-.75 3.1 3.1 0 0 1-.75-1.15c-.14-.36-.31-.88-.35-1.86-.05-1.05-.06-1.37-.06-4.04s.01-2.99.06-4.04c.04-.98.21-1.5.35-1.86.18-.47.4-.8.75-1.15.35-.35.68-.57 1.15-.75.36-.14.88-.31 1.86-.35C9.01 3.81 9.33 3.8 12 3.8Zm0 3.06a5.13 5.13 0 1 0 0 10.27 5.13 5.13 0 0 0 0-10.27Zm0 8.47a3.33 3.33 0 1 1 0-6.67 3.33 3.33 0 0 1 0 6.67Zm6.54-8.67a1.2 1.2 0 1 1-2.4 0 1.2 1.2 0 0 1 2.4 0Z" />
    </Brand>
  );
}
