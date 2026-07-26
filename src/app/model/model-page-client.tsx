"use client";

import {
  ArrowDown,
  ArrowRight,
  BookOpen,
  Bot,
  CheckCircle2,
  ChevronRight,
  CircleUserRound,
  Clock3,
  FileStack,
  GraduationCap,
  Heart,
  History,
  Library,
  LockKeyhole,
  Menu,
  MousePointer2,
  Network,
  PanelRightOpen,
  Play,
  Route,
  ShieldCheck,
  Sparkles,
  Target,
  Users,
  WandSparkles,
  X,
  Zap,
} from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";

const personas = [
  {
    id: "teacher",
    tab: "Учитель",
    kicker: "Первый рынок",
    title: "Из цели ученика — в готовое занятие",
    quote:
      "«Сделай урок короче, добавь практику на эти слова и отдельный вариант для Миши».",
    outcome:
      "Меньше времени на подготовку и администрирование. Больше — на само обучение.",
    steps: [
      ["01", "Создаёт курс", "Вручную, из шаблона или вместе с AI"],
      ["02", "Готовит урок", "План преподавателя, Экран ученика и материалы"],
      ["03", "Проводит", "Сам, с AI-copilot или повторно по тому же уроку"],
      [
        "04",
        "Получает результат",
        "Ошибки, слова и наблюдения сохраняются в профиль",
      ],
    ],
    accent: "lime",
  },
  {
    id: "family",
    tab: "Родитель",
    kicker: "Следующий рынок",
    title: "Обучение ребёнка без сборки из пяти сервисов",
    quote:
      "«Хочу программу чтения на три месяца: короткие занятия, динозавры и без перегруза».",
    outcome:
      "Родитель задаёт цель и ограничения, а ShiDao помогает выстроить процесс — с человеком или AI.",
    steps: [
      ["01", "Создаёт профиль", "История ребёнка живёт отдельно от курсов"],
      ["02", "Выбирает путь", "Готовый шаблон или персональная программа"],
      ["03", "Определяет режим", "Заниматься самому, с преподавателем или AI"],
      [
        "04",
        "Видит прогресс",
        "Расписание, ДЗ, результаты и подтверждённые выводы",
      ],
    ],
    accent: "lilac",
  },
  {
    id: "learner",
    tab: "Ученик",
    kicker: "Личный путь",
    title: "Простой экран сегодня — память на годы",
    quote:
      "«Покажи, что у меня сегодня, помоги пройти и напомни, что повторить».",
    outcome:
      "Курсы и преподаватели меняются. Образовательная память человека остаётся.",
    steps: [
      ["01", "Видит сегодня", "Ближайшее занятие без административного шума"],
      ["02", "Проходит шаг", "Только Экран ученика и доступные действия"],
      ["03", "Делает ДЗ", "Общее или персональное задание"],
      ["04", "Растёт дальше", "Следующий урок учитывает прошлый опыт"],
    ],
    accent: "blue",
  },
] as const;

const aiRoles = [
  {
    number: "01",
    title: "Автор",
    text: "Создаёт структуру курса, первые уроки, материалы и задания.",
  },
  {
    number: "02",
    title: "Редактор",
    text: "Меняет существующий продукт по обычной человеческой просьбе.",
  },
  {
    number: "03",
    title: "Помощник",
    text: "Подсказывает преподавателю следующий вопрос, материал или объяснение.",
  },
  {
    number: "04",
    title: "Преподаватель",
    text: "Ведёт экранный урок, проверяет ответы и меняет темп.",
  },
  {
    number: "05",
    title: "Аналитик",
    text: "Находит повторяющиеся ошибки и предлагает следующий шаг.",
  },
];

const roadmap = [
  {
    stage: "01",
    tag: "Сейчас",
    title: "Инструмент преподавателя",
    text: "Конструктор курсов, Экран ученика, материалы, расписание, ДЗ и образовательный профиль.",
  },
  {
    stage: "02",
    tag: "Подключения",
    title: "Внешняя экосистема",
    text: "MCP и API превращают ShiDao в образовательный backend для ChatGPT, Claude, Gemini, DeepSeek, Grok и других агентов.",
  },
  {
    stage: "03",
    tag: "Следующий этап",
    title: "ИИ-преподаватель",
    text: "Занятия ведёт ИИ-преподаватель: объясняет материал, задаёт вопросы, проверяет ответы, меняет темп и сохраняет результаты в образовательный профиль.",
  },
  {
    stage: "04",
    tag: "Будущее",
    title: "B2C-обучение",
    text: "Человек приходит в ShiDao с целью и получает готовый персональный образовательный путь, а не набор отдельных инструментов.",
  },
];

function BrandMark() {
  return (
    <span className="model-brand-mark" aria-hidden="true">
      <span />
      <span />
      <span />
    </span>
  );
}

function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`model-wordmark ${className}`.trim()}>
      Shidao<span className="model-wordmark-mark">™</span>
    </span>
  );
}

function SectionIntro({
  index,
  eyebrow,
  title,
  text,
  detail,
}: {
  index: string;
  eyebrow: string;
  title: string;
  text: string;
  detail?: ReactNode;
}) {
  return (
    <div className="model-section-intro">
      <div className="model-section-index">{index}</div>
      <div className="model-section-copy">
        <p className="model-eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
        <p>{text}</p>
        {detail ? <div className="model-section-detail">{detail}</div> : null}
      </div>
    </div>
  );
}

export function ModelPageClient() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [persona, setPersona] =
    useState<(typeof personas)[number]["id"]>("teacher");
  const [lessonMode, setLessonMode] = useState<"live" | "review">("live");
  const [scrollProgress, setScrollProgress] = useState(0);

  useEffect(() => {
    const updateProgress = () => {
      const scrollable =
        document.documentElement.scrollHeight - window.innerHeight;
      setScrollProgress(
        scrollable > 0 ? Math.min(100, (window.scrollY / scrollable) * 100) : 0,
      );
    };

    updateProgress();
    window.addEventListener("scroll", updateProgress, { passive: true });
    return () => window.removeEventListener("scroll", updateProgress);
  }, []);

  const selectedPersona =
    personas.find((item) => item.id === persona) ?? personas[0];

  const closeMenu = () => setMenuOpen(false);

  return (
    <main className="model-page">
      <div
        className="model-scroll-progress"
        style={{ width: `${scrollProgress}%` }}
        aria-hidden="true"
      />

      <header className="model-header">
        <a className="model-logo" href="#top" aria-label="ShiDao, наверх">
          <Wordmark />
        </a>

        <nav
          className={`model-nav ${menuOpen ? "is-open" : ""}`}
          aria-label="Навигация по странице"
        >
          <a href="#model" onClick={closeMenu}>
            Модель
          </a>
          <a href="#scenarios" onClick={closeMenu}>
            Сценарии
          </a>
          <a href="#experience" onClick={closeMenu}>
            UI / UX
          </a>
          <a href="#ai" onClick={closeMenu}>
            ИИ
          </a>
          <a href="#strategy" onClick={closeMenu}>
            Стратегия
          </a>
        </nav>

        <a className="model-header-cta" href="#north-star">
          Куда идём <ArrowRight size={15} />
        </a>

        <button
          className="model-menu-button"
          type="button"
          aria-label={menuOpen ? "Закрыть меню" : "Открыть меню"}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((value) => !value)}
        >
          {menuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </header>

      <section className="model-hero" id="top">
        <div className="model-hero-grid" aria-hidden="true" />
        <div
          className="model-hero-orbit model-hero-orbit-one"
          aria-hidden="true"
        />
        <div
          className="model-hero-orbit model-hero-orbit-two"
          aria-hidden="true"
        />

        <div className="model-hero-copy">
          <div className="model-hero-kicker">
            <span>Внутренняя продуктовая модель</span>
            <span>26 / 07 / 2026</span>
          </div>
          <h1>
            AI умеет
            <br />
            объяснять.
            <br />
            <em>ShiDao превращает</em>
            <br />
            объяснение в образование.
          </h1>
          <p className="model-hero-lead">
            Профессиональная образовательная система, в которой человек может
            создать курс, учить другого, учиться сам и передать процесс AI, не
            теряя историю, структуру и контроль.
          </p>
          <div className="model-hero-actions">
            <a className="model-button model-button-primary" href="#model">
              Понять модель <ArrowDown size={17} />
            </a>
            <a className="model-button model-button-ghost" href="#scenarios">
              Увидеть в работе
            </a>
          </div>
        </div>

        <div className="model-hero-aside">
          <div className="model-hero-definition">
            <span className="model-hero-definition-label">
              В одном предложении
            </span>
            <p>
              ShiDao — это образовательная система для обучения с человеком и
              AI.
            </p>
          </div>
          <div className="model-hero-signal">
            <span className="model-signal-dot" />
            <span>Не ещё один AI-чат</span>
            <strong>Устойчивая инфраструктура обучения</strong>
          </div>
        </div>
      </section>

      <section className="model-section model-foundation" id="model">
        <SectionIntro
          index="01"
          eyebrow="Продуктовая модель"
          title="Главная сущность — образовательный профиль человека"
          text="Курс может закончиться. Преподаватель — смениться. AI-модель — обновиться. Учебный профиль остаётся и делает каждое следующее занятие точнее."
          detail={
            <div className="model-foundation-story">
              <div className="model-foundation-narrative">
                <p>
                  В новой модели ShiDao обучение организовано не вокруг школы,
                  каталога контента или отдельного курса, а вокруг человека и
                  его образовательной цели. Для каждого учащегося ведётся единый
                  учебный профиль: в нём накапливаются проведённые занятия,
                  ответы, ошибки, освоенные знания, интересы, темп и
                  подтверждённые наблюдения о том, как человеку лучше учиться.
                </p>
                <p>
                  Курс становится личным управляемым планом достижения цели. Он
                  объединяет последовательность уроков, аудиторию и настройки,
                  может быть создан вручную или вместе с AI и назначен одному
                  учащемуся либо группе. Когда курс заканчивается, его результат
                  не пропадает: важные данные переходят в учебный профиль и
                  становятся контекстом для следующего решения.
                </p>
              </div>

              <aside className="model-foundation-difference">
                <div>
                  <Sparkles size={18} />
                  <span>Главное отличие</span>
                </div>
                <strong>
                  Не просто показать следующий урок, а понять, каким он должен
                  быть именно для этого человека.
                </strong>
                <p>
                  Обычная платформа помнит прогресс внутри курса. ShiDao
                  продолжает образовательный путь между курсами, преподавателями
                  и AI-моделями.
                </p>
              </aside>

              <div className="model-foundation-signals">
                <div>
                  <History size={18} />
                  <span>Помнит</span>
                  <strong>весь подтверждённый учебный опыт</strong>
                </div>
                <div>
                  <Network size={18} />
                  <span>Связывает</span>
                  <strong>цель, курс, уроки и результаты</strong>
                </div>
                <div>
                  <WandSparkles size={18} />
                  <span>Адаптирует</span>
                  <strong>следующий шаг на основе истории</strong>
                </div>
              </div>
            </div>
          }
        />

        <div
          className="model-entity-map"
          aria-label="Ключевые сущности продуктовой модели движутся по своим орбитам вокруг образовательного профиля человека"
        >
          <div className="model-entity-center">
            <div className="model-entity-person">
              <CircleUserRound size={68} strokeWidth={1.15} />
            </div>
            <strong>Образовательный профиль человека</strong>
          </div>

          <div className="model-entity-orbit model-orbit-ai">
            <div className="model-orbit-runner">
              <article className="model-orbit-node">
                <div className="model-orbit-content">
                  <div className="model-entity-icon is-ai">
                    <Bot size={25} />
                  </div>
                  <div className="model-orbit-copy">
                    <h3>ИИ</h3>
                    <p>Создаёт, адаптирует и помогает проводить обучение.</p>
                  </div>
                </div>
              </article>
            </div>
          </div>

          <div className="model-entity-orbit model-orbit-profile">
            <div className="model-orbit-runner">
              <article className="model-orbit-node">
                <div className="model-orbit-content">
                  <div className="model-entity-icon is-lilac">
                    <History size={25} />
                  </div>
                  <div className="model-orbit-copy">
                    <h3>Учебный профиль</h3>
                    <p>
                      Долговременная история знаний, занятий, ошибок, темпа и
                      предпочтений человека.
                    </p>
                  </div>
                </div>
              </article>
            </div>
          </div>

          <div className="model-entity-orbit model-orbit-lesson">
            <div className="model-orbit-runner">
              <article className="model-orbit-node">
                <div className="model-orbit-content">
                  <div className="model-entity-icon is-blue">
                    <BookOpen size={25} />
                  </div>
                  <div className="model-orbit-copy">
                    <h3>Урок</h3>
                    <p>
                      Редактируемый сценарий, отделённый от каждого конкретного
                      проведения.
                    </p>
                  </div>
                </div>
              </article>
            </div>
          </div>

          <div className="model-entity-orbit model-orbit-course">
            <div className="model-orbit-runner">
              <article className="model-orbit-node">
                <div className="model-orbit-content">
                  <div className="model-entity-icon is-lime">
                    <Route size={25} />
                  </div>
                  <div className="model-orbit-copy">
                    <h3>Курс</h3>
                    <p>
                      Личный управляемый план достижения цели для учащегося или
                      группы.
                    </p>
                  </div>
                </div>
              </article>
            </div>
          </div>

          <div className="model-entity-orbit model-orbit-material">
            <div className="model-orbit-runner">
              <article className="model-orbit-node">
                <div className="model-orbit-content">
                  <div className="model-entity-icon is-coral">
                    <Library size={25} />
                  </div>
                  <div className="model-orbit-copy">
                    <h3>Материал</h3>
                    <p>
                      Самостоятельный объект каталога, который подключается к
                      разным урокам.
                    </p>
                  </div>
                </div>
              </article>
            </div>
          </div>
        </div>
      </section>

      <section className="model-loop-section">
        <div className="model-loop-copy">
          <span className="model-card-label model-card-label-dark">
            ПРОДУКТОВЫЙ ЦИКЛ
          </span>
          <h2>ИИ превращает результаты занятия в следующий урок</h2>
          <p>
            Человек задаёт образовательную цель. ShiDao превращает её в курс,
            уроки и отдельные занятия, а после каждого проведения сохраняет в
            образовательном профиле ответы, ошибки, темп, прогресс и наблюдения.
            ИИ анализирует эту историю и предлагает, что повторить, как изменить
            сложность и каким сделать следующий урок. Поэтому обучение не
            обрывается после занятия: каждый результат становится контекстом для
            следующего решения.
          </p>
        </div>
        <div
          className="model-loop"
          aria-label="Цикл персонализации обучения с ИИ в ShiDao"
        >
          {[
            [
              "Цель",
              "Человек задаёт, чему нужно научиться и какие есть ограничения.",
              Target,
            ],
            [
              "Курс",
              "ИИ связывает цель с профилем и предлагает программу обучения.",
              Route,
            ],
            [
              "Урок",
              "ИИ готовит сценарий, материалы, задания и экран ученика.",
              BookOpen,
            ],
            [
              "Сессия",
              "Человек или ИИ проводит конкретное занятие по готовому уроку.",
              Play,
            ],
            [
              "Данные",
              "Ответы, ошибки, темп и наблюдения сохраняются в профиле.",
              Network,
            ],
            [
              "Адаптация",
              "ИИ предлагает, что повторить и как изменить следующий урок.",
              WandSparkles,
            ],
          ].map(([label, description, Icon], index) => (
            <div className="model-loop-item" key={String(label)}>
              <div>
                <span>0{index + 1}</span>
                <Icon size={23} />
              </div>
              <strong>{String(label)}</strong>
              <p>{String(description)}</p>
              {index < 5 && (
                <ChevronRight className="model-loop-arrow" size={20} />
              )}
            </div>
          ))}
        </div>

        <div className="model-loop-explainer">
          {[
            [
              "Профиль хранит факты",
              "После каждого занятия ShiDao сохраняет не только отметку о прохождении, но и ответы, ошибки, освоенные слова, темп, использованные подсказки и подтверждённые наблюдения.",
            ],
            [
              "ИИ анализирует историю",
              "ИИ сопоставляет новые результаты с целью, текущим курсом и предыдущими занятиями, находит повторяющиеся трудности и понимает, к чему человек готов дальше.",
            ],
            [
              "Следующий шаг меняется",
              "На основе анализа ИИ предлагает обновить содержание урока, сложность, материалы, задания и домашнюю работу. Важные изменения применяются прозрачно и остаются под контролем человека.",
            ],
          ].map(([title, text], index) => (
            <article key={title}>
              <span>0{index + 1}</span>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>

        <div className="model-loop-equation">
          <span>Больше занятий</span>
          <ArrowRight size={18} />
          <span>Больше данных в профиле</span>
          <ArrowRight size={18} />
          <span>Точнее анализ ИИ</span>
          <ArrowRight size={18} />
          <span>Полезнее следующий урок</span>
        </div>
      </section>

      <section className="model-section model-scenarios" id="scenarios">
        <SectionIntro
          index="02"
          eyebrow="Модель в работе"
          title="Роль пользователя (учитель / родитель / ученик) — это контекст, а не тип аккаунта"
          text="Один человек может одновременно создавать курсы, учиться сам, проводить занятия и помогать ребёнку. Поэтому в ShiDao нет отдельных типов аккаунта «учитель», «родитель» и «ученик»: возможности определяются владением и связями с конкретными курсами, группами и образовательными профилями. Интерфейс показывает нужный контекст для текущей задачи, а все три сценария продолжают единый образовательный профиль человека."
        />

        <div
          className="model-persona-tabs"
          role="tablist"
          aria-label="Сценарии пользователей"
        >
          {personas.map((item) => (
            <button
              type="button"
              role="tab"
              aria-selected={persona === item.id}
              className={persona === item.id ? "is-active" : ""}
              onClick={() => setPersona(item.id)}
              key={item.id}
            >
              {item.tab}
              <span />
            </button>
          ))}
        </div>

        <div
          className={`model-persona-panel accent-${selectedPersona.accent}`}
          role="tabpanel"
        >
          <div className="model-persona-story">
            <span className="model-card-label">{selectedPersona.kicker}</span>
            <h3>{selectedPersona.title}</h3>
            <blockquote>{selectedPersona.quote}</blockquote>
            <div className="model-persona-outcome">
              <CheckCircle2 size={21} />
              <p>{selectedPersona.outcome}</p>
            </div>
          </div>
          <div className="model-persona-steps">
            {selectedPersona.steps.map(([number, title, text]) => (
              <article key={number}>
                <span>{number}</span>
                <div>
                  <h4>{title}</h4>
                  <p>{text}</p>
                </div>
              </article>
            ))}
          </div>
        </div>

        <div className="model-context-case">
          <div className="model-context-case-head">
            <span>КЕЙС · ОДИН ЧЕЛОВЕК, ТРИ КОНТЕКСТА</span>
            <strong>Анна преподаёт, помогает дочери и сама учится</strong>
            <p>
              В ShiDao ей не нужны три аккаунта. Текущая задача и связи с
              конкретными курсами и образовательными профилями определяют, какой
              интерфейс и какие возможности она видит.
            </p>
          </div>

          <div className="model-context-case-body">
            <article className="model-context-identity">
              <div className="model-context-avatar">
                <CircleUserRound size={58} strokeWidth={1.2} />
              </div>
              <span>ОДИН АККАУНТ SHIDAO</span>
              <h3>Анна</h3>
              <p>
                Преподаватель английского, мама Лизы и ученица на курсе
                китайского языка.
              </p>
              <div className="model-context-role-chips">
                <span>
                  <GraduationCap size={15} /> Учитель
                </span>
                <span>
                  <Heart size={15} /> Родитель
                </span>
                <span>
                  <BookOpen size={15} /> Ученик
                </span>
              </div>
            </article>

            <div className="model-context-cards">
              <article className="is-teacher">
                <div className="model-context-card-top">
                  <span>КОНТЕКСТ 01 · УЧИТЕЛЬ</span>
                  <div>
                    <GraduationCap size={22} />
                  </div>
                </div>
                <small>Курс «English B1» · группа подростков</small>
                <h4>Проводит занятие</h4>
                <p>
                  Открывает план урока, управляет Экраном ученика и получает от
                  ИИ подсказки по ходу занятия.
                </p>
              </article>

              <article className="is-parent">
                <div className="model-context-card-top">
                  <span>КОНТЕКСТ 02 · РОДИТЕЛЬ</span>
                  <div>
                    <Heart size={22} />
                  </div>
                </div>
                <small>Образовательный профиль Лизы · 9 лет</small>
                <h4>Организует обучение дочери</h4>
                <p>
                  Выбирает курс по математике, видит расписание, домашние
                  задания, результаты и подтверждённые выводы.
                </p>
              </article>

              <article className="is-learner">
                <div className="model-context-card-top">
                  <span>КОНТЕКСТ 03 · УЧЕНИК</span>
                  <div>
                    <Bot size={22} />
                  </div>
                </div>
                <small>Личный курс · китайский язык</small>
                <h4>Учится с ИИ-преподавателем</h4>
                <p>
                  Проходит занятия в своём темпе. Ответы, ошибки и прогресс
                  пополняют её собственный образовательный профиль.
                </p>
              </article>
            </div>
          </div>

          <div className="model-context-summary">
            <div>
              <Network size={23} />
            </div>
            <span>
              <strong>Меняется контекст — не аккаунт.</strong>
              Для собственного обучения у Анны есть образовательный профиль, а к
              профилю дочери она подключена как родитель. Курсы, группы и связи
              определяют доступные действия.
            </span>
          </div>
        </div>
      </section>

      <section className="model-section model-experience" id="experience">
        <SectionIntro
          index="03"
          eyebrow="UI / UX"
          title="Интерфейс следует работе, а не структуре базы"
          text="Никакой панели администратора ради панели администратора. В каждый момент ShiDao отвечает на простой вопрос пользователя: что я делаю сейчас?"
        />

        <div className="model-ui-story model-ui-story-author">
          <div className="model-ui-copy model-author-intro">
            <span className="model-card-label">РАБОЧЕЕ МЕСТО АВТОРА</span>
            <h3>Урок — центр связанной системы</h3>
            <p>
              Автор собирает не набор разрозненных экранов, а один редактируемый
              документ. Он связывает цель и аудиторию с материалами, планом
              преподавателя, Экраном ученика, домашним заданием и каждым
              проведением.
            </p>
          </div>

          <div
            className="model-author-map"
            aria-label="Карта связей документа урока"
          >
            <div className="model-author-map-body">
              <div className="model-author-map-column model-author-map-inputs">
                <span className="model-author-map-label">
                  01 · ЧТО ФОРМИРУЕТ УРОК
                </span>
                <div className="model-author-map-input-grid">
                  <article>
                    <div>
                      <Target size={18} />
                    </div>
                    <span>
                      <strong>Цель и аудитория</strong>
                      <small>Для кого и ради какого результата</small>
                    </span>
                  </article>
                  <article>
                    <div>
                      <Route size={18} />
                    </div>
                    <span>
                      <strong>Место в курсе</strong>
                      <small>Что было раньше и что будет дальше</small>
                    </span>
                  </article>
                  <article>
                    <div>
                      <Library size={18} />
                    </div>
                    <span>
                      <strong>Материалы</strong>
                      <small>Карточки, задания, медиа и ссылки</small>
                    </span>
                  </article>
                </div>
              </div>

              <div className="model-author-map-arrow" aria-hidden="true">
                <ArrowDown size={20} />
              </div>

              <div className="model-author-map-core-section">
                <span className="model-author-map-label">
                  02 · РЕДАКТИРУЕМЫЙ ДОКУМЕНТ
                </span>
                <div className="model-author-map-core">
                  <div className="model-author-map-core-main">
                    <div className="model-author-map-core-icon">
                      <BookOpen size={18} />
                    </div>
                    <span>
                      <strong>Урок</strong>
                      <small>
                        Единая структура занятия: цель, шаги, содержание и
                        настройки
                      </small>
                    </span>
                  </div>
                  <div className="model-author-map-ai">
                    <div>
                      <Sparkles size={18} />
                    </div>
                    <span>
                      <strong>ИИ помогает автору</strong>
                      <small>
                        Создаёт и адаптирует урок, показывает правки до
                        применения
                      </small>
                    </span>
                  </div>
                </div>
              </div>

              <div className="model-author-map-arrow" aria-hidden="true">
                <ArrowDown size={20} />
              </div>

              <div className="model-author-map-column model-author-map-outputs">
                <span className="model-author-map-label">
                  03 · ГДЕ УРОК РАБОТАЕТ
                </span>
                <div className="model-author-map-output-grid">
                  <article>
                    <div>
                      <FileStack size={18} />
                    </div>
                    <span>
                      <strong>План урока</strong>
                      <small>Сценарий и заметки автора</small>
                    </span>
                  </article>
                  <article>
                    <div>
                      <PanelRightOpen size={18} />
                    </div>
                    <span>
                      <strong>Экран ученика</strong>
                      <small>Только нужный учащемуся шаг</small>
                    </span>
                  </article>
                  <article>
                    <div>
                      <CheckCircle2 size={18} />
                    </div>
                    <span>
                      <strong>Домашнее задание</strong>
                      <small>Общее или персональное</small>
                    </span>
                  </article>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="model-ui-story model-ui-story-student">
          <div className="model-student-experience-copy">
            <span className="model-card-label model-card-label-dark">
              ЭКРАН УЧЕНИКА
            </span>
            <h3>Один экран. Два режима доступа.</h3>
            <p>
              Во время live-урока текущий шаг выбирает преподаватель. После
              завершения тот же экран становится пространством повторения.
            </p>
            <div
              className="model-mode-switch"
              role="tablist"
              aria-label="Режим Экрана ученика"
            >
              <button
                type="button"
                role="tab"
                aria-selected={lessonMode === "live"}
                className={lessonMode === "live" ? "is-active" : ""}
                onClick={() => setLessonMode("live")}
              >
                Live-урок
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={lessonMode === "review"}
                className={lessonMode === "review" ? "is-active" : ""}
                onClick={() => setLessonMode("review")}
              >
                Повторение
              </button>
            </div>
            <div className="model-mode-note">
              {lessonMode === "live" ? (
                <>
                  <LockKeyhole size={18} />
                  <span>
                    Навигация ученика заблокирована. Все участники видят шаг,
                    выбранный преподавателем.
                  </span>
                </>
              ) : (
                <>
                  <MousePointer2 size={18} />
                  <span>
                    Ученик свободно перемещается между уже открытыми шагами и
                    повторяет материал.
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="model-tablet-frame">
            <div className="model-tablet-camera" />
            <div className="model-student-screen">
              <div className="model-student-topline">
                <span>Китайский для Миши</span>
                <div>
                  <span className="model-live-dot" />{" "}
                  {lessonMode === "live" ? "Урок идёт" : "Повторение"}
                </div>
              </div>
              <div className="model-student-stepmeta">
                <span>ШАГ 2 ИЗ 6</span>
                <strong>Как тебя зовут?</strong>
              </div>
              <div className="model-dialog-card">
                <div className="model-dialog-person">李</div>
                <div>
                  <b>你叫什么名字？</b>
                  <span>Nǐ jiào shénme míngzi?</span>
                  <small>Как тебя зовут?</small>
                </div>
                <button type="button" aria-label="Прослушать диалог">
                  <Play size={16} fill="currentColor" />
                </button>
              </div>
              <p className="model-student-instruction">
                Прослушай фразу и ответь, назвав своё имя.
              </p>
              <button className="model-answer-button" type="button">
                <span className="model-mic-wave">•••</span> Ответить голосом
              </button>
              <div className="model-student-controls">
                <button type="button" disabled={lessonMode === "live"}>
                  ← Назад
                </button>
                <div className="model-step-dots">
                  {[0, 1, 2, 3, 4, 5].map((dot) => (
                    <span className={dot === 1 ? "is-active" : ""} key={dot} />
                  ))}
                </div>
                <button type="button" disabled={lessonMode === "live"}>
                  Дальше →
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="model-ai-section" id="ai">
        <div className="model-ai-section-inner">
          <SectionIntro
            index="04"
            eyebrow="Глубоко интегрирован с ИИ"
            title="Модели ИИ заменяемы. Образовательная память — нет."
            text="ShiDao не конкурирует с моделью. Он даёт любой подходящей модели контекст, инструменты и безопасное место в реальном образовательном процессе."
          />

          <div className="model-ai-roles">
            {aiRoles.map((role) => (
              <article key={role.number}>
                <span>{role.number}</span>
                <div className="model-ai-role-icon">
                  <Sparkles size={17} />
                </div>
                <h3>{role.title}</h3>
                <p>{role.text}</p>
              </article>
            ))}
          </div>

          <div className="model-ai-safety">
            <div className="model-ai-safety-main">
              <div className="model-ai-safety-copy">
                <span className="model-card-label model-card-label-dark">
                  ЕДИНЫЙ И БЕЗОПАСНЫЙ КОНТУР
                </span>
                <h3>
                  ИИ не зашит в продукт: MCP-сервер задаёт единые правила всем
                  моделям.
                </h3>
                <p>
                  MCP — это защищённый вход к возможностям ShiDao. Внутренняя
                  модель с самого начала работает через него; в дальнейшем к
                  тому же серверу смогут подключаться внешние чаты и модели. Все
                  они получают только разрешённые инструменты, а ShiDao
                  проверяет права и сохраняет историю действий.
                </p>
                <div className="model-safety-pills">
                  <span>
                    <ShieldCheck size={14} /> Разрешённые инструменты
                  </span>
                  <span>
                    <LockKeyhole size={14} /> Проверка прав
                  </span>
                  <span>
                    <History size={14} /> История действий
                  </span>
                  <span>
                    <Zap size={14} /> Лимиты расходов
                  </span>
                </div>
              </div>

              <div
                className="model-stack-layers"
                aria-label="Устройство контура ИИ"
              >
                <div className="model-stack-layer layer-ai">
                  <Bot size={19} />
                  <span>Сменяемые модели ИИ</span>
                  <small>
                    внутренняя модель · внешние чаты · другие модели
                  </small>
                </div>
                <div className="model-stack-layer layer-tools">
                  <WandSparkles size={19} />
                  <span>MCP-сервер и разрешённые инструменты</span>
                  <small>
                    единые правила · проверка прав · история действий
                  </small>
                </div>
                <div className="model-stack-layer layer-product">
                  <Route size={19} />
                  <span>Образовательный процесс</span>
                  <small>курс · урок · занятие · ДЗ · общение</small>
                </div>
                <div className="model-stack-layer layer-memory">
                  <History size={19} />
                  <span>Долговременная образовательная память</span>
                  <small>
                    профиль · события · слова · подтверждённые выводы
                  </small>
                </div>
              </div>
            </div>

            <div className="model-ai-operation">
              <div className="model-ai-operation-copy">
                <span>КАК РАБОТАЕТ MCP</span>
                <h4>
                  MCP-сервер — это понятный посредник между моделью ИИ и ShiDao.
                </h4>
                <p>
                  Он даёт модели не свободный доступ ко всему продукту, а набор
                  конкретных инструментов — словно руки, которыми она может
                  выполнять разрешённые действия.
                </p>
                <p>
                  Один инструмент запрашивает образовательный профиль и историю
                  занятий, другой находит нужный курс или материал, третий
                  создаёт урок и добавляет в него шаги, упражнения и материалы,
                  четвёртый обновляет домашнее задание или сохраняет результат
                  занятия.
                </p>
                <p>
                  Модель выбирает нужный инструмент и передаёт ему понятную
                  команду, а ShiDao проверяет, кому принадлежат данные и можно
                  ли выполнить действие. Встроенная модель и подключённые
                  внешние чаты работают через один и тот же MCP-сервер, поэтому
                  правила и возможности для них едины.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="model-section model-strategy" id="strategy">
        <SectionIntro
          index="05"
          eyebrow="Стратегия и тактика"
          title="Лёгкий вход. Большая система за ним."
          text="Мы не строим всё будущее одновременно. Первая версия решает конкретную ежедневную работу преподавателя — и закладывает модель, которая масштабируется до персонального обучения с ИИ."
        />

        <div className="model-wedge">
          <div className="model-wedge-now">
            <span>ТАКТИКА · ПЕРВЫЙ РЫНОК</span>
            <h3>Школы, преподаватели и репетиторы</h3>
            <p>
              Уже работают с учащимися, каждую неделю готовят уроки и сразу
              чувствуют ценность единого рабочего процесса.
            </p>
            <div>
              <span>
                <Clock3 size={16} /> Экономия подготовки
              </span>
              <span>
                <FileStack size={16} /> Собственная библиотека
              </span>
              <span>
                <Sparkles size={16} /> ИИ в реальной работе
              </span>
            </div>
          </div>
          <div className="model-wedge-arrow">
            <ArrowRight size={25} />
          </div>
          <div className="model-wedge-next">
            <span>СТРАТЕГИЯ · РАСШИРЕНИЕ</span>
            <div className="model-market-rings">
              <div>Преподаватели</div>
              <div>Семьи</div>
              <div>Самообучение</div>
              <div>Обучение с ИИ</div>
            </div>
          </div>
        </div>

        <div className="model-roadmap" aria-label="Этапы развития ShiDao">
          {roadmap.map((item, index) => (
            <article
              className={index === 0 ? "is-current" : ""}
              key={item.stage}
            >
              <div className="model-roadmap-marker">
                <span>{item.stage}</span>
                <i />
              </div>
              <div className="model-roadmap-card">
                <small>{item.tag}</small>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="model-future">
        <div className="model-future-glow" aria-hidden="true" />
        <div className="model-future-copy">
          <span>ВЗГЛЯД В БУДУЩЕЕ · НЕ ОБЕЩАНИЕ, А НАПРАВЛЕНИЕ</span>
          <h2>
            Школа может перестать быть единственным источником образования.
          </h2>
          <p>
            Школы могут превратиться в пространства, которые отвечают за
            безопасность, социализацию, совместные проекты, режим и присутствие
            взрослых. Само обучение — объяснение, практика, проверка знаний и
            выбор следующего шага — частично перейдёт к ИИ.
          </p>
          <p>
            В таком сценарии ShiDao становится цифровой образовательной средой
            школы. Он ведёт профиль каждого ребёнка, сохраняет историю обучения,
            подбирает программу, проводит занятия через ИИ-преподавателя,
            анализирует результаты и адаптирует следующий урок под одного
            ученика или целую группу.
          </p>
          <p>
            Дети могут работать с планшетами, общим экраном, проектором или
            новыми устройствами — конкретная техника не принципиальна. Взрослый
            остаётся рядом как оператор пространства, наставник и человек,
            который помогает, когда нужен живой контакт; всю последовательность
            образовательного процесса удерживает ShiDao.
          </p>
        </div>
        <div className="model-future-scene">
          <div className="model-future-space-head">
            <div>
              <GraduationCap size={24} />
              <div>
                <small>ФИЗИЧЕСКОЕ ПРОСТРАНСТВО</small>
                <strong>Школа</strong>
              </div>
            </div>
            <span>безопасность · социализация · проекты · взрослые рядом</span>
          </div>

          <div className="model-future-platform">
            <div className="model-future-platform-head">
              <Wordmark className="model-future-wordmark" />
              <div>
                <span>ВЕДЁТ ВЕСЬ ОБРАЗОВАТЕЛЬНЫЙ ПРОЦЕСС</span>
                <strong>Цифровая образовательная среда</strong>
              </div>
            </div>
            <p>
              ShiDao связывает цели, уроки, материалы и историю ребёнка в одну
              непрерывную систему.
            </p>

            <div className="model-future-capabilities">
              <div>
                <Bot size={19} />
                <div>
                  <strong>ИИ-преподаватель</strong>
                  <span>объясняет · тренирует · проверяет</span>
                </div>
              </div>
              <div>
                <History size={19} />
                <div>
                  <strong>Учебный профиль</strong>
                  <span>хранит знания · ошибки · интересы · темп</span>
                </div>
              </div>
              <div>
                <Target size={19} />
                <div>
                  <strong>Адаптация</strong>
                  <span>выбирает программу и следующий шаг</span>
                </div>
              </div>
              <div>
                <Network size={19} />
                <div>
                  <strong>Аналитика</strong>
                  <span>видит прогресс и помогает принимать решения</span>
                </div>
              </div>
            </div>

            <div className="model-future-modes">
              <div>
                <CircleUserRound size={20} />
                <div>
                  <strong>Один ребёнок</strong>
                  <span>свой ИИ-преподаватель, программа и темп</span>
                </div>
              </div>
              <div>
                <Users size={20} />
                <div>
                  <strong>Группа детей</strong>
                  <span>общий урок, адаптированный под эту группу</span>
                </div>
              </div>
            </div>
          </div>

          <div className="model-future-operator">
            <Heart size={20} />
            <div>
              <strong>Взрослый внутри пространства</strong>
              <span>
                поддерживает ритм, помогает в сложных ситуациях и сохраняет
                живой человеческий контакт
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="model-section model-decisions">
        <SectionIntro
          index="06"
          eyebrow="Компас команды"
          title="Что мы защищаем, когда принимаем решения"
          text="Функции будут меняться. Эти критерии помогают не потерять продуктовую логику по дороге."
        />
        <div className="model-decision-list">
          {[
            [
              "01",
              "Человек важнее роли",
              "Не создаём искусственных границ между «учусь», «обучаю» и «помогаю».",
            ],
            [
              "02",
              "Путь важнее курса",
              "Проектируем так, чтобы история становилась ценнее после каждого занятия.",
            ],
            [
              "03",
              "Процесс важнее генерации",
              "AI-результат должен сразу жить в курсе, уроке или материале.",
            ],
            [
              "04",
              "Переиспользование важнее копий",
              "Хороший материал улучшается один раз и работает во многих местах.",
            ],
            [
              "05",
              "Прозрачность важнее магии",
              "Показываем, что AI изменит, сколько это стоит и как отменить.",
            ],
            [
              "06",
              "MVP важнее фантазии",
              "Не тащим школы, voice AI и marketplace до доказанного основного цикла.",
            ],
          ].map(([number, title, text]) => (
            <article key={number}>
              <span>{number}</span>
              <h3>{title}</h3>
              <p>{text}</p>
              <ArrowRight size={18} />
            </article>
          ))}
        </div>
      </section>

      <section className="model-north-star" id="north-star">
        <div className="model-north-star-grid" aria-hidden="true" />
        <div className="model-north-star-label">
          <BrandMark />
          <span>НАША СЕВЕРНАЯ ЗВЕЗДА</span>
        </div>
        <h2>
          Сегодня ShiDao продаёт
          <br />
          <span>инструмент персонального обучения.</span>
          <br />
          Завтра — само персональное образование.
        </h2>
        <p>
          У каждого человека должен быть собственный образовательный путь, а не
          только доступ к чужой программе.
        </p>
        <a href="#top" className="model-button model-button-light">
          Вернуться к началу <ArrowRight size={17} />
        </a>
      </section>

      <footer className="model-footer">
        <div className="model-logo">
          <BrandMark />
          <span>
            <strong>SHIDAO</strong>
            <small>PERSONAL EDUCATION OS</small>
          </span>
        </div>
        <p>
          Продуктовая модель v1.0 · основана на глобальной спецификации
          рефакторинга · 26 июля 2026
        </p>
        <a href="https://shidao.ru">
          shidao.ru <ArrowRight size={14} />
        </a>
      </footer>
    </main>
  );
}
