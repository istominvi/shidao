"use client";

import Link from "next/link";
import { ROUTES } from "@/lib/auth";
import { SessionNavActions } from "@/components/session-nav-actions";
import { useSessionView } from "@/components/use-session-view";
import {
  canRenderSessionNavActions,
  resolveLandingAuthCtaHref,
  resolveLandingNavAction,
} from "@/lib/navigation-contract";
import {
  Check,
  ChevronRight,
  CircleHelp,
  GraduationCap,
  UserRound,
  Users,
} from "lucide-react";

const valueStrip = [
  "Методика — основа курса",
  "Группа и урок связаны",
  "Домашние задания из методики",
  "Коммуникация в контексте занятия",
  "Родитель видит процесс",
  "Ученик работает в отдельном кабинете",
];

const comparisonBefore = [
  "Методика в PDF или папках",
  "Расписание отдельно",
  "Задания в сообщениях",
  "Комментарии теряются в чатах",
  "Родителю трудно понять, что происходит",
  "Преподаватель собирает процесс вручную",
];

const comparisonAfter = [
  "Методика встроена в рабочий процесс",
  "Урок привязан к группе",
  "Задание назначается в контексте курса",
  "Комментарии остаются внутри занятия",
  "Родитель видит понятный статус",
  "Ученик работает в отдельном кабинете",
];

const firstMethodStats = [
  "5–6 лет",
  "1 учебный год",
  "~180 слов",
  "21 песня",
  "21 видео",
  "45 минут урок",
  "4–6 детей в группе",
  "до 8 детей максимум",
  "14–16 активностей на урок",
];

const workflowSteps = [
  {
    title: "Выбрать методику",
    description:
      "Преподаватель открывает доступную методику и понимает структуру курса: уроки, материалы, задания и сценарии работы.",
  },
  {
    title: "Создать группу",
    description:
      "На базе методики создаётся учебная группа — будущий рабочий контур преподавателя.",
  },
  {
    title: "Добавить учеников",
    description:
      "Внутри группы собирается состав учеников, для которых дальше ведутся уроки, задания и коммуникация.",
  },
  {
    title: "Запланировать урок",
    description:
      "Занятие планируется уже в контексте конкретной группы и методики, а не через абстрактную форму.",
  },
  {
    title: "Вести урок и домашнюю работу",
    description:
      "После занятия преподаватель оставляет комментарии, выдаёт домашнее задание, а ученик и родитель видят всё в своём контексте.",
  },
];

const roleCards = [
  {
    title: "Для преподавателя",
    icon: GraduationCap,
    description:
      "Рабочее пространство преподавателя строится вокруг методики, групп и уроков. Здесь видны ученики, расписание, материалы, домашние задания и коммуникация по каждому занятию.",
    points: [
      "группы и ученики в одном контуре",
      "уроки и расписание",
      "материалы и задания из методики",
      "комментарии и коммуникация по занятию",
      "понятная структура курса, а не набор разрозненных файлов",
    ],
  },
  {
    title: "Для родителя",
    icon: UserRound,
    description:
      "Родитель не погружается в преподавательский интерфейс, но видит всё важное по своему ребёнку: расписание, задания, сообщения и статус выполнения.",
    points: [
      "расписание ребёнка",
      "домашние задания",
      "комментарии преподавателя",
      "статус выполнения",
      "прозрачная картина обучения без лишнего шума",
    ],
  },
  {
    title: "Для ученика",
    icon: Users,
    description:
      "Ученик получает отдельный кабинет и отдельный доступ. Внутри — только то, что связано с его обучением: уроки, материалы, задания и ответы преподавателя.",
    points: [
      "отдельный вход",
      "отдельный кабинет",
      "материалы по уроку",
      "домашняя работа",
      "ответы и комментарии в контексте занятия",
    ],
  },
];

const faq = [
  {
    q: "Нужна ли своя методика, чтобы начать?",
    a: "Нет. Shidao построен вокруг готовых методик. Преподаватель получает доступ к уже подготовленной структуре курса и работает на её основе.",
  },
  {
    q: "Что именно видит родитель?",
    a: "Родитель видит расписание ребёнка, домашние задания, сообщения преподавателя и статус выполнения. Родительский кабинет делает учебный процесс прозрачным, но не перегружает лишними функциями.",
  },
  {
    q: "Нужен ли ученику отдельный доступ?",
    a: "Да. У ученика есть отдельные авторизационные данные и отдельный кабинет, где он видит только своё обучение: уроки, материалы, задания и ответы преподавателя.",
  },
  {
    q: "Можно ли работать как частный преподаватель?",
    a: "Да. Shidao подходит для самостоятельной работы: преподаватель может вести группы в личном контуре и управлять учебным процессом без сложной настройки.",
  },
  {
    q: "Подходит ли платформа школе или организации?",
    a: "Да. В Shidao предусмотрен организационный контур: владелец может приглашать преподавателей и работать в рамках общего пространства с корректным разграничением доступа и данных.",
  },
  {
    q: "Как связаны урок, домашнее задание и переписка?",
    a: "В Shidao всё собирается вокруг занятия. Преподаватель планирует урок, назначает домашнюю работу, а комментарии и ответы сохраняются в контексте конкретного урока.",
  },
  {
    q: "Что является ядром продукта уже сейчас?",
    a: "Ядро Shidao — это методика, группы, уроки, задания и роли участников обучения. Платформа помогает преподавателю вести процесс по готовой логике, а родителю и ученику — видеть свою часть этого процесса.",
  },
  {
    q: "Это платформа только для детских курсов?",
    a: "Нет. Но первая доступная методика в Shidao — это годовой курс китайского для детей 5–6 лет. Именно поэтому на старте платформа особенно хорошо показывает ценность методико-структурированного детского обучения.",
  },
];

function SectionTitle({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <header className="max-w-3xl">
      <p className="landing-chip landing-chip-soft text-xs tracking-[0.12em] uppercase">
        {eyebrow}
      </p>
      <h2 className="mt-4 text-2xl font-black leading-tight tracking-tight md:mt-5 md:text-5xl">
        {title}
      </h2>
      <p className="mt-3 max-w-[62ch] text-[0.97rem] leading-relaxed text-neutral-700 md:mt-4 md:text-lg">
        {description}
      </p>
    </header>
  );
}

export function LandingPage() {
  const { state, sessionResolved } = useSessionView();
  const authCtaHref = resolveLandingAuthCtaHref(state);
  const navActions = (() => {
    const action = resolveLandingNavAction(state, sessionResolved);

    switch (action) {
      case "guest-cta-pair":
        return (
          <>
            <Link
              href={ROUTES.login}
              className="landing-btn landing-btn-muted min-h-11 flex-1 sm:flex-none"
            >
              Войти
            </Link>
            <Link
              href={ROUTES.join}
              className="landing-btn landing-btn-primary min-h-11 flex-1 sm:flex-none"
            >
              Создать аккаунт
            </Link>
          </>
        );
      case "session-actions":
        if (!canRenderSessionNavActions(state)) {
          return null;
        }

        return <SessionNavActions state={state} variant="landing" portalMenu />;
      case "skeleton":
        return (
          <div
            className="landing-btn landing-btn-muted min-h-11 flex-1 sm:flex-none sm:min-w-[148px]"
            aria-hidden="true"
          >
            <span className="block h-4 w-24 animate-pulse rounded-full bg-neutral-300/70" />
          </div>
        );
      default: {
        const _exhaustive: never = action;
        return _exhaustive;
      }
    }
  })();

  return (
    <main className="pb-16">
      <div className="landing-noise" aria-hidden="true" />
      <section className="container pt-4 md:pt-8">
        <div className="relative overflow-hidden rounded-[1.8rem] border border-white/70 bg-white/80 p-4 shadow-[0_20px_80px_rgba(20,20,20,0.08)] backdrop-blur-xl md:rounded-[2.2rem] md:p-7">
          <div
            className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-fuchsia-200/40 blur-3xl"
            aria-hidden="true"
          />
          <div
            className="absolute -left-24 bottom-0 h-56 w-56 rounded-full bg-sky-200/45 blur-3xl"
            aria-hidden="true"
          />
          <header className="flex flex-wrap items-center justify-between gap-4">
            <Link
              href={ROUTES.home}
              className="text-xl font-black tracking-tight transition hover:opacity-80"
            >
              Shidao
            </Link>
            <nav
              aria-label="Навигация по лендингу"
              className="hidden flex-wrap gap-2 text-sm font-medium text-neutral-700 lg:flex"
            >
              <a className="landing-nav-link" href="#roles">
                Для кого
              </a>
              <a className="landing-nav-link" href="#why">
                Почему Shidao
              </a>
              <a className="landing-nav-link" href="#method-core">
                Методика
              </a>
              <a className="landing-nav-link" href="#workflow">
                Как работает
              </a>
              <a className="landing-nav-link" href="#faq">
                Вопросы
              </a>
            </nav>
            <div className="flex w-full gap-2 sm:w-auto">{navActions}</div>
          </header>

          <div className="relative mt-8 grid items-center gap-8 lg:grid-cols-[1.04fr_0.96fr]">
            <div>
              <p className="landing-chip bg-lime-200/90">Методика внутри платформы</p>
              <h1 className="mt-5 max-w-[15ch] text-[2rem] font-black leading-[1.02] tracking-[-0.03em] sm:text-[2.35rem] md:mt-6 md:max-w-none md:text-7xl">
                Китайский по готовой методике — через группы, уроки и домашние
                задания
              </h1>
              <p className="mt-4 max-w-[60ch] text-[0.97rem] leading-relaxed text-neutral-700 md:mt-6 md:text-lg">
                Shidao помогает преподавателю вести обучение системно: выбирать
                методику, запускать группы, планировать занятия, выдавать задания
                и вести коммуникацию по каждому уроку. Родитель видит расписание
                и статус, ученик работает в отдельном кабинете.
              </p>
              <div className="mt-6 grid gap-3 sm:flex sm:flex-wrap">
                <Link
                  href={ROUTES.join}
                  className="landing-btn landing-btn-primary min-h-12 w-full gap-2 sm:w-auto"
                >
                  Создать аккаунт <ChevronRight className="size-4" />
                </Link>
                <Link
                  href={authCtaHref}
                  className="landing-btn landing-btn-muted min-h-12 w-full sm:w-auto"
                >
                  У меня уже есть доступ
                </Link>
              </div>
              <p className="mt-3 text-sm text-neutral-600">
                Для частного преподавателя и для школы. Один продукт — разные
                контуры работы.
              </p>
            </div>

            <article className="relative rounded-[1.8rem] border border-black/10 bg-[linear-gradient(145deg,rgba(242,249,255,0.95),rgba(255,255,255,0.95),rgba(255,241,250,0.95))] p-4 shadow-[0_30px_80px_rgba(17,24,39,0.18)] md:p-6">
              <span className="landing-chip floating-chip absolute -left-3 top-5 hidden bg-sky-100/95 text-sm md:inline-flex">
                Группа по методике
              </span>
              <span className="landing-chip floating-chip absolute -right-2 top-20 hidden bg-fuchsia-100/95 text-sm md:inline-flex">
                Урок в расписании
              </span>
              <span className="landing-chip floating-chip absolute -left-4 bottom-8 hidden bg-lime-100/95 text-sm md:inline-flex">
                Видно родителю
              </span>
              <div className="grid gap-3">
                {[
                  "Методика: «Мир вокруг меня»",
                  "Группа: 5–6 лет • 6 учеников",
                  "Ближайший урок: «Животные на ферме» • четверг • 17:00",
                  "Домашнее задание: назначено группе",
                  "Комментарий к занятию",
                  "Родитель видит статус и сообщение преподавателя",
                  "Отдельный вход ученика",
                ].map((item, idx) => (
                  <div
                    key={item}
                    className={`landing-card text-sm font-medium ${
                      idx % 3 === 0
                        ? "bg-sky-100/85"
                        : idx % 3 === 1
                          ? "bg-white/90"
                          : "bg-fuchsia-100/75"
                    }`}
                  >
                    {item}
                  </div>
                ))}
              </div>
            </article>
          </div>
        </div>
      </section>

      <section className="container mt-5 md:mt-6">
        <div className="flex flex-wrap gap-2 rounded-[1.8rem] border border-black/5 bg-white/60 p-4 backdrop-blur-xl">
          {valueStrip.map((item, idx) => (
            <span
              key={item}
              className={`landing-chip text-sm ${
                idx % 4 === 0
                  ? "bg-sky-100/85"
                  : idx % 4 === 1
                    ? "bg-lime-100/85"
                    : idx % 4 === 2
                      ? "bg-fuchsia-100/80"
                      : "bg-violet-100/80"
              }`}
            >
              {item}
            </span>
          ))}
        </div>
      </section>

      <section id="why" className="container mt-14 md:mt-16">
        <SectionTitle
          eyebrow="Почему Shidao"
          title="Не собирать обучение вручную, а вести его по готовой логике"
          description="Обычно преподавателю приходится держать методику в одном месте, расписание — в другом, задания — в третьем, а переписку — в чатах. Shidao собирает всё вокруг урока: методику, группу, материалы, домашнее задание и коммуникацию по занятию."
        />
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <article className="landing-surface rounded-[1.6rem] border border-black/10 bg-white/75 p-5">
            <p className="text-sm font-bold uppercase tracking-[0.12em] text-neutral-500">
              До Shidao
            </p>
            <ul className="mt-4 space-y-2.5 text-sm text-neutral-700">
              {comparisonBefore.map((point) => (
                <li key={point} className="flex gap-2">
                  <span className="mt-1 size-1.5 shrink-0 rounded-full bg-neutral-400" />
                  {point}
                </li>
              ))}
            </ul>
          </article>
            <article className="landing-surface rounded-[1.6rem] border border-black/10 bg-gradient-to-br from-lime-100/80 to-sky-100/60 p-5">
            <p className="text-sm font-bold uppercase tracking-[0.12em] text-neutral-700">
              В Shidao
            </p>
            <ul className="mt-4 space-y-2.5 text-sm text-neutral-800">
              {comparisonAfter.map((point) => (
                <li key={point} className="flex gap-2">
                  <Check className="mt-0.5 size-4 shrink-0" />
                  {point}
                </li>
              ))}
            </ul>
          </article>
        </div>
      </section>

      <section id="method-core" className="container mt-14 md:mt-16">
        <SectionTitle
          eyebrow="Методика как основа"
          title="В Shidao методика — не приложение к курсу, а его рабочая структура"
          description="Методика в Shidao — это не просто набор файлов. Она задаёт ход обучения: какие уроки идут по порядку, какие материалы использует преподаватель, какое домашнее задание назначается и в каком контексте идёт коммуникация по занятию."
        />
        <div className="mt-8 rounded-[1.8rem] border border-black/10 bg-white/75 p-5 md:p-7">
          <div className="grid gap-3 md:grid-cols-6">
            {[
              "Методика",
              "Уроки",
              "Материалы",
              "Домашнее задание",
              "Комментарии и ответы",
              "История занятия",
            ].map((step, idx) => (
              <div
                key={step}
                className={`rounded-2xl border border-black/10 p-3 text-sm font-semibold ${
                  idx % 3 === 0
                    ? "bg-sky-100/80"
                    : idx % 3 === 1
                      ? "bg-lime-100/75"
                      : "bg-fuchsia-100/70"
                }`}
              >
                {step}
              </div>
            ))}
          </div>
          <p className="mt-5 text-sm leading-relaxed text-neutral-700 md:text-base">
            Преподаватель не собирает курс вручную. Он ведёт группу по уже
            заданной логике и видит весь учебный контекст в одном месте.
          </p>
        </div>
      </section>

      <section id="method" className="container mt-14 md:mt-16">
        <SectionTitle
          eyebrow="Первая методика в Shidao"
          title="«Мир вокруг меня» — готовый годовой курс китайского для детей 5–6 лет"
          description="Первая методика в платформе рассчитана на учебный год и помогает преподавателю вести детскую группу последовательно: от темы к теме, от урока к уроку, с готовыми песнями, видео, активностями и подробными сценариями работы."
        />
        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {firstMethodStats.map((item, idx) => (
            <article
              key={item}
              className={`landing-surface rounded-3xl border border-black/10 p-5 ${idx % 3 === 0 ? "bg-sky-100/75" : idx % 3 === 1 ? "bg-white/85" : "bg-fuchsia-100/65"}`}
            >
              <p className="text-lg font-black tracking-tight">{item}</p>
            </article>
          ))}
        </div>
        <p className="mt-6 max-w-[74ch] text-sm leading-relaxed text-neutral-700 md:text-base">
          Каждый урок в методике — это не абстрактная тема, а конкретный план
          работы преподавателя: слова и фразы, карточки, реквизит, материалы,
          игровые активности, движение, повторение и чёткий сценарий занятия.
        </p>
        <p className="mt-3 max-w-[74ch] text-sm leading-relaxed text-neutral-700 md:text-base">
          Урок начинается и заканчивается песней, а преподаватель работает не по
          памяти и не по заметкам, а по готовой структуре.
        </p>
      </section>

      <section id="workflow" className="container mt-14 md:mt-16">
        <SectionTitle
          eyebrow="Как это работает"
          title="Преподаватель начинает не с пустой формы, а с понятного учебного контура"
          description="Shidao помогает выстроить обучение вокруг методики, группы и урока. Сначала преподаватель выбирает методику, затем запускает группу, добавляет учеников и уже после этого планирует занятия и выдаёт задания."
        />
        <ol className="mt-8 grid gap-3 md:grid-cols-5">
          {workflowSteps.map(({ title, description }, idx) => (
            <li
              key={title}
              className={`rounded-3xl border border-black/10 p-5 ${
                idx % 3 === 0
                  ? "bg-sky-100/80"
                  : idx % 3 === 1
                    ? "bg-white/85"
                    : "bg-violet-100/75"
              }`}
            >
              <p className="text-xs font-bold tracking-[0.14em] text-neutral-600">
                ШАГ {idx + 1}
              </p>
              <p className="mt-3 text-base font-bold">{title}</p>
              <p className="mt-2 text-sm leading-relaxed text-neutral-700">{description}</p>
            </li>
          ))}
        </ol>
      </section>

      <section id="roles" className="container mt-14 md:mt-16">
        <SectionTitle
          eyebrow="Для кого платформа"
          title="У каждого участника — свой контекст, но учебный процесс один"
          description="Shidao разделяет роли так, чтобы каждый видел только то, что нужно ему в реальной работе или обучении."
        />
        <div className="mt-8 grid gap-4 lg:grid-cols-3">
          {roleCards.map(({ title, icon: Icon, description, points }) => (
            <article
              key={title}
              className="landing-surface rounded-[1.6rem] border border-black/10 bg-white/80 p-5"
            >
              <Icon className="size-5" />
              <h3 className="mt-3 text-xl font-black">{title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-neutral-700">
                {description}
              </p>
              <ul className="mt-4 space-y-2.5 text-sm text-neutral-700">
                {points.map((point) => (
                  <li key={point} className="flex gap-2">
                    <Check className="mt-0.5 size-4 shrink-0" />
                    {point}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section className="container mt-14 md:mt-16">
        <SectionTitle
          eyebrow="Два режима работы"
          title="Shidao подходит и частному преподавателю, и команде школы"
          description="Платформа поддерживает личный контур преподавателя и контур организации. Это позволяет работать самостоятельно или в составе школы, не смешивая доступы и данные."
        />
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <article className="rounded-[1.6rem] border border-black/10 bg-white/80 p-5">
            <h3 className="text-xl font-black">Частный преподаватель</h3>
            <p className="mt-3 text-sm leading-relaxed text-neutral-700">
              Можно вести группы самостоятельно, без лишней административной
              сложности, сохраняя весь учебный процесс в одном месте.
            </p>
          </article>
          <article className="rounded-[1.6rem] border border-black/10 bg-white/80 p-5">
            <h3 className="text-xl font-black">Школа / организация</h3>
            <p className="mt-3 text-sm leading-relaxed text-neutral-700">
              Можно работать в организационном контуре: приглашать
              преподавателей, разделять доступы и вести обучение в рамках общей
              структуры.
            </p>
          </article>
        </div>
        <p className="mt-4 text-sm text-neutral-700 md:text-base">
          Один и тот же продукт остаётся понятным в обоих сценариях: личном и
          организационном.
        </p>
      </section>

      <section id="faq" className="container mt-14 md:mt-16">
        <SectionTitle
          eyebrow="Частые вопросы"
          title="Коротко о самом важном"
          description="Ответы на вопросы, которые помогают быстро понять логику Shidao."
        />
        <div className="mt-8 space-y-2.5">
          {faq.map(({ q, a }) => (
            <details
              key={q}
              className="group landing-surface rounded-[1.2rem] border border-black/10 bg-white/80 p-4 open:bg-white md:rounded-3xl md:p-5"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[0.98rem] font-semibold leading-snug md:text-base">
                <span>{q}</span>
                <CircleHelp className="size-4 shrink-0 text-neutral-500 transition group-open:rotate-12" />
              </summary>
              <p className="mt-2.5 text-sm leading-relaxed text-neutral-700 md:mt-3">
                {a}
              </p>
            </details>
          ))}
        </div>
      </section>

      <section className="container mt-14 md:mt-16">
        <div className="rounded-[1.6rem] border border-black/10 bg-[linear-gradient(150deg,rgba(240,247,255,0.92),rgba(255,255,255,0.92),rgba(255,241,250,0.92))] px-4 py-8 text-center shadow-[0_24px_70px_rgba(20,20,20,0.16)] sm:px-6 md:rounded-[2rem] md:px-12 md:py-10">
          <p className="landing-chip mx-auto bg-lime-100/85">
            Запустить обучение в единой рабочей среде
          </p>
          <h2 className="mx-auto mt-5 max-w-[22ch] text-2xl font-black leading-tight md:mt-6 md:max-w-none md:text-5xl">
            Shidao помогает преподавателю вести курс по методике, а не собирать
            процесс вручную
          </h2>
          <p className="mx-auto mt-3 max-w-[56ch] text-sm leading-relaxed text-neutral-700 md:text-base">
            От группы и расписания до домашнего задания и комментариев по уроку
            — всё собрано в одном учебном контуре для преподавателя, родителя и
            ученика.
          </p>
          <div className="mt-6 grid gap-3 sm:flex sm:justify-center">
            <Link
              href={ROUTES.join}
              className="landing-btn min-h-12 w-full bg-lime-200 !text-black hover:bg-lime-300 sm:w-auto"
            >
              Создать аккаунт
            </Link>
            <Link
              href={authCtaHref}
              className="landing-btn min-h-12 w-full border border-black/20 bg-white/80 text-neutral-900 hover:bg-white sm:w-auto"
            >
              Войти
            </Link>
          </div>
          <p className="mt-3 text-sm text-neutral-600">
            Для частного преподавателя и для школы. Начать можно с первой
            готовой методики.
          </p>
        </div>
      </section>
    </main>
  );
}
