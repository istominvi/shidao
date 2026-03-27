import Link from 'next/link';
import { GraduationCap, ShieldCheck, Sparkles, Users } from 'lucide-react';
import { TopNav } from '@/components/top-nav';

export default function LandingPage() {
  return (
    <main className="pb-12">
      <TopNav />

      <section className="container mt-8 rounded-[2rem] bg-white p-8 shadow-sm md:p-14">
        <p className="chip bg-pink-100 text-pink-700">Платформа ShiDao</p>
        <h1 className="mt-6 max-w-5xl text-4xl font-black leading-tight md:text-6xl">
          Прозрачное обучение китайскому языку для семьи, ученика и преподавателя
        </h1>
        <p className="mt-6 max-w-3xl text-lg text-neutral-700">
          Взрослые создают один единый аккаунт, а ученик входит по своему логину. После первого входа взрослый выбирает
          только одно направление и может позже переключить роль в шапке.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link className="chip bg-black px-7 py-4 text-white" href="/auth/sign-up">
            Зарегистрироваться взрослому
          </Link>
          <Link className="chip bg-neutral-100 px-7 py-4" href="/auth/sign-in">
            Войти в систему
          </Link>
        </div>
      </section>

      <section className="container mt-7 grid gap-4 md:grid-cols-3">
        <article className="glass rounded-3xl p-6">
          <Users className="mb-3" />
          <h2 className="text-xl font-bold">Один взрослый аккаунт</h2>
          <p className="mt-2 text-neutral-600">Регистрация единая: без деления на родителя и преподавателя в форме.</p>
        </article>
        <article className="glass rounded-3xl p-6">
          <GraduationCap className="mb-3" />
          <h2 className="text-xl font-bold">Отдельный вход ученика</h2>
          <p className="mt-2 text-neutral-600">Ученик входит по своему логину и сразу попадает в ученическую зону.</p>
        </article>
        <article className="glass rounded-3xl p-6">
          <ShieldCheck className="mb-3" />
          <h2 className="text-xl font-bold">Безопасная авторизация</h2>
          <p className="mt-2 text-neutral-600">Вход и пароли обрабатываются только через Supabase Auth.</p>
        </article>
      </section>

      <section className="container mt-7 grid gap-4 md:grid-cols-2">
        <article className="glass rounded-3xl p-6 md:p-8">
          <p className="chip bg-lime-100 text-lime-700">Для взрослых</p>
          <h3 className="mt-4 text-2xl font-black">Один вход, две роли</h3>
          <p className="mt-2 text-neutral-700">
            При первом входе вы выбираете одно направление: следить за обучением ребёнка или преподавать китайский язык.
            Вторую роль можно подключить позже в шапке.
          </p>
        </article>
        <article className="glass rounded-3xl p-6 md:p-8">
          <p className="chip bg-violet-100 text-violet-700">Для ученика</p>
          <h3 className="mt-4 text-2xl font-black">Быстрый и понятный вход</h3>
          <p className="mt-2 text-neutral-700">
            Единая форма входа принимает логин ученика и пароль/PIN-код. Не нужно выбирать тип аккаунта вручную.
          </p>
          <Sparkles className="mt-4" />
        </article>
      </section>
    </main>
  );
}
