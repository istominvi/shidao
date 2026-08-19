import Link from "next/link";
import { AuthPage } from "@/components/auth/auth-page";
import { Alert } from "@/components/ui/alert";
import { productButtonClassName } from "@/components/ui/button";
import { ROUTES } from "@/lib/auth";
import { afterLogin } from "@/lib/auth-redirects";

export default async function JoinCheckEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; next?: string }>;
}) {
  const params = await searchParams;
  const loginSearch = new URLSearchParams({
    registered: "1",
    next: afterLogin(params.next),
  });

  return (
    <AuthPage
      title="Проверьте почту"
      description={
        <>
          Мы отправили письмо с подтверждением на{" "}
          <strong>{params.email ?? "ваш email"}</strong>. Подтвердите адрес
          перед первым входом.
        </>
      }
    >
      <div className="auth-form">
        <Alert tone="neutral" title="Письма пока нет?">
          Проверьте папки «Спам» и «Промоакции». После подтверждения вернитесь
          ко входу.
        </Alert>

        <Link
          href={`${ROUTES.login}?${loginSearch.toString()}`}
          className={productButtonClassName("inverse", "auth-submit")}
        >
          Перейти ко входу
        </Link>
      </div>
    </AuthPage>
  );
}
