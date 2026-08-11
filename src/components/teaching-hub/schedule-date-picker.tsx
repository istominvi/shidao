"use client";

import { ArrowLeft, ArrowRight, CalendarDays, ChevronDown } from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import {
  addLocalDays,
  atLocalNoon,
  formatLocalDateValue,
  formatScheduleMonthTitle,
  formatSchedulePeriodAriaLabel,
  formatSchedulePeriodLabel,
  schedulePeriodLocalRange,
  shiftSchedulePeriod,
  startOfLocalWeek,
  type SchedulePeriod,
} from "@/components/teaching-hub/schedule-period";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { classNames } from "@/lib/ui/classnames";

type ScheduleDatePickerProps = {
  selectedDate: Date;
  period: SchedulePeriod;
  onDateChange: (value: Date) => void;
  onPeriodChange: (value: SchedulePeriod) => void;
};

const periodItems: Array<{ value: SchedulePeriod; label: string }> = [
  { value: "day", label: "День" },
  { value: "week", label: "Неделя" },
  { value: "month", label: "Месяц" },
];

const periodNavigationLabels: Record<
  SchedulePeriod,
  { previous: string; next: string }
> = {
  day: { previous: "Предыдущий день", next: "Следующий день" },
  week: { previous: "Предыдущая неделя", next: "Следующая неделя" },
  month: { previous: "Предыдущий месяц", next: "Следующий месяц" },
};

const weekdays = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

function sameLocalDate(left: Date, right: Date) {
  return formatLocalDateValue(left) === formatLocalDateValue(right);
}

function addLocalMonths(value: Date, amount: number) {
  const targetMonth = new Date(
    value.getFullYear(),
    value.getMonth() + amount,
    1,
    12,
  );
  const targetMonthEnd = new Date(
    targetMonth.getFullYear(),
    targetMonth.getMonth() + 1,
    0,
    12,
  );
  targetMonth.setDate(Math.min(value.getDate(), targetMonthEnd.getDate()));
  return targetMonth;
}

function calendarMonthDates(value: Date) {
  const monthStart = new Date(value.getFullYear(), value.getMonth(), 1, 12);
  const gridStart = atLocalNoon(startOfLocalWeek(monthStart));
  return Array.from({ length: 42 }, (_, index) =>
    addLocalDays(gridStart, index),
  );
}

function dateIsInPeriod(
  value: Date,
  selectedDate: Date,
  period: SchedulePeriod,
) {
  const range = schedulePeriodLocalRange(selectedDate, period);
  const timestamp = value.getTime();
  return timestamp >= range.from.getTime() && timestamp < range.to.getTime();
}

export function ScheduleDatePicker({
  selectedDate,
  period,
  onDateChange,
  onPeriodChange,
}: ScheduleDatePickerProps) {
  const [open, setOpen] = useState(false);
  const [calendarCursorDate, setCalendarCursorDate] = useState(() =>
    atLocalNoon(selectedDate),
  );
  const [focusedDate, setFocusedDate] = useState(() =>
    atLocalNoon(selectedDate),
  );
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const dayRefs = useRef(new Map<string, HTMLButtonElement>());
  const generatedId = useId().replaceAll(":", "");
  const panelId = `schedule-date-popover-${generatedId}`;
  const monthHeadingId = `schedule-date-month-${generatedId}`;
  const instructionsId = `schedule-date-instructions-${generatedId}`;

  const visibleLabel = formatSchedulePeriodLabel(selectedDate, period);
  const accessiblePeriodLabel = formatSchedulePeriodAriaLabel(
    selectedDate,
    period,
  );
  const monthDates = useMemo(
    () => calendarMonthDates(calendarCursorDate),
    [calendarCursorDate],
  );

  const closePopover = useCallback((restoreFocus = false) => {
    setOpen(false);
    if (restoreFocus) {
      window.requestAnimationFrame(() => triggerRef.current?.focus());
    }
  }, []);

  useEffect(() => {
    if (open) return;
    const normalizedDate = atLocalNoon(selectedDate);
    setCalendarCursorDate(normalizedDate);
    setFocusedDate(normalizedDate);
  }, [open, selectedDate]);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      if (rootRef.current?.contains(event.target as Node)) return;
      closePopover();
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        closePopover(true);
        return;
      }
      if (event.key !== "Tab") return;

      const panel = panelRef.current;
      if (!panel) return;
      const focusable = Array.from(
        panel.querySelectorAll<HTMLElement>(
          "button:not([disabled]):not([tabindex='-1']), [tabindex]:not([tabindex='-1'])",
        ),
      ).filter((element) => element.offsetParent !== null);
      if (focusable.length === 0) {
        event.preventDefault();
        panel.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (
        event.shiftKey &&
        (document.activeElement === first ||
          !panel.contains(document.activeElement))
      ) {
        event.preventDefault();
        last.focus();
      } else if (
        !event.shiftKey &&
        (document.activeElement === last ||
          !panel.contains(document.activeElement))
      ) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [closePopover, open]);

  useEffect(() => {
    if (!open) return;
    const animationFrame = window.requestAnimationFrame(() => {
      dayRefs.current.get(formatLocalDateValue(focusedDate))?.focus();
    });
    return () => window.cancelAnimationFrame(animationFrame);
  }, [calendarCursorDate, focusedDate, open]);

  function openPopover() {
    const normalizedDate = atLocalNoon(selectedDate);
    setCalendarCursorDate(normalizedDate);
    setFocusedDate(normalizedDate);
    setOpen(true);
  }

  function selectDate(value: Date) {
    const normalizedDate = atLocalNoon(value);
    setCalendarCursorDate(normalizedDate);
    setFocusedDate(normalizedDate);
    onDateChange(normalizedDate);
    closePopover(true);
  }

  function moveCalendarMonth(direction: -1 | 1) {
    const nextDate = addLocalMonths(calendarCursorDate, direction);
    setCalendarCursorDate(nextDate);
    setFocusedDate(nextDate);
  }

  function moveDayFocus(value: Date) {
    const normalizedDate = atLocalNoon(value);
    setFocusedDate(normalizedDate);
    setCalendarCursorDate(normalizedDate);
  }

  function handleDayKeyDown(
    event: ReactKeyboardEvent<HTMLButtonElement>,
    value: Date,
  ) {
    let nextDate: Date | null = null;
    if (event.key === "ArrowLeft") {
      nextDate = addLocalDays(value, event.shiftKey ? -7 : -1);
    } else if (event.key === "ArrowRight") {
      nextDate = addLocalDays(value, event.shiftKey ? 7 : 1);
    } else if (event.key === "ArrowUp") {
      nextDate = addLocalDays(value, -7);
    } else if (event.key === "ArrowDown") {
      nextDate = addLocalDays(value, 7);
    } else if (event.key === "Home") {
      nextDate = atLocalNoon(startOfLocalWeek(value));
    } else if (event.key === "End") {
      nextDate = addLocalDays(startOfLocalWeek(value), 6);
    } else if (event.key === "PageUp") {
      nextDate = addLocalMonths(value, event.shiftKey ? -12 : -1);
    } else if (event.key === "PageDown") {
      nextDate = addLocalMonths(value, event.shiftKey ? 12 : 1);
    }

    if (!nextDate) return;
    event.preventDefault();
    moveDayFocus(nextDate);
  }

  function shiftVisiblePeriod(direction: -1 | 1) {
    closePopover();
    onDateChange(shiftSchedulePeriod(selectedDate, period, direction));
  }

  return (
    <div ref={rootRef} className="teaching-date-picker">
      <div className="teaching-date-navigator">
        <button
          type="button"
          aria-label={periodNavigationLabels[period].previous}
          title={periodNavigationLabels[period].previous}
          onClick={() => shiftVisiblePeriod(-1)}
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        </button>
        <button
          ref={triggerRef}
          type="button"
          className="teaching-date-trigger"
          aria-label={`Выбранный период: ${accessiblePeriodLabel}. Открыть календарь`}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => (open ? closePopover() : openPopover())}
        >
          <CalendarDays
            className="teaching-date-trigger-icon h-4 w-4"
            aria-hidden="true"
          />
          <span aria-live="polite" aria-atomic="true">
            {visibleLabel}
          </span>
          <ChevronDown
            className="teaching-date-trigger-chevron h-4 w-4"
            aria-hidden="true"
          />
        </button>
        <button
          type="button"
          aria-label={periodNavigationLabels[period].next}
          title={periodNavigationLabels[period].next}
          onClick={() => shiftVisiblePeriod(1)}
        >
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      {open ? (
        <div
          ref={panelRef}
          id={panelId}
          className="teaching-date-popover"
          role="dialog"
          aria-modal="true"
          aria-labelledby={monthHeadingId}
          aria-describedby={instructionsId}
          tabIndex={-1}
        >
          <p id={instructionsId} className="sr-only">
            Используйте стрелки для перехода по дням, Shift со стрелкой — по
            неделям, Page Up и Page Down — по месяцам.
          </p>
          <p className="sr-only" aria-live="polite" aria-atomic="true">
            Выбранный период: {accessiblePeriodLabel}
          </p>

          <div className="teaching-date-popover-heading">
            <button
              type="button"
              aria-label="Предыдущий месяц календаря"
              onClick={() => moveCalendarMonth(-1)}
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            </button>
            <h2 id={monthHeadingId} aria-live="polite">
              {formatScheduleMonthTitle(calendarCursorDate)}
            </h2>
            <button
              type="button"
              aria-label="Следующий месяц календаря"
              onClick={() => moveCalendarMonth(1)}
            >
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          <div className="teaching-date-weekdays" aria-hidden="true">
            {weekdays.map((weekday) => (
              <span key={weekday}>{weekday}</span>
            ))}
          </div>

          <div
            className="teaching-date-grid"
            role="grid"
            aria-label={`Календарь: ${formatScheduleMonthTitle(calendarCursorDate)}`}
            aria-multiselectable={period !== "day"}
          >
            {Array.from({ length: 6 }, (_, rowIndex) => (
              <div className="teaching-date-grid-row" role="row" key={rowIndex}>
                {monthDates
                  .slice(rowIndex * 7, rowIndex * 7 + 7)
                  .map((date) => {
                    const dateValue = formatLocalDateValue(date);
                    const isSelected = sameLocalDate(date, selectedDate);
                    const isInPeriod = dateIsInPeriod(
                      date,
                      selectedDate,
                      period,
                    );
                    const isToday = sameLocalDate(date, new Date());
                    const isOutsideMonth =
                      date.getMonth() !== calendarCursorDate.getMonth();
                    const isFocused = sameLocalDate(date, focusedDate);
                    const fullDateLabel = formatSchedulePeriodAriaLabel(
                      date,
                      "day",
                    );

                    return (
                      <span
                        className="teaching-date-grid-cell"
                        role="gridcell"
                        aria-selected={isInPeriod}
                        key={dateValue}
                      >
                        <button
                          ref={(node) => {
                            if (node) dayRefs.current.set(dateValue, node);
                            else dayRefs.current.delete(dateValue);
                          }}
                          type="button"
                          className={classNames(
                            isToday && "is-today",
                            isSelected && "is-selected",
                            isInPeriod && "is-in-period",
                            isOutsideMonth && "is-outside",
                          )}
                          data-date={dateValue}
                          aria-label={
                            isSelected
                              ? `${fullDateLabel}, выбранная дата`
                              : fullDateLabel
                          }
                          aria-current={isToday ? "date" : undefined}
                          tabIndex={isFocused ? 0 : -1}
                          onFocus={() => setFocusedDate(date)}
                          onKeyDown={(event) => handleDayKeyDown(event, date)}
                          onClick={() => selectDate(date)}
                        >
                          {date.getDate()}
                        </button>
                      </span>
                    );
                  })}
              </div>
            ))}
          </div>

          <div className="teaching-date-popover-footer">
            <button
              type="button"
              className="teaching-date-today"
              onClick={() => selectDate(new Date())}
            >
              Сегодня
            </button>
            <SegmentedControl
              className="teaching-date-period-switch"
              items={periodItems}
              value={period}
              onChange={onPeriodChange}
              ariaLabel="Период расписания"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
