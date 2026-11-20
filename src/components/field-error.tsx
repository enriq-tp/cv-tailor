// An error message: an icon plus text, never colour alone. The icon is decorative.
export function FieldError({ children }: { children: React.ReactNode }) {
  return (
    <span className="flex items-start gap-2 font-medium text-brick">
      <svg
        aria-hidden="true"
        viewBox="0 0 20 20"
        className="mt-[3px] size-[18px] shrink-0"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      >
        <circle cx="10" cy="10" r="8" />
        <path d="M10 5.5v5.5M10 14.2v.1" />
      </svg>
      <span>{children}</span>
    </span>
  );
}
