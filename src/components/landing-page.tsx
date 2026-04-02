import Link from 'next/link';
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

function SectionTitle({
  eyebrow,
  title,
  description,
  invert = false
}: {
  eyebrow: string;
  title: string;
  description: string;
  invert?: boolean;
}) {
  return (
    <header className="max-w-3xl">
      <p className={`landing-chip text-xs tracking-[0.12em] uppercase ${invert ? 'bg-white/15 text-white border-white/20 shadow-none' : 'landing-chip-soft'}`}>{eyebrow}</p>
      <h2 className={`mt-5 text-3xl font-black leading-tight tracking-tight md:text-5xl ${invert ? 'text-white' : ''}`}>{title}</h2>
      <p className={`mt-4 text-base md:text-lg ${invert ? 'text-white/80' : 'text-neutral-700'}`}>{description}</p>
    </header>
  );
}

export function LandingPage() {
  return (
    <main className="pb-16">
      <div className="landing-noise" aria-hidden="true" />
      <section className="container pt-6 md:pt-8">
        <div className="relative overflow-hidden rounded-[2.2rem] border border-white/70 bg-white/75 p-4 shadow-[0_20px_80px_rgba(20,20,20,0.08)] backdrop-blur-xl md:p-7">
          <div className="absolute -right-28 -top-24 h-64 w-64 rounded-full bg-fuchsia-200/40 blur-3xl" aria-hidden="true" />
          <div className="absolute -left-28 bottom-6 h-56 w-56 rounded-full bg-sky-200/45 blur-3xl" aria-hidden="true" />

          <header className="relative z-10 flex flex-wrap items-center justify-between gap-4">
            <Link href="/" className="text-xl font-black tracking-tight transition hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/40">
              Shidao
            </Link>
            <nav aria-label="Навигация по лендингу" className="hidden flex-wrap gap-2 text-sm font-medium text-neutral-700 lg:flex">
              <a href="#audience" className="rounded-full border border-transparent px-4 py-2 text-neutral-800 transition hover:border-black/10 hover:bg-black hover:text-white">Для кого</a>
              <a href="#method" className="rounded-full border border-transparent px-4 py-2 text-neutral-800 transition hover:border-black/10 hover:bg-black hover:text-white">Методика</a>
              <a href="#workflow" className="rounded-full border border-transparent px-4 py-2 text-neutral-800 transition hover:border-black/10 hover:bg-black hover:text-white">Сценарий урока</a>
              <a href="#access" className="rounded-full border border-transparent px-4 py-2 text-neutral-800 transition hover:border-black/10 hover:bg-black hover:text-white">Доступ</a>
              <a href="#faq" className="rounded-full border border-transparent px-4 py-2 text-neutral-800 transition hover:border-black/10 hover:bg-black hover:text-white">Вопросы</a>
            </nav>
            <div className="flex gap-2">
              <Link href="/login" className="landing-btn landing-btn-muted">Войти</Link>
              <Link href="/join" className="landing-btn landing-btn-primary">Создать аккаунт</Link>
            </div>
          </header>

          <div className="relative z-10 mt-10 grid items-center gap-10 lg:grid-cols-[1.03fr_0.97fr]">
            <div>
              <p className="landing-chip -rotate-2 bg-lime-200/85">Премиальная среда для преподавания китайского</p>
              <h1 className="mt-6 text-4xl font-black leading-[0.98] tracking-[-0.03em] md:text-7xl">Китайский по готовой методике — в единой учебной среде для преподавателя, родителя и ученика</h1>
              <p className="mt-6 max-w-xl text-base leading-relaxed text-neutral-700 md:text-lg">
                Методика уже встроена в платформу: преподаватель ведёт обучение системно, родитель видит прогресс, а
                ученик получает понятный маршрут и отдельный вход.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/join" className="landing-btn landing-btn-primary inline-flex items-center gap-2">Начать в Shidao <ChevronRight className="size-4" /></Link>
                <Link href="/login" className="landing-btn landing-btn-muted">У меня уже есть доступ</Link>
              </div>
            </div>

            <div className="relative">
              <div className="absolute -right-3 -top-6 z-20">
                <span className="landing-chip floating-chip rotate-[3deg] bg-white text-neutral-900">Методика внутри</span>
              </div>
              <div className="absolute -left-5 top-10 z-20 hidden sm:block">
                <span className="landing-chip floating-chip -rotate-3 bg-sky-100 text-neutral-800">Личный режим</span>
              </div>
              <div className="absolute -right-6 bottom-14 z-20 hidden md:block">
                <span className="landing-chip floating-chip rotate-2 bg-fuchsia-100 text-neutral-900">Школьный режим</span>
              </div>
              <div className="absolute left-10 top-[58%] z-20 hidden md:block">
                <span className="landing-chip floating-chip -rotate-2 bg-lime-100 text-neutral-900">Тред в контексте урока</span>
              </div>

              <div className="relative rounded-[2.2rem] border border-black/10 bg-gradient-to-br from-white via-white to-violet-50 p-4 shadow-[0_40px_90px_rgba(17,24,39,0.18)] md:p-6">
                <div className="absolute inset-x-10 top-0 h-12 rounded-b-[2rem] bg-gradient-to-b from-white/85 to-transparent" aria-hidden="true" />
                <div className="landing-surface rounded-[1.8rem] bg-[linear-gradient(140deg,rgba(240,247,255,0.9),rgba(255,255,255,0.9),rgba(255,241,250,0.85))] p-4 md:p-5">
                  <article className="landing-card">
                    <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">Сегодня • HSK 2</p>
                    <h3 className="mt-2 text-lg font-black">Урок: Диалоги и грамматика</h3>
                    <p className="mt-2 text-sm text-neutral-700">Материалы, домашняя работа и комментарии собраны в едином пространстве обучения.</p>
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

      <section className="container mt-6">
        <div className="grid gap-3 rounded-[1.8rem] border border-black/5 bg-white/60 p-4 backdrop-blur-xl md:grid-cols-[1.2fr_0.8fr]">
          <p className="px-1 text-xs font-semibold uppercase tracking-[0.15em] text-neutral-500 md:self-center">Опорные принципы среды</p>
          <div className="hidden md:flex items-center justify-end">
            <span className="landing-chip bg-black text-white">Art-directed rhythm</span>
          </div>
          <div className="md:col-span-2 flex flex-wrap gap-2">
          {trustItems.map((item, index) => (
            <span key={item} className={`landing-chip text-sm transition duration-300 hover:-translate-y-0.5 ${index % 4 === 0 ? 'rotate-1 bg-sky-100/80' : index % 4 === 1 ? '-rotate-1 bg-lime-100/80' : index % 4 === 2 ? 'rotate-2 bg-fuchsia-100/80' : '-rotate-2 bg-violet-100/70'}`}>
              {item}
            </span>
          ))}
          </div>
        </div>
      </section>

      <section id="audience" className="container mt-16">
        <SectionTitle
          eyebrow="Для кого платформа"
          title="Три роли — один единый рабочий процесс"
          description="Каждый участник учебного процесса получает понятный интерфейс и только нужные действия."
        />
        <div className="mt-10 grid gap-5 md:grid-cols-6">
          {audienceCards.map(({ id, title, icon: Icon, points, tone }, index) => (
            <article key={id} className={`landing-surface rounded-[1.9rem] border border-black/10 p-6 shadow-[0_16px_40px_rgba(20,20,20,0.08)] ${tone} ${
              index === 0
                ? 'md:col-span-3'
                : index === 1
                  ? 'md:col-span-2 md:translate-y-7'
                  : 'md:col-span-3 md:-translate-y-5'
            }`}>
              <Icon className="size-5" />
              <h3 className="mt-4 text-2xl font-black">{title}</h3>
              <ul className="mt-4 space-y-3 text-sm text-neutral-700">
                {points.map((point) => (
                  <li key={point} className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0" />{point}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section id="method" className="container mt-16">
        <div className="grid gap-6 rounded-[2rem] border border-black/10 bg-black p-6 text-white shadow-[0_24px_80px_rgba(10,10,10,0.32)] md:grid-cols-[1.1fr_0.9fr] md:p-8">
          <div>
            <p className="text-4xl font-black leading-none tracking-[-0.04em] text-lime-200 md:text-7xl">Методика = ритм</p>
            <SectionTitle
              eyebrow="Методика — ядро"
              title="Shidao — не просто кабинет, а продуманная среда обучения."
              description="Курс, урок, материалы, домашняя работа и проверка собраны в единую цепочку. Преподаватель не собирает процесс вручную — он ведёт его по готовой логике."
              invert
            />
          </div>
          <div className="landing-surface rounded-[1.5rem] border border-white/20 bg-gradient-to-b from-white to-neutral-100 p-5 text-black">
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

      <section id="workflow" className="container mt-16">
        <SectionTitle
          eyebrow="Как это работает"
          title="Сценарий одного урока — прозрачно для всех"
          description="Всё, что происходит вокруг урока, остаётся в рабочем пространстве и не теряется в чатах и заметках."
        />
        <ol className="mt-8 grid gap-4 md:grid-cols-12">
          {workflow.map((item, idx) => (
            <li
              key={item}
              className={`landing-surface rounded-3xl border border-black/10 p-5 ${
                idx === 1 || idx === 3 ? 'bg-black text-white shadow-[0_16px_32px_rgba(20,20,20,0.24)]' : 'bg-white/75'
              } ${
                idx === 0
                  ? 'md:col-span-5'
                  : idx === 1
                    ? 'md:col-span-7 md:translate-y-6'
                    : idx === 2
                      ? 'md:col-span-4'
                      : idx === 3
                        ? 'md:col-span-4 md:-translate-y-4'
                        : 'md:col-span-4 md:translate-y-8'
              }`}>
              <p className={`text-xs font-bold tracking-[0.14em] ${idx === 1 || idx === 3 ? 'text-white/70' : 'text-neutral-500'}`}>ШАГ {idx + 1}</p>
              <p className={`mt-3 text-sm leading-relaxed ${idx === 1 || idx === 3 ? 'text-white/90' : 'text-neutral-800'}`}>{item}</p>
            </li>
          ))}
        </ol>
      </section>

      <section id="access" className="container mt-16 grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <article className="rounded-[1.9rem] border border-black/10 bg-black p-7 text-white shadow-[0_20px_70px_rgba(20,20,20,0.25)]">
          <p className="landing-chip -rotate-2 bg-white/15 text-white">Доступ без лишних шагов</p>
          <h3 className="mt-5 text-3xl font-black leading-tight md:text-4xl">Единый взрослый доступ и отдельный вход ученика</h3>
          <p className="mt-4 text-sm leading-relaxed text-white/85 md:text-base">
            Взрослый регистрируется один раз и работает в нужном сценарии. Ученик не проходит самостоятельную регистрацию:
            взрослый создаёт ему доступ, а ученик заходит отдельно в свой кабинет.
          </p>
        </article>
        <article className="landing-surface rounded-[1.9rem] border border-black/10 bg-white/70 p-7">
          <p className="landing-chip rotate-2 bg-violet-100/90">Личный и школьный режим</p>
          <h3 className="mt-5 text-3xl font-black leading-tight">Подходит частным преподавателям и командам школ</h3>
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

      <section className="container mt-16">
        <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <div className="lg:sticky lg:top-5">
            <SectionTitle
              eyebrow="Функциональные блоки"
              title="Всё, что нужно для системного обучения китайскому"
              description="Ключевые возможности собраны в едином пространстве и работают в контексте реальных уроков."
            />
            <p className="mt-8 text-5xl font-black leading-[0.95] tracking-[-0.04em] text-black md:text-7xl">Чистая архитектура. Живой ритм.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {featureCards.map(({ title, icon: Icon }, idx) => (
            <article
              key={title}
              className={`landing-surface rounded-3xl border border-black/10 p-5 ${
                idx % 4 === 0 ? 'bg-lime-100/70' : idx % 4 === 1 ? 'bg-sky-100/75' : idx % 4 === 2 ? 'bg-white/80' : 'bg-fuchsia-100/70'
              } ${
                idx === 0 || idx === 5 ? 'sm:col-span-2' : ''
              } ${idx === 2 ? 'sm:translate-y-5' : idx === 6 ? 'sm:-translate-y-4' : ''}`}>
              <Icon className="size-5" />
              <h3 className="mt-4 text-base font-bold">{title}</h3>
            </article>
          ))}
          </div>
        </div>
      </section>

      <section id="faq" className="container mt-16">
        <SectionTitle
          eyebrow="Частые вопросы"
          title="Коротко о самом важном"
          description="Собрали ответы на частые вопросы перед стартом работы в Shidao."
        />
        <div className="mt-8 space-y-3">
          {faq.map(({ q, a }) => (
            <details key={q} className="group landing-surface rounded-3xl border border-black/10 bg-white/80 p-5 open:bg-white">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-base font-semibold">
                <span>{q}</span>
                <CircleHelp className="size-4 shrink-0 text-neutral-500 transition group-open:rotate-12" />
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-neutral-700">{a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="container mt-16">
        <div className="relative overflow-hidden rounded-[2rem] border border-black/10 bg-black px-6 py-10 text-center text-white shadow-[0_24px_70px_rgba(20,20,20,0.3)] md:px-12">
          <div className="absolute left-1/2 top-0 h-40 w-80 -translate-x-1/2 rounded-full bg-white/10 blur-3xl" aria-hidden="true" />
          <p className="landing-chip mx-auto bg-white/15">Готовы запустить обучение в единой учебной среде?</p>
          <h2 className="mt-6 text-3xl font-black leading-tight md:text-5xl">Начните в Shidao и соберите весь учебный процесс в одном месте</h2>
          <p className="mx-auto mt-4 max-w-2xl text-sm text-white/80 md:text-base">От первого урока до домашней работы и комментариев — единая методическая среда для преподавателя, родителя и ученика.</p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link href="/join" className="landing-btn bg-lime-200 !text-black hover:bg-lime-300">Создать аккаунт</Link>
            <Link href="/login" className="landing-btn border border-white/50 bg-white/5 text-white hover:bg-white/15">Войти</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
