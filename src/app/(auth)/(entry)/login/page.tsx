import { AuthLink, AuthPage } from "@/components/auth/auth-page";
import { LoginForm } from "@/components/auth/login-form";
import { ROUTES } from "@/lib/auth";

type LoginSearchParams = {
  confirmed?: string | string[];
  next?: string | string[];
  passwordReset?: string | string[];
  registered?: string | string[];
};

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function resolveSuccessHint(params: LoginSearchParams) {
  if (first(params.registered) === "1") {
    return "Аккаунт создан. Теперь войдите с email и паролем.";
  }
  if (first(params.confirmed) === "1") {
    return "Email подтверждён. Теперь выполните вход.";
  }
  if (first(params.passwordReset) === "1") {
    return "Пароль обновлён. Войдите с новым паролем.";
  }
  return undefined;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<LoginSearchParams>;
}) {
  const params = await searchParams;

  return (
    <AuthPage
      title="Войти в Shidao"
      description="Используйте email и пароль либо отдельный логин учащегося и PIN-код."
      footer={
        <p>
          Ещё нет аккаунта?{" "}
          <AuthLink href={ROUTES.join}>Создать аккаунт</AuthLink>
        </p>
      }
    >
      <LoginForm
        requestedRoute={first(params.next)}
        successHint={resolveSuccessHint(params)}
      />
    </AuthPage>
  );
}
