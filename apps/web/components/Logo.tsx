interface Props {
  size?: number;
  variant?: "mark" | "wordmark";
  className?: string;
}

/**
 * PetLab brand mark — circle with two pet-paw "ears" on top.
 * Reads as a friendly clinical roundel; works at 16px favicon up to 64px hero.
 */
export function Logo({ size = 28, variant = "wordmark", className }: Props) {
  const mark = (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className="shrink-0"
    >
      <circle cx="16" cy="18" r="11" fill="#0f766e" />
      <circle cx="9" cy="9" r="3" fill="#0f766e" />
      <circle cx="23" cy="9" r="3" fill="#0f766e" />
      <path
        d="M11 17.5c0-1.93 2.24-3.5 5-3.5s5 1.57 5 3.5c0 1.4-.97 2.6-2.4 3.18-.85.34-1.51 1.07-1.61 1.97L16.7 24c-.07.6-.92.6-.99 0l-.3-1.35c-.1-.9-.76-1.63-1.6-1.97-1.44-.58-2.41-1.78-2.41-3.18Z"
        fill="white"
      />
    </svg>
  );

  if (variant === "mark") {
    return <span className={className}>{mark}</span>;
  }

  return (
    <span className={`inline-flex items-center gap-2 ${className ?? ""}`}>
      {mark}
      <span className="text-lg font-semibold tracking-tight text-gray-900">
        Pet<span className="text-brand-700">Lab</span>
      </span>
    </span>
  );
}
