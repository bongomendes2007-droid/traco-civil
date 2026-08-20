import Image from "next/image";
import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
  showText?: boolean;
  variant?: "default" | "mono" | "inverse";
}

// A logo oficial (traco-civil-logo.png) é um wordmark horizontal 1600x267 (~6:1),
// predominantemente escuro. Em fundos escuros (sidebar/login) usamos a variante
// "inverse" que inverte para branco via CSS, mantendo uma única fonte da verdade.
const heightMap = { sm: 18, md: 26, lg: 40, xl: 56 };

export function Logo({
  className,
  size = "md",
  showText = true,
  variant = "default",
}: LogoProps) {
  if (!showText) {
    return (
      <span
        aria-hidden
        className={cn("inline-block rounded-sm bg-traco-laranja", className)}
        style={{ width: heightMap[size], height: heightMap[size] }}
      />
    );
  }

  const h = heightMap[size];
  const w = Math.round((h * 1600) / 267);

  return (
    <Image
      src="/assets/traco-civil-logo.png"
      alt="TRAÇO CIVIL"
      width={w}
      height={h}
      priority={size === "lg" || size === "xl"}
      className={cn(
        "h-auto w-auto select-none",
        variant === "inverse" && "brightness-0 invert",
        className,
      )}
      style={{ height: h, width: w }}
    />
  );
}