"use client";

import Image from "next/image";
import QRCode from "qrcode";
import { Copy, QrCode, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import type { ShareCode } from "@/modules/learner-identity/domain";
import { formatIdentityDate } from "./identity-ui";

export function ShareCodeCard({
  shareCode,
  busy,
  onRotate,
}: {
  shareCode: ShareCode | null;
  busy: boolean;
  onRotate: () => void;
}) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const link = useMemo(() => {
    if (!shareCode || typeof window === "undefined") return null;
    const target = new URL("/students", window.location.origin);
    target.hash = new URLSearchParams({
      "connect-code": shareCode.code,
    }).toString();
    return target.toString();
  }, [shareCode]);

  useEffect(() => {
    let active = true;
    setQrDataUrl(null);
    if (!link) return;
    void QRCode.toDataURL(link, {
      width: 220,
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#111827", light: "#ffffff" },
    }).then((dataUrl) => {
      if (active) setQrDataUrl(dataUrl);
    });
    return () => {
      active = false;
    };
  }, [link]);

  return (
    <section
      className="rounded-2xl border border-neutral-200 bg-white p-5"
      aria-labelledby="share-code-title"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="share-code-title" className="font-bold text-neutral-950">
            Одноразовый код подключения
          </h2>
          <p className="mt-1 max-w-xl text-sm leading-relaxed text-neutral-600">
            Покажите код или QR конкретному преподавателю. Он создаст только
            запрос; связь появится после вашего подтверждения.
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          disabled={busy}
          onClick={onRotate}
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          {shareCode ? "Заменить код" : "Создать код"}
        </Button>
      </div>
      {shareCode ? (
        <div className="mt-4 grid items-center gap-5 sm:grid-cols-[1fr_auto]">
          <div>
            <p
              className="font-mono text-2xl font-black tracking-[0.18em] text-neutral-950"
              aria-label={`Код ${shareCode.code}`}
            >
              {shareCode.code}
            </p>
            <p className="mt-2 text-xs text-neutral-500">
              Действует до {formatIdentityDate(shareCode.expiresAt)} и сгорает
              после первого запроса.
            </p>
            <Button
              type="button"
              variant="ghost"
              className="mt-3"
              onClick={() => void navigator.clipboard.writeText(shareCode.code)}
            >
              <Copy className="h-4 w-4" aria-hidden="true" />
              Копировать код
            </Button>
          </div>
          <div
            className="flex h-[220px] w-[220px] items-center justify-center rounded-2xl border border-neutral-200 bg-white"
            aria-label="QR-код подключения"
          >
            {qrDataUrl ? (
              <Image
                src={qrDataUrl}
                width={220}
                height={220}
                alt="QR-код одноразового подключения"
                unoptimized
              />
            ) : (
              <QrCode
                className="h-10 w-10 text-neutral-300"
                aria-hidden="true"
              />
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}
