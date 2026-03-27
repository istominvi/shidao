import { TopNav } from '@/components/top-nav';

export function DashboardShell({
  title,
  subtitle,
  roleLabel,
  children
}: {
  title: string;
  subtitle: string;
  roleLabel: string;
  children: React.ReactNode;
}) {
  return (
    <main className="pb-10">
      <TopNav />
      <div className="container py-8">
        <section className="glass rounded-3xl p-6 md:p-10">
          <p className="text-xs uppercase tracking-[0.22em] text-neutral-500">{roleLabel}</p>
          <h1 className="mt-2 text-3xl font-black md:text-5xl">{title}</h1>
          <p className="mt-2 text-neutral-600">{subtitle}</p>
          <div className="mt-8">{children}</div>
        </section>
      </div>
    </main>
  );
}
