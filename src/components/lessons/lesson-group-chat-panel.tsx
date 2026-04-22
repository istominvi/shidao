"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { productButtonClassName } from "@/components/ui/button";
import { classNames } from "@/lib/ui/classnames";
import type { LessonGroupChatReadModel } from "@/lib/server/lesson-group-chat-service";

type LessonGroupChatPanelProps = {
  scheduledLessonId: string;
  initialModel?: LessonGroupChatReadModel | null;
  canWrite?: boolean;
};

type RecorderState = "idle" | "requesting" | "recording" | "preview" | "uploading" | "error";

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
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
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

  const viewportRef = useRef<HTMLDivElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const timerRef = useRef<number | null>(null);

  const resolvedCanWrite = canWrite ?? model?.canWrite ?? false;

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
    if (!resolvedCanWrite || pending) return;
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
    } catch (apiError) {
      setError(apiError instanceof Error ? apiError.message : "Не удалось отправить сообщение.");
    } finally {
      setPending(false);
    }
  };

  const requestSignedUrl = useCallback(
    async (attachmentId: string) => {
      if (audioUrls[attachmentId]) return;
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
    [audioUrls, scheduledLessonId],
  );

  useEffect(() => {
    const voiceAttachments =
      model?.messages.flatMap((message) => message.attachments.filter((item) => item.kind === "voice")) ??
      [];
    for (const attachment of voiceAttachments) {
      if (audioUrls[attachment.id]) continue;
      void requestSignedUrl(attachment.id).catch(() => undefined);
    }
  }, [audioUrls, model?.messages, requestSignedUrl]);

  const startRecording = async () => {
    if (!resolvedCanWrite || recorderState === "recording" || recorderState === "requesting") return;

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
          setRecorderState("error");
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
      setRecorderState("error");
      setError("Не удалось получить доступ к микрофону. Разрешите доступ к микрофону в браузере.");
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
    if (recorderState === "recording") return `Запись ${formatDuration(recordingMs)}`;
    if (recorderState === "requesting") return "Запрашиваем доступ к микрофону...";
    if (recorderState === "uploading") return "Отправляем голосовое сообщение...";
    return null;
  }, [recorderState, recordingMs]);

  return (
    <div className="space-y-3">
      <div
        ref={viewportRef}
        className="max-h-[24rem] space-y-2 overflow-y-auto rounded-2xl border border-neutral-200 bg-neutral-50 p-3"
      >
        {!model || model.messages.length === 0 ? (
          <p className="text-sm text-neutral-600">
            Пока нет сообщений. Напишите первое сообщение для группы.
          </p>
        ) : (
          model.messages.map((message) => (
            <article
              key={message.id}
              className={classNames(
                "max-w-[85%] rounded-2xl px-3 py-2 text-sm",
                message.isOwn
                  ? "ml-auto border border-sky-200 bg-sky-50 text-sky-950"
                  : "mr-auto border border-neutral-200 bg-white text-neutral-900",
              )}
            >
              <p className="text-xs font-semibold text-neutral-700">
                @{message.authorLogin} — {message.authorName}
              </p>
              {message.body ? <p className="mt-1 whitespace-pre-wrap break-words">{message.body}</p> : null}
              {message.attachments.map((attachment) =>
                attachment.kind === "voice" ? (
                  <div key={attachment.id} className="mt-2 rounded-xl border border-neutral-200 bg-white/80 p-2">
                    <audio
                      controls
                      preload="none"
                      className="w-full"
                      src={audioUrls[attachment.id] ?? undefined}
                    />
                    {attachment.durationMs !== null ? (
                      <p className="mt-1 text-[11px] text-neutral-500">{formatDuration(attachment.durationMs)}</p>
                    ) : null}
                  </div>
                ) : null,
              )}
              <p className="mt-1 text-right text-[11px] text-neutral-500">
                {formatMessageTime(message.createdAt)}
              </p>
            </article>
          ))
        )}
      </div>

      {error ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {error}
        </p>
      ) : null}

      {resolvedCanWrite ? (
        <div className="space-y-2">
          <textarea
            rows={3}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900"
            placeholder="Сообщение в общий чат урока"
            maxLength={2000}
          />

          {recorderStatusText ? (
            <div className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-700">
              {recorderStatusText}
            </div>
          ) : null}

          {recorderState === "recording" ? (
            <div className="flex flex-wrap gap-2">
              <button type="button" className={productButtonClassName("ghost", "text-sm")} onClick={cancelRecording}>
                Отменить
              </button>
              <button type="button" className={productButtonClassName("secondary", "text-sm")} onClick={stopRecording}>
                Остановить
              </button>
            </div>
          ) : null}

          {recorderState === "preview" && previewUrl ? (
            <div className="space-y-2 rounded-xl border border-neutral-200 bg-neutral-50 p-3">
              <audio controls preload="metadata" className="w-full" src={previewUrl} />
              <div className="flex flex-wrap gap-2">
                <button type="button" className={productButtonClassName("ghost", "text-sm")} onClick={clearPreview}>
                  Удалить
                </button>
                <button type="button" className={productButtonClassName("secondary", "text-sm")} onClick={() => void sendVoice()}>
                  Отправить голос
                </button>
              </div>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className={productButtonClassName("ghost", "text-sm")}
              onClick={() => void startRecording()}
              disabled={pending || recorderState === "recording" || recorderState === "uploading"}
            >
              🎤
            </button>
            <button
              type="button"
              className={productButtonClassName("secondary", "text-sm")}
              onClick={() => void onSend()}
              disabled={pending || recorderState === "uploading"}
            >
              Отправить
            </button>
          </div>
        </div>
      ) : (
        <p className="text-xs text-neutral-600">
          Родительский просмотр: писать в чат может преподаватель и ученики группы.
        </p>
      )}
    </div>
  );
}
