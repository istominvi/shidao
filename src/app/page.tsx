import Link from 'next/link';
import { GraduationCap, Sparkles, Users } from 'lucide-react';
import { TopNav } from '@/components/top-nav';

export default function LandingPage() {
  return (
    <main className="pb-10">
      <TopNav />
      <section className="container mt-8 rounded-[2rem] bg-white p-8 shadow-sm md:p-14">
        <p className="chip bg-pink-100 text-pink-700">Онлайн-платформа ShiDao</p>
        <h1 className="mt-6 max-w-4xl text-5xl font-black leading-[0.95] md:text-7xl">
          Обучение китайскому языку в едином контуре для
          <span className="ml-3 inline-block rounded-2xl bg-lime-300 px-4 py-2">преподавателя</span>
          <span className="ml-3 inline-block rounded-2xl bg-sky-200 px-4 py-2">родителя</span>
          <span className="ml-3 inline-block rounded-2xl bg-violet-200 px-4 py-2">ученика</span>
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-neutral-700">
          Базовый интерфейс Demo-версии: лэндинг, единая регистрация взрослого, отдельный вход ученика,
          кабинеты преподавателя и родителя.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link className="chip bg-black px-7 py-4 text-white" href="/auth">
            Войти / Зарегистрироваться
          </Link>
          <Link className="chip bg-neutral-100 px-7 py-4" href="/dashboard/teacher">
            Смотреть демо кабинетов
          </Link>
        </div>
      </section>

      <section className="container mt-7 grid gap-4 md:grid-cols-3">
        <article className="glass rounded-3xl p-6">
          <Sparkles className="mb-3" />
          <h2 className="text-xl font-bold">Методика — ядро</h2>
          <p className="mt-2 text-neutral-600">Готовые курсы, структура уроков и домашние задания в одном месте.</p>
        </article>
        <article className="glass rounded-3xl p-6">
          <Users className="mb-3" />
          <h2 className="text-xl font-bold">Единый взрослый аккаунт</h2>
          <p className="mt-2 text-neutral-600">Один пользователь может работать и как преподаватель, и как родитель.</p>
        </article>
        <article className="glass rounded-3xl p-6">
          <GraduationCap className="mb-3" />
          <h2 className="text-xl font-bold">Отдельный вход ученика</h2>
          <p className="mt-2 text-neutral-600">Детский кабинет с ограниченными правами и собственными учетными данными.</p>
        </article>
      </section>
    </main>
  );
}
