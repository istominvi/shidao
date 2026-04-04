import { type ReactNode } from 'react';
import { TopNav } from '@/components/top-nav';

type DashboardShellProps = {
  title: string;
  subtitle: string;
  roleLabel: string;
  roleTone?: 'parent' | 'teacher' | 'student';
  children: ReactNode;
};

const roleToneClass: Record<NonNullable<DashboardShellProps['roleTone']>, string> = {
  parent: 'bg-lime-100/85',
  teacher: 'bg-sky-100/80',
  student: 'bg-fuchsia-100/75'
};

export function DashboardShell({ title, subtitle, roleLabel, roleTone = 'parent', children }: DashboardShellProps) {
  return (
    <main className="pb-10">
      <div className="landing-noise" aria-hidden="true" />
      <TopNav />
      <div className="container py-6 md:py-8">
        <section className="dashboard-hero landing-surface relative z-0 border border-white/70 shadow-[0_24px_72px_rgba(20,20,20,0.1)] backdrop-blur-xl">
          <p className={`landing-chip text-xs uppercase tracking-[0.16em] ${roleToneClass[roleTone]}`}>{roleLabel}</p>
          <h1 className="mt-4 text-4xl font-black tracking-[-0.03em] md:text-6xl">{title}</h1>
          <p className="mt-3 max-w-[62ch] text-sm text-neutral-700 md:text-base">{subtitle}</p>
          <div className="mt-6">{children}</div>
        </section>
      </div>
    </main>
  );
}
