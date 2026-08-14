import { type ReactNode } from "react";
import { AppPageHeader } from "@/components/app/page-header";
import { TopNav } from "@/components/top-nav";
import { SettingsNavigation } from "@/components/settings-navigation";

type SettingsShellProps = {
  title: string;
  metric?: ReactNode;
  children: ReactNode;
};

export function SettingsShell({ title, metric, children }: SettingsShellProps) {
  return (
    <main className="course-demo-shell settings-product-shell">
      <TopNav demoStyle />
      <section className="container mt-8 grid gap-4 pb-12 md:grid-cols-[280px_minmax(0,1fr)]">
        <SettingsNavigation />

        <div className="glass rounded-3xl p-6 md:p-8">
          <AppPageHeader title={title} metric={metric} />
          {children}
        </div>
      </section>
    </main>
  );
}
