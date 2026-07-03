"use client";

import { useEffect, useState } from "react";

/**
 * Google Display-style image carousel for an ad unit. A single image just
 * renders (no client JS cost); 2-3 images auto-rotate with dot indicators.
 */
export function AdImageCarousel({
  images,
  alt,
  className = "",
  imgClassName = "",
}: {
  images: string[];
  alt: string;
  className?: string;
  imgClassName?: string;
}) {
  const [i, setI] = useState(0);

  useEffect(() => {
    if (images.length < 2) return;
    const t = setInterval(() => setI((n) => (n + 1) % images.length), 3500);
    return () => clearInterval(t);
  }, [images.length]);

  if (images.length === 0) return null;

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {images.map((src, idx) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={src}
          src={src}
          alt={alt}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${imgClassName} ${idx === i ? "opacity-100" : "opacity-0"}`}
        />
      ))}
      {images.length > 1 && (
        <div className="absolute inset-x-0 bottom-1 flex justify-center gap-1">
          {images.map((_, idx) => (
            <span
              key={idx}
              className={`h-1.5 w-1.5 rounded-full transition ${idx === i ? "bg-white" : "bg-white/50"}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
