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

const trustItems = ['Методика', 'Уроки', 'Домашние задания', 'Коммуникация', 'Кабинет родителя', 'История занятий'];

const audienceCards = [
  {
    id: 'teacher',
    title: 'Для преподавателя',
    tone: 'bg-sky-100/70',
    icon: GraduationCap,
    points: ['Ведёт группы и уроки в единой структуре.', 'Работает по встроенной методике без хаоса в материалах.', 'Назначает домашние задания группе или ученику.', 'Комментирует и общается в треде конкретного занятия.']
  },
  {
    id: 'parent',
    title: 'Для родителя',
    tone: 'bg-lime-100/80',
    icon: UserRound,
    points: ['Видит актуальное расписание ребёнка.', 'Контролирует задания и статус выполнения.', 'Получает комментарии по урокам и домашней работе.', 'Понимает, как движется обучение по шагам.']
  },
  {
    id: 'student',
    title: 'Для ученика',
    tone: 'bg-fuchsia-100/70',
    icon: BookOpen,
    points: ['Заходит в отдельный, понятный кабинет.', 'Открывает урок и материалы в нужном порядке.', 'Сдаёт домашние задания текстом, файлом или голосом.', 'Общается в треде именно по своему занятию.']
  }
];

const workflow = [
  'Урок появляется в расписании и сразу фиксирует контекст занятия.',
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
    a: 'Расписание, задания, статусы выполнения, комментарии и историю занятий — всё в одном интерфейсе.'
  },
  {
    q: 'Можно ли использовать платформу частному преподавателю?',
    a: 'Да. Личный контур позволяет вести обучение самостоятельно, без сложной настройки.'
  },
  {
    q: 'Подходит ли платформа для школы или организации?',
    a: 'Да. Есть школьный контур для командной работы с аккуратным разграничением доступа и данных.'
  },
  {
    q: 'Как устроены задания и коммуникация?',
    a: 'Задания назначаются по уроку, а обсуждение сохраняется в треде этого же занятия — без потери контекста.'
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
      <p className="chip -rotate-2 border border-black/10 bg-white/80 text-sm">{eyebrow}</p>
      <h2 className="mt-5 text-3xl font-black leading-tight md:text-5xl">{title}</h2>
      <p className="mt-4 text-base text-neutral-700 md:text-lg">{description}</p>
    </header>
  );
}

export function LandingPage() {
  return (
    <main className="pb-16">
      <div className="landing-noise" aria-hidden="true" />
      <section className="container pt-6 md:pt-8">
        <div className="rounded-[2rem] border border-white/70 bg-white/75 p-4 shadow-[0_20px_80px_rgba(20,20,20,0.08)] backdrop-blur-xl md:p-7">
          <header className="flex flex-wrap items-center justify-between gap-4">
            <Link href="/" className="text-xl font-black tracking-tight transition hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/40">
              ShiDao
            </Link>
            <nav aria-label="Навигация по лендингу" className="hidden flex-wrap gap-2 text-sm font-medium text-neutral-700 lg:flex">
              <a href="#audience" className="rounded-full px-4 py-2 transition hover:bg-black hover:text-white">Для кого</a>
              <a href="#method" className="rounded-full px-4 py-2 transition hover:bg-black hover:text-white">Методика</a>
              <a href="#workflow" className="rounded-full px-4 py-2 transition hover:bg-black hover:text-white">Сценарий урока</a>
              <a href="#access" className="rounded-full px-4 py-2 transition hover:bg-black hover:text-white">Доступ</a>
              <a href="#faq" className="rounded-full px-4 py-2 transition hover:bg-black hover:text-white">FAQ</a>
            </nav>
            <div className="flex gap-2">
              <Link href="/login" className="rounded-full border border-black/15 bg-white px-4 py-2 text-sm font-semibold transition hover:border-black hover:bg-black hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/40">Войти</Link>
              <Link href="/join" className="rounded-full bg-black px-4 py-2 text-sm font-semibold text-white transition hover:opacity-85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/40">Создать аккаунт</Link>
            </div>
          </header>

          <div className="mt-10 grid items-center gap-8 lg:grid-cols-[1.05fr_0.95fr]">
            <div>
              <p className="chip -rotate-2 border border-black/10 bg-lime-200/80 text-sm">Premium EdTech Workspace</p>
              <h1 className="mt-6 text-4xl font-black leading-[1.05] tracking-tight md:text-6xl">Китайский язык по готовой методике — в одном цифровом контуре для преподавателя, родителя и ученика</h1>
              <p className="mt-6 max-w-xl text-base leading-relaxed text-neutral-700 md:text-lg">
                Методика уже встроена в платформу: преподаватель ведёт обучение системно, родитель видит прогресс по
                урокам и заданиям, а ученик получает понятный маршрут работы и отдельный вход.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/join" className="inline-flex items-center gap-2 rounded-full bg-black px-6 py-3 text-sm font-semibold text-white transition hover:translate-y-[-1px] hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/40">Начать в Shidao <ChevronRight className="size-4" /></Link>
                <Link href="/login" className="rounded-full border border-black/15 bg-white px-6 py-3 text-sm font-semibold transition hover:border-black hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/40">У меня уже есть доступ</Link>
              </div>
            </div>

            <div className="relative rounded-[2rem] border border-white/80 bg-gradient-to-br from-sky-100 via-white to-fuchsia-100 p-5 shadow-[0_25px_60px_rgba(17,24,39,0.16)]">
              <div className="absolute -right-3 -top-3 rounded-full bg-black px-3 py-1 text-xs font-semibold text-white">Method inside</div>
              <div className="grid gap-3">
                <article className="rounded-3xl border border-black/10 bg-white/80 p-4 backdrop-blur-md">
                  <p className="text-xs uppercase tracking-[0.18em] text-neutral-500">Сегодня</p>
                  <h3 className="mt-2 text-lg font-bold">Урок HSK 2 • Диалоги и грамматика</h3>
                  <p className="mt-2 text-sm text-neutral-700">Материалы, задания и комментарии собраны в одном контексте занятия.</p>
                </article>
                <div className="grid gap-3 sm:grid-cols-2">
                  <article className="rounded-3xl border border-black/10 bg-white/80 p-4">
                    <p className="text-sm font-semibold">Домашнее задание</p>
                    <p className="mt-1 text-sm text-neutral-600">Назначено группе 3A, дедлайн до пятницы.</p>
                  </article>
                  <article className="rounded-3xl border border-black/10 bg-black p-4 text-white">
                    <p className="text-sm font-semibold">Кабинет родителя</p>
                    <p className="mt-1 text-sm text-white/80">Статус, посещаемость и комментарии по уроку.</p>
                  </article>
                </div>
                <article className="rounded-3xl border border-dashed border-black/20 bg-white/70 p-4">
                  <p className="text-sm font-semibold">Тред занятия</p>
                  <p className="mt-1 text-sm text-neutral-600">Текст, файл и голосовые ответы ученика — всё сохраняется рядом с уроком.</p>
                </article>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="container mt-6">
        <div className="flex flex-wrap gap-2 rounded-[1.8rem] border border-black/5 bg-white/60 p-4 backdrop-blur-xl">
          {trustItems.map((item, index) => (
            <span key={item} className={`chip border border-black/10 text-sm ${index % 2 === 0 ? 'bg-sky-100/80' : 'bg-lime-100/80'}`}>
              {item}
            </span>
          ))}
        </div>
      </section>

      <section id="audience" className="container mt-16">
        <SectionTitle
          eyebrow="Для кого платформа"
          title="Три роли — один рабочий ритм"
          description="Каждый участник учебного процесса получает свой понятный интерфейс и только нужные действия."
        />
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {audienceCards.map(({ id, title, icon: Icon, points, tone }) => (
            <article key={id} className={`rounded-[1.8rem] border border-black/10 p-6 shadow-[0_16px_40px_rgba(20,20,20,0.08)] ${tone}`}>
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
        <div className="grid gap-6 rounded-[2rem] border border-black/10 bg-white/70 p-6 shadow-[0_18px_60px_rgba(20,20,20,0.08)] md:grid-cols-2 md:p-8">
          <div>
            <SectionTitle
              eyebrow="Методика — ядро"
              title="Shidao — не просто кабинет. Это среда обучения вокруг готовой структуры."
              description="Курс, урок, материалы, домашняя работа и проверка связаны в единую цепочку. Преподаватель не собирает процесс вручную — он ведёт его по заранее выстроенной логике."
            />
          </div>
          <div className="rounded-[1.5rem] border border-black/10 bg-gradient-to-b from-white to-neutral-50 p-5">
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
          eyebrow="How it works"
          title="Сценарий одного урока — прозрачно для всех"
          description="Всё, что происходит вокруг урока, остаётся в связном рабочем контуре и не теряется в чатах и заметках."
        />
        <ol className="mt-8 grid gap-4 md:grid-cols-5">
          {workflow.map((item, idx) => (
            <li key={item} className="rounded-3xl border border-black/10 bg-white/75 p-5">
              <p className="text-xs font-bold tracking-[0.14em] text-neutral-500">ШАГ {idx + 1}</p>
              <p className="mt-3 text-sm leading-relaxed text-neutral-800">{item}</p>
            </li>
          ))}
        </ol>
      </section>

      <section id="access" className="container mt-16 grid gap-5 lg:grid-cols-2">
        <article className="rounded-[1.9rem] border border-black/10 bg-black p-7 text-white shadow-[0_20px_70px_rgba(20,20,20,0.25)]">
          <p className="chip -rotate-2 bg-white/15 text-white">Доступ без лишних шагов</p>
          <h3 className="mt-5 text-3xl font-black leading-tight">Единый взрослый доступ и отдельный вход ученика</h3>
          <p className="mt-4 text-sm leading-relaxed text-white/85 md:text-base">
            Взрослый регистрируется один раз и работает в нужном сценарии. Ученик не проходит самостоятельную регистрацию:
            взрослый создаёт ему доступ, а ученик заходит отдельно в свой кабинет.
          </p>
        </article>
        <article className="rounded-[1.9rem] border border-black/10 bg-white/70 p-7">
          <p className="chip bg-violet-100/90">Личный и школьный контур</p>
          <h3 className="mt-5 text-3xl font-black leading-tight">Подходит частным преподавателям и командам школ</h3>
          <p className="mt-4 text-sm leading-relaxed text-neutral-700 md:text-base">
            Начинайте в личном формате и масштабируйтесь до школьного контура, когда растёт команда. Доступы и данные
            разделяются аккуратно, чтобы каждый работал в своей зоне ответственности.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <span className="chip bg-sky-100/80"><GraduationCap className="size-4" /> Частный преподаватель</span>
            <span className="chip bg-amber-100/80"><School className="size-4" /> Школа / организация</span>
          </div>
        </article>
      </section>

      <section className="container mt-16">
        <SectionTitle
          eyebrow="Функциональные блоки"
          title="Всё, что нужно для системного обучения китайскому"
          description="Ключевые возможности собраны в едином пространстве и работают в контексте реальных уроков."
        />
        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {featureCards.map(({ title, icon: Icon }, idx) => (
            <article key={title} className={`rounded-3xl border border-black/10 p-5 ${idx % 3 === 0 ? 'bg-lime-100/60' : idx % 3 === 1 ? 'bg-sky-100/70' : 'bg-white/80'}`}>
              <Icon className="size-5" />
              <h3 className="mt-4 text-base font-bold">{title}</h3>
            </article>
          ))}
        </div>
      </section>

      <section id="faq" className="container mt-16">
        <SectionTitle
          eyebrow="FAQ"
          title="Коротко о самом важном"
          description="Собрали ответы на частые вопросы перед стартом работы в Shidao."
        />
        <div className="mt-8 space-y-3">
          {faq.map(({ q, a }) => (
            <details key={q} className="group rounded-3xl border border-black/10 bg-white/80 p-5 open:bg-white">
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
        <div className="rounded-[2rem] border border-black/10 bg-black px-6 py-10 text-center text-white shadow-[0_24px_70px_rgba(20,20,20,0.3)] md:px-12">
          <p className="chip mx-auto bg-white/15">Готовы запустить обучение в структурном контуре?</p>
          <h2 className="mt-6 text-3xl font-black leading-tight md:text-5xl">Начните в Shidao и соберите весь учебный процесс в одном месте</h2>
          <p className="mx-auto mt-4 max-w-2xl text-sm text-white/80 md:text-base">От первого урока до домашней работы и комментариев — единая методическая среда для преподавателя, родителя и ученика.</p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link href="/join" className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-black transition hover:bg-lime-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">Создать аккаунт</Link>
            <Link href="/login" className="rounded-full border border-white/30 px-6 py-3 text-sm font-semibold transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">Войти</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
