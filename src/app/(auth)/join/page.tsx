'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { ContextCard, PageHero, ProductShell, StatusMessage } from '@/components/product-shell';
import { ROUTES } from '@/lib/auth';

export default function JoinPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (!name.trim() || !email.trim() || password.length < 8) {
      setError('Укажите имя, корректный email и пароль не короче 8 символов.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Пароль и подтверждение не совпадают.');
      return;
    }

    if (!agreed) {
      setError('Нужно согласиться с условиями и политикой.');
      return;
    }

    try {
      setLoading(true);
      const normalizedEmail = email.trim().toLowerCase();
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: normalizedEmail,
          password
        })
      });

      const payload = (await response.json().catch(() => null)) as { error?: string; redirectTo?: string } | null;
      if (!response.ok) {
        throw new Error(payload?.error ?? 'Не удалось завершить регистрацию. Попробуйте ещё раз.');
      }
      if (!payload?.redirectTo) {
        throw new Error('Сервер не вернул маршрут после регистрации.');
      }

      router.push(payload.redirectTo);
    } catch (submitError) {
      if (submitError instanceof TypeError && submitError.message.includes('fetch')) {
        setError('Проблема с сетью. Проверьте подключение и попробуйте ещё раз.');
      } else {
        setError(submitError instanceof Error ? submitError.message : 'Ошибка регистрации.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <ProductShell>
      <PageHero
        eyebrow="Вход в продукт"
        title="Создайте взрослый аккаунт Shidao"
        description="Это единый взрослый доступ: после входа вы выберете роль и сможете работать как родитель или преподаватель в одной системе."
      />

      <div className="auth-shell-grid">
        <div className="space-y-3">
          <ContextCard tone="lime" title="Единый взрослый доступ" description="Один аккаунт для управления учебным процессом и коммуникацией внутри платформы." />
          <ContextCard tone="sky" title="Роль выбирается позже" description="Сначала создаём доступ, затем на первом входе вы выбираете стартовый профиль." />
          <ContextCard tone="pink" title="Отдельный ученический контур" description="Ученики получают собственный вход, чтобы не смешивать взрослые и учебные действия." />
        </div>

        <div className="primary-form-card">
          <h2 className="text-2xl font-black tracking-tight">Регистрация взрослого</h2>
          <p className="mt-2 text-sm text-neutral-600">После регистрации вы перейдёте к подтверждению email или сразу ко входу — зависит от режима проекта.</p>

          <form className="mt-5 space-y-3.5" onSubmit={onSubmit}>
            <label className="block">
              <span className="field-label">Имя</span>
              <input value={name} onChange={(e) => setName(e.target.value)} className="field-input" placeholder="Как к вам обращаться" />
            </label>
            <label className="block">
              <span className="field-label">Email</span>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="field-input" placeholder="you@example.com" />
            </label>
            <label className="block">
              <span className="field-label">Пароль</span>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="field-input" placeholder="Минимум 8 символов" />
            </label>
            <label className="block">
              <span className="field-label">Подтверждение пароля</span>
              <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="field-input" />
            </label>

            <label className="context-card flex items-start gap-2.5 bg-white/88 text-sm">
              <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5 size-4" />
              <span>Я согласен(а) с условиями использования и политикой конфиденциальности.</span>
            </label>

            {error && <StatusMessage kind="error">{error}</StatusMessage>}

            <button disabled={loading} className="landing-btn landing-btn-primary min-h-12 w-full disabled:opacity-60" type="submit">
              {loading ? 'Создаём аккаунт…' : 'Создать аккаунт'}
            </button>
          </form>

          <p className="mt-5 text-sm text-neutral-600">
            Уже есть аккаунт?{' '}
            <Link href={ROUTES.login} className="font-semibold underline decoration-black/25 underline-offset-2">
              Войти
            </Link>
          </p>
        </div>
      </div>
    </ProductShell>
  );
}
