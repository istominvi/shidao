type SectionTitleProps = {
  eyebrow: string;
  title: string;
  description: string;
};

export function SectionTitle({
  eyebrow,
  title,
  description,
}: SectionTitleProps) {
  return (
    <header className="max-w-3xl">
      <p className="landing-chip landing-chip-soft text-xs tracking-[0.12em] uppercase">
        {eyebrow}
      </p>
      <h2 className="mt-4 text-2xl font-black leading-tight tracking-tight md:mt-5 md:text-5xl">
        {title}
      </h2>
      <p className="mt-3 max-w-[62ch] text-[0.97rem] leading-relaxed text-neutral-700 md:mt-4 md:text-lg">
        {description}
      </p>
    </header>
  );
}
