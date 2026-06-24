import Image from "next/image";
import { gradientFor } from "@/lib/site";

/**
 * Featured-image thumbnail. Shows the article's image when present, otherwise a
 * deterministic colour gradient placeholder (matches the UI mock).
 */
export function Thumb({
  src,
  alt,
  seed,
  className = "",
  sizes,
  priority,
}: {
  src: string | null;
  alt: string;
  seed: string;
  className?: string;
  sizes?: string;
  priority?: boolean;
}) {
  return (
    <div className={`relative overflow-hidden ${className}`}>
      {src ? (
        <Image
          src={src}
          alt={alt}
          fill
          sizes={sizes ?? "100vw"}
          priority={priority}
          className="object-cover"
        />
      ) : (
        <div
          className="h-full w-full"
          style={{ background: gradientFor(seed) }}
          aria-hidden
        />
      )}
    </div>
  );
}
