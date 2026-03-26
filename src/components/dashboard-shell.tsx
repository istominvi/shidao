import Link from 'next/link';

export function DashboardShell({
  title,
  subtitle,
  children,
  role
}: {
  title: string;
  subtitle: string;
  role: 'teacher' | 'parent' | 'student';
  children: React.ReactNode;
}) {
  return (
    <div className="container py-8">
      <div className="mb-4 flex flex-wrap gap-2 text-sm">
        <Link className="chip bg-sky-100" href="/dashboard/teacher">
          Режим: преподаватель
        </Link>
        <Link className="chip bg-lime-100" href="/dashboard/parent">
          Режим: родитель
        </Link>
        <Link className="chip bg-violet-100" href="/dashboard/student">
          Режим: ученик
        </Link>
        <Link className="chip bg-white" href="/auth">
          Выйти
        </Link>
      </div>
      <section className="glass rounded-3xl p-6 md:p-10">
        <p className="text-xs uppercase tracking-[0.22em] text-neutral-500">{role}</p>
        <h1 className="mt-2 text-3xl font-black md:text-5xl">{title}</h1>
        <p className="mt-2 text-neutral-600">{subtitle}</p>
        <div className="mt-8">{children}</div>
      </section>
    </div>
  );
}
