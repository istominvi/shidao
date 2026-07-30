"use client";

import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
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
  Sparkles,
  Target,
  Users,
  WandSparkles,
  X,
} from "lucide-react";
import Image from "next/image";
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
      "Родитель задаёт цель и ограничения, а Shidao помогает выстроить процесс — с человеком или AI.",
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
    Icon: FileStack,
  },
  {
    number: "02",
    title: "Редактор",
    text: "Меняет существующий продукт по обычной человеческой просьбе.",
    Icon: MousePointer2,
  },
  {
    number: "03",
    title: "Помощник",
    text: "Подсказывает преподавателю следующий вопрос, материал или объяснение.",
    Icon: Sparkles,
  },
  {
    number: "04",
    title: "Преподаватель",
    text: "Ведёт экранный урок, проверяет ответы и меняет темп.",
    Icon: GraduationCap,
  },
  {
    number: "05",
    title: "Аналитик",
    text: "Фиксирует поведенческие паттерны ученика в его профиле",
    Icon: Network,
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
    text: (
      <>
        <a
          className="model-mcp-link"
          href="https://ru.wikipedia.org/wiki/Model_Context_Protocol"
          rel="noopener noreferrer"
          target="_blank"
        >
          MCP
        </a>{" "}
        и API превращают Shidao в образовательный backend для ChatGPT, Claude,
        Gemini, DeepSeek, Grok и других агентов.
      </>
    ),
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
    text: "Человек приходит в Shidao с целью и получает готовый персональный образовательный путь, а не набор отдельных инструментов.",
  },
];

function Wordmark({ className = "" }: { className?: string }) {
  return <span className={`model-wordmark ${className}`.trim()}>Shidao</span>;
}

function SectionIntro({
  index,
  eyebrow,
  title,
  text,
  detail,
  illustration,
}: {
  index: string;
  eyebrow: string;
  title: ReactNode;
  text: string;
  detail?: ReactNode;
  illustration?: { src: string; alt: string };
}) {
  return (
    <div
      className={`model-section-intro${illustration ? " model-section-intro-with-illustration" : ""}`}
    >
      <div className="model-section-heading">
        <p className="model-eyebrow">
          <span className="model-section-index">{index}</span> {eyebrow}
        </p>
        {illustration ? (
          <div className="model-section-illustration">
            <Image
              src={illustration.src}
              alt={illustration.alt}
              width={1254}
              height={1254}
              sizes="(max-width: 960px) 100vw, 50vw"
              unoptimized
            />
          </div>
        ) : null}
        <div className="model-section-copy">
          <h2>{title}</h2>
          <p className="model-copy-lead">{text}</p>
        </div>
      </div>
      {detail ? <div className="model-section-detail">{detail}</div> : null}
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
        <a className="model-logo" href="#top" aria-label="Shidao, наверх">
          <Wordmark />
        </a>

        <nav
          className={`model-nav ${menuOpen ? "is-open" : ""}`}
          aria-label="Навигация по странице"
        >
          <a href="#model" onClick={closeMenu}>
            Модель
          </a>
          <a href="#ai" onClick={closeMenu}>
            ИИ
          </a>
          <a href="#profile" onClick={closeMenu}>
            Профиль
          </a>
          <a href="#scenarios" onClick={closeMenu}>
            Аккаунт
          </a>
          <a href="#experience" onClick={closeMenu}>
            Интерфейс
          </a>
          <a href="#strategy" onClick={closeMenu}>
            Стратегия
          </a>
          <a href="#principles" onClick={closeMenu}>
            Критерии
          </a>
        </nav>

        <a
          className="model-header-cta"
          href="https://demo.shidao.ru"
          target="_blank"
          rel="noopener noreferrer"
        >
          Демо <ArrowRight size={15} />
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
        <div className="model-hero-heading">
          <div className="model-hero-kicker">
            <span>Внутренняя продуктовая модель</span>
            <span>26 / 07 / 2026</span>
          </div>

          <div className="model-hero-illustration" aria-hidden="true">
            <Image
              src="/model/0_1_v2.png"
              alt=""
              width={1080}
              height={1080}
              sizes="(max-width: 960px) 100vw, 50vw"
              priority
              unoptimized
            />
          </div>

          <div className="model-hero-copy">
            <h1>
              Shidao —{" "}
              <em className="model-hero-accent">образование будущего,</em>
              <br />
              где ИИ — ассистент,
              <br />
              аналитик и автор контента
            </h1>
            <p className="model-hero-lead model-copy-lead">
              Умная образовательная система, в которой человек может создать
              курс, учить другого, учиться сам и передать процесс AI, не теряя
              историю, структуру и контроль.
            </p>
          </div>

          <div className="model-hero-actions">
            <a className="model-button model-button-primary" href="#model">
              Понять модель <ArrowDown size={17} />
            </a>
            <a
              className="model-button model-button-ghost"
              href="https://demo.shidao.ru"
              target="_blank"
              rel="noopener noreferrer"
            >
              Увидеть в работе <ArrowRight size={17} />
            </a>
          </div>
        </div>
      </section>

      <section className="model-section model-foundation" id="model">
        <SectionIntro
          index="01"
          eyebrow="Продуктовая модель"
          title={
            <>
              Shidao —{" "}
              <em className="model-section-title-accent">
                адаптивная
                <br />
                образовательная
                <br />
                экосистема с ИИ
              </em>
              ,
              <br />
              сопровождающая человека на протяжении всей жизни.
            </>
          }
          text="Три фундаментальных технологических и гуманитарных принципа, которые превращают процесс получения знаний в увлекательный жизненный путь:"
          illustration={{
            src: "/model/1_1_v4.png",
            alt: "Ребёнок с разноцветными обручами",
          }}
          detail={
            <div className="model-principles">
              <div className="model-principle">
                <div className="model-principle-number">1</div>
                <div className="model-principle-content">
                  <h3>Интеллектуальное ядро: ИИ как архитектор знаний</h3>
                  <p className="model-copy-body">
                    В сердце системы находится ИИ-оркестратор, который не просто
                    генерирует текст, а проектирует живую рабочую программу. Он
                    выступает в роли цифрового дирижера: мгновенно создает
                    уникальные уроки, анализирует поведенческие паттерны
                    пользователя и впитывает контекстные данные от
                    преподавателя, чтобы превратить каждую образовательную цель
                    в точный и эффективный маршрут.
                  </p>
                </div>
              </div>
              <div className="model-principle">
                <div className="model-principle-number">2</div>
                <div className="model-principle-content">
                  <h3>Образовательная память: Учебный профиль как фундамент</h3>
                  <p className="model-copy-body">
                    Курсы могут заканчиваться, а преподаватели меняться, но ваш
                    опыт в Shidao остается с вами навсегда. Учебный профиль —
                    это «умное зеркало» учащегося, которое накапливает
                    аналитику, метрики и каждое действие пользователя.
                    Искусственный интеллект обрабатывает эти данные в реальном
                    времени, используя накопленную «память» для того, чтобы
                    делать каждый следующий урок точнее предыдущего.
                  </p>
                </div>
              </div>
              <div className="model-principle">
                <div className="model-principle-number">3</div>
                <div className="model-principle-content">
                  <h3>Единый путь: Один аккаунт на всю жизнь</h3>
                  <p className="model-copy-body">
                    Мы верим, что образование — это не этап, а неотъемлемая
                    часть жизни человека. В Shidao мы стерли границы между
                    ролями: теперь для нас нет разделения на учеников, учителей
                    и родителей. Наша система спроектирована так, чтобы вести
                    ребенка от первого слова до момента, когда он сам станет
                    экспертом, преподавателем или родителем, следящим за
                    успехами своих детей. Мы не просто предлагаем инструмент —
                    мы предлагаем систему, которая будет рядом от рождения до
                    глубокой старости, потому что в Shidao вы всегда остаетесь
                    исследователем, в какой бы роли ни находились сегодня.
                  </p>
                </div>
              </div>
            </div>
          }
        />
      </section>

      <section className="model-ai-section" id="ai">
        <div className="model-ai-section-inner">
          <SectionIntro
            index="02"
            eyebrow="Искусственный интеллект"
            title={
              <>
                Модели ИИ заменяемы.
                <br />
                <em className="model-section-title-accent">
                  Образовательная память — нет.
                </em>
              </>
            }
            text="Shidao не конкурирует с моделью. Система даёт любой подходящей модели контекст, инструменты и безопасное место в реальном образовательном процессе, чтобы ИИ мог исполнять следующие роли:"
            illustration={{
              src: "/model/02_1.png",
              alt: "Ребёнок взаимодействует с роботом через цифровой экран",
            }}
          />

          <div className="model-ai-roles">
            {aiRoles.map((role) => (
              <article key={role.number}>
                <span>{role.number}</span>
                <div className="model-ai-role-icon">
                  <role.Icon size={24} />
                </div>
                <h3>{role.title}</h3>
                <p className="model-copy-body">{role.text}</p>
              </article>
            ))}
          </div>

          <div className="model-ai-architecture">
            <h2 className="model-card-label model-card-label-dark">
              ЕДИНАЯ АРХИТЕКТУРА ИИ
            </h2>
            <div className="model-ai-architecture-text">
              {[
                {
                  Icon: Network,
                  text: "Shidao строится не вокруг одной конкретной ИИ-модели, а вокруг независимого слоя оркестрации. Образовательная логика, данные учебного профиля и продуктовые сценарии отделены от поставщика искусственного интеллекта. Благодаря этому система сможет выбирать модель в зависимости от задачи, требований к точности, скорости, стоимости и конфиденциальности. Например, более мощная модель может использоваться для проектирования курса и сложного анализа, а более быстрая и экономичная — для проверки ответов, классификации данных или подготовки коротких подсказок.",
                },
                {
                  Icon: Route,
                  text: "По мере развития технологий новые модели можно будет подключать, тестировать и заменять без перестройки всей платформы, остановки образовательного процесса или потери накопленной истории. При необходимости Shidao сможет перенаправить задачу на резервную модель, сравнить результаты нескольких моделей или постепенно перевести отдельный сценарий на более эффективное решение. При этом для пользователя ничего не меняется: курсы, занятия, учебный профиль и правила работы остаются едиными.",
                },
                {
                  Icon: WandSparkles,
                  text: "Связующим слоем между искусственным интеллектом и продуктом станет собственный MCP-сервер Shidao. Он предоставит моделям стандартный набор разрешённых инструментов: получить доступный пользователю контекст, найти курс или материал, создать или изменить урок, назначить домашнее задание, сохранить результат занятия или запросить аналитику. Модель не будет обращаться напрямую к базе данных и внутренним сервисам Shidao — все действия будут выполняться через стабильные и контролируемые интерфейсы.",
                },
                {
                  Icon: LockKeyhole,
                  text: "В этом контуре Shidao централизованно проверяет пользователя и его права, валидирует запросы, ограничивает доступные операции, запрашивает подтверждение для важных изменений и сохраняет историю действий. Поэтому разные модели работают с продуктом по одинаковым правилам, а их подключение, обновление или замена не требуют заново проектировать интеграцию. Такой подход также упрощает тестирование, мониторинг качества, управление расходами и безопасный откат изменений.",
                },
                {
                  Icon: Bot,
                  text: "MCP-сервер откроет Shidao и для внешних ИИ-приложений. Поддерживающие этот стандарт чаты и агенты смогут подключаться к платформе как к образовательному сервису: показывать человеку его прогресс, анализировать трудности, находить материалы, готовить занятия или продолжать обучение прямо в привычном интерфейсе. Это могут быть ChatGPT, Claude и другие MCP-совместимые клиенты, включая решения на базе моделей DeepSeek. Доступ будет предоставляться только после авторизации и в пределах разрешений конкретного пользователя.",
                },
                {
                  Icon: History,
                  text: "Таким образом, Shidao сохраняет у себя главное — образовательную память, структуру процесса, данные и правила работы. Модели, пользовательские интерфейсы и внешние сервисы могут меняться, а сама система остаётся стабильной, безопасной и готовой к развитию экосистемы ИИ.",
                },
              ].map(({ Icon, text }) => (
                <article key={text}>
                  <div className="model-ai-architecture-icon">
                    <Icon size={21} />
                  </div>
                  <p>{text}</p>
                </article>
              ))}
            </div>
          </div>

          <div className="model-loop-copy">
            <span className="model-card-label model-card-label-dark">
              ПРОДУКТОВЫЙ ЦИКЛ
            </span>
            <h2>ИИ превращает результаты занятия в следующий урок</h2>
            <p className="model-ai-topic-lead">
              Человек задаёт образовательную цель. Shidao превращает её в курс,
              уроки и отдельные занятия, а после каждого проведения сохраняет в
              образовательном профиле ответы, ошибки, темп, прогресс и
              наблюдения. ИИ анализирует эту историю и предлагает, что
              повторить, как изменить сложность и каким сделать следующий урок.
              Поэтому обучение не обрывается после занятия: каждый результат
              становится контекстом для следующего решения.
            </p>
          </div>
          <div
            className="model-loop"
            aria-label="Цикл персонализации обучения с ИИ в Shidao"
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
                <p className="model-copy-body">{String(description)}</p>
                {index < 5 && (
                  <ChevronRight className="model-loop-arrow" size={20} />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="model-section model-profile" id="profile">
        <SectionIntro
          index="03"
          eyebrow="Образовательный профиль"
          title={
            <>
              Главная сущность —
              <br />
              <em className="model-section-title-accent">
                образовательный профиль человека
              </em>
            </>
          }
          text="Курс может закончиться. Преподаватель — смениться. AI-модель — обновиться. Учебный профиль остаётся и делает каждое следующее занятие точнее."
          illustration={{
            src: "/model/3_1_v1.png",
            alt: "Ученица рядом с визуализацией образовательного профиля",
          }}
          detail={
            <div className="model-profile-story">
              <div className="model-profile-overview">
                <div className="model-profile-points">
                  <article>
                    <div className="model-profile-point-icon">
                      <CircleUserRound size={29} strokeWidth={1.5} />
                    </div>
                    <div>
                      <h3>Обучение строится вокруг человека</h3>
                      <p className="model-copy-body">
                        В новой модели Shidao обучение организовано не вокруг
                        школы, каталога контента или отдельного курса, а вокруг
                        человека и его образовательной цели. Для каждого
                        учащегося ведётся единый учебный профиль: в нём
                        накапливаются проведённые занятия, ответы, ошибки,
                        освоенные знания, интересы, темп и подтверждённые
                        наблюдения о том, как человеку лучше учиться.
                      </p>
                    </div>
                  </article>

                  <article>
                    <div className="model-profile-point-icon">
                      <Route size={27} strokeWidth={1.6} />
                    </div>
                    <div>
                      <h3>Курс становится управляемым маршрутом</h3>
                      <p className="model-copy-body">
                        Курс объединяет последовательность уроков, аудиторию и
                        настройки, может быть создан вручную или вместе с AI и
                        назначен одному учащемуся либо группе. Когда курс
                        заканчивается, его результат не пропадает: важные данные
                        переходят в учебный профиль и становятся контекстом для
                        следующего решения.
                      </p>
                    </div>
                  </article>
                </div>

                <aside className="model-profile-difference">
                  <div>
                    <Sparkles size={18} />
                    <span>Главное отличие</span>
                  </div>
                  <p>
                    Не просто показать следующий урок, а понять, каким он должен
                    быть именно для этого человека. Обычная платформа помнит
                    прогресс внутри курса, а Shidao продолжает образовательный
                    путь между курсами, преподавателями и AI-моделями.
                  </p>
                </aside>
              </div>

              <div className="model-profile-signals">
                <article>
                  <span>01</span>
                  <History size={23} />
                  <h3>Помнит</h3>
                  <p>Весь подтверждённый учебный опыт человека.</p>
                </article>
                <article>
                  <span>02</span>
                  <Network size={23} />
                  <h3>Связывает</h3>
                  <p>Цель, курс, уроки и полученные результаты.</p>
                </article>
                <article>
                  <span>03</span>
                  <WandSparkles size={23} />
                  <h3>Адаптирует</h3>
                  <p>Следующий шаг на основе накопленной истории.</p>
                </article>
              </div>
            </div>
          }
        />
      </section>

      <section
        className="model-section model-scenarios model-scenarios-dark"
        id="scenarios"
      >
        <SectionIntro
          index="04"
          eyebrow="Аккаунт"
          title={
            <>
              Один человек –
              <br />
              <em className="model-section-title-accent">один аккаунт</em>
            </>
          }
          text="Один человек может одновременно создавать курсы, учиться сам, проводить занятия и помогать ребёнку. Поэтому в Shidao нет отдельных типов аккаунта «учитель», «родитель» и «ученик»: возможности определяются владением и связями с конкретными курсами, группами и образовательными профилями. Интерфейс показывает нужный контекст для текущей задачи, а все три сценария продолжают единый образовательный профиль человека."
          illustration={{
            src: "/model/4_1_v2.png",
            alt: "Человек в разных образовательных ролях",
          }}
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
            <strong>Агата преподаёт, помогает дочери и сама учится</strong>
            <p className="model-copy-body">
              В Shidao ей не нужны три аккаунта. Текущая задача и связи с
              конкретными курсами и образовательными профилями определяют, какой
              интерфейс и какие возможности она видит.
            </p>
          </div>

          <div className="model-context-case-body">
            <article className="model-context-identity">
              <div className="model-context-avatar">
                <CircleUserRound size={58} strokeWidth={1.2} />
              </div>
              <span>ОДИН АККАУНТ Shidao</span>
              <h3>Агата</h3>
              <p className="model-copy-body">
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
                <p className="model-copy-body">
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
                <p className="model-copy-body">
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
                <p className="model-copy-body">
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
          index="05"
          eyebrow="UI / UX"
          title={
            <>
              Интерфейс{" "}
              <em className="model-section-title-accent">следует работе</em>,
              <br />а не структуре базы
            </>
          }
          text="Никакой панели администратора ради панели администратора. В каждый момент Shidao отвечает на простой вопрос пользователя: что я делаю сейчас?"
          illustration={{
            src: "/model/5_v2.png",
            alt: "Ученица взаимодействует с образовательным интерфейсом Shidao",
          }}
        />

        <div className="model-ui-story model-ui-story-author">
          <div className="model-ui-copy model-author-intro">
            <span className="model-card-label">РАБОЧЕЕ МЕСТО АВТОРА</span>
            <h3>Урок — центр связанной системы</h3>
            <p className="model-copy-body">
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
            <p className="model-copy-body">
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

      <section className="model-strategy" id="strategy">
        <div className="model-section model-strategy-main">
          <SectionIntro
            index="06"
            eyebrow="Стратегия"
            title={
              <>
                Лёгкий вход.
                <br />
                <em className="model-section-title-accent">
                  Большая система за ним.
                </em>
              </>
            }
            text="Мы не строим всё будущее одновременно. Первая версия решает конкретную ежедневную работу преподавателя — и закладывает модель, которая масштабируется до персонального обучения с ИИ."
          />

          <div className="model-wedge">
            <div className="model-wedge-now">
              <span>ТАКТИКА · ПЕРВЫЙ РЫНОК</span>
              <h3>Школы, преподаватели и репетиторы</h3>
              <p className="model-copy-body">
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
              <span>СТРАТЕГИЯ · МАСШТАБИРОВАНИЕ</span>
              <div className="model-market-rings">
                <div>Преподаватели</div>
                <div>Агенты</div>
                <div>ИИ-преподаватель</div>
                <div>Самообучение</div>
              </div>
            </div>
          </div>

          <div className="model-roadmap" aria-label="Этапы развития Shidao">
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
                  <p className="model-copy-body">{item.text}</p>
                </div>
              </article>
            ))}
          </div>
        </div>

        <div className="model-future">
          <div className="model-future-glow" aria-hidden="true" />
          <div className="model-future-copy">
            <span>ВЗГЛЯД В БУДУЩЕЕ · НЕ ОБЕЩАНИЕ, А НАПРАВЛЕНИЕ</span>
            <h2>
              Школа может перестать быть единственным источником образования.
            </h2>
            <p className="model-copy-body">
              Школы могут превратиться в пространства, которые отвечают за
              безопасность, социализацию, совместные проекты, режим и
              присутствие взрослых. Само обучение — объяснение, практика,
              проверка знаний и выбор следующего шага — частично перейдёт к ИИ.
            </p>
            <p className="model-copy-body">
              В таком сценарии Shidao становится цифровой образовательной средой
              школы. Он ведёт профиль каждого ребёнка, сохраняет историю
              обучения, подбирает программу, проводит занятия через
              ИИ-преподавателя, анализирует результаты и адаптирует следующий
              урок под одного ученика или целую группу.
            </p>
            <p className="model-copy-body">
              Дети могут работать с планшетами, общим экраном, проектором или
              новыми устройствами — конкретная техника не принципиальна.
              Взрослый остаётся рядом как оператор пространства, наставник и
              человек, который помогает, когда нужен живой контакт; всю
              последовательность образовательного процесса удерживает Shidao.
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
              <span>
                безопасность · социализация · проекты · взрослые рядом
              </span>
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
                Shidao связывает цели, уроки, материалы и историю ребёнка в одну
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
        </div>
      </section>

      <section className="model-section model-decisions" id="principles">
        <SectionIntro
          index="07"
          eyebrow="Компас команды"
          title={
            <>
              Что мы защищаем,
              <br />
              <em className="model-section-title-accent">
                когда принимаем решения?
              </em>
            </>
          }
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
              "Обновление важнее копий",
              "Компоненты совершенствуются в каталоге и обновляются до последней версии во всех курсах — вместе с ними совершенствуются и сами курсы.",
            ],
            [
              "04",
              "Прозрачность важнее магии",
              "ИИ постоянно работает рядом в режиме помощника: обсуждает предложение, показывает, что хочет изменить, и действует только после разрешения человека.",
            ],
          ].map(([number, title, text]) => (
            <article key={number}>
              <span>{number}</span>
              <h3>{title}</h3>
              <p className="model-copy-body">{text}</p>
              <ArrowRight size={18} />
            </article>
          ))}
        </div>
      </section>

      <section className="model-north-star" id="north-star">
        <div className="model-north-star-grid" aria-hidden="true" />
        <h2>
          Сегодня Shidao продаёт
          <br />
          <span>систему для создания и проведения обучения с ИИ.</span>
          <br />
          Завтра — само персональное образование.
        </h2>
        <p className="model-copy-lead">
          У каждого человека должен быть собственный образовательный путь, а не
          только доступ к учебным материалам.
        </p>
        <a href="#top" className="model-button model-button-light">
          Вернуться к началу <ArrowUp size={17} />
        </a>
      </section>
    </main>
  );
}
