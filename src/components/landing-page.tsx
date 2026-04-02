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
  Orbit,
  School,
  Sparkles,
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
      <h2 className="mt-5 text-3xl font-black leading-tight tracking-tight md:text-5xl">{title}</h2>
      <p className="mt-4 text-base text-neutral-700 md:text-lg">{description}</p>
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

          <div className="relative z-10 mt-12 grid items-center gap-12 lg:grid-cols-[1.02fr_0.98fr]">
            <div>
              <p className="landing-chip -rotate-2 bg-lime-200/90">Премиальная платформа обучения китайскому</p>
              <h1 className="mt-7 text-4xl font-black leading-[0.95] tracking-[-0.04em] md:text-7xl">
                Методика уже внутри —
                <span className="relative mx-2 inline-flex rounded-[1.2rem] bg-[linear-gradient(120deg,#b5ff6d,#86b8ff,#ecabff)] px-3 py-1 text-black shadow-[0_14px_34px_rgba(80,80,80,0.2)]">
                  teacher + parent + student
                </span>
                в одном живом процессе
              </h1>
              <p className="mt-6 max-w-xl text-base leading-relaxed text-neutral-700 md:text-lg">
                Преподаватель ведёт урок по готовой логике, родитель видит прозрачный прогресс, ученик идёт по
                понятному маршруту — всё в едином пространстве Shidao.
              </p>
              <div className="mt-9 flex flex-wrap gap-3">
                <Link
                  href="/join"
                  className="landing-btn inline-flex items-center gap-2 border-transparent bg-[linear-gradient(120deg,#171717,#2f2f2f,#141414)] px-6 py-3 text-white shadow-[0_18px_44px_rgba(17,17,17,0.35)]"
                >
                  Начать в Shidao <ChevronRight className="size-4" />
                </Link>
                <Link
                  href="/login"
                  className="landing-btn inline-flex items-center gap-2 border-black/10 bg-white/95 px-6 py-3 shadow-[0_10px_25px_rgba(17,17,17,0.14)]"
                >
                  У меня уже есть доступ
                </Link>
              </div>
            </div>

            <div className="relative pb-4 pt-10 sm:pt-12">
              <div className="absolute -left-2 top-0 z-30 hidden md:block">
                <span className="landing-chip floating-chip -rotate-6 bg-sky-100/95 text-sky-700">
                  <Sparkles className="size-4" /> Методика внутри
                </span>
              </div>
              <div className="absolute right-0 top-3 z-30">
                <span className="landing-chip floating-chip rotate-[8deg] bg-lime-100/95 text-lime-800">
                  <Orbit className="size-4" /> Связанные роли
                </span>
              </div>
              <div className="absolute -bottom-2 left-8 z-30 hidden sm:block">
                <span className="landing-chip floating-chip -rotate-3 bg-fuchsia-100/95 text-fuchsia-800">Тред в контексте урока</span>
              </div>

              <div className="relative overflow-hidden rounded-[2.5rem] border border-white/70 bg-[radial-gradient(circle_at_15%_15%,rgba(201,255,79,0.28),transparent_34%),radial-gradient(circle_at_85%_12%,rgba(112,183,255,0.28),transparent_35%),linear-gradient(135deg,#ffffff_0%,#fafcff_55%,#fff5fd_100%)] p-4 shadow-[0_45px_110px_rgba(17,24,39,0.2)] md:p-6">
                <div className="landing-surface relative rounded-[2rem] border border-black/10 bg-white/80 p-4 backdrop-blur-sm md:p-5">
                  <div className="flex items-center justify-between rounded-2xl border border-black/10 bg-white/90 px-4 py-3">
                    <p className="text-sm font-semibold">Сегодняшний урок · HSK 2</p>
                    <span className="rounded-full bg-black px-3 py-1 text-xs font-semibold text-white">Live</span>
                  </div>

                  <div className="mt-3 rounded-[1.4rem] border border-black/10 bg-[linear-gradient(130deg,rgba(188,243,255,0.34),rgba(255,255,255,0.9),rgba(255,203,243,0.32))] p-4">
                    <h3 className="text-lg font-black md:text-xl">Диалоги + грамматика + речь</h3>
                    <p className="mt-2 text-sm text-neutral-700">Материалы, домашнее задание и обсуждение собраны прямо внутри урока.</p>
                    <div className="mt-4 grid gap-2 sm:grid-cols-3">
                      {['Преподаватель ведёт', 'Родитель наблюдает', 'Ученик выполняет'].map((role, idx) => (
                        <span
                          key={role}
                          className={`rounded-xl border border-black/10 px-3 py-2 text-xs font-semibold shadow-[0_8px_18px_rgba(20,20,20,0.08)] ${
                            idx === 0 ? 'bg-sky-100/90' : idx === 1 ? 'bg-lime-100/90' : 'bg-fuchsia-100/90'
                          }`}
                        >
                          {role}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="mt-3 grid gap-3 sm:grid-cols-[1.1fr_0.9fr]">
                    <article className="landing-card bg-white/95">
                      <p className="text-sm font-semibold">Домашнее задание</p>
                      <p className="mt-1 text-sm text-neutral-600">Назначено группе, дедлайн и критерии видны всем участникам процесса.</p>
                    </article>
                    <article className="landing-card border-black/20 bg-black text-white shadow-[0_20px_35px_rgba(10,10,10,0.33)]">
                      <p className="text-sm font-semibold">Кабинет родителя</p>
                      <p className="mt-1 text-sm text-white/80">Прогресс, посещаемость и комментарии преподавателя.</p>
                    </article>
                  </div>
                </div>

                <article className="landing-card absolute -left-2 top-[42%] z-20 hidden w-44 -rotate-[6deg] bg-white/95 md:block">
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-neutral-500">Teacher</p>
                  <p className="mt-2 text-sm font-semibold">План урока и проверка ДЗ</p>
                </article>
                <article className="landing-card absolute -right-3 bottom-6 z-20 hidden w-44 rotate-[7deg] bg-white/95 md:block">
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-neutral-500">Parent</p>
                  <p className="mt-2 text-sm font-semibold">Статус урока и обратная связь</p>
                </article>
                <article className="landing-card absolute bottom-2 left-1/2 z-20 hidden w-44 -translate-x-1/2 -rotate-3 bg-white/95 sm:block md:w-52">
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-neutral-500">Student</p>
                  <p className="mt-2 text-sm font-semibold">Отправляет текст, файл или голос</p>
                </article>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="container mt-6">
        <div className="flex flex-wrap gap-2 rounded-[1.8rem] border border-black/5 bg-white/60 p-4 backdrop-blur-xl">
          {trustItems.map((item, index) => (
            <span key={item} className={`landing-chip text-sm transition duration-300 hover:-translate-y-0.5 ${index % 4 === 0 ? 'rotate-1 bg-sky-100/80' : index % 4 === 1 ? '-rotate-1 bg-lime-100/80' : index % 4 === 2 ? 'rotate-2 bg-fuchsia-100/80' : '-rotate-2 bg-violet-100/70'}`}>
              {item}
            </span>
          ))}
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
            <article key={id} className={`landing-surface rounded-[1.9rem] border border-black/10 p-6 shadow-[0_16px_40px_rgba(20,20,20,0.08)] ${tone} ${index === 1 ? 'md:col-span-2 md:-translate-y-3' : 'md:col-span-2'}`}>
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
        <div className="grid gap-6 rounded-[2rem] border border-black/10 bg-white/70 p-6 shadow-[0_18px_60px_rgba(20,20,20,0.08)] md:grid-cols-[1.1fr_0.9fr] md:p-8">
          <div>
            <p className="text-4xl font-black leading-none tracking-[-0.04em] text-black/85 md:text-7xl">Методика = ритм</p>
            <SectionTitle
              eyebrow="Методика — ядро"
              title="Shidao — не просто кабинет, а продуманная среда обучения."
              description="Курс, урок, материалы, домашняя работа и проверка собраны в единую цепочку. Преподаватель не собирает процесс вручную — он ведёт его по готовой логике."
            />
          </div>
          <div className="landing-surface rounded-[1.5rem] border border-black/10 bg-gradient-to-b from-white to-neutral-50 p-5">
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
        <ol className="mt-8 grid gap-4 md:grid-cols-5">
          {workflow.map((item, idx) => (
            <li key={item} className={`landing-surface rounded-3xl border border-black/10 p-5 ${idx === 1 || idx === 3 ? 'bg-black text-white shadow-[0_16px_32px_rgba(20,20,20,0.24)]' : 'bg-white/75'}`}>
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
