"use client";

import { useCallback, useEffect, useState } from "react";
import { BadgeCheck, LoaderCircle, Plus, Save, Trash2 } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { courseBuilderRequest } from "./course-builder-client";
import type {
  CourseAttestationAuthoredQuestion,
  CourseAttestationDefinition,
} from "@/modules/course-attestations/domain";

function identifier(prefix: "q" | "o") {
  return `${prefix}_${globalThis.crypto.randomUUID().replaceAll("-", "")}`;
}

function emptyQuestion(): CourseAttestationAuthoredQuestion {
  const firstOptionId = identifier("o");
  return {
    id: identifier("q"),
    prompt: "",
    explanation: "",
    correctOptionId: firstOptionId,
    options: [
      { id: firstOptionId, label: "" },
      { id: identifier("o"), label: "" },
    ],
  };
}

function emptyDefinition(): CourseAttestationDefinition {
  return {
    version: 0,
    title: "Итоговая аттестация",
    description: "",
    passingScorePercent: 80,
    questions: [emptyQuestion()],
  };
}

export function CourseAttestationEditor({ courseId }: { courseId: string }) {
  const [definition, setDefinition] =
    useState<CourseAttestationDefinition | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = await courseBuilderRequest<{
        attestation: CourseAttestationDefinition | null;
      }>(`/api/v2/courses/${encodeURIComponent(courseId)}/attestation`);
      setDefinition(payload.attestation ?? emptyDefinition());
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Не удалось загрузить аттестацию.",
      );
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    void load();
  }, [load]);

  function changeQuestion(
    questionId: string,
    update: (
      question: CourseAttestationAuthoredQuestion,
    ) => CourseAttestationAuthoredQuestion,
  ) {
    setSaved(false);
    setDefinition((current) =>
      current
        ? {
            ...current,
            questions: current.questions.map((question) =>
              question.id === questionId ? update(question) : question,
            ),
          }
        : current,
    );
  }

  async function saveDefinition() {
    if (!definition || saving) return;
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const payload = await courseBuilderRequest<{
        attestation: CourseAttestationDefinition;
      }>(`/api/v2/courses/${encodeURIComponent(courseId)}/attestation`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: definition.title,
          description: definition.description,
          passingScorePercent: definition.passingScorePercent,
          questions: definition.questions,
        }),
      });
      setDefinition(payload.attestation);
      setSaved(true);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Не удалось сохранить аттестацию.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="workspace-surface flex items-center gap-3" role="status">
        <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden="true" />
        Загружаем аттестацию…
      </div>
    );
  }

  if (!definition) {
    return (
      <Alert tone="error" title="Не удалось загрузить аттестацию">
        <Button variant="secondary" onClick={() => void load()}>
          Повторить
        </Button>
      </Alert>
    );
  }

  return (
    <section
      className="workspace-surface space-y-5"
      aria-labelledby="authored-attestation-heading"
    >
      <div className="workspace-panel-heading">
        <div>
          <p className="workspace-eyebrow">Проверка знаний педагога</p>
          <h2 id="authored-attestation-heading">Аттестация</h2>
        </div>
        {definition.version > 0 ? (
          <span className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-700">
            <BadgeCheck className="h-4 w-4" aria-hidden="true" />
            Версия {definition.version}
          </span>
        ) : null}
      </div>

      <p className="workspace-surface-note">
        Каждый сохранённый вариант становится новой версией теста. Укажите
        правильные ответы: слушатель увидит их только после завершения попытки.
      </p>

      {error ? <Alert tone="error" title={error} /> : null}

      <div className="grid gap-4 md:grid-cols-[1fr_12rem]">
        <label className="grid gap-2 text-sm font-semibold">
          Название
          <Input
            value={definition.title}
            disabled={saving}
            maxLength={240}
            onChange={(event) => {
              setSaved(false);
              setDefinition({ ...definition, title: event.target.value });
            }}
          />
        </label>
        <label className="grid gap-2 text-sm font-semibold">
          Проходной балл, %
          <Input
            type="number"
            min={1}
            max={100}
            value={definition.passingScorePercent}
            disabled={saving}
            onChange={(event) => {
              setSaved(false);
              setDefinition({
                ...definition,
                passingScorePercent: Number(event.target.value),
              });
            }}
          />
        </label>
      </div>

      <label className="grid gap-2 text-sm font-semibold">
        Описание
        <textarea
          className="field-input min-h-20 resize-y"
          value={definition.description}
          disabled={saving}
          maxLength={2000}
          onChange={(event) => {
            setSaved(false);
            setDefinition({ ...definition, description: event.target.value });
          }}
        />
      </label>

      <div className="space-y-4">
        {definition.questions.map((question, questionIndex) => (
          <article
            key={question.id}
            className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-bold">Вопрос {questionIndex + 1}</h3>
              <Button
                type="button"
                variant="ghost"
                className="product-btn-danger"
                disabled={saving || definition.questions.length === 1}
                aria-label={`Удалить вопрос ${questionIndex + 1}`}
                onClick={() => {
                  setSaved(false);
                  setDefinition({
                    ...definition,
                    questions: definition.questions.filter(
                      (item) => item.id !== question.id,
                    ),
                  });
                }}
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                Удалить
              </Button>
            </div>

            <label className="mt-3 grid gap-2 text-sm font-semibold">
              Формулировка
              <textarea
                required
                className="field-input min-h-20 resize-y"
                value={question.prompt}
                disabled={saving}
                maxLength={2000}
                onChange={(event) =>
                  changeQuestion(question.id, (current) => ({
                    ...current,
                    prompt: event.target.value,
                  }))
                }
              />
            </label>

            <fieldset className="mt-4 space-y-3">
              <legend className="text-sm font-semibold">
                Варианты ответа — отметьте правильный
              </legend>
              {question.options.map((option, optionIndex) => (
                <div key={option.id} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name={`correct-${question.id}`}
                    checked={question.correctOptionId === option.id}
                    disabled={saving}
                    aria-label={`Вариант ${optionIndex + 1} правильный`}
                    onChange={() =>
                      changeQuestion(question.id, (current) => ({
                        ...current,
                        correctOptionId: option.id,
                      }))
                    }
                  />
                  <Input
                    value={option.label}
                    disabled={saving}
                    maxLength={500}
                    placeholder={`Вариант ${optionIndex + 1}`}
                    onChange={(event) =>
                      changeQuestion(question.id, (current) => ({
                        ...current,
                        options: current.options.map((item) =>
                          item.id === option.id
                            ? { ...item, label: event.target.value }
                            : item,
                        ),
                      }))
                    }
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={saving || question.options.length === 2}
                    aria-label={`Удалить вариант ${optionIndex + 1}`}
                    onClick={() =>
                      changeQuestion(question.id, (current) => {
                        const options = current.options.filter(
                          (item) => item.id !== option.id,
                        );
                        return {
                          ...current,
                          options,
                          correctOptionId:
                            current.correctOptionId === option.id
                              ? options[0]!.id
                              : current.correctOptionId,
                        };
                      })
                    }
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="secondary"
                disabled={saving || question.options.length === 8}
                onClick={() =>
                  changeQuestion(question.id, (current) => ({
                    ...current,
                    options: [
                      ...current.options,
                      { id: identifier("o"), label: "" },
                    ],
                  }))
                }
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                Добавить вариант
              </Button>
            </fieldset>

            <label className="mt-4 grid gap-2 text-sm font-semibold">
              Пояснение после попытки
              <textarea
                className="field-input min-h-16 resize-y"
                value={question.explanation}
                disabled={saving}
                maxLength={2000}
                onChange={(event) =>
                  changeQuestion(question.id, (current) => ({
                    ...current,
                    explanation: event.target.value,
                  }))
                }
              />
            </label>
          </article>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button
          type="button"
          variant="secondary"
          disabled={saving || definition.questions.length === 50}
          onClick={() => {
            setSaved(false);
            setDefinition({
              ...definition,
              questions: [...definition.questions, emptyQuestion()],
            });
          }}
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Добавить вопрос
        </Button>
        <div className="flex items-center gap-3">
          {saved ? (
            <span
              className="text-sm font-semibold text-emerald-700"
              role="status"
            >
              Аттестация сохранена
            </span>
          ) : null}
          <Button disabled={saving} onClick={() => void saveDefinition()}>
            {saving ? (
              <LoaderCircle
                className="h-4 w-4 animate-spin"
                aria-hidden="true"
              />
            ) : (
              <Save className="h-4 w-4" aria-hidden="true" />
            )}
            {saving ? "Сохраняем…" : "Сохранить аттестацию"}
          </Button>
        </div>
      </div>
    </section>
  );
}
