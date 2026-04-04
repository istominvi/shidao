import Link from 'next/link';
import { ContextCard, PageHero, ProductShell } from '@/components/product-shell';
import { ROUTES } from '@/lib/auth';

export default async function JoinCheckEmailPage({ searchParams }: { searchParams: Promise<{ email?: string }> }) {
  const params = await searchParams;

  return (
    <ProductShell>
      <PageHero
        eyebrow="Подтверждение адреса"
        title="Проверьте почту перед первым входом"
        description="Мы отправили письмо с подтверждением. После подтверждения вернитесь в Shidao и продолжайте настройку профиля."
      />

      <div className="auth-shell-grid">
        <ContextCard
          tone="sky"
          title="Куда отправили письмо"
          description={`Адрес: ${params.email ?? 'ваш email'}. Если письмо не видно, проверьте папки “Спам” и “Промоакции”.`}
        />

        <div className="primary-form-card">
          <h2 className="text-2xl font-black tracking-tight">Письмо отправлено</h2>
          <p className="mt-2 text-sm text-neutral-600">Подтвердите адрес и вернитесь ко входу. Это защитит ваш взрослый аккаунт.</p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <Link href={ROUTES.login} className="landing-btn landing-btn-primary min-h-12 w-full">
              Перейти ко входу
            </Link>
            <Link href={ROUTES.join} className="landing-btn landing-btn-muted min-h-12 w-full border-black/15">
              Изменить email
            </Link>
          </div>
        </div>
      </div>
    </ProductShell>
  );
}
