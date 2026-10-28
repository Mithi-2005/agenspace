export function ComingSoonTag({ className = "" }: { className?: string }) {
  return (
    <span
      className={`as-coming-soon-tag ${className}`}
      aria-label="Coming soon"
    >
      Coming soon
    </span>
  );
}
