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
  ArrowRight,
  BookOpenText,
  Building2,
  CalendarClock,
  Check,
  ChevronRight,
  CircleHelp,
  ClipboardCheck,
  FileStack,
  FolderKanban,
  GraduationCap,
  History,
  KeyRound,
  LayoutDashboard,
  Link2,
  MessageCircle,
  Music3,
  NotebookTabs,
  PlayCircle,
  UserRound,
  Users,
} from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";

const iconSystem = [
  { label: "Методика", icon: BookOpenText, tone: "bg-sky-100/85" },
  { label: "Группа", icon: Users, tone: "bg-lime-100/85" },
  { label: "Урок", icon: CalendarClock, tone: "bg-violet-100/80" },
  { label: "Домашнее задание", icon: ClipboardCheck, tone: "bg-fuchsia-100/80" },
  { label: "Комментарии", icon: MessageCircle, tone: "bg-white" },
  { label: "Преподаватель", icon: GraduationCap, tone: "bg-sky-100/85" },
  { label: "Родитель", icon: UserRound, tone: "bg-lime-100/85" },
  { label: "Отдельный вход ученика", icon: KeyRound, tone: "bg-violet-100/80" },
  { label: "История занятия", icon: History, tone: "bg-fuchsia-100/80" },
  { label: "Материалы и карточки", icon: FileStack, tone: "bg-white" },
  { label: "Расписание", icon: CalendarClock, tone: "bg-sky-100/85" },
  { label: "Школа / организация", icon: Building2, tone: "bg-lime-100/85" },
  { label: "Личный контур", icon: UserRound, tone: "bg-violet-100/80" },
  { label: "Онлайн-урок / ссылка", icon: Link2, tone: "bg-fuchsia-100/80" },
];

const productFlow = [
  { title: "Методика", note: "Source of truth курса", icon: BookOpenText },
  { title: "Группа", note: "Рабочая единица", icon: Users },
  { title: "Урок", note: "Runtime процесса", icon: CalendarClock },
  { title: "Домашнее задание", note: "Продолжение после урока", icon: ClipboardCheck },
  { title: "Комментарии", note: "Коммуникация по занятию", icon: MessageCircle },
];

const teacherWorkflow = [
  {
    title: "Выбрать методику",
    description: "Преподаватель открывает готовый курс с уроками, материалами и заданиями.",
  },
  {
    title: "Создать группу",
    description: "Группа создаётся в /dashboard и становится операционной точкой запуска.",
  },
  {
    title: "Добавить учеников",
    description: "Внутри группы собирается состав. Ученик получает отдельные данные входа.",
  },
  {
    title: "Планировать занятия",
    description:
      "Занятия планируются внутри группы. /lessons остаётся вторичным индексом, а не стартовой точкой.",
  },
  {
    title: "Вести урок и выдавать ДЗ",
    description:
      "После урока преподаватель назначает домашнюю работу и оставляет комментарий в контексте занятия.",
  },
];

const roleCards = [
  {
    title: "Преподаватель",
    icon: GraduationCap,
    tone: "teacher",
    description:
      "Ведёт процесс через /dashboard: группы, уроки, расписание, материалы и комментарии по каждому занятию.",
    points: [
      "единый взрослый аккаунт",
      "запуск группы по готовой методике",
      "контроль расписания и статусов",
      "назначение ДЗ и обратной связи",
    ],
  },
  {
    title: "Родитель",
    icon: UserRound,
    tone: "parent",
    description:
      "Видит только процесс ребёнка: расписание, задания, сообщения и актуальные статусы выполнения.",
    points: [
      "прозрачная динамика обучения",
      "комментарии привязаны к конкретному уроку",
      "нет перегруза преподавательскими функциями",
      "понятно, что делать после занятия",
    ],
  },
  {
    title: "Ученик",
    icon: Users,
    tone: "student",
    description:
      "Получает отдельный доступ и отдельный кабинет с материалами, заданиями и ответами по своим урокам.",
    points: [
      "собственные авторизационные данные",
      "материалы и карточки по теме",
      "домашняя работа в своём контексте",
      "история взаимодействия с преподавателем",
    ],
  },
];

const lessonComposition = [
  "Слова и фразы по теме",
  "Карточки и реквизит",
  "Материалы и игровые активности",
  "Сценарий действий преподавателя",
  "Старт и финал урока через песню",
  "14–16 действий в одном занятии",
];

const faq = [
  {
    q: "С чего преподаватель начинает работу в Shidao?",
    a: "С /dashboard: выбирает методику, создаёт группу, добавляет учеников и уже внутри группы планирует занятия.",
  },
  {
    q: "Есть ли готовая методика на старте?",
    a: "Да. Первая методика — «我周围的世界» («Мир вокруг меня»): курс на год для детей 5–6 лет, с уроками, материалами и заданиями.",
  },
  {
    q: "Что именно видит родитель?",
    a: "Расписание ребёнка, домашние задания, сообщения преподавателя и статус выполнения. Всё в рамках конкретных занятий.",
  },
  {
    q: "У ученика отдельный вход или общий с родителем?",
    a: "Отдельный. У ученика свои авторизационные данные и свой кабинет с личным учебным контекстом.",
  },
  {
    q: "Подходит ли платформа частному преподавателю и школе?",
    a: "Да. Есть личный контур для самостоятельной работы и организационный контур для школы с разграничением доступа.",
  },
  {
    q: "Это CRM или LMS в классическом виде?",
    a: "Shidao — методико-ориентированная платформа: методика задаёт рабочую логику курса, а не просто хранится как контент.",
  },
];

function Reveal({ children, className = "" }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -10% 0px" },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className={`reveal ${visible ? "reveal-visible" : ""} ${className}`}>
      {children}
    </div>
  );
}

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
      <p className="landing-chip landing-chip-soft text-xs tracking-[0.12em] uppercase">{eyebrow}</p>
      <h2 className="mt-4 text-2xl font-black leading-tight tracking-tight md:mt-5 md:text-5xl">{title}</h2>
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
        <div className="relative overflow-hidden rounded-[1.8rem] border border-white/70 bg-white/85 p-4 shadow-[0_20px_80px_rgba(20,20,20,0.08)] backdrop-blur-xl md:rounded-[2.2rem] md:p-7">
          <header className="flex flex-wrap items-center justify-between gap-4">
            <Link href={ROUTES.home} className="text-xl font-black tracking-tight transition hover:opacity-80">
              Shidao
            </Link>
            <nav
              aria-label="Навигация по лендингу"
              className="hidden flex-wrap gap-2 text-sm font-medium text-neutral-700 lg:flex"
            >
              <a className="landing-nav-link" href="#why">
                Почему Shidao
              </a>
              <a className="landing-nav-link" href="#product-model">
                Как устроен продукт
              </a>
              <a className="landing-nav-link" href="#workflow">
                Как работает преподаватель
              </a>
              <a className="landing-nav-link" href="#method">
                Первая методика
              </a>
              <a className="landing-nav-link" href="#faq">
                FAQ
              </a>
            </nav>
            <div className="flex w-full gap-2 sm:w-auto">{navActions}</div>
          </header>

          <div className="mt-8 grid items-center gap-8 lg:grid-cols-[1.03fr_0.97fr]">
            <div>
              <p className="landing-chip bg-lime-200/90">Teacher-first методическая платформа</p>
              <h1 className="mt-5 max-w-[16ch] text-[2rem] font-black leading-[1.02] tracking-[-0.03em] sm:text-[2.35rem] md:mt-6 md:max-w-none md:text-7xl">
                Shidao ведёт китайский курс по логике методики, а не по папкам и чатам
              </h1>
              <p className="mt-4 max-w-[62ch] text-[0.97rem] leading-relaxed text-neutral-700 md:mt-6 md:text-lg">
                Методика → группа → ученики → урок → домашнее задание → коммуникация. Преподаватель
                запускает работу из /dashboard, родитель получает прозрачный статус по ребёнку, ученик
                работает в отдельном кабинете.
              </p>
              <div className="mt-6 grid gap-3 sm:flex sm:flex-wrap">
                <Link href={ROUTES.join} className="landing-btn landing-btn-primary min-h-12 w-full gap-2 sm:w-auto">
                  Создать аккаунт <ChevronRight className="size-4" />
                </Link>
                <Link href={authCtaHref} className="landing-btn landing-btn-muted min-h-12 w-full sm:w-auto">
                  У меня уже есть доступ
                </Link>
              </div>
              <p className="mt-3 text-sm text-neutral-600">
                Без пустого старта: первая методика уже содержит уроки, материалы и задания.
              </p>
            </div>

            <Reveal>
              <article className="hero-mockup relative rounded-[1.8rem] border border-black/10 bg-white p-4 shadow-[0_30px_80px_rgba(17,24,39,0.16)] md:p-5">
                <div className="grid gap-3">
                  <div className="landing-card border-sky-200/80 bg-sky-100/85 p-4">
                    <p className="text-xs font-bold uppercase tracking-[0.12em] text-sky-900/70">Операционный вход</p>
                    <div className="mt-2 flex items-center justify-between gap-3">
                      <p className="text-base font-black">/dashboard</p>
                      <LayoutDashboard className="size-4 text-sky-900/70" />
                    </div>
                    <p className="mt-2 text-sm text-neutral-700">Здесь создаётся группа и планируется работа по методике.</p>
                  </div>

                  <div className="rounded-2xl border border-black/10 bg-white/90 p-3">
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div className="rounded-xl border border-black/10 bg-lime-100/70 p-3 text-sm">
                        <p className="font-semibold">Методика</p>
                        <p className="mt-1 text-xs text-neutral-700">«我周围的世界» • 5–6 лет</p>
                      </div>
                      <div className="rounded-xl border border-black/10 bg-violet-100/70 p-3 text-sm">
                        <p className="font-semibold">Группа</p>
                        <p className="mt-1 text-xs text-neutral-700">4–6 детей • максимум 8</p>
                      </div>
                      <div className="rounded-xl border border-black/10 bg-sky-50 p-3 text-sm">
                        <p className="font-semibold">Урок</p>
                        <p className="mt-1 text-xs text-neutral-700">45 минут • 14–16 активностей</p>
                      </div>
                      <div className="rounded-xl border border-black/10 bg-fuchsia-100/70 p-3 text-sm">
                        <p className="font-semibold">После урока</p>
                        <p className="mt-1 text-xs text-neutral-700">ДЗ + комментарий по занятию</p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-black/10 bg-neutral-900 p-3 text-white">
                    <p className="text-xs uppercase tracking-[0.11em] text-neutral-300">Роли в одном процессе</p>
                    <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                      <span className="rounded-lg bg-white/10 px-2 py-2">Преподаватель ведёт</span>
                      <span className="rounded-lg bg-white/10 px-2 py-2">Родитель видит статус</span>
                      <span className="rounded-lg bg-white/10 px-2 py-2">Ученик входит отдельно</span>
                    </div>
                  </div>
                </div>
              </article>
            </Reveal>
          </div>
        </div>
      </section>

      <section className="container mt-5 md:mt-6">
        <div className="grid gap-2 rounded-[1.8rem] border border-black/5 bg-white/60 p-4 backdrop-blur-xl sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          {iconSystem.map(({ label, icon: Icon, tone }) => (
            <div key={label} className={`landing-chip justify-start text-xs ${tone}`}>
              <Icon className="size-3.5" />
              <span>{label}</span>
            </div>
          ))}
        </div>
      </section>

      <section id="why" className="container mt-14 md:mt-16">
        <SectionTitle
          eyebrow="Почему Shidao"
          title="Вместо ручной сборки из PDF, таблиц и чатов — единый рабочий контур"
          description="Shidao соединяет методику, расписание, задания и коммуникацию в одном месте. Контекст занятия не теряется после урока и не распадается по разным инструментам."
        />
        <div className="why-connector mt-8 grid gap-4 md:grid-cols-2">
          <article className="landing-surface pattern-chaos rounded-[1.6rem] border border-black/10 bg-white/75 p-5">
            <p className="text-sm font-bold uppercase tracking-[0.12em] text-neutral-500">Разрозненный сценарий</p>
            <ul className="mt-4 space-y-2.5 text-sm text-neutral-700">
              {[
                "Методика хранится отдельно от расписания",
                "Домашняя работа и комментарии уходят в чат",
                "Родитель получает только часть информации",
                "Преподаватель начинает работу почти с пустого экрана",
              ].map((point) => (
                <li key={point} className="flex gap-2">
                  <span className="mt-1 size-1.5 shrink-0 rounded-full bg-neutral-400" />
                  {point}
                </li>
              ))}
            </ul>
          </article>
          <article className="landing-surface pattern-structured rounded-[1.6rem] border border-black/10 bg-gradient-to-br from-lime-100/80 to-sky-100/60 p-5">
            <p className="text-sm font-bold uppercase tracking-[0.12em] text-neutral-700">Сценарий в Shidao</p>
            <ul className="mt-4 space-y-2.5 text-sm text-neutral-800">
              {[
                "Методика становится операционной основой курса",
                "Группа и урок связаны с материалами и ДЗ",
                "Комментарии привязаны к конкретному занятию",
                "Родитель и ученик видят только свой контекст",
              ].map((point) => (
                <li key={point} className="flex gap-2">
                  <Check className="mt-0.5 size-4 shrink-0 text-emerald-700" />
                  {point}
                </li>
              ))}
            </ul>
          </article>
        </div>
      </section>

      <section id="product-model" className="container mt-14 md:mt-16">
        <SectionTitle
          eyebrow="Как устроен продукт"
          title="Методика — source of truth, группа — рабочая единица, урок — runtime"
          description="Shidao не про хранение контента. Это рабочий механизм преподавателя: методика определяет последовательность, а группа и урок превращают её в ежедневную операционную практику."
        />
        <Reveal className="mt-8 rounded-[1.8rem] border border-black/10 bg-white/75 p-5 md:p-7">
          <div className="method-flow relative grid gap-3 md:grid-cols-5 md:gap-4">
            {productFlow.map(({ title, note, icon: Icon }, idx) => (
              <article
                key={title}
                className={`method-node rounded-2xl border border-black/10 p-3 ${
                  idx === 0 ? "bg-sky-200/85" : idx % 2 ? "bg-white" : "bg-violet-100/75"
                }`}
              >
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Icon className="size-4" />
                  {title}
                </div>
                <p className="mt-1 text-xs text-neutral-600">{note}</p>
              </article>
            ))}
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <article className="rounded-2xl border border-black/10 bg-neutral-900 p-4 text-white">
              <p className="text-xs uppercase tracking-[0.11em] text-neutral-300">Главный вход</p>
              <p className="mt-2 text-lg font-black">/dashboard</p>
              <p className="mt-1 text-sm text-neutral-200">Запуск группы, расписания и учебного процесса начинается здесь.</p>
            </article>
            <article className="rounded-2xl border border-black/10 bg-white p-4">
              <p className="text-xs uppercase tracking-[0.11em] text-neutral-500">Вторичный индекс</p>
              <p className="mt-2 text-lg font-black">/lessons</p>
              <p className="mt-1 text-sm text-neutral-700">Используется как обзор по урокам, но не заменяет workflow внутри группы.</p>
            </article>
          </div>
        </Reveal>
      </section>

      <section id="workflow" className="container mt-14 md:mt-16">
        <SectionTitle
          eyebrow="Как работает преподаватель"
          title="Пошаговый рабочий поток от методики до обратной связи"
          description="В Shidao преподаватель ведёт группу по готовой структуре курса. Это снижает ручную нагрузку и сохраняет единый контекст урока для всех ролей."
        />
        <Reveal className="workflow-rail mt-8 grid gap-3 md:grid-cols-5">
          {teacherWorkflow.map(({ title, description }, idx) => (
            <li
              key={title}
              className={`workflow-step list-none rounded-3xl border border-black/10 p-5 ${
                idx === 0 || idx === 3
                  ? "bg-sky-200/85 shadow-[0_18px_30px_rgba(56,189,248,0.2)]"
                  : idx % 3 === 1
                    ? "bg-white/85"
                    : "bg-violet-100/75"
              }`}
            >
              <p className="flex items-center gap-2 text-xs font-bold tracking-[0.14em] text-neutral-600">
                <span className="inline-flex size-6 items-center justify-center rounded-full border border-black/15 bg-white/80 text-[11px]">
                  {idx + 1}
                </span>
                ШАГ
              </p>
              <p className="mt-3 text-base font-bold">{title}</p>
              <p className="mt-2 text-sm leading-relaxed text-neutral-700">{description}</p>
            </li>
          ))}
        </Reveal>
      </section>

      <section id="method" className="container mt-14 md:mt-16">
        <SectionTitle
          eyebrow="Первая методика"
          title="«我周围的世界» / «Мир вокруг меня» — готовый курс для запуска первой группы"
          description="Методика рассчитана на детей 5–6 лет и закрывает учебный год: структура уроков, материалы и задания уже собраны, чтобы преподаватель запускал работу без ручной сборки курса."
        />

        <div className="mt-8 grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
          <article className="landing-surface rounded-[1.6rem] border border-black/10 bg-white/85 p-5">
            <p className="text-sm font-bold uppercase tracking-[0.12em] text-neutral-600">Композиция методики</p>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {[
                "1 учебный год",
                "~180 слов",
                "21 песня",
                "21 видео",
                "45 минут урок",
                "4–6 детей в группе",
                "максимум 8 детей",
                "14–16 активностей",
                "старт и финал через песню",
              ].map((item, idx) => (
                <div
                  key={item}
                  className={`rounded-xl border border-black/10 p-3 text-sm font-semibold ${
                    idx % 3 === 0
                      ? "bg-sky-100/80"
                      : idx % 3 === 1
                        ? "bg-lime-100/80"
                        : "bg-fuchsia-100/75"
                  }`}
                >
                  {item}
                </div>
              ))}
            </div>
          </article>

          <article className="landing-surface rounded-[1.6rem] border border-black/10 bg-gradient-to-br from-sky-100/60 to-white p-5">
            <p className="text-sm font-bold uppercase tracking-[0.12em] text-neutral-600">Из чего состоит урок</p>
            <div className="mt-4 grid gap-2">
              {lessonComposition.map((item, idx) => (
                <div
                  key={item}
                  className={`flex items-start gap-2 rounded-xl border border-black/10 p-3 text-sm ${
                    idx % 2 ? "bg-white/95" : "bg-sky-50/70"
                  }`}
                >
                  <ArrowRight className="mt-0.5 size-4 shrink-0 text-neutral-600" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </article>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-4">
          {[
            { title: "Песни", icon: Music3, text: "21 песня встроена в сценарии уроков." },
            { title: "Видео", icon: PlayCircle, text: "21 видео поддерживает тему и ритм занятия." },
            { title: "Карточки", icon: FolderKanban, text: "Материалы и реквизит заданы внутри урока." },
            { title: "Сценарии", icon: NotebookTabs, text: "Преподаватель видит последовательность действий." },
          ].map(({ title, icon: Icon, text }, idx) => (
            <article
              key={title}
              className={`rounded-2xl border border-black/10 p-4 ${
                idx === 0 ? "bg-white" : idx === 1 ? "bg-sky-100/75" : idx === 2 ? "bg-lime-100/75" : "bg-violet-100/75"
              }`}
            >
              <div className="flex items-center gap-2 text-sm font-bold">
                <Icon className="size-4" />
                {title}
              </div>
              <p className="mt-2 text-sm leading-relaxed text-neutral-700">{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="roles" className="container mt-14 md:mt-16">
        <SectionTitle
          eyebrow="Роли"
          title="Преподаватель ведёт, родитель наблюдает, ученик учится в отдельном контексте"
          description="У каждой роли свой интерфейс и своя зона ответственности, но все они связаны одним процессом внутри конкретного урока и группы."
        />
        <div className="mt-8 grid gap-4 lg:grid-cols-3">
          {roleCards.map(({ title, icon: Icon, tone, description, points }) => (
            <article
              key={title}
              className={`landing-surface rounded-[1.6rem] border border-black/10 p-5 role-card role-${tone}`}
            >
              <p className="landing-chip bg-white/75 text-[0.68rem] uppercase">Роль</p>
              <div className="mt-3 flex items-center gap-2">
                <Icon className="size-5" />
                <h3 className="text-xl font-black">{title}</h3>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-neutral-700">{description}</p>
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
          eyebrow="Частный преподаватель и школа"
          title="Личный и организационный контур без смешивания данных"
          description="Shidao спокойно масштабируется от самостоятельной практики до работы внутри школы: логика курса остаётся единой, а границы доступа — ясными."
        />
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <article className="mode-card mode-private rounded-[1.6rem] border border-black/10 bg-white/90 p-5 shadow-[0_18px_36px_rgba(20,20,20,0.08)]">
            <p className="landing-chip bg-sky-100/85 text-xs">Личный контур</p>
            <h3 className="mt-3 text-xl font-black">Частный преподаватель</h3>
            <p className="mt-3 text-sm leading-relaxed text-neutral-700">
              Один взрослый аккаунт, свои группы, своё расписание и методический процесс без лишней административной настройки.
            </p>
          </article>
          <article className="mode-card mode-school rounded-[1.6rem] border border-black/10 bg-gradient-to-br from-fuchsia-100/50 to-white p-5 shadow-[0_18px_36px_rgba(20,20,20,0.08)]">
            <p className="landing-chip bg-fuchsia-100/85 text-xs">Организационный контур</p>
            <h3 className="mt-3 text-xl font-black">Школа / организация</h3>
            <p className="mt-3 text-sm leading-relaxed text-neutral-700">
              Общий рабочий контур с приглашением преподавателей и корректным разграничением ролей и данных внутри организации.
            </p>
          </article>
        </div>
      </section>

      <section id="faq" className="container mt-14 md:mt-16">
        <SectionTitle
          eyebrow="FAQ"
          title="Короткие ответы на практические вопросы"
          description="Только то, что важно для принятия решения о запуске первой группы в Shidao."
        />
        <div className="mt-8 space-y-3 rounded-[1.4rem] border border-black/5 bg-white/45 p-2 md:space-y-4 md:p-3">
          {faq.map(({ q, a }) => (
            <details
              key={q}
              className="group landing-surface rounded-[1.2rem] border border-black/10 bg-white/80 p-4 transition hover:bg-white open:bg-white md:rounded-3xl md:p-6"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[0.98rem] font-semibold leading-snug md:text-base">
                <span>{q}</span>
                <CircleHelp className="size-4 shrink-0 text-neutral-500 transition duration-300 group-open:rotate-12 group-hover:-translate-y-0.5" />
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-neutral-700 md:mt-3.5">{a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="container mt-14 md:mt-16">
        <div className="cta-finale relative overflow-hidden rounded-[1.6rem] border border-black/10 bg-[linear-gradient(150deg,rgba(240,247,255,0.92),rgba(255,255,255,0.92),rgba(255,241,250,0.92))] px-4 py-8 text-center shadow-[0_24px_70px_rgba(20,20,20,0.16)] sm:px-6 md:rounded-[2rem] md:px-12 md:py-10">
          <p className="landing-chip mx-auto bg-lime-100/85">Методика уже внутри продукта</p>
          <h2 className="mx-auto mt-5 max-w-[22ch] text-2xl font-black leading-tight md:mt-6 md:max-w-none md:text-5xl">
            Запустите первую группу по методике «Мир вокруг меня» в Shidao
          </h2>
          <p className="mx-auto mt-3 max-w-[56ch] text-sm leading-relaxed text-neutral-700 md:text-base">
            Платформа собирает процесс в рабочую систему: /dashboard как вход преподавателя, роли с отдельными контекстами и коммуникация, привязанная к уроку.
          </p>
          <div className="mt-6 grid gap-3 sm:flex sm:justify-center">
            <Link href={ROUTES.join} className="landing-btn min-h-12 w-full bg-lime-200 !text-black hover:bg-lime-300 sm:w-auto">
              Создать аккаунт
            </Link>
            <Link
              href={authCtaHref}
              className="landing-btn min-h-12 w-full border border-black/20 bg-white/80 text-neutral-900 hover:bg-white sm:w-auto"
            >
              Войти
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
