'use client';

import Link from 'next/link';
import { ROUTES } from '@/lib/auth';
import { SessionNavActions } from '@/components/session-nav-actions';
import { useSessionView } from '@/components/use-session-view';
import {
  Bell,
  BookOpen,
  CalendarDays,
  Check,
  ChevronRight,
  CircleHelp,
  FileAudio,
  FileText,
  GraduationCap,
  LayoutGrid,
  MessageSquare,
  School,
  UserRound,
  Users,
  Waypoints
} from 'lucide-react';

const trustItems = ['Методика внутри платформы', 'Урок как центр процесса', 'Задания и обсуждение рядом', 'Единая учебная среда', 'Кабинет родителя', 'История занятий'];

const audienceCards = [
  {
    id: 'teacher',
    title: 'Для преподавателя',
    tone: 'bg-sky-100/70',
    icon: GraduationCap,
    points: ['Ведёт группы и уроки в единой структуре.', 'Работает по встроенной методике — без хаоса в материалах.', 'Назначает домашние задания группе или ученику.', 'Обсуждает прогресс прямо в треде нужного урока.']
  },
  {
    id: 'parent',
    title: 'Для родителя',
    tone: 'bg-lime-100/80',
    icon: UserRound,
    points: ['Видит актуальное расписание ребёнка.', 'Следит за заданиями и статусом выполнения.', 'Получает комментарии по урокам и домашней работе.', 'Понимает, как ребёнок движется по программе.']
  },
  {
    id: 'student',
    title: 'Для ученика',
    tone: 'bg-fuchsia-100/70',
    icon: BookOpen,
    points: ['Заходит в отдельный, понятный кабинет.', 'Открывает урок и материалы в нужном порядке.', 'Сдаёт домашние задания текстом, файлом или голосом.', 'Обсуждает вопросы в треде именно своего занятия.']
  }
];

const workflow = [
  'Урок появляется в расписании и задаёт рамку занятия.',
  'Преподаватель открывает материалы и задаёт формат работы на урок.',
  'Домашнее задание назначается группе или конкретному ученику.',
  'Ученик отправляет ответ текстом, файлом или голосовым сообщением.',
  'Комментарии и переписка сохраняются внутри этого занятия.'
];

const featureCards = [
  { title: 'Расписание уроков', icon: CalendarDays },
  { title: 'Домашние задания', icon: FileText },
  { title: 'Коммуникация по занятию', icon: MessageSquare },
  { title: 'Кабинет родителя', icon: Users },
  { title: 'История занятий', icon: LayoutGrid },
  { title: 'Посещаемость', icon: Check },
  { title: 'Файлы и голосовые сообщения', icon: FileAudio },
  { title: 'Уведомления', icon: Bell }
];

const faq = [
  {
    q: 'Нужна ли отдельная регистрация ученика?',
    a: 'Нет. Взрослый создаёт ученический доступ, после чего ученик заходит по отдельному входу в свой кабинет.'
  },
  {
    q: 'Что видит родитель в системе?',
    a: 'Расписание, задания, статусы выполнения, комментарии и историю занятий — всё в одном месте.'
  },
  {
    q: 'Можно ли использовать платформу частному преподавателю?',
    a: 'Да. Личный режим позволяет вести обучение самостоятельно, без сложной настройки.'
  },
  {
    q: 'Подходит ли платформа для школы или организации?',
    a: 'Да. Есть школьный режим для командной работы с аккуратным разграничением доступа и данных.'
  },
  {
    q: 'Как устроены задания и коммуникация?',
    a: 'Задания назначаются по уроку, а обсуждение остаётся в треде этого же занятия — ничего не теряется.'
  },
  {
    q: 'Можно ли прикладывать файлы и голосовые сообщения?',
    a: 'Да, ответы и комментарии можно отправлять в разных форматах, включая файлы и голосовые.'
  },
  {
    q: 'Нужна ли своя методика, чтобы начать?',
    a: 'Нет. В Shidao методика уже встроена в платформу и задаёт структуру обучения с первого урока.'
  }
];

function SectionTitle({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <header className="max-w-3xl">
      <p className="landing-chip landing-chip-soft text-xs tracking-[0.12em] uppercase">{eyebrow}</p>
      <h2 className="mt-4 max-w-[17ch] text-2xl font-black leading-tight tracking-tight sm:max-w-[22ch] md:mt-5 md:max-w-none md:text-5xl">{title}</h2>
      <p className="mt-3 max-w-[58ch] text-[0.97rem] leading-relaxed text-neutral-700 md:mt-4 md:text-lg">{description}</p>
    </header>
  );
}

export function LandingPage() {
  const { state, sessionResolved } = useSessionView();
  const authCtaHref = sessionResolved && state.authenticated ? ROUTES.dashboard : ROUTES.login;

  return (
    <main className="pb-16">
      <div className="landing-noise" aria-hidden="true" />
      <section className="container pt-4 md:pt-8">
        <div className="relative overflow-hidden rounded-[1.8rem] border border-white/70 bg-white/75 p-4 shadow-[0_20px_80px_rgba(20,20,20,0.08)] backdrop-blur-xl md:rounded-[2.2rem] md:p-7">
          <div className="absolute -right-28 -top-24 h-64 w-64 rounded-full bg-fuchsia-200/40 blur-3xl" aria-hidden="true" />
          <div className="absolute -left-28 bottom-6 h-56 w-56 rounded-full bg-sky-200/45 blur-3xl" aria-hidden="true" />

          <header className="relative z-10 flex flex-wrap items-center justify-between gap-4">
            <Link href={ROUTES.home} className="text-xl font-black tracking-tight transition hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/40">
              Shidao
            </Link>
            <nav aria-label="Навигация по лендингу" className="hidden flex-wrap gap-2 text-sm font-medium text-neutral-700 lg:flex">
              <a href="#audience" className="rounded-full border border-transparent px-4 py-2 text-neutral-800 transition hover:border-black/10 hover:bg-black hover:text-white">Для кого</a>
              <a href="#method" className="rounded-full border border-transparent px-4 py-2 text-neutral-800 transition hover:border-black/10 hover:bg-black hover:text-white">Методика</a>
              <a href="#workflow" className="rounded-full border border-transparent px-4 py-2 text-neutral-800 transition hover:border-black/10 hover:bg-black hover:text-white">Сценарий урока</a>
              <a href="#access" className="rounded-full border border-transparent px-4 py-2 text-neutral-800 transition hover:border-black/10 hover:bg-black hover:text-white">Доступ</a>
              <a href="#faq" className="rounded-full border border-transparent px-4 py-2 text-neutral-800 transition hover:border-black/10 hover:bg-black hover:text-white">Вопросы</a>
            </nav>
            <div className="flex w-full gap-2 sm:w-auto">
              {sessionResolved && !state.authenticated ? (
                <>
                  <Link href={ROUTES.login} className="landing-btn landing-btn-muted min-h-11 flex-1 sm:flex-none">Войти</Link>
                  <Link href={ROUTES.join} className="landing-btn landing-btn-primary min-h-11 flex-1 sm:flex-none">Создать аккаунт</Link>
                </>
              ) : state.authenticated ? (
                <SessionNavActions state={state} variant="landing" portalMenu />
              ) : (
                <div className="landing-btn landing-btn-muted min-h-11 flex-1 text-sm text-neutral-500 sm:flex-none">Проверяем сессию…</div>
              )}
            </div>
          </header>

          <div className="relative z-10 mt-8 grid items-center gap-7 md:gap-10 lg:grid-cols-[1.03fr_0.97fr]">
            <div>
              <p className="landing-chip bg-lime-200/85 md:-rotate-2">Премиальная среда для преподавания китайского</p>
              <h1 className="mt-5 max-w-[13ch] text-[2rem] font-black leading-[0.98] tracking-[-0.03em] sm:max-w-[16ch] sm:text-[2.35rem] md:mt-6 md:max-w-none md:text-7xl">Китайский по готовой методике — в единой учебной среде</h1>
              <p className="mt-4 max-w-[52ch] text-[0.97rem] leading-relaxed text-neutral-700 md:mt-6 md:max-w-xl md:text-lg">
                Преподаватель ведёт обучение системно. Родитель видит прогресс. Ученик идёт по понятному маршруту и заходит в отдельный кабинет.
              </p>
              <div className="mt-6 grid gap-3 sm:mt-8 sm:flex sm:flex-wrap">
                <Link href={ROUTES.join} className="landing-btn landing-btn-primary min-h-12 w-full inline-flex items-center justify-center gap-2 sm:w-auto">Начать в Shidao <ChevronRight className="size-4" /></Link>
                <Link href={authCtaHref} className="landing-btn landing-btn-muted min-h-12 w-full sm:w-auto">У меня уже есть доступ</Link>
              </div>
            </div>

            <div className="relative">
              <div className="absolute right-1 top-1 z-20 md:-right-3 md:-top-6">
                <span className="landing-chip floating-chip rotate-[3deg] bg-white text-neutral-900">Методика внутри</span>
              </div>
              <div className="absolute -left-2 top-6 z-20 hidden md:block">
                <span className="landing-chip floating-chip -rotate-3 bg-sky-100 text-neutral-800">Личный режим</span>
              </div>
              <div className="absolute -right-6 bottom-14 z-20 hidden md:block">
                <span className="landing-chip floating-chip rotate-2 bg-fuchsia-100 text-neutral-900">Школьный режим</span>
              </div>
              <div className="absolute left-10 top-[58%] z-20 hidden md:block">
                <span className="landing-chip floating-chip -rotate-2 bg-lime-100 text-neutral-900">Тред в контексте урока</span>
              </div>

              <div className="relative rounded-[1.6rem] border border-black/10 bg-gradient-to-br from-white via-white to-violet-50 p-3.5 shadow-[0_40px_90px_rgba(17,24,39,0.18)] sm:p-4 md:rounded-[2.2rem] md:p-6">
                <div className="absolute inset-x-10 top-0 h-12 rounded-b-[2rem] bg-gradient-to-b from-white/85 to-transparent" aria-hidden="true" />
                <div className="landing-surface rounded-[1.35rem] bg-[linear-gradient(140deg,rgba(240,247,255,0.9),rgba(255,255,255,0.9),rgba(255,241,250,0.85))] p-3.5 sm:p-4 md:rounded-[1.8rem] md:p-5">
                  <article className="landing-card">
                    <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">Сегодня • HSK 2</p>
                    <h3 className="mt-2 text-base font-black md:text-lg">Урок: Диалоги и грамматика</h3>
                    <p className="mt-2 text-sm leading-relaxed text-neutral-700">Материалы, домашняя работа и комментарии в одном месте.</p>
                  </article>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <article className="landing-card bg-white/90">
                      <p className="text-sm font-semibold">Домашнее задание</p>
                      <p className="mt-1 text-sm text-neutral-600">Назначено группе 3A, дедлайн до пятницы.</p>
                    </article>
                    <article className="landing-card border-black/20 bg-black text-white shadow-[0_20px_35px_rgba(10,10,10,0.35)]">
                      <p className="text-sm font-semibold">Кабинет родителя</p>
                      <p className="mt-1 text-sm text-white/80">Посещаемость, статус и комментарии по уроку.</p>
                    </article>
                  </div>
                  <article className="landing-card mt-3 border-dashed border-black/20 bg-white/80">
                    <p className="text-sm font-semibold">Тред занятия</p>
                    <p className="mt-1 text-sm text-neutral-600">Текст, файл и голосовые ответы ученика остаются рядом с этим уроком.</p>
                  </article>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="container mt-5 md:mt-6">
        <div className="flex flex-wrap gap-2 rounded-[1.8rem] border border-black/5 bg-white/60 p-4 backdrop-blur-xl">
          {trustItems.map((item, index) => (
            <span key={item} className={`landing-chip text-sm transition duration-300 hover:-translate-y-0.5 ${index % 4 === 0 ? 'rotate-1 bg-sky-100/80' : index % 4 === 1 ? '-rotate-1 bg-lime-100/80' : index % 4 === 2 ? 'rotate-2 bg-fuchsia-100/80' : '-rotate-2 bg-violet-100/70'}`}>
              {item}
            </span>
          ))}
        </div>
      </section>

      <section id="audience" className="container mt-14 md:mt-16">
        <SectionTitle
          eyebrow="Для кого платформа"
          title="Три роли — один единый рабочий процесс"
          description="Каждый участник учебного процесса получает понятный интерфейс и только нужные действия."
        />
        <div className="mt-8 grid gap-4 md:mt-10 md:grid-cols-6 md:gap-5">
          {audienceCards.map(({ id, title, icon: Icon, points, tone }, index) => (
            <article key={id} className={`landing-surface rounded-[1.5rem] border border-black/10 p-4 shadow-[0_16px_40px_rgba(20,20,20,0.08)] sm:p-5 md:rounded-[1.9rem] md:p-6 ${tone} ${index === 1 ? 'md:col-span-2 md:-translate-y-3' : 'md:col-span-2'}`}>
              <Icon className="size-5" />
              <h3 className="mt-3 text-xl font-black md:mt-4 md:text-2xl">{title}</h3>
              <ul className="mt-3 space-y-2.5 text-sm leading-relaxed text-neutral-700 md:mt-4 md:space-y-3">
                {points.map((point) => (
                  <li key={point} className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0" />{point}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section id="method" className="container mt-14 md:mt-16">
        <div className="grid gap-6 rounded-[1.7rem] border border-black/10 bg-white/70 p-5 shadow-[0_18px_60px_rgba(20,20,20,0.08)] md:grid-cols-[1.1fr_0.9fr] md:rounded-[2rem] md:p-8">
          <div className="order-2 md:order-1">
            <p className="text-4xl font-black leading-none tracking-[-0.04em] text-black/85 md:text-7xl">Методика = ритм</p>
            <SectionTitle
              eyebrow="Методика — ядро"
              title="Shidao — не просто кабинет, а продуманная среда обучения."
              description="Курс, урок, материалы, домашняя работа и проверка собраны в единую цепочку. Преподаватель не собирает процесс вручную — он ведёт его по готовой логике."
            />
          </div>
          <div className="landing-surface order-1 rounded-[1.3rem] border border-black/10 bg-gradient-to-b from-white to-neutral-50 p-4 md:order-2 md:rounded-[1.5rem] md:p-5">
            {['Курс', 'Урок', 'Материалы', 'Домашнее задание', 'Тест / Комментарии'].map((step, idx) => (
              <div key={step} className="flex items-center gap-3">
                <span className="my-3 inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-black text-sm font-bold text-white">{idx + 1}</span>
                <p className="text-sm font-semibold md:text-base">{step}</p>
                {idx < 4 && <Waypoints className="ml-auto size-4 text-neutral-400" />}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="workflow" className="container mt-14 md:mt-16">
        <SectionTitle
          eyebrow="Как это работает"
          title="Сценарий одного урока — прозрачно для всех"
          description="Всё, что происходит вокруг урока, остаётся в рабочем пространстве и не теряется в чатах и заметках."
        />
        <ol className="mt-8 grid gap-3 md:grid-cols-5 md:gap-4">
          {workflow.map((item, idx) => (
            <li key={item} className={`landing-surface rounded-3xl border border-black/10 p-5 ${idx === 1 || idx === 3 ? 'bg-black text-white shadow-[0_16px_32px_rgba(20,20,20,0.24)]' : 'bg-white/75'}`}>
              <p className={`text-xs font-bold tracking-[0.14em] ${idx === 1 || idx === 3 ? 'text-white/70' : 'text-neutral-500'}`}>ШАГ {idx + 1}</p>
              <p className={`mt-3 text-sm leading-relaxed ${idx === 1 || idx === 3 ? 'text-white/90' : 'text-neutral-800'}`}>{item}</p>
            </li>
          ))}
        </ol>
      </section>

      <section id="access" className="container mt-14 grid gap-4 md:mt-16 md:gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <article className="rounded-[1.6rem] border border-black/10 bg-black p-5 text-white shadow-[0_20px_70px_rgba(20,20,20,0.25)] md:rounded-[1.9rem] md:p-7">
          <p className="landing-chip -rotate-2 bg-white/15 text-white">Доступ без лишних шагов</p>
          <h3 className="mt-5 max-w-[18ch] text-2xl font-black leading-tight md:max-w-none md:text-4xl">Единый взрослый доступ и отдельный вход ученика</h3>
          <p className="mt-4 text-sm leading-relaxed text-white/85 md:text-base">
            Взрослый регистрируется один раз и работает в нужном сценарии. Ученик не проходит самостоятельную регистрацию:
            взрослый создаёт ему доступ, а ученик заходит отдельно в свой кабинет.
          </p>
        </article>
        <article className="landing-surface rounded-[1.6rem] border border-black/10 bg-white/70 p-5 md:rounded-[1.9rem] md:p-7">
          <p className="landing-chip rotate-2 bg-violet-100/90">Личный и школьный режим</p>
          <h3 className="mt-5 max-w-[18ch] text-2xl font-black leading-tight md:max-w-none md:text-3xl">Подходит частным преподавателям и командам школ</h3>
          <p className="mt-4 text-sm leading-relaxed text-neutral-700 md:text-base">
            Начинайте в личном формате и переходите в школьный режим, когда растёт команда. Доступы и данные
            разграничены аккуратно, чтобы каждый работал в своей зоне ответственности.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <span className="landing-chip bg-sky-100/80"><GraduationCap className="size-4" /> Частный преподаватель</span>
            <span className="landing-chip bg-amber-100/80"><School className="size-4" /> Школа / организация</span>
          </div>
        </article>
      </section>

      <section className="container mt-14 md:mt-16">
        <SectionTitle
          eyebrow="Функциональные блоки"
          title="Всё, что нужно для системного обучения китайскому"
          description="Ключевые возможности собраны в едином пространстве и работают в контексте реальных уроков."
        />
        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {featureCards.map(({ title, icon: Icon }, idx) => (
            <article key={title} className={`landing-surface rounded-3xl border border-black/10 p-5 ${idx % 4 === 0 ? 'bg-lime-100/70' : idx % 4 === 1 ? 'bg-sky-100/75' : idx % 4 === 2 ? 'bg-white/80' : 'bg-fuchsia-100/70'}`}>
              <Icon className="size-5" />
              <h3 className="mt-4 text-base font-bold">{title}</h3>
            </article>
          ))}
        </div>
      </section>

      <section id="faq" className="container mt-14 md:mt-16">
        <SectionTitle
          eyebrow="Частые вопросы"
          title="Коротко о самом важном"
          description="Собрали ответы на частые вопросы перед стартом работы в Shidao."
        />
        <div className="mt-8 space-y-2.5 md:space-y-3">
          {faq.map(({ q, a }) => (
            <details key={q} className="group landing-surface rounded-[1.2rem] border border-black/10 bg-white/80 p-4 open:bg-white md:rounded-3xl md:p-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[0.98rem] font-semibold leading-snug md:gap-4 md:text-base">
                <span>{q}</span>
                <CircleHelp className="size-4 shrink-0 text-neutral-500 transition group-open:rotate-12" />
              </summary>
              <p className="mt-2.5 text-sm leading-relaxed text-neutral-700 md:mt-3">{a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="container mt-14 md:mt-16">
        <div className="relative overflow-hidden rounded-[1.6rem] border border-black/10 bg-black px-4 py-8 text-center text-white shadow-[0_24px_70px_rgba(20,20,20,0.3)] sm:px-6 md:rounded-[2rem] md:px-12 md:py-10">
          <div className="absolute left-1/2 top-0 h-40 w-80 -translate-x-1/2 rounded-full bg-white/10 blur-3xl" aria-hidden="true" />
          <p className="landing-chip mx-auto bg-white/15">Готовы запустить обучение в единой учебной среде?</p>
          <h2 className="mx-auto mt-5 max-w-[18ch] text-2xl font-black leading-tight md:mt-6 md:max-w-none md:text-5xl">Начните в Shidao и соберите весь учебный процесс в одном месте</h2>
          <p className="mx-auto mt-3 max-w-[52ch] text-sm leading-relaxed text-white/80 md:mt-4 md:max-w-2xl md:text-base">От первого урока до домашней работы и комментариев — единая методическая среда для преподавателя, родителя и ученика.</p>
          <div className="mt-6 grid gap-3 sm:mt-8 sm:flex sm:flex-wrap sm:items-center sm:justify-center">
            <Link href={ROUTES.join} className="landing-btn min-h-12 w-full bg-lime-200 !text-black hover:bg-lime-300 sm:w-auto">Создать аккаунт</Link>
            <Link href={authCtaHref} className="landing-btn min-h-12 w-full border border-white/50 bg-white/5 text-white hover:bg-white/15 sm:w-auto">Войти</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
