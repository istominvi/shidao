"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Mic, SendHorizontal, Trash2 } from "lucide-react";
import { classNames } from "@/lib/ui/classnames";
import type { LessonGroupChatReadModel } from "@/lib/server/lesson-group-chat-service";

type LessonGroupChatPanelProps = {
  scheduledLessonId: string;
  initialModel?: LessonGroupChatReadModel | null;
  canWrite?: boolean;
};

type RecorderState = "idle" | "requesting" | "recording" | "preview" | "uploading";

const MAX_DURATION_SECONDS = 120;

function formatMessageTime(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatDuration(durationMs: number | null) {
  if (durationMs === null) return "";
  const totalSeconds = Math.floor(durationMs / 1000);
  const minutes = String(Math.floor(totalSeconds / 60));
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function chooseRecorderMimeType() {
  if (typeof MediaRecorder === "undefined") return "";
  const preferred = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
  for (const candidate of preferred) {
    if (MediaRecorder.isTypeSupported(candidate)) return candidate;
  }
  return "";
}

function getAuthorDisplayName(message: LessonGroupChatReadModel["messages"][number]) {
  const trimmedName = message.authorName.trim();
  if (trimmedName.length > 0) return trimmedName;

  const fallbackLogin = message.authorLogin.trim();
  if (fallbackLogin.length > 0 && !fallbackLogin.startsWith("@")) return fallbackLogin;
  if (fallbackLogin.length > 0) return fallbackLogin.slice(1);

  return "Ученик";
}

export function LessonGroupChatPanel({
  scheduledLessonId,
  initialModel,
  canWrite,
}: LessonGroupChatPanelProps) {
  const [model, setModel] = useState<LessonGroupChatReadModel | null>(initialModel ?? null);
  const [body, setBody] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recorderState, setRecorderState] = useState<RecorderState>("idle");
  const [recordingMs, setRecordingMs] = useState(0);
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewDurationMs, setPreviewDurationMs] = useState<number | null>(null);
  const [audioUrls, setAudioUrls] = useState<Record<string, string>>({});
  const [audioLoadErrors, setAudioLoadErrors] = useState<Record<string, string>>({});

  const viewportRef = useRef<HTMLDivElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const timerRef = useRef<number | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const resolvedCanWrite = canWrite ?? model?.canWrite ?? false;
  const canSendText = body.trim().length > 0;
  const canSendAny = canSendText || recorderState === "preview";

  const cleanupRecording = () => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    mediaRecorderRef.current = null;
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
  };

  const refreshMessages = useCallback(async () => {
    const response = await fetch(`/api/lessons/${scheduledLessonId}/group-chat`, {
      method: "GET",
      cache: "no-store",
    });
    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      throw new Error(data.error ?? "Не удалось загрузить чат урока.");
    }
    const data = (await response.json()) as LessonGroupChatReadModel;
    setModel(data);
    setError(null);
  }, [scheduledLessonId]);

  useEffect(() => {
    setModel(initialModel ?? null);
  }, [initialModel]);

  useEffect(() => {
    void refreshMessages().catch((apiError) => {
      setError(apiError instanceof Error ? apiError.message : "Не удалось загрузить чат урока.");
    });
    const timer = window.setInterval(() => {
      void refreshMessages().catch((apiError) => {
        setError(apiError instanceof Error ? apiError.message : "Не удалось загрузить чат урока.");
      });
    }, 2800);

    return () => window.clearInterval(timer);
  }, [refreshMessages]);

  useEffect(() => {
    if (!viewportRef.current) return;
    viewportRef.current.scrollTop = viewportRef.current.scrollHeight;
  }, [model?.messages]);

  useEffect(() => {
    return () => {
      cleanupRecording();
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      Object.values(audioUrls).forEach((url) => URL.revokeObjectURL(url));
    };
  }, [audioUrls, previewUrl]);

  const onSend = async () => {
    if (!resolvedCanWrite || pending || !canSendText) return;
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/lessons/${scheduledLessonId}/group-chat`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ body }),
      });

      const data = (await response.json().catch(() => ({}))) as
        | LessonGroupChatReadModel
        | { error?: string };
      if (!response.ok) {
        throw new Error("error" in data ? data.error : "Не удалось отправить сообщение.");
      }

      setModel(data as LessonGroupChatReadModel);
      setBody("");
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    } catch (apiError) {
      setError(apiError instanceof Error ? apiError.message : "Не удалось отправить сообщение.");
    } finally {
      setPending(false);
    }
  };

  const requestSignedUrl = useCallback(
    async (attachmentId: string) => {
      if (audioUrls[attachmentId] || audioLoadErrors[attachmentId]) return;
      const response = await fetch(
        `/api/communication/attachments/${attachmentId}/signed-url?scheduledLessonId=${encodeURIComponent(scheduledLessonId)}`,
        { cache: "no-store" },
      );
      const data = (await response.json().catch(() => ({}))) as { signedUrl?: string; error?: string };
      if (!response.ok || !data.signedUrl) {
        throw new Error(data.error ?? "Не удалось получить ссылку на аудио.");
      }
      setAudioUrls((prev) => ({ ...prev, [attachmentId]: data.signedUrl! }));
    },
    [audioLoadErrors, audioUrls, scheduledLessonId],
  );

  useEffect(() => {
    const voiceAttachments =
      model?.messages.flatMap((message) => message.attachments.filter((item) => item.kind === "voice")) ?? [];
    for (const attachment of voiceAttachments) {
      if (audioUrls[attachment.id] || audioLoadErrors[attachment.id]) continue;
      void requestSignedUrl(attachment.id).catch((apiError) => {
        setAudioLoadErrors((prev) => ({
          ...prev,
          [attachment.id]: apiError instanceof Error ? apiError.message : "Не удалось загрузить аудио.",
        }));
      });
    }
  }, [audioLoadErrors, audioUrls, model?.messages, requestSignedUrl]);

  const startRecording = async () => {
    if (!resolvedCanWrite || recorderState === "recording" || recorderState === "requesting") return;

    if (typeof window === "undefined" || typeof MediaRecorder === "undefined") {
      setError("Ваш браузер не поддерживает запись голосовых сообщений.");
      return;
    }

    setError(null);
    setRecorderState("requesting");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      const mimeType = chooseRecorderMimeType();
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];
      setRecordingMs(0);

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        cleanupRecording();
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        if (blob.size === 0) {
          setRecorderState("idle");
          setError("Не удалось записать голосовое сообщение.");
          return;
        }
        const url = URL.createObjectURL(blob);
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPreviewBlob(blob);
        setPreviewUrl(url);
        setPreviewDurationMs(recordingMs);
        setRecorderState("preview");
      };

      recorder.start();
      setRecorderState("recording");
      timerRef.current = window.setInterval(() => {
        setRecordingMs((prev) => {
          const next = prev + 1000;
          if (next >= MAX_DURATION_SECONDS * 1000) {
            mediaRecorderRef.current?.stop();
          }
          return next;
        });
      }, 1000);
    } catch {
      cleanupRecording();
      setRecorderState("idle");
      setError("Не удалось получить доступ к микрофону. Проверьте разрешения браузера.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
    }
  };

  const cancelRecording = () => {
    cleanupRecording();
    setRecorderState("idle");
    setRecordingMs(0);
  };

  const clearPreview = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setPreviewBlob(null);
    setPreviewDurationMs(null);
    setRecorderState("idle");
  };

  const sendVoice = async () => {
    if (!previewBlob || !resolvedCanWrite || pending) return;
    setPending(true);
    setRecorderState("uploading");
    setError(null);
    try {
      const formData = new FormData();
      formData.set("audio", previewBlob, `voice.${previewBlob.type.split("/")[1] || "webm"}`);
      if (previewDurationMs !== null) {
        formData.set("durationMs", String(previewDurationMs));
      }
      const response = await fetch(`/api/lessons/${scheduledLessonId}/voice-message`, {
        method: "POST",
        body: formData,
      });
      const data = (await response.json().catch(() => ({}))) as LessonGroupChatReadModel | { error?: string };
      if (!response.ok) {
        throw new Error("error" in data ? data.error : "Не удалось отправить голосовое сообщение.");
      }
      setModel(data as LessonGroupChatReadModel);
      clearPreview();
    } catch (apiError) {
      setRecorderState("preview");
      setError(apiError instanceof Error ? apiError.message : "Не удалось отправить голосовое сообщение.");
    } finally {
      setPending(false);
    }
  };

  const recorderStatusText = useMemo(() => {
    if (recorderState === "requesting") return "Запрашиваем доступ к микрофону...";
    if (recorderState === "uploading") return "Отправляем голосовое сообщение...";
    return null;
  }, [recorderState]);

  return (
    <div className="space-y-3">
      <div
        ref={viewportRef}
        className="max-h-[24rem] space-y-3 overflow-y-auto rounded-2xl border border-neutral-200/80 bg-neutral-50 p-3"
      >
        {!model || model.messages.length === 0 ? (
          <p className="px-1 text-sm text-neutral-600">Пока нет сообщений. Начните обсуждение урока.</p>
        ) : (
          model.messages.map((message) => (
            <article
              key={message.id}
              className={classNames("flex", message.isOwn ? "justify-end" : "justify-start")}
            >
              <div className="w-full max-w-[85%] md:max-w-[70%]">
                {!message.isOwn ? (
                  <p className="mb-1 px-1 text-[11px] font-medium text-neutral-500">{getAuthorDisplayName(message)}</p>
                ) : null}
                <div
                  className={classNames(
                    "rounded-2xl px-3 py-2 text-sm shadow-sm",
                    message.isOwn ? "bg-sky-100/70 text-neutral-900" : "bg-white text-neutral-900",
                  )}
                >
                  {message.body ? <p className="whitespace-pre-wrap break-words">{message.body}</p> : null}
                  {message.attachments.map((attachment) =>
                    attachment.kind === "voice" ? (
                      <div key={attachment.id} className={classNames(message.body ? "mt-2" : "", "space-y-1")}>
                        <div className="flex items-center gap-2 text-[11px] text-neutral-500">
                          <span>Голосовое сообщение</span>
                          {attachment.durationMs !== null ? <span>{formatDuration(attachment.durationMs)}</span> : null}
                        </div>
                        {audioLoadErrors[attachment.id] ? (
                          <p className="text-xs text-rose-600">Не удалось загрузить аудио.</p>
                        ) : (
                          <audio
                            controls
                            preload="none"
                            className="w-full max-w-[20rem]"
                            src={audioUrls[attachment.id] ?? undefined}
                          />
                        )}
                      </div>
                    ) : null,
                  )}
                  <p className="mt-1 text-right text-[11px] text-neutral-500">{formatMessageTime(message.createdAt)}</p>
                </div>
              </div>
            </article>
          ))
        )}
      </div>

      {error ? <p className="px-1 text-xs text-rose-700">{error}</p> : null}
      {recorderStatusText ? <p className="px-1 text-xs text-neutral-500">{recorderStatusText}</p> : null}

      {resolvedCanWrite ? (
        recorderState === "recording" ? (
          <div className="flex items-center justify-between gap-2 rounded-2xl border border-neutral-200 bg-white px-3 py-2">
            <div className="flex items-center gap-2 text-sm text-neutral-700">
              <span aria-hidden className="inline-block size-2 rounded-full bg-rose-500" />
              <span>Идёт запись</span>
              <span className="text-neutral-500">{formatDuration(recordingMs)}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="rounded-xl px-3 py-1.5 text-sm text-neutral-600 hover:bg-neutral-100"
                onClick={cancelRecording}
              >
                Отменить
              </button>
              <button
                type="button"
                className="rounded-xl bg-neutral-900 px-3 py-1.5 text-sm text-white hover:bg-neutral-800"
                onClick={stopRecording}
              >
                Остановить
              </button>
            </div>
          </div>
        ) : recorderState === "preview" && previewUrl ? (
          <div className="space-y-2 rounded-2xl border border-neutral-200 bg-white p-3">
            <div className="flex items-center justify-between gap-2 text-sm text-neutral-700">
              <span>Голосовое сообщение готово</span>
              {previewDurationMs !== null ? <span className="text-xs text-neutral-500">{formatDuration(previewDurationMs)}</span> : null}
            </div>
            <audio controls preload="metadata" className="w-full" src={previewUrl} />
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-xl px-3 py-1.5 text-sm text-neutral-600 hover:bg-neutral-100"
                onClick={clearPreview}
              >
                <Trash2 className="size-4" aria-hidden />
                Удалить
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-xl bg-neutral-900 px-3 py-1.5 text-sm text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={() => void sendVoice()}
                disabled={pending}
              >
                <SendHorizontal className="size-4" aria-hidden />
                Отправить
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-end gap-2 rounded-2xl border border-neutral-200 bg-white p-2">
            <textarea
              ref={textareaRef}
              rows={1}
              value={body}
              onChange={(event) => setBody(event.target.value)}
              onInput={(event) => {
                const target = event.currentTarget;
                target.style.height = "auto";
                target.style.height = `${Math.min(target.scrollHeight, 104)}px`;
              }}
              className="max-h-[104px] min-h-[38px] flex-1 resize-none bg-transparent px-2 py-2 text-sm text-neutral-900 outline-none placeholder:text-neutral-400"
              placeholder="Сообщение в чат урока"
              maxLength={2000}
            />
            <button
              type="button"
              className="inline-flex size-9 items-center justify-center rounded-xl text-neutral-600 transition hover:bg-neutral-100 disabled:opacity-50"
              onClick={() => void startRecording()}
              disabled={pending || recorderState === "uploading"}
              aria-label="Записать голосовое"
            >
              <Mic className="size-4" aria-hidden />
            </button>
            <button
              type="button"
              className="inline-flex size-9 items-center justify-center rounded-xl bg-neutral-900 text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => void onSend()}
              disabled={pending || recorderState === "uploading" || !canSendAny}
              aria-label="Отправить сообщение"
            >
              <SendHorizontal className="size-4" aria-hidden />
            </button>
          </div>
        )
      ) : (
        <p className="px-1 text-xs text-neutral-600">
          Родительский просмотр: писать в чат может преподаватель и ученик.
        </p>
      )}
    </div>
  );
}
