import Link from 'next/link';
import { TopNav } from '@/components/top-nav';

function Input({ placeholder }: { placeholder: string }) {
  return <input placeholder={placeholder} className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3" />;
}

export default function AuthPage() {
  return (
    <main>
      <TopNav />
      <section className="container mt-8 grid gap-6 pb-12 md:grid-cols-2">
        <article className="glass rounded-3xl p-6 md:p-8">
          <p className="chip bg-lime-100 text-lime-700">Я взрослый</p>
          <h1 className="mt-4 text-3xl font-black">Вход / регистрация</h1>
          <p className="mt-2 text-sm text-neutral-600">
            Единый аккаунт взрослого в Supabase Auth для ролей преподавателя и родителя. Выбор режима — после входа.
          </p>
          <div className="mt-5 space-y-3">
            <Input placeholder="Email или телефон" />
            <Input placeholder="Пароль" />
            <button className="w-full rounded-2xl bg-black px-4 py-3 font-semibold text-white">Войти</button>
            <button className="w-full rounded-2xl bg-sky-100 px-4 py-3 font-semibold">Создать аккаунт</button>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
            <span className="chip justify-center bg-neutral-100">Преподаватель</span>
            <span className="chip justify-center bg-neutral-100">Родитель</span>
            <span className="chip justify-center bg-neutral-100">Оба режима</span>
          </div>
        </article>

        <article className="glass rounded-3xl p-6 md:p-8">
          <p className="chip bg-violet-100 text-violet-700">Я ученик</p>
          <h2 className="mt-4 text-3xl font-black">Вход ученика</h2>
          <p className="mt-2 text-sm text-neutral-600">
            Отдельный UX-поток, но та же аутентификация через Supabase Auth (без отдельной student_credentials таблицы).
          </p>
          <div className="mt-5 space-y-3">
            <Input placeholder="Email/логин ученика" />
            <Input placeholder="Пароль" />
            <button className="w-full rounded-2xl bg-black px-4 py-3 font-semibold text-white">Войти как ученик</button>
          </div>

          <div className="mt-5 rounded-2xl bg-neutral-100 p-4 text-sm text-neutral-700">
            Демо-навигация:
            <div className="mt-2 flex flex-wrap gap-2">
              <Link href="/dashboard/teacher" className="chip bg-white">
                Кабинет преподавателя
              </Link>
              <Link href="/dashboard/parent" className="chip bg-white">
                Кабинет родителя
              </Link>
              <Link href="/dashboard/student" className="chip bg-white">
                Кабинет ученика
              </Link>
            </div>
          </div>
        </article>
      </section>
    </main>
  );
}
