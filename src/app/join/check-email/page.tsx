import Link from 'next/link';
import { TopNav } from '@/components/top-nav';
import { ROUTES } from '@/lib/auth';

export default async function JoinCheckEmailPage({ searchParams }: { searchParams: Promise<{ email?: string }> }) {
  const params = await searchParams;
  return (
    <main>
      <TopNav />
      <section className="container mt-8 pb-12">
        <div className="mx-auto max-w-xl glass rounded-3xl p-6 md:p-8">
          <p className="chip bg-indigo-100 text-indigo-700">Проверьте email</p>
          <h1 className="mt-4 text-3xl font-black">Письмо отправлено</h1>
          <p className="mt-2 text-sm text-neutral-600">
            Мы отправили письмо для подтверждения на <span className="font-semibold">{params.email ?? 'ваш email'}</span>. Подтвердите адрес, затем выполните вход.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <Link href={ROUTES.login} className="rounded-2xl bg-black px-4 py-3 text-center font-semibold text-white">Перейти ко входу</Link>
            <Link href={ROUTES.join} className="rounded-2xl border border-black/15 bg-white px-4 py-3 text-center font-semibold">Назад / изменить email</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
