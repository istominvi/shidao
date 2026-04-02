import Link from 'next/link';
import { DashboardShell } from '@/components/dashboard-shell';

export default function ProfileChooserPage() {
  return (
    <DashboardShell
      roleLabel="Профили"
      title="Выберите профиль"
      subtitle="У вашего аккаунта доступны профили родителя и преподавателя."
    >
      <div className="grid gap-4 md:grid-cols-2">
        <Link href="/dashboard/parent" className="rounded-3xl border border-black/10 bg-pink-50 p-6 transition hover:border-black/30">
          <h2 className="text-xl font-bold">Родитель</h2>
          <p className="mt-2 text-sm text-neutral-700">Следите за прогрессом, уроками и домашними заданиями учеников.</p>
        </Link>
        <Link href="/dashboard/teacher" className="rounded-3xl border border-black/10 bg-sky-50 p-6 transition hover:border-black/30">
          <h2 className="text-xl font-bold">Преподаватель</h2>
          <p className="mt-2 text-sm text-neutral-700">Управляйте классами, уроками и учебной программой школы.</p>
        </Link>
      </div>
    </DashboardShell>
  );
}
