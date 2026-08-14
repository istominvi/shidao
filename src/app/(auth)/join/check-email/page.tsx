import Link from "next/link";
import { ProductShell } from "@/components/product-shell";
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
    <ProductShell contentClassName="mt-10">
      <div className="mx-auto w-full max-w-[500px]">
        <div className="surface-card">
          <h1 className="surface-card-title text-2xl text-black">
            Проверьте почту перед первым входом
          </h1>
          <p className="surface-card-description mt-2 text-black">
            Мы отправили письмо с подтверждением на{" "}
            <span className="font-semibold">{params.email ?? "ваш email"}</span>
            . Если письмо не видно, проверьте папки «Спам» и «Промоакции». После
            подтверждения вернитесь к входу.
          </p>

          <div className="mt-6 flex justify-center">
            <Link
              href={`${ROUTES.login}?${loginSearch.toString()}`}
              className={productButtonClassName("primary", "px-8")}
            >
              Перейти ко входу
            </Link>
          </div>
        </div>
      </div>
    </ProductShell>
  );
}
