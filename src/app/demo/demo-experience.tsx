"use client";

import {
  ArrowLeft,
  ArrowRight,
  Bell,
  BookOpen,
  Bot,
  Brain,
  CalendarDays,
  CalendarPlus,
  Check,
  CheckCircle2,
  ChevronDown,
  CirclePlay,
  Clock3,
  Copy,
  FileAudio,
  FileText,
  FolderOpen,
  GripVertical,
  Image as ImageIcon,
  Layers3,
  Link2,
  ListChecks,
  LoaderCircle,
  Menu,
  MessageCircle,
  MoreHorizontal,
  Paperclip,
  Pencil,
  Play,
  Plus,
  RotateCcw,
  Search,
  Send,
  Sparkles,
  Target,
  UploadCloud,
  UserRound,
  Users,
  WandSparkles,
  X,
} from "lucide-react";
import {
  type ChangeEvent,
  type DragEvent,
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type DemoView =
  | "schedule"
  | "students"
  | "student"
  | "courses"
  | "course"
  | "builder"
  | "lesson"
  | "learner";

type Tone = "lime" | "blue" | "purple" | "pink" | "amber" | "neutral";

type Course = {
  id: string;
  title: string;
  description: string;
  audience: string;
  audienceType: "Учащийся" | "Группа" | "Без аудитории";
  created: number;
  target: number;
  next: string;
  tone: Tone;
  status: string;
  subject: string;
};

type Material = {
  id: string;
  title: string;
  type: string;
  meta: string;
  tone: Tone;
};

type LessonStep = {
  id: string;
  title: string;
  duration: string;
  teacher: string;
  learner: string;
  materialIds: string[];
};

type AgentMessage = {
  id: number;
  from: "agent" | "user";
  text: string;
};

const navItems: Array<{
  id: DemoView;
  label: string;
  icon: typeof CalendarDays;
}> = [
  { id: "schedule", label: "Расписание", icon: CalendarDays },
  { id: "students", label: "Ученики", icon: Users },
  { id: "courses", label: "Курсы", icon: BookOpen },
];

const demoCourses: Course[] = [
  {
    id: "english-b1",
    title: "English B1 · подростки",
    description: "Разговорный английский через реальные ситуации и проекты",
    audience: "Группа «Teen Talk» · 4 человека",
    audienceType: "Группа",
    created: 8,
    target: 24,
    next: "Сегодня, 10:00",
    tone: "blue",
    status: "В работе",
    subject: "Английский язык",
  },
  {
    id: "math-lisa",
    title: "Математика для Лизы",
    description: "Дроби, задачи и уверенность в школьной математике",
    audience: "Лиза · 9 лет",
    audienceType: "Учащийся",
    created: 4,
    target: 12,
    next: "Сегодня, 14:30 · ведёт AI",
    tone: "lime",
    status: "AI-обучение",
    subject: "Математика",
  },
  {
    id: "chinese-personal",
    title: "Китайский для себя",
    description: "Личный курс Агаты: базовый разговорный китайский",
    audience: "Агата · мой учебный профиль",
    audienceType: "Учащийся",
    created: 6,
    target: 30,
    next: "Завтра, 08:30",
    tone: "purple",
    status: "Самостоятельно",
    subject: "Китайский язык",
  },
  {
    id: "reading-template",
    title: "Учимся читать",
    description: "Черновик программы для ребёнка 6–7 лет",
    audience: "Аудитория пока не выбрана",
    audienceType: "Без аудитории",
    created: 2,
    target: 18,
    next: "Не запланировано",
    tone: "pink",
    status: "Черновик",
    subject: "Чтение",
  },
];

const materials: Material[] = [
  {
    id: "dialog",
    title: "Диалог в кафе",
    type: "Аудио",
    meta: "Используется в 3 уроках",
    tone: "blue",
  },
  {
    id: "cards",
    title: "Карточки Present Perfect",
    type: "Флеш-карточки",
    meta: "Используется в 4 уроках",
    tone: "purple",
  },
  {
    id: "quiz",
    title: "Мини-тест · опыт",
    type: "Один ответ",
    meta: "Используется в 2 уроках",
    tone: "lime",
  },
  {
    id: "timeline",
    title: "Past ↔ Present",
    type: "Изображение",
    meta: "Используется в 2 курсах",
    tone: "pink",
  },
  {
    id: "reflection",
    title: "Рефлексия в конце урока",
    type: "Открытый вопрос",
    meta: "Используется в 6 уроках",
    tone: "amber",
  },
];

const initialLessonSteps: LessonStep[] = [
  {
    id: "warmup",
    title: "Разогрев · Что уже произошло?",
    duration: "5 мин",
    teacher:
      "Покажите три фотографии и попросите учеников назвать, что уже успело произойти. Не вводите правило — соберите живые примеры.",
    learner: "Посмотри на фотографии. Что уже произошло к этому моменту?",
    materialIds: ["timeline"],
  },
  {
    id: "discovery",
    title: "Открываем Present Perfect",
    duration: "10 мин",
    teacher:
      "Сопоставьте примеры учеников с конструкцией have / has + V3. Подчеркните связь прошлого действия с настоящим результатом.",
    learner: "Собери правило из примеров и выбери подходящую форму.",
    materialIds: ["cards"],
  },
  {
    id: "dialog",
    title: "Диалог · Have you ever…?",
    duration: "12 мин",
    teacher:
      "Сначала прослушайте диалог целиком, затем по репликам. Попросите заметить три вопроса про жизненный опыт.",
    learner: "Прослушай диалог и отметь вопросы, которые услышишь.",
    materialIds: ["dialog"],
  },
  {
    id: "practice",
    title: "Практика в парах",
    duration: "15 мин",
    teacher:
      "Разделите учеников на пары. После каждого ответа попросите задать один уточняющий вопрос в Past Simple.",
    learner: "Задай партнёру три вопроса про опыт и уточни один ответ.",
    materialIds: ["quiz"],
  },
  {
    id: "reflection",
    title: "Рефлексия и следующий шаг",
    duration: "5 мин",
    teacher:
      "Соберите быстрый самоотчёт: уверенность от 1 до 5 и одну фразу, которую хочется повторить.",
    learner: "Оцени уверенность и запиши одну фразу, которую хочешь повторить.",
    materialIds: ["reflection"],
  },
];

const demoToday = new Date(2026, 6, 26, 12);

function dateKey(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function startOfWeek(date: Date) {
  const start = new Date(date);
  const dayIndex = start.getDay() === 0 ? 6 : start.getDay() - 1;
  start.setDate(start.getDate() - dayIndex);
  return start;
}

function formatWeekRange(start: Date, end: Date) {
  const monthNames = [
    "января",
    "февраля",
    "марта",
    "апреля",
    "мая",
    "июня",
    "июля",
    "августа",
    "сентября",
    "октября",
    "ноября",
    "декабря",
  ];
  const startMonth = monthNames[start.getMonth()];
  const endMonth = monthNames[end.getMonth()];

  if (start.getMonth() === end.getMonth()) {
    return `${start.getDate()}–${end.getDate()} ${endMonth} ${end.getFullYear()}`;
  }

  return `${start.getDate()} ${startMonth} — ${end.getDate()} ${endMonth} ${end.getFullYear()}`;
}

function formatScheduleDate(date: Date) {
  if (dateKey(date) === dateKey(demoToday)) return "Сегодня";
  const value = new Intl.DateTimeFormat("ru-RU", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(date);
  return value.charAt(0).toUpperCase() + value.slice(1);
}

const generationStages = [
  "Анализирую цель и учебный профиль",
  "Собираю структуру курса",
  "Создаю первые уроки и материалы",
  "Проверяю логику и готовлю результат",
];

function toneClass(tone: Tone) {
  return `demo-tone-${tone}`;
}

function formatViewPath(view: DemoView) {
  switch (view) {
    case "schedule":
      return "/";
    case "students":
      return "/students";
    case "student":
      return "/students/misha";
    case "courses":
      return "/courses";
    case "course":
      return "/courses/english-b1";
    case "builder":
      return "/courses/new";
    case "lesson":
      return "/courses/english-b1/lessons/present-perfect";
    case "learner":
      return "/lesson/live";
  }
}

function viewFromLocation(): DemoView {
  if (typeof window === "undefined") return "schedule";
  const queryView = new URLSearchParams(window.location.search).get("view");
  if (
    queryView === "schedule" ||
    queryView === "students" ||
    queryView === "student" ||
    queryView === "courses" ||
    queryView === "course" ||
    queryView === "builder" ||
    queryView === "lesson" ||
    queryView === "learner"
  ) {
    return queryView;
  }

  const path = window.location.pathname.replace(/\/+$/, "") || "/";
  if (path === "/students/misha") return "student";
  if (path === "/students") return "students";
  if (path === "/courses/new") return "builder";
  if (path.includes("/lessons/")) return "lesson";
  if (path === "/courses/english-b1") return "course";
  if (path === "/courses") return "courses";
  if (path === "/lesson/live") return "learner";
  return "schedule";
}

function DemoButton({
  children,
  variant = "secondary",
  size = "md",
  className = "",
  ...props
}: {
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "lime";
  size?: "sm" | "md";
  className?: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={`demo-button demo-button-${variant} demo-button-${size} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

function DemoTag({
  children,
  tone = "neutral",
  className = "",
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span className={`demo-tag ${toneClass(tone)} ${className}`}>{children}</span>
  );
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div
      className="demo-progress"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(value)}
    >
      <span style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}

export function DemoExperience() {
  const [view, setView] = useState<DemoView>("schedule");
  const [mobileMenu, setMobileMenu] = useState(false);
  const [profileMenu, setProfileMenu] = useState(false);
  const [notificationMenu, setNotificationMenu] = useState(false);
  const [notificationsUnread, setNotificationsUnread] = useState(true);
  const [scheduleFilter, setScheduleFilter] = useState("Все");
  const [calendarWeekOffset, setCalendarWeekOffset] = useState(0);
  const [selectedScheduleDate, setSelectedScheduleDate] = useState(dateKey(demoToday));
  const [studentTab, setStudentTab] = useState("Профиль");
  const [courseTab, setCourseTab] = useState("Уроки");
  const [lessonTab, setLessonTab] = useState("План урока");
  const [currentStep, setCurrentStep] = useState(1);
  const [screenMode, setScreenMode] = useState<"live" | "review">("live");
  const [lessonSteps, setLessonSteps] = useState(initialLessonSteps);
  const [dragOver, setDragOver] = useState(false);
  const [sourceFiles, setSourceFiles] = useState([
    "Программа Cambridge B1.pdf",
    "Заметки о группе.docx",
  ]);
  const [builderMode, setBuilderMode] = useState<"ai" | "template" | "empty">("ai");
  const [builderStep, setBuilderStep] = useState(1);
  const [generationStage, setGenerationStage] = useState<number | null>(null);
  const [generatedCourse, setGeneratedCourse] = useState(false);
  const [agentOpen, setAgentOpen] = useState(false);
  const [agentInput, setAgentInput] = useState("");
  const [agentTyping, setAgentTyping] = useState(false);
  const [showChangeSet, setShowChangeSet] = useState(false);
  const [changeApplied, setChangeApplied] = useState(false);
  const [messages, setMessages] = useState<AgentMessage[]>([
    {
      id: 1,
      from: "agent",
      text: "Привет, Агата! Я вижу текущую страницу и могу помочь собрать курс, адаптировать урок или разобраться с прогрессом.",
    },
  ]);
  const [toast, setToast] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const notificationMenuRef = useRef<HTMLDivElement>(null);

  const allCourses = useMemo(
    () =>
      generatedCourse
        ? [
            {
              id: "generated-space",
              title: "Английский через космос",
              description: "Персональный курс B1 для группы Teen Talk",
              audience: "Группа «Teen Talk» · 4 человека",
              audienceType: "Группа" as const,
              created: 3,
              target: 12,
              next: "Пока не запланировано",
              tone: "lime" as const,
              status: "Только что создан",
              subject: "Английский язык",
            },
            ...demoCourses,
          ]
        : demoCourses,
    [generatedCourse],
  );

  useEffect(() => {
    setView(viewFromLocation());
    const handlePopState = () => setView(viewFromLocation());
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    if (!profileMenu && !notificationMenu) return;

    const closeOnOutsideClick = (event: PointerEvent) => {
      if (
        profileMenu &&
        profileMenuRef.current &&
        !profileMenuRef.current.contains(event.target as Node)
      ) {
        setProfileMenu(false);
      }
      if (
        notificationMenu &&
        notificationMenuRef.current &&
        !notificationMenuRef.current.contains(event.target as Node)
      ) {
        setNotificationMenu(false);
      }
    };
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        setProfileMenu(false);
        setNotificationMenu(false);
      }
    };

    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [notificationMenu, profileMenu]);

  function navigate(next: DemoView) {
    setView(next);
    setMobileMenu(false);
    setProfileMenu(false);
    setNotificationMenu(false);
    if (typeof window !== "undefined") {
      const isDemoHost = window.location.hostname === "demo.shidao.ru";
      const url = isDemoHost
        ? formatViewPath(next)
        : `/demo?view=${encodeURIComponent(next)}`;
      window.history.pushState({}, "", url);
    }
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  function handleSourceDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragOver(false);
    const dropped = Array.from(event.dataTransfer.files);
    const libraryTitle = event.dataTransfer.getData("text/plain");
    const names = dropped.length
      ? dropped.map((file) => file.name)
      : libraryTitle
        ? [libraryTitle]
        : [];
    if (!names.length) return;
    setSourceFiles((current) => Array.from(new Set([...current, ...names])));
    setToast("Источник добавлен в курс");
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const names = Array.from(event.target.files ?? []).map((file) => file.name);
    if (names.length) {
      setSourceFiles((current) => Array.from(new Set([...current, ...names])));
      setToast("Файлы добавлены. Они останутся только до перезагрузки.");
    }
    event.target.value = "";
  }

  function addMaterialToStep(materialId: string, stepIndex = currentStep) {
    setLessonSteps((steps) =>
      steps.map((step, index) =>
        index === stepIndex
          ? {
              ...step,
              materialIds: Array.from(new Set([...step.materialIds, materialId])),
            }
          : step,
      ),
    );
    const material = materials.find((item) => item.id === materialId);
    setToast(`${material?.title ?? "Материал"} добавлен в шаг ${stepIndex + 1}`);
  }

  function handleStepDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    const materialId = event.dataTransfer.getData("application/x-shidao-material");
    if (materialId) addMaterialToStep(materialId);
  }

  function updateStep(field: "title" | "teacher" | "learner", value: string) {
    setLessonSteps((steps) =>
      steps.map((step, index) =>
        index === currentStep ? { ...step, [field]: value } : step,
      ),
    );
  }

  function startGeneration() {
    setGenerationStage(0);
    let stage = 0;
    const timer = window.setInterval(() => {
      stage += 1;
      if (stage >= generationStages.length) {
        window.clearInterval(timer);
        setGeneratedCourse(true);
        setGenerationStage(null);
        setCourseTab("Уроки");
        setToast("Курс создан и готов к редактированию");
        navigate("course");
        return;
      }
      setGenerationStage(stage);
    }, 900);
  }

  function sendAgentMessage(text = agentInput) {
    const normalized = text.trim();
    if (!normalized || agentTyping) return;
    setMessages((current) => [
      ...current,
      { id: Date.now(), from: "user", text: normalized },
    ]);
    setAgentInput("");
    setAgentTyping(true);
    window.setTimeout(() => {
      setMessages((current) => [
        ...current,
        {
          id: Date.now() + 1,
          from: "agent",
          text:
            view === "lesson"
              ? "Предлагаю сократить объяснение на 3 минуты, добавить практику на вопросы Have you ever…? и персональный вариант для Миши. Я подготовила изменения — посмотрите их перед применением."
              : view === "builder"
                ? "Цель понятна. Для группы Teen Talk я бы собрала 12 уроков по 45 минут и сначала создала три: знакомство с темой, управляемая практика и мини-проект."
                : "Я могу превратить это в конкретное изменение: обновить курс, подготовить следующий урок или объяснить, какие данные повлияли на рекомендацию.",
        },
      ]);
      setAgentTyping(false);
      if (view === "lesson") setShowChangeSet(true);
    }, 850);
  }

  function handleAgentKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") sendAgentMessage();
  }

  function applyChangeSet() {
    setLessonSteps((steps) =>
      steps.map((step, index) =>
        index === 3
          ? {
              ...step,
              title: "Персональная практика · Have you ever…?",
              teacher:
                "Дайте каждому ученику персональный набор вопросов. Мише предложите опоры с формами глаголов; остальные формулируют вопросы самостоятельно.",
            }
          : step,
      ),
    );
    setShowChangeSet(false);
    setChangeApplied(true);
    setToast("Изменения применены. В настоящем продукте здесь будет доступна отмена.");
  }

  function activeNavId() {
    if (view === "students" || view === "student") return "students";
    if (view === "courses" || view === "course" || view === "builder" || view === "lesson")
      return "courses";
    return "schedule";
  }

  function renderHeader() {
    return (
      <header className="demo-header-wrap">
        <div className="demo-header">
          <button
            type="button"
            className="demo-brand"
            onClick={() => navigate("schedule")}
            aria-label="ShiDao, открыть расписание"
          >
            Shidao<span>™</span>
          </button>

          <nav className="demo-main-nav" aria-label="Основная навигация">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = activeNavId() === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`demo-nav-item ${active ? "is-active" : ""}`}
                  onClick={() => navigate(item.id)}
                >
                  <Icon size={17} />
                  {item.label}
                </button>
              );
            })}
          </nav>

          <div className="demo-header-actions">
            <div className="demo-notification-menu-wrap" ref={notificationMenuRef}>
              <button
                className="demo-icon-button"
                type="button"
                aria-label={notificationsUnread ? "Уведомления, 4 новых" : "Уведомления"}
                aria-expanded={notificationMenu}
                onClick={() => {
                  setNotificationMenu((open) => !open);
                  setProfileMenu(false);
                }}
              >
                <Bell size={18} />
                {notificationsUnread ? <span className="demo-notification-dot" /> : null}
              </button>
              {notificationMenu ? (
                <div className="demo-notification-popover" role="dialog" aria-label="Уведомления">
                  <div className="demo-notification-heading">
                    <div>
                      <strong>Уведомления</strong>
                      <span>{notificationsUnread ? "4 новых" : "Сегодня"}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setNotificationsUnread(false);
                        setToast("Все уведомления прочитаны");
                      }}
                    >
                      Прочитать все
                    </button>
                  </div>
                  <div className="demo-notification-list">
                    <button
                      type="button"
                      className={notificationsUnread ? "is-unread" : ""}
                      onClick={() => {
                        setNotificationsUnread(false);
                        navigate("lesson");
                      }}
                    >
                      <span className="demo-notification-icon demo-tone-purple">
                        <Brain size={17} />
                      </span>
                      <span className="demo-notification-copy">
                        <small>AI-рекомендация · сейчас</small>
                        <strong>Мише пригодится короткая опора</strong>
                        <p>Он понимает правило, но путается в третьей форме глагола. Я подготовила карточку для практики.</p>
                      </span>
                    </button>
                    <button
                      type="button"
                      className={notificationsUnread ? "is-unread" : ""}
                      onClick={() => {
                        setNotificationsUnread(false);
                        navigate("student");
                      }}
                    >
                      <span className="demo-notification-icon demo-tone-blue">
                        <Target size={17} />
                      </span>
                      <span className="demo-notification-copy">
                        <small>Статистика · 18 минут назад</small>
                        <strong>Аня стала увереннее отвечать сама</strong>
                        <p>84% заданий без подсказок за неделю — на 12 пунктов больше предыдущего результата.</p>
                      </span>
                    </button>
                    <button
                      type="button"
                      className={notificationsUnread ? "is-unread" : ""}
                      onClick={() => {
                        setNotificationsUnread(false);
                        navigate("students");
                      }}
                    >
                      <span className="demo-notification-icon demo-tone-lime">
                        <CheckCircle2 size={17} />
                      </span>
                      <span className="demo-notification-copy">
                        <small>Прогресс · сегодня, 12:40</small>
                        <strong>Лиза прошла четыре урока подряд</strong>
                        <p>Последние два задания по дробям выполнены без подсказок. Можно повысить сложность.</p>
                      </span>
                    </button>
                    <button
                      type="button"
                      className={notificationsUnread ? "is-unread" : ""}
                      onClick={() => {
                        setNotificationsUnread(false);
                        navigate("students");
                      }}
                    >
                      <span className="demo-notification-icon demo-tone-pink">
                        <Users size={17} />
                      </span>
                      <span className="demo-notification-copy">
                        <small>Группа Teen Talk · вчера</small>
                        <strong>Трое из четырёх сдали домашнюю работу</strong>
                        <p>Остался ответ Пети. Средний результат группы — 78%.</p>
                      </span>
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
            <div className="demo-profile-menu-wrap" ref={profileMenuRef}>
              <button
                type="button"
                className="demo-profile-trigger"
                onClick={() => {
                  setProfileMenu((open) => !open);
                  setNotificationMenu(false);
                }}
                aria-expanded={profileMenu}
              >
                <span className="demo-avatar">АИ</span>
                <span className="demo-profile-copy">
                  <strong>Агата Истомина</strong>
                </span>
                <ChevronDown size={15} />
              </button>
              {profileMenu ? (
                <div className="demo-profile-popover">
                  <div className="demo-profile-summary">
                    <span className="demo-avatar">АИ</span>
                    <div>
                      <strong>Агата Истомина</strong>
                      <span>agata.istomina@gmail.com</span>
                    </div>
                  </div>
                  <div className="demo-context-stack">
                    <span><BookOpen size={14} /> Преподаю: 2 курса</span>
                    <span><UserRound size={14} /> Помогаю Лизе</span>
                    <span><Sparkles size={14} /> Учусь: китайский</span>
                  </div>
                  <p>
                    Это не переключатель ролей: доступные действия складываются из ваших связей с
                    курсами и учебными профилями.
                  </p>
                </div>
              ) : null}
            </div>
            <button
              className="demo-icon-button demo-mobile-menu-button"
              type="button"
              aria-label="Открыть меню"
              onClick={() => setMobileMenu((open) => !open)}
            >
              {mobileMenu ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
        {mobileMenu ? (
          <nav className="demo-mobile-nav" aria-label="Мобильная навигация">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <button key={item.id} type="button" onClick={() => navigate(item.id)}>
                  <Icon size={18} /> {item.label}
                </button>
              );
            })}
          </nav>
        ) : null}
      </header>
    );
  }

  function renderSchedule() {
    const weekStart = addDays(startOfWeek(demoToday), calendarWeekOffset * 7);
    const calendarDays = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
    const weekEnd = calendarDays[calendarDays.length - 1];
    const selectedDate =
      calendarDays.find((date) => dateKey(date) === selectedScheduleDate) ?? demoToday;
    const contextCards = [
      {
        time: "10:00",
        duration: "45 мин",
        role: "Учитель",
        context: "Я провожу",
        title: "Present Perfect · жизненный опыт",
        course: "English B1 · Teen Talk",
        people: "4 учащихся",
        action: "Начать занятие",
        tone: "blue" as Tone,
        onClick: () => navigate("lesson"),
      },
      {
        time: "14:30",
        duration: "35 мин",
        role: "Родитель",
        context: "Лиза учится с AI",
        title: "Дроби вокруг нас",
        course: "Математика для Лизы",
        people: "Лиза · 9 лет",
        action: "Открыть урок",
        tone: "lime" as Tone,
        onClick: () => navigate("learner"),
      },
      {
        time: "18:00",
        duration: "25 мин",
        role: "Ученик",
        context: "Я учусь",
        title: "认识你很高兴 · знакомство",
        course: "Китайский для себя",
        people: "Самостоятельно с AI",
        action: "Продолжить",
        tone: "purple" as Tone,
        onClick: () => navigate("learner"),
      },
    ];

    const visibleCards =
      scheduleFilter === "Все"
        ? contextCards
        : contextCards.filter((card) => card.role === scheduleFilter);

    return (
      <>
        <section className="demo-page-hero demo-schedule-hero">
          <div>
            <h1>Добрый день, Агата</h1>
            <div className="demo-hero-metrics" aria-label="Показатели на сегодня">
              <span><strong>3</strong> занятия</span>
              <span><strong>2 ч 45 мин</strong> в расписании</span>
              <span><strong>1</strong> рекомендация</span>
            </div>
          </div>
          <div className="demo-hero-actions">
            <DemoButton variant="secondary" onClick={() => navigate("builder")}>
              <Plus size={17} /> Новый курс
            </DemoButton>
            <DemoButton variant="primary" onClick={() => setToast("Планирование открыто")}>
              <CalendarPlus size={17} /> Запланировать
            </DemoButton>
          </div>
        </section>

        <section className="demo-week-card">
          <div className="demo-week-heading">
            <div>
              <strong>{formatWeekRange(weekStart, weekEnd)}</strong>
            </div>
            <div className="demo-week-controls">
              <DemoButton
                size="sm"
                variant="ghost"
                aria-label="Предыдущая неделя"
                onClick={() => {
                  setCalendarWeekOffset((value) => value - 1);
                  setSelectedScheduleDate(dateKey(addDays(selectedDate, -7)));
                }}
              >
                <ArrowLeft size={15} />
              </DemoButton>
              <DemoButton
                size="sm"
                variant="secondary"
                onClick={() => {
                  setCalendarWeekOffset(0);
                  setSelectedScheduleDate(dateKey(demoToday));
                }}
              >
                Сегодня
              </DemoButton>
              <DemoButton
                size="sm"
                variant="ghost"
                aria-label="Следующая неделя"
                onClick={() => {
                  setCalendarWeekOffset((value) => value + 1);
                  setSelectedScheduleDate(dateKey(addDays(selectedDate, 7)));
                }}
              >
                <ArrowRight size={15} />
              </DemoButton>
            </div>
          </div>
          <div className="demo-week-days">
            {calendarDays.map((date) => {
              const key = dateKey(date);
              const isToday = key === dateKey(demoToday);
              const isSelected = key === selectedScheduleDate;
              const weekday = new Intl.DateTimeFormat("ru-RU", { weekday: "short" })
                .format(date)
                .replace(".", "");
              return (
                <button
                  type="button"
                  key={key}
                  className={`${isToday ? "is-today" : ""} ${isSelected ? "is-selected" : ""}`}
                  aria-pressed={isSelected}
                  onClick={() => setSelectedScheduleDate(key)}
                >
                  <span>
                    {weekday.charAt(0).toUpperCase() + weekday.slice(1)}
                  </span>
                  <strong>{date.getDate()}</strong>
                  {isToday ? <i /> : null}
                </button>
              );
            })}
          </div>
        </section>

        <div className="demo-section-heading demo-section-heading-spaced">
          <div>
            <span className="demo-eyebrow">{formatScheduleDate(selectedDate)}</span>
            <h2>Уроки сегодня</h2>
          </div>
          <div className="demo-filter-row">
            {["Все", "Учитель", "Родитель", "Ученик"].map((filter) => (
              <button
                type="button"
                key={filter}
                className={scheduleFilter === filter ? "is-active" : ""}
                onClick={() => setScheduleFilter(filter)}
              >
                {filter}
              </button>
            ))}
          </div>
        </div>

        <section className="demo-schedule-grid">
          <div className="demo-timeline">
            {visibleCards.map((card) => (
              <article className="demo-session-row" key={card.context}>
                <div className="demo-session-time">
                  <strong>{card.time}</strong>
                  <span>{card.duration}</span>
                </div>
                <div className={`demo-session-card ${toneClass(card.tone)}`}>
                  <div className="demo-session-topline">
                    <DemoTag tone={card.tone}>{card.context}</DemoTag>
                    <button type="button" aria-label="Другие действия"><MoreHorizontal size={19} /></button>
                  </div>
                  <h3>{card.title}</h3>
                  <p>{card.course}</p>
                  <div className="demo-session-meta">
                    <span><Users size={15} /> {card.people}</span>
                    <span><Clock3 size={15} /> {card.duration}</span>
                  </div>
                  <DemoButton variant="primary" onClick={card.onClick}>
                    <Play size={16} /> {card.action}
                  </DemoButton>
                </div>
              </article>
            ))}
          </div>
          <aside className="demo-insight-card">
            <div className="demo-insight-icon"><Brain size={23} /></div>
            <DemoTag tone="purple">AI-рекомендация</DemoTag>
            <h3>Мише пригодится короткая опора</h3>
            <p>
              В двух последних занятиях он верно выбирал время, но путался в третьей форме
              глагола. Я подготовила облегчённую карточку для сегодняшней практики.
            </p>
            <button type="button" onClick={() => { navigate("lesson"); setAgentOpen(true); }}>
              Посмотреть предложение <ArrowRight size={15} />
            </button>
            <small>Основано на 2 занятиях · требует подтверждения</small>
          </aside>
        </section>
      </>
    );
  }

  function renderStudents() {
    const studentCards = [
      {
        initials: "М",
        name: "Миша Орлов",
        age: "13 лет",
        level: "English A2+",
        courses: "2 активных курса",
        progress: "7 занятий",
        note: "Нужна опора с формами глаголов",
        tone: "blue" as Tone,
      },
      {
        initials: "Л",
        name: "Лиза Истомина",
        age: "9 лет · мой ребёнок",
        level: "Математика · 4 класс",
        courses: "1 активный курс",
        progress: "4 занятия",
        note: "Уверенно работает с равными долями",
        tone: "lime" as Tone,
      },
      {
        initials: "А",
        name: "Аня Соколова",
        age: "14 лет",
        level: "English B1",
        courses: "1 активный курс",
        progress: "11 занятий",
        note: "Готова к более свободной речи",
        tone: "pink" as Tone,
      },
      {
        initials: "П",
        name: "Петя Ли",
        age: "13 лет",
        level: "English A2+",
        courses: "1 активный курс",
        progress: "8 занятий",
        note: "Лучше реагирует на визуальные примеры",
        tone: "purple" as Tone,
      },
    ];

    return (
      <>
        <section className="demo-page-hero">
          <div>
            <DemoTag tone="blue">Учебные профили</DemoTag>
            <h1>Ученики</h1>
            <p>
              Здесь хранится образовательный путь человека — независимо от конкретного курса,
              преподавателя или способа обучения.
            </p>
          </div>
          <div className="demo-hero-actions">
            <DemoButton variant="secondary" onClick={() => setToast("Приглашение скопировано")}>
              <Link2 size={17} /> Пригласить
            </DemoButton>
            <DemoButton variant="primary" onClick={() => setToast("Форма нового учебного профиля открыта")}>
              <Plus size={17} /> Новый профиль
            </DemoButton>
          </div>
        </section>

        <section className="demo-toolbar">
          <div className="demo-segmented">
            <button className="is-active" type="button">Все профили <span>5</span></button>
            <button type="button">Группы <span>1</span></button>
            <button type="button">Архив</button>
          </div>
          <label className="demo-search">
            <Search size={17} />
            <input placeholder="Найти учащегося" />
          </label>
        </section>

        <section className="demo-student-grid">
          {studentCards.map((student) => (
            <button
              type="button"
              className="demo-student-card"
              key={student.name}
              onClick={() => navigate("student")}
            >
              <div className="demo-student-card-top">
                <span className={`demo-large-avatar ${toneClass(student.tone)}`}>{student.initials}</span>
                <DemoTag tone={student.tone}>{student.age}</DemoTag>
              </div>
              <h2>{student.name}</h2>
              <p>{student.level}</p>
              <div className="demo-student-stats">
                <span><BookOpen size={15} /> {student.courses}</span>
                <span><CheckCircle2 size={15} /> {student.progress}</span>
              </div>
              <div className="demo-mini-insight">
                <Sparkles size={15} />
                <span>{student.note}</span>
              </div>
              <div className="demo-card-link">Открыть профиль <ArrowRight size={15} /></div>
            </button>
          ))}
          <article className="demo-group-card">
            <div className="demo-overlap-avatars">
              <span>М</span><span>А</span><span>П</span><span>+1</span>
            </div>
            <DemoTag tone="amber">Группа</DemoTag>
            <h2>Teen Talk</h2>
            <p>4 участника · 2 курса</p>
            <div className="demo-group-next">
              <CalendarDays size={17} />
              <div>
                <span>Следующее занятие</span>
                <strong>Сегодня, 10:00</strong>
              </div>
            </div>
            <DemoButton variant="secondary" onClick={() => setToast("Открыт состав группы Teen Talk")}>
              Управлять группой
            </DemoButton>
          </article>
        </section>
      </>
    );
  }

  function renderStudentProfile() {
    return (
      <>
        <button type="button" className="demo-back-link" onClick={() => navigate("students")}>
          <ArrowLeft size={16} /> Все учащиеся
        </button>
        <section className="demo-profile-hero">
          <div className="demo-profile-person">
            <span className="demo-profile-avatar demo-tone-blue">М</span>
            <div>
              <div className="demo-inline-tags">
                <DemoTag tone="blue">Учебный профиль</DemoTag>
                <DemoTag>13 лет</DemoTag>
              </div>
              <h1>Миша Орлов</h1>
              <p>English A2+ · интересы: космос, игры, путешествия</p>
            </div>
          </div>
          <div className="demo-hero-actions">
            <DemoButton variant="secondary"><MessageCircle size={17} /> Написать</DemoButton>
            <DemoButton variant="primary" onClick={() => navigate("builder")}>
              <Plus size={17} /> Создать курс
            </DemoButton>
          </div>
        </section>

        <div className="demo-profile-tabs">
          {["Профиль", "История", "Слова", "Курсы", "Доступ"].map((tab) => (
            <button
              type="button"
              key={tab}
              className={studentTab === tab ? "is-active" : ""}
              onClick={() => setStudentTab(tab)}
            >
              {tab}
            </button>
          ))}
        </div>

        {studentTab === "Профиль" ? (
          <section className="demo-profile-layout">
            <div className="demo-profile-main">
              <article className="demo-panel">
                <div className="demo-panel-heading">
                  <div>
                    <span className="demo-eyebrow">Сейчас</span>
                    <h2>Что важно учитывать</h2>
                  </div>
                  <DemoTag tone="purple"><Sparkles size={13} /> 3 вывода AI</DemoTag>
                </div>
                <div className="demo-inference-list">
                  <div>
                    <Brain size={19} />
                    <span>
                      <strong>Визуальные опоры помогают начать ответ</strong>
                      <small>Подтверждено Агатой · 18 июля</small>
                    </span>
                  </div>
                  <div>
                    <Target size={19} />
                    <span>
                      <strong>Грамматическое правило понимает, формы глаголов нужно повторить</strong>
                      <small>Предложено AI · на основе 2 занятий</small>
                    </span>
                    <button type="button" onClick={() => setToast("Вывод подтверждён")}>Подтвердить</button>
                  </div>
                  <div>
                    <CirclePlay size={19} />
                    <span>
                      <strong>После 30 минут полезно менять формат активности</strong>
                      <small>Подтверждено Агатой · 11 июля</small>
                    </span>
                  </div>
                </div>
              </article>
              <article className="demo-panel">
                <div className="demo-panel-heading">
                  <div>
                    <span className="demo-eyebrow">Последние занятия</span>
                    <h2>Учебная история</h2>
                  </div>
                  <button type="button" onClick={() => setStudentTab("История")}>Вся история</button>
                </div>
                <div className="demo-history-list">
                  {[
                    ["18 июля", "Past Simple · история путешествия", "Занятие с Агатой", "42 мин"],
                    ["15 июля", "Vocabulary · transport", "Самостоятельная практика", "16 мин"],
                    ["11 июля", "Past Simple · questions", "Занятие с Агатой", "45 мин"],
                  ].map((row) => (
                    <div key={row[1]}>
                      <span>{row[0]}</span>
                      <strong>{row[1]}</strong>
                      <small>{row[2]}</small>
                      <em>{row[3]}</em>
                    </div>
                  ))}
                </div>
              </article>
            </div>
            <aside className="demo-profile-side">
              <article className="demo-panel">
                <span className="demo-eyebrow">Прогресс за 30 дней</span>
                <div className="demo-big-number">7</div>
                <p>занятий · 4 ч 18 мин</p>
                <div className="demo-stats-pair">
                  <span><strong>34</strong><small>слова изучает</small></span>
                  <span><strong>18</strong><small>уже уверенно</small></span>
                </div>
              </article>
              <article className="demo-panel demo-tone-lime">
                <DemoTag tone="lime">Ближайшее занятие</DemoTag>
                <h3>Present Perfect · опыт</h3>
                <p>Сегодня, 10:00 · группа Teen Talk</p>
                <DemoButton variant="primary" onClick={() => navigate("lesson")}>Открыть урок</DemoButton>
              </article>
            </aside>
          </section>
        ) : (
          <section className="demo-empty-tab">
            <div className="demo-empty-icon">
              {studentTab === "Слова" ? <BookOpen size={26} /> : <Layers3 size={26} />}
            </div>
            <h2>{studentTab}</h2>
            <p>
              Данные остаются привязанными к учебному профилю, даже если курс или урок
              закончился.
            </p>
            <DemoButton variant="secondary" onClick={() => setStudentTab("Профиль")}>
              Вернуться к обзору
            </DemoButton>
          </section>
        )}
      </>
    );
  }

  function renderCourses() {
    return (
      <>
        <section className="demo-page-hero">
          <div>
            <DemoTag tone="purple">Личные документы</DemoTag>
            <h1>Курсы</h1>
            <p>
              Создавайте программу вручную, копируйте шаблон или попросите AI превратить цель в
              готовые уроки.
            </p>
          </div>
          <DemoButton variant="primary" onClick={() => navigate("builder")}>
            <Plus size={17} /> Новый курс
          </DemoButton>
        </section>

        <section className="demo-template-banner">
          <div className="demo-template-visual">
            <span><Sparkles size={21} /></span>
            <span><BookOpen size={25} /></span>
            <span><Target size={20} /></span>
          </div>
          <div>
            <DemoTag tone="lime">Быстрый старт</DemoTag>
            <h2>Сформулируйте цель — AI соберёт курс</h2>
            <p>Первые уроки, материалы и задания появятся сразу, а всё важное останется под вашим контролем.</p>
          </div>
          <DemoButton variant="lime" onClick={() => navigate("builder")}>
            Создать с AI <ArrowRight size={16} />
          </DemoButton>
        </section>

        <section className="demo-toolbar">
          <div className="demo-segmented">
            <button className="is-active" type="button">Активные <span>{allCourses.length}</span></button>
            <button type="button">Шаблоны <span>3</span></button>
            <button type="button">Архив</button>
          </div>
          <label className="demo-search">
            <Search size={17} />
            <input placeholder="Найти курс" />
          </label>
        </section>

        <section className="demo-course-grid">
          {allCourses.map((course) => {
            const progress = (course.created / course.target) * 100;
            return (
              <article className="demo-course-card" key={course.id}>
                <div className={`demo-course-cover ${toneClass(course.tone)}`}>
                  <div>
                    <span>{course.subject}</span>
                    <strong>{course.title.split(" ")[0]}</strong>
                  </div>
                  <button type="button" aria-label="Действия с курсом"><MoreHorizontal size={19} /></button>
                </div>
                <div className="demo-course-card-body">
                  <div className="demo-inline-tags">
                    <DemoTag tone={course.tone}>{course.status}</DemoTag>
                    <DemoTag>{course.audienceType}</DemoTag>
                  </div>
                  <h2>{course.title}</h2>
                  <p>{course.description}</p>
                  <div className="demo-audience-line"><Users size={15} /> {course.audience}</div>
                  <div className="demo-course-progress-copy">
                    <span>Уроки созданы</span>
                    <strong>{course.created} из {course.target}</strong>
                  </div>
                  <ProgressBar value={progress} />
                  <div className="demo-course-next"><CalendarDays size={15} /> {course.next}</div>
                  <DemoButton
                    variant="secondary"
                    className="demo-full-button"
                    onClick={() => navigate("course")}
                  >
                    Открыть курс <ArrowRight size={15} />
                  </DemoButton>
                </div>
              </article>
            );
          })}
        </section>
      </>
    );
  }

  function renderCourse() {
    const currentCourse = generatedCourse
      ? {
          ...demoCourses[0],
          title: "Английский через космос",
          description: "Персональный курс B1 на 12 уроков для группы Teen Talk",
          created: 3,
          target: 12,
          tone: "lime" as Tone,
          next: "Не запланировано",
        }
      : demoCourses[0];

    const lessons = generatedCourse
      ? [
          ["1", "Миссия начинается · знакомимся с целью", "45 мин", "Готов"],
          ["2", "Космическая станция · Present Perfect", "45 мин", "Готов"],
          ["3", "Новости из космоса · проект", "50 мин", "Готов"],
        ]
      : [
          ["1", "Welcome · стартовая диагностика", "45 мин", "Проведён 2 раза"],
          ["2", "People and interests", "45 мин", "Проведён"],
          ["3", "Past Simple · события", "45 мин", "Проведён"],
          ["4", "Stories that matter", "45 мин", "Проведён"],
          ["5", "Present Perfect · результат", "45 мин", "Проведён"],
          ["6", "Present Perfect · жизненный опыт", "45 мин", "Сегодня, 10:00"],
          ["7", "Travel experiences", "45 мин", "Черновик"],
          ["8", "Mini project · My experience map", "50 мин", "Черновик"],
        ];

    return (
      <>
        <button type="button" className="demo-back-link" onClick={() => navigate("courses")}>
          <ArrowLeft size={16} /> Все курсы
        </button>
        <section className="demo-course-hero">
          <div className={`demo-course-hero-mark ${toneClass(currentCourse.tone)}`}>
            <BookOpen size={28} />
          </div>
          <div className="demo-course-hero-copy">
            <div className="demo-inline-tags">
              <DemoTag tone={currentCourse.tone}>{currentCourse.status}</DemoTag>
              <DemoTag>{currentCourse.audience}</DemoTag>
            </div>
            <h1>{currentCourse.title}</h1>
            <p>{currentCourse.description}</p>
          </div>
          <div className="demo-course-hero-actions">
            <DemoButton variant="secondary"><Copy size={16} /> Копировать</DemoButton>
            <DemoButton variant="primary" onClick={() => { setAgentOpen(true); setAgentInput("Адаптируй следующие уроки по последним результатам группы"); }}>
              <Sparkles size={16} /> Изменить с AI
            </DemoButton>
          </div>
        </section>

        <section className="demo-course-summary">
          <div>
            <span>Создано уроков</span>
            <strong>{currentCourse.created} из {currentCourse.target}</strong>
            <ProgressBar value={(currentCourse.created / currentCourse.target) * 100} />
          </div>
          <div>
            <span>Аудитория</span>
            <strong>{currentCourse.audienceType}</strong>
            <small>{currentCourse.audience}</small>
          </div>
          <div>
            <span>Следующее занятие</span>
            <strong>{currentCourse.next}</strong>
            <small>Один урок можно провести повторно</small>
          </div>
          <div>
            <span>AI-лимит</span>
            <strong>2 430 / 5 000</strong>
            <ProgressBar value={48.6} />
          </div>
        </section>

        <div className="demo-course-tabs">
          {["Уроки", "Материалы", "Источники", "История курса"].map((tab) => (
            <button
              key={tab}
              type="button"
              className={courseTab === tab ? "is-active" : ""}
              onClick={() => setCourseTab(tab)}
            >
              {tab}
              {tab === "Уроки" ? <span>{currentCourse.created}</span> : null}
            </button>
          ))}
        </div>

        {courseTab === "Уроки" ? (
          <section className="demo-lessons-panel">
            <div className="demo-panel-heading">
              <div>
                <span className="demo-eyebrow">Структура курса</span>
                <h2>Уроки</h2>
              </div>
              <div className="demo-hero-actions">
                <DemoButton variant="secondary" onClick={() => setToast("Добавлен новый урок")}>
                  <Plus size={16} /> Пустой урок
                </DemoButton>
                <DemoButton variant="lime" onClick={() => { setAgentOpen(true); setAgentInput("Создай следующие три урока"); }}>
                  <Sparkles size={16} /> Создать следующие 3
                </DemoButton>
              </div>
            </div>
            <div className="demo-lesson-list">
              {lessons.map((lesson, index) => (
                <button
                  type="button"
                  className="demo-lesson-row"
                  key={lesson[0]}
                  onClick={() => navigate("lesson")}
                >
                  <GripVertical size={17} />
                  <span className="demo-lesson-number">{lesson[0]}</span>
                  <span className="demo-lesson-title">
                    <strong>{lesson[1]}</strong>
                    <small>{lesson[2]} · 5 шагов</small>
                  </span>
                  <DemoTag tone={index === 5 ? "lime" : index > 5 ? "neutral" : "blue"}>
                    {lesson[3]}
                  </DemoTag>
                  <ArrowRight size={17} />
                </button>
              ))}
            </div>
            <div className="demo-lessons-tail">
              <span>{currentCourse.target - currentCourse.created}</span>
              <div>
                <strong>Ещё {currentCourse.target - currentCourse.created} уроков запланировано</strong>
                <p>
                  Это намерение, а не пустые сущности. Создавайте уроки по мере необходимости.
                </p>
              </div>
            </div>
          </section>
        ) : courseTab === "Материалы" ? (
          <section className="demo-library-layout">
            <div className="demo-panel-heading">
              <div><span className="demo-eyebrow">Единый каталог</span><h2>Материалы курса</h2></div>
              <DemoButton variant="primary"><Plus size={16} /> Новый материал</DemoButton>
            </div>
            <p className="demo-surface-note">
              Материал не принадлежит одному курсу. Улучшите его один раз — обновление появится во
              всех уроках, где он используется.
            </p>
            <div className="demo-material-grid">
              {materials.map((material) => (
                <article key={material.id} className="demo-material-card">
                  <span className={`demo-material-icon ${toneClass(material.tone)}`}>
                    {material.type === "Аудио" ? <FileAudio size={20} /> : <FileText size={20} />}
                  </span>
                  <div><DemoTag tone={material.tone}>{material.type}</DemoTag><h3>{material.title}</h3><p>{material.meta}</p></div>
                  <button type="button" aria-label="Редактировать материал"><Pencil size={16} /></button>
                </article>
              ))}
            </div>
          </section>
        ) : (
          <section className="demo-empty-tab">
            <div className="demo-empty-icon">
              {courseTab === "Источники" ? <FolderOpen size={26} /> : <RotateCcw size={26} />}
            </div>
            <h2>{courseTab}</h2>
            <p>
              {courseTab === "Источники"
                ? "PDF, документы, ссылки и заметки дают AI проверяемый контекст для создания и адаптации курса."
                : "Изменения курса и результаты проведений разделены: редактирование документа не переписывает учебную историю."}
            </p>
            <DemoButton variant="secondary" onClick={() => setCourseTab("Уроки")}>Вернуться к урокам</DemoButton>
          </section>
        )}
      </>
    );
  }

  function renderBuilder() {
    return (
      <>
        <button type="button" className="demo-back-link" onClick={() => navigate("courses")}>
          <ArrowLeft size={16} /> Отменить создание
        </button>
        <section className="demo-builder-hero">
          <div>
            <DemoTag tone="lime"><Sparkles size={13} /> Конструктор курса</DemoTag>
            <h1>Превратите цель в учебный путь</h1>
            <p>Всё можно изменить до и после генерации.</p>
          </div>
          <div className="demo-builder-progress-copy">
            <span>Шаг {builderStep} из 4</span>
            <ProgressBar value={builderStep * 25} />
          </div>
        </section>

        <section className="demo-builder-layout">
          <aside className="demo-builder-steps">
            {[
              ["1", "Способ создания", "AI, шаблон или с нуля"],
              ["2", "Цель и аудитория", "Что и для кого"],
              ["3", "Источники", "Файлы, ссылки, заметки"],
              ["4", "Проверка", "Что создаст AI"],
            ].map((step, index) => (
              <button
                type="button"
                key={step[0]}
                className={builderStep === index + 1 ? "is-active" : builderStep > index + 1 ? "is-done" : ""}
                onClick={() => setBuilderStep(index + 1)}
              >
                <span>{builderStep > index + 1 ? <Check size={15} /> : step[0]}</span>
                <div><strong>{step[1]}</strong><small>{step[2]}</small></div>
              </button>
            ))}
            <div className="demo-builder-agent-note">
              <Bot size={19} />
              <div><strong>AI не действует скрытно</strong><p>Перед созданием вы увидите структуру, расход и список изменений.</p></div>
            </div>
          </aside>

          <div className="demo-builder-main">
            {builderStep === 1 ? (
              <div className="demo-builder-section">
                <span className="demo-eyebrow">Шаг 1</span>
                <h2>Как начнём?</h2>
                <p>Выберите удобную отправную точку. Дальше курс остаётся обычным редактируемым документом.</p>
                <div className="demo-creation-options">
                  {[
                    {
                      id: "ai" as const,
                      icon: Sparkles,
                      title: "Создать вместе с AI",
                      text: "Опишите цель, добавьте источники — AI подготовит структуру и первые уроки.",
                      tone: "lime" as Tone,
                    },
                    {
                      id: "template" as const,
                      icon: Copy,
                      title: "Взять шаблон",
                      text: "Скопируйте готовую основу и адаптируйте её под своего учащегося или группу.",
                      tone: "purple" as Tone,
                    },
                    {
                      id: "empty" as const,
                      icon: Pencil,
                      title: "Начать с нуля",
                      text: "Создайте пустой курс и добавляйте уроки вручную в своём темпе.",
                      tone: "blue" as Tone,
                    },
                  ].map((option) => {
                    const Icon = option.icon;
                    return (
                      <button
                        type="button"
                        key={option.id}
                        className={builderMode === option.id ? "is-selected" : ""}
                        onClick={() => setBuilderMode(option.id)}
                      >
                        <span className={toneClass(option.tone)}><Icon size={23} /></span>
                        <DemoTag tone={option.tone}>{option.id === "ai" ? "Рекомендуем" : "Вариант"}</DemoTag>
                        <h3>{option.title}</h3>
                        <p>{option.text}</p>
                        <i>{builderMode === option.id ? <Check size={15} /> : null}</i>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {builderStep === 2 ? (
              <div className="demo-builder-section">
                <span className="demo-eyebrow">Шаг 2</span>
                <h2>Чему и кого будем учить?</h2>
                <p>AI использует учебный профиль и цель только в рамках этого курса.</p>
                <div className="demo-form-grid">
                  <label className="demo-field demo-field-wide">
                    <span>Название курса</span>
                    <input defaultValue="Английский через космос" />
                  </label>
                  <label className="demo-field">
                    <span>Предмет</span>
                    <select defaultValue="english"><option value="english">Английский язык</option><option>Китайский язык</option><option>Математика</option></select>
                  </label>
                  <label className="demo-field">
                    <span>Текущий уровень</span>
                    <select defaultValue="b1"><option value="b1">B1 · средний</option><option>A2 · базовый</option><option>B2 · выше среднего</option></select>
                  </label>
                  <label className="demo-field demo-field-wide">
                    <span>Образовательная цель</span>
                    <textarea defaultValue="Уверенно говорить о жизненном опыте и проектах, расширить активный словарь и подготовить групповой проект о космосе." />
                  </label>
                  <label className="demo-field">
                    <span>Аудитория</span>
                    <select defaultValue="teen"><option value="teen">Группа «Teen Talk» · 4 человека</option><option>Миша Орлов</option><option>Без аудитории</option></select>
                  </label>
                  <label className="demo-field">
                    <span>План уроков</span>
                    <select defaultValue="12"><option value="12">12 уроков по 45 минут</option><option>8 уроков по 60 минут</option><option>Составить вместе с AI</option></select>
                  </label>
                  <div className="demo-profile-context demo-field-wide">
                    <Brain size={21} />
                    <div>
                      <strong>Что AI учтёт из профилей группы</strong>
                      <p>Уровень A2–B1, интерес к космосу и играм, визуальные опоры для Миши, больше свободной речи для Ани.</p>
                    </div>
                    <button type="button" onClick={() => setToast("Контекст профилей раскрыт")}>Проверить</button>
                  </div>
                </div>
              </div>
            ) : null}

            {builderStep === 3 ? (
              <div className="demo-builder-section">
                <span className="demo-eyebrow">Шаг 3</span>
                <h2>Добавьте источники</h2>
                <p>Перетащите файлы, выберите материалы из каталога или добавьте ссылку.</p>
                <div
                  className={`demo-drop-zone ${dragOver ? "is-dragging" : ""}`}
                  onDragOver={(event) => { event.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleSourceDrop}
                >
                  <UploadCloud size={28} />
                  <h3>Перетащите PDF, DOCX, аудио или изображения</h3>
                  <p>или выберите файлы на устройстве</p>
                  <DemoButton variant="secondary" onClick={() => fileInputRef.current?.click()}>
                    Выбрать файлы
                  </DemoButton>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    hidden
                    onChange={handleFileChange}
                    aria-label="Выбрать источники"
                  />
                </div>
                <div className="demo-source-list">
                  {sourceFiles.map((file) => (
                    <div key={file}>
                      <span><FileText size={18} /></span>
                      <div><strong>{file}</strong><small>Готово к использованию</small></div>
                      <CheckCircle2 size={18} />
                      <button type="button" aria-label={`Удалить ${file}`} onClick={() => setSourceFiles((current) => current.filter((item) => item !== file))}><X size={16} /></button>
                    </div>
                  ))}
                </div>
                <div className="demo-source-library">
                  <div className="demo-panel-heading">
                    <div><span className="demo-eyebrow">Мой каталог</span><h3>Перетащите готовый материал выше</h3></div>
                  </div>
                  <div>
                    {materials.slice(0, 3).map((material) => (
                      <article
                        key={material.id}
                        draggable
                        onDragStart={(event) => event.dataTransfer.setData("text/plain", material.title)}
                      >
                        <span className={toneClass(material.tone)}><Paperclip size={17} /></span>
                        <strong>{material.title}</strong>
                        <small>{material.type}</small>
                        <GripVertical size={16} />
                      </article>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}

            {builderStep === 4 ? (
              <div className="demo-builder-section">
                <span className="demo-eyebrow">Шаг 4</span>
                <h2>Что будет создано</h2>
                <p>Сначала — только рабочая основа. Остальные уроки остаются планом и создаются по мере необходимости.</p>
                <div className="demo-generation-summary">
                  <article><span className="demo-tone-lime"><BookOpen size={21} /></span><div><strong>Курс на 12 уроков</strong><p>Английский через космос · группа Teen Talk</p></div></article>
                  <article><span className="demo-tone-blue"><Layers3 size={21} /></span><div><strong>Первые 3 урока</strong><p>С планом преподавателя, Экраном ученика и ДЗ</p></div></article>
                  <article><span className="demo-tone-purple"><FolderOpen size={21} /></span><div><strong>{sourceFiles.length} источника</strong><p>Используются только как контекст генерации</p></div></article>
                  <article><span className="demo-tone-pink"><Sparkles size={21} /></span><div><strong>≈ 340 AI units</strong><p>Оценка до запуска · остаток после операции 2 090</p></div></article>
                </div>
                <div className="demo-change-preview">
                  <div><Check size={16} /> Создать 1 курс</div>
                  <div><Check size={16} /> Создать 3 урока и 15 согласованных шагов</div>
                  <div><Check size={16} /> Добавить 9 материалов в личный каталог</div>
                  <div><Check size={16} /> Назначить курс группе Teen Talk</div>
                  <p>Удалений и изменений существующих данных нет.</p>
                </div>
              </div>
            ) : null}

            <footer className="demo-builder-footer">
              <DemoButton
                variant="secondary"
                disabled={builderStep === 1}
                onClick={() => setBuilderStep((step) => Math.max(1, step - 1))}
              >
                <ArrowLeft size={16} /> Назад
              </DemoButton>
              {builderStep < 4 ? (
                <DemoButton variant="primary" onClick={() => setBuilderStep((step) => Math.min(4, step + 1))}>
                  Продолжить <ArrowRight size={16} />
                </DemoButton>
              ) : (
                <DemoButton variant="lime" onClick={startGeneration}>
                  <Sparkles size={16} /> Сгенерировать курс
                </DemoButton>
              )}
            </footer>
          </div>
        </section>
      </>
    );
  }

  function renderLessonEditor() {
    const step = lessonSteps[currentStep];
    return (
      <>
        <button type="button" className="demo-back-link" onClick={() => navigate("course")}>
          <ArrowLeft size={16} /> English B1 · подростки
        </button>
        <section className="demo-lesson-hero">
          <div>
            <div className="demo-inline-tags">
              <DemoTag tone="blue">Урок 6 из 24</DemoTag>
              <DemoTag tone="lime">Сегодня, 10:00</DemoTag>
            </div>
            <h1>Present Perfect · жизненный опыт</h1>
            <p>45 минут · 5 согласованных шагов · группа Teen Talk</p>
          </div>
          <div className="demo-hero-actions">
            <DemoButton variant="secondary" onClick={() => { setScreenMode("review"); navigate("learner"); }}>
              <CirclePlay size={16} /> Предпросмотр
            </DemoButton>
            <DemoButton variant="primary" onClick={() => setToast("Занятие готово к запуску")}>
              <Play size={16} /> Начать занятие
            </DemoButton>
          </div>
        </section>

        {changeApplied ? (
          <div className="demo-change-applied">
            <CheckCircle2 size={18} />
            <span>AI-изменения применены: персональная практика добавлена в шаг 4.</span>
            <button type="button" onClick={() => { setLessonSteps(initialLessonSteps); setChangeApplied(false); setToast("Изменения отменены"); }}>
              <RotateCcw size={15} /> Отменить
            </button>
          </div>
        ) : null}

        <div className="demo-lesson-tabs">
          {["План урока", "Экран ученика", "Материалы", "Домашнее задание", "Проведения"].map((tab) => (
            <button
              type="button"
              key={tab}
              className={lessonTab === tab ? "is-active" : ""}
              onClick={() => setLessonTab(tab)}
            >
              {tab === "План урока" ? <ListChecks size={16} /> : null}
              {tab === "Экран ученика" ? <CirclePlay size={16} /> : null}
              {tab === "Материалы" ? <FolderOpen size={16} /> : null}
              {tab === "Домашнее задание" ? <FileText size={16} /> : null}
              {tab === "Проведения" ? <CalendarDays size={16} /> : null}
              {tab}
            </button>
          ))}
        </div>

        {lessonTab === "План урока" ? (
          <section className="demo-editor-layout">
            <aside className="demo-step-list">
              <div className="demo-step-list-heading">
                <div><span>Шаги урока</span><strong>{lessonSteps.length}</strong></div>
                <button type="button" onClick={() => setToast("Новый шаг добавлен")}><Plus size={17} /></button>
              </div>
              {lessonSteps.map((lessonStep, index) => (
                <button
                  type="button"
                  className={currentStep === index ? "is-active" : ""}
                  key={lessonStep.id}
                  onClick={() => setCurrentStep(index)}
                >
                  <GripVertical size={15} />
                  <span>{index + 1}</span>
                  <div><strong>{lessonStep.title}</strong><small>{lessonStep.duration} · {lessonStep.materialIds.length} материала</small></div>
                </button>
              ))}
            </aside>

            <main className="demo-step-editor">
              <div className="demo-step-editor-top">
                <DemoTag tone="blue">Шаг {currentStep + 1} из {lessonSteps.length}</DemoTag>
                <div>
                  <DemoButton size="sm" variant="ghost" disabled={currentStep === 0} onClick={() => setCurrentStep((index) => Math.max(0, index - 1))}><ArrowLeft size={15} /></DemoButton>
                  <DemoButton size="sm" variant="ghost" disabled={currentStep === lessonSteps.length - 1} onClick={() => setCurrentStep((index) => Math.min(lessonSteps.length - 1, index + 1))}><ArrowRight size={15} /></DemoButton>
                </div>
              </div>
              <label className="demo-field demo-title-field">
                <span>Название шага · одинаковое у преподавателя и ученика</span>
                <input value={step.title} onChange={(event) => updateStep("title", event.target.value)} />
              </label>
              <label className="demo-field">
                <span>План преподавателя · приватно</span>
                <textarea value={step.teacher} onChange={(event) => updateStep("teacher", event.target.value)} />
              </label>
              <label className="demo-field">
                <span>Короткая инструкция на Экране ученика</span>
                <textarea value={step.learner} onChange={(event) => updateStep("learner", event.target.value)} />
              </label>
              <div
                className="demo-step-material-drop"
                onDragOver={(event) => event.preventDefault()}
                onDrop={handleStepDrop}
              >
                <div className="demo-panel-heading">
                  <div><span className="demo-eyebrow">Материалы шага</span><h3>Перетащите материал из каталога</h3></div>
                  <DemoButton size="sm" variant="secondary"><Plus size={15} /> Создать</DemoButton>
                </div>
                <div className="demo-placed-materials">
                  {step.materialIds.map((materialId) => {
                    const material = materials.find((item) => item.id === materialId);
                    if (!material) return null;
                    return (
                      <div key={material.id}>
                        <span className={toneClass(material.tone)}><Paperclip size={16} /></span>
                        <div><strong>{material.title}</strong><small>{material.type}</small></div>
                        <button type="button" aria-label={`Убрать ${material.title}`} onClick={() => setLessonSteps((steps) => steps.map((item, index) => index === currentStep ? { ...item, materialIds: item.materialIds.filter((id) => id !== material.id) } : item))}><X size={15} /></button>
                      </div>
                    );
                  })}
                  {!step.materialIds.length ? <p>Пока пусто. Бросьте карточку сюда.</p> : null}
                </div>
              </div>
              <div className="demo-teacher-control">
                <div><span className="demo-live-dot" /><div><strong>Управление live-уроком</strong><p>Ученики перейдут на этот же шаг.</p></div></div>
                <DemoButton variant="primary" onClick={() => { setScreenMode("live"); navigate("learner"); }}>
                  Показать шаг ученикам <ArrowRight size={16} />
                </DemoButton>
              </div>
            </main>

            <aside className="demo-material-drawer">
              <div className="demo-material-drawer-heading">
                <div><strong>Каталог материалов</strong><span>Перетащите в урок</span></div>
                <Search size={17} />
              </div>
              <div className="demo-material-filter">
                <button className="is-active" type="button">Все</button><button type="button">Интерактив</button><button type="button">Медиа</button>
              </div>
              <div className="demo-draggable-materials">
                {materials.map((material) => (
                  <article
                    key={material.id}
                    draggable
                    onDragStart={(event) => event.dataTransfer.setData("application/x-shidao-material", material.id)}
                    onDoubleClick={() => addMaterialToStep(material.id)}
                    title="Перетащите или дважды нажмите"
                  >
                    <span className={toneClass(material.tone)}>
                      {material.type === "Аудио" ? <FileAudio size={18} /> : material.type === "Изображение" ? <ImageIcon size={18} /> : <FileText size={18} />}
                    </span>
                    <div><strong>{material.title}</strong><small>{material.type}</small></div>
                    <GripVertical size={16} />
                  </article>
                ))}
              </div>
              <p><Sparkles size={14} /> AI может создать новый материал прямо в этот каталог.</p>
            </aside>
          </section>
        ) : null}

        {lessonTab === "Экран ученика" ? renderStudentScreenPreview() : null}
        {lessonTab === "Материалы" ? renderLessonMaterials() : null}
        {lessonTab === "Домашнее задание" ? renderHomework() : null}
        {lessonTab === "Проведения" ? renderSessions() : null}
      </>
    );
  }

  function renderStudentScreenPreview() {
    const step = lessonSteps[currentStep];
    return (
      <section className="demo-student-screen-workspace">
        <div className="demo-student-screen-toolbar">
          <div>
            <span className="demo-live-dot" />
            <div><strong>Предпросмотр Экрана ученика</strong><small>Номер и название совпадают с Планом урока</small></div>
          </div>
          <div className="demo-segmented">
            <button type="button" className={screenMode === "live" ? "is-active" : ""} onClick={() => setScreenMode("live")}>Live-урок</button>
            <button type="button" className={screenMode === "review" ? "is-active" : ""} onClick={() => setScreenMode("review")}>Повторение</button>
          </div>
          <DemoButton variant="secondary" onClick={() => navigate("learner")}>Открыть на весь экран</DemoButton>
        </div>
        <div className="demo-device-frame">
          <div className="demo-device-topbar">
            <span>Shidao™</span>
            <div><strong>Teen Talk</strong><small>{screenMode === "live" ? "Урок идёт · управляет Агата" : "Повторение после урока"}</small></div>
            <span className="demo-avatar">М</span>
          </div>
          <div className="demo-learner-slide">
            <DemoTag tone="blue">Шаг {currentStep + 1} из {lessonSteps.length}</DemoTag>
            <h2>{step.title}</h2>
            <p>{step.learner}</p>
            <div className="demo-activity-stage">
              {currentStep === 2 ? (
                <>
                  <span className="demo-audio-orb"><FileAudio size={30} /></span>
                  <strong>Have you ever been to another country?</strong>
                  <small>00:08 / 00:24</small>
                  <DemoButton variant="primary"><Play size={16} /> Слушать</DemoButton>
                </>
              ) : (
                <>
                  <span className="demo-activity-emoji">{currentStep === 0 ? "🚀" : currentStep === 1 ? "✨" : currentStep === 3 ? "💬" : "🎯"}</span>
                  <strong>{currentStep === 3 ? "Have you ever tried something new?" : "Подумай и выбери ответ"}</strong>
                  <div className="demo-answer-options"><button type="button">Yes, I have</button><button type="button">No, I haven’t</button></div>
                </>
              )}
            </div>
            <div className="demo-learner-controls">
              <DemoButton variant="secondary" disabled={screenMode === "live" || currentStep === 0} onClick={() => setCurrentStep((index) => Math.max(0, index - 1))}><ArrowLeft size={16} /> Назад</DemoButton>
              <span>{screenMode === "live" ? "Навигацией управляет преподаватель" : "Можно свободно повторять шаги"}</span>
              <DemoButton variant="primary" disabled={screenMode === "live" || currentStep === lessonSteps.length - 1} onClick={() => setCurrentStep((index) => Math.min(lessonSteps.length - 1, index + 1))}>Дальше <ArrowRight size={16} /></DemoButton>
            </div>
          </div>
        </div>
      </section>
    );
  }

  function renderLessonMaterials() {
    return (
      <section className="demo-library-layout">
        <div className="demo-panel-heading">
          <div><span className="demo-eyebrow">Ресурсы урока</span><h2>Материалы</h2></div>
          <DemoButton variant="primary"><Plus size={16} /> Новый материал</DemoButton>
        </div>
        <div className="demo-shared-warning">
          <Link2 size={18} />
          <div><strong>Материалы связаны, а не скопированы</strong><p>Редактирование карточек Present Perfect обновит 4 урока в 2 курсах. Перед изменением вы увидите все места использования.</p></div>
          <button type="button" onClick={() => setToast("Показаны 4 места использования")}>Показать связи</button>
        </div>
        <div className="demo-material-grid">
          {materials.map((material) => (
            <article className="demo-material-card" key={material.id}>
              <span className={`demo-material-icon ${toneClass(material.tone)}`}>
                {material.type === "Аудио" ? <FileAudio size={20} /> : <FileText size={20} />}
              </span>
              <div><DemoTag tone={material.tone}>{material.type}</DemoTag><h3>{material.title}</h3><p>{material.meta}</p></div>
              <button type="button" onClick={() => setToast(`Редактор «${material.title}» открыт`)}><Pencil size={16} /></button>
            </article>
          ))}
        </div>
      </section>
    );
  }

  function renderHomework() {
    return (
      <section className="demo-homework-layout">
        <main className="demo-panel">
          <div className="demo-panel-heading">
            <div><span className="demo-eyebrow">Общее задание</span><h2>Домашняя работа группы</h2></div>
            <DemoTag tone="lime">Применяется к 3 из 4</DemoTag>
          </div>
          <label className="demo-field"><span>Инструкция</span><textarea defaultValue="Запиши аудио с тремя фразами о своём опыте. Используй Present Perfect, а затем добавь одну подробность в Past Simple." /></label>
          <div className="demo-homework-material">
            <span className="demo-tone-purple"><FileAudio size={19} /></span>
            <div><strong>Голосовой ответ</strong><p>До 2 минут · ученик может перезаписать</p></div>
            <button type="button"><Pencil size={16} /></button>
          </div>
          <label className="demo-field"><span>Срок</span><select defaultValue="next"><option value="next">До следующего занятия</option><option>Через 3 дня</option><option>Без срока</option></select></label>
        </main>
        <aside className="demo-panel">
          <div className="demo-panel-heading">
            <div><span className="demo-eyebrow">Персонализация</span><h2>Индивидуальные варианты</h2></div>
          </div>
          <div className="demo-homework-learners">
            {[
              ["М", "Миша", "Персональный вариант", "purple"],
              ["А", "Аня", "Общее задание", "lime"],
              ["П", "Петя", "Общее задание", "lime"],
              ["С", "Соня", "Нет effective homework", "amber"],
            ].map((person) => (
              <div key={person[1]}>
                <span className={`demo-mini-avatar demo-tone-${person[3]}`}>{person[0]}</span>
                <div><strong>{person[1]}</strong><small>{person[2]}</small></div>
                <button type="button" onClick={() => setToast(`Вариант для ${person[1]} открыт`)}><Pencil size={15} /></button>
              </div>
            ))}
          </div>
          <DemoButton variant="lime" className="demo-full-button" onClick={() => { setAgentOpen(true); setAgentInput("Сделай персональные варианты домашнего задания для всей группы"); }}>
            <Sparkles size={16} /> Создать варианты с AI
          </DemoButton>
        </aside>
      </section>
    );
  }

  function renderSessions() {
    return (
      <section className="demo-sessions-layout">
        <div className="demo-panel-heading">
          <div><span className="demo-eyebrow">Документ и проведение разделены</span><h2>Проведения этого урока</h2></div>
          <DemoButton variant="primary"><CalendarPlus size={16} /> Запланировать ещё</DemoButton>
        </div>
        <p className="demo-surface-note">
          Один и тот же урок можно проводить много раз. Каждое проведение хранит собственную дату,
          режим и снимок результатов.
        </p>
        <div className="demo-session-history">
          <article><span className="demo-tone-lime"><CalendarDays size={20} /></span><div><DemoTag tone="lime">Запланировано</DemoTag><h3>Сегодня, 10:00</h3><p>Live · группа Teen Talk · ведёт Агата</p></div><DemoButton variant="secondary">Открыть</DemoButton></article>
          <article><span className="demo-tone-blue"><CheckCircle2 size={20} /></span><div><DemoTag tone="blue">Завершено</DemoTag><h3>2 июня, 17:00</h3><p>Live · пробное проведение · 42 минуты</p></div><DemoButton variant="ghost">Результаты</DemoButton></article>
        </div>
      </section>
    );
  }

  function renderLearnerScreen() {
    const step = lessonSteps[currentStep];
    return (
      <section className="demo-learner-fullscreen">
        <header>
          <button type="button" className="demo-brand" onClick={() => navigate("lesson")}>Shidao<span>™</span></button>
          <div>
            <strong>Present Perfect · жизненный опыт</strong>
            <small>{screenMode === "live" ? "Урок идёт · шагом управляет Агата" : "Режим повторения"}</small>
          </div>
          <DemoTag tone={screenMode === "live" ? "lime" : "purple"}>
            {screenMode === "live" ? <><span className="demo-live-dot" /> Live</> : "Повторение"}
          </DemoTag>
          <button type="button" className="demo-learner-exit" onClick={() => navigate("lesson")}><X size={19} /> Выйти из просмотра</button>
        </header>
        <main>
          <div className="demo-learner-step-copy">
            <DemoTag tone="blue">Шаг {currentStep + 1} из {lessonSteps.length}</DemoTag>
            <h1>{step.title}</h1>
            <p>{step.learner}</p>
          </div>
          <div className="demo-learner-main-activity">
            {currentStep === 2 ? (
              <>
                <span className="demo-audio-orb"><FileAudio size={38} /></span>
                <span className="demo-activity-kicker">Прослушай фразу</span>
                <h2>Have you ever been to another country?</h2>
                <div className="demo-audio-line"><span /><i /></div>
                <small>00:08 / 00:24</small>
                <DemoButton variant="primary"><Play size={18} /> Слушать ещё раз</DemoButton>
              </>
            ) : (
              <>
                <span className="demo-activity-emoji">{currentStep === 0 ? "🚀" : currentStep === 1 ? "✨" : currentStep === 3 ? "💬" : "🎯"}</span>
                <span className="demo-activity-kicker">Твой ход</span>
                <h2>{currentStep === 3 ? "Have you ever tried something new?" : "Выбери ответ, который подходит тебе"}</h2>
                <div className="demo-large-answer-options">
                  <button type="button" onClick={() => setToast("Ответ принят")}>Yes, I have</button>
                  <button type="button" onClick={() => setToast("Ответ принят")}>No, I haven’t</button>
                </div>
              </>
            )}
          </div>
          <div className="demo-learner-bottom">
            <DemoButton variant="secondary" disabled={screenMode === "live" || currentStep === 0} onClick={() => setCurrentStep((index) => Math.max(0, index - 1))}><ArrowLeft size={17} /> Назад</DemoButton>
            <div className="demo-step-dots">
              {lessonSteps.map((item, index) => <span key={item.id} className={index === currentStep ? "is-active" : index < currentStep ? "is-done" : ""} />)}
            </div>
            <span className="demo-navigation-note">{screenMode === "live" ? "Переходами управляет преподаватель" : "Можно свободно повторять урок"}</span>
            <DemoButton variant="primary" disabled={screenMode === "live" || currentStep === lessonSteps.length - 1} onClick={() => setCurrentStep((index) => Math.min(lessonSteps.length - 1, index + 1))}>Дальше <ArrowRight size={17} /></DemoButton>
          </div>
        </main>
        {screenMode === "live" ? (
          <div className="demo-teacher-remote">
            <small>Панель преподавателя</small>
            <strong>Сейчас показан шаг {currentStep + 1}</strong>
            <div>
              <button type="button" disabled={currentStep === 0} onClick={() => setCurrentStep((index) => Math.max(0, index - 1))}><ArrowLeft size={16} /></button>
              <button type="button" disabled={currentStep === lessonSteps.length - 1} onClick={() => setCurrentStep((index) => Math.min(lessonSteps.length - 1, index + 1))}>Следующий шаг <ArrowRight size={16} /></button>
            </div>
          </div>
        ) : null}
      </section>
    );
  }

  function renderAgent() {
    return (
      <>
        <button
          type="button"
          className={`demo-agent-button ${agentOpen ? "is-open" : ""}`}
          onClick={() => setAgentOpen((open) => !open)}
          aria-label={agentOpen ? "Закрыть AI-помощника" : "Открыть AI-помощника"}
        >
          <span className="demo-agent-pulse" />
          {agentOpen ? <X size={22} /> : <Sparkles size={22} />}
          {!agentOpen ? <strong>AI</strong> : null}
        </button>
        {agentOpen ? (
          <aside className="demo-agent-panel">
            <header>
              <span className="demo-agent-avatar"><WandSparkles size={20} /></span>
              <div><strong>ShiDao AI</strong><small>Видит контекст текущей страницы</small></div>
              <button type="button" onClick={() => setAgentOpen(false)}><X size={18} /></button>
            </header>
            <div className="demo-agent-context">
              <span className="demo-live-dot" />
              {view === "lesson"
                ? "Урок 6 · Present Perfect"
                : view === "builder"
                  ? "Новый курс · шаг создания"
                  : view === "student"
                    ? "Учебный профиль Миши"
                    : "Рабочее пространство Агаты"}
            </div>
            <div className="demo-agent-messages">
              {messages.map((message) => (
                <div key={message.id} className={`demo-agent-message is-${message.from}`}>
                  {message.text}
                </div>
              ))}
              {agentTyping ? (
                <div className="demo-agent-message is-agent demo-agent-typing"><i /><i /><i /></div>
              ) : null}
              {showChangeSet ? (
                <article className="demo-change-set">
                  <div className="demo-change-set-title"><Sparkles size={17} /><div><strong>Предлагаемые изменения</strong><small>≈ 28 AI units</small></div></div>
                  <ul>
                    <li><Check size={14} /> Сократить объяснение на 3 минуты</li>
                    <li><Check size={14} /> Добавить 4 вопроса Have you ever…?</li>
                    <li><Check size={14} /> Создать опору для Миши</li>
                  </ul>
                  <p>Затронуты: 1 шаг, 2 материала. Удалений нет.</p>
                  <div>
                    <DemoButton size="sm" variant="secondary" onClick={() => setShowChangeSet(false)}>Не сейчас</DemoButton>
                    <DemoButton size="sm" variant="lime" onClick={applyChangeSet}>Применить</DemoButton>
                  </div>
                </article>
              ) : null}
            </div>
            <div className="demo-agent-prompts">
              {(view === "lesson"
                ? ["Сделай урок короче", "Добавь практику", "Вариант для Миши"]
                : view === "builder"
                  ? ["Предложи структуру", "Учти профиль группы", "Оцени расход"]
                  : ["Что важно сегодня?", "Подготовь следующий урок"]
              ).map((prompt) => (
                <button type="button" key={prompt} onClick={() => sendAgentMessage(prompt)}>{prompt}</button>
              ))}
            </div>
            <footer>
              <button type="button" aria-label="Прикрепить файл"><Paperclip size={18} /></button>
              <input
                value={agentInput}
                onChange={(event) => setAgentInput(event.target.value)}
                onKeyDown={handleAgentKeyDown}
                placeholder="Попросите изменить или объяснить…"
              />
              <button type="button" onClick={() => sendAgentMessage()} disabled={!agentInput.trim()} aria-label="Отправить"><Send size={18} /></button>
            </footer>
            <div className="demo-agent-quota">
              <span>AI-лимит: 2 430 из 5 000</span>
              <ProgressBar value={48.6} />
            </div>
          </aside>
        ) : null}
      </>
    );
  }

  if (view === "learner") {
    return (
      <div className="demo-v2-root">
        {renderLearnerScreen()}
        {renderAgent()}
        {toast ? <div className="demo-toast"><CheckCircle2 size={17} /> {toast}</div> : null}
      </div>
    );
  }

  return (
    <div className="demo-v2-root">
      <div className="demo-background-orb demo-orb-one" />
      <div className="demo-background-orb demo-orb-two" />
      {renderHeader()}
      <main className={`demo-page demo-page-${view}`}>
        {view === "schedule" ? renderSchedule() : null}
        {view === "students" ? renderStudents() : null}
        {view === "student" ? renderStudentProfile() : null}
        {view === "courses" ? renderCourses() : null}
        {view === "course" ? renderCourse() : null}
        {view === "builder" ? renderBuilder() : null}
        {view === "lesson" ? renderLessonEditor() : null}
      </main>
      {renderAgent()}
      {toast ? <div className="demo-toast"><CheckCircle2 size={17} /> {toast}</div> : null}
      {generationStage !== null ? (
        <div className="demo-generation-overlay" role="status" aria-live="polite">
          <div className="demo-generation-modal">
            <span className="demo-generation-orb"><Sparkles size={30} /></span>
            <DemoTag tone="lime">AI создаёт курс</DemoTag>
            <h2>{generationStages[generationStage]}</h2>
            <p>После создания структуру и каждый урок можно будет изменить.</p>
            <ProgressBar value={((generationStage + 1) / generationStages.length) * 100} />
            <div className="demo-generation-steps">
              {generationStages.map((stage, index) => (
                <span key={stage} className={index < generationStage ? "is-done" : index === generationStage ? "is-active" : ""}>
                  {index < generationStage ? <Check size={14} /> : index === generationStage ? <LoaderCircle size={14} /> : <i />}
                  {stage}
                </span>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
