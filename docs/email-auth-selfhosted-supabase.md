# Email auth в Shidao на self-hosted Supabase: рабочий runbook

## 1) Контекст

Документ фиксирует **текущее фактическое рабочее состояние** email auth в Shidao:
- приложение Shidao (Next.js) развёрнуто отдельно;
- Supabase (self-hosted) и Supabase Auth (GoTrue) развёрнуты отдельно;
- SMTP-провайдер: VK WorkSpace (`smtp.mail.ru`);
- домен отправителя: `shidao.ru`;
- служебный ящик: `auth@shidao.ru`.

> В документе только безопасные примеры. Реальные секреты/пароли не хранятся в repo.

---

## 2) Рабочая архитектура (end-to-end)

Цепочка в текущем production/self-hosted режиме (`ENABLE_EMAIL_AUTOCONFIRM=false`):

1. Пользователь регистрируется в Shidao (`/join`).
2. Shidao вызывает Supabase Auth signup.
3. Supabase Auth создаёт user в состоянии «email не подтверждён».
4. Supabase Auth отправляет письмо через SMTP (VK WorkSpace).
5. Пользователь получает письмо и открывает verify link.
6. Подтверждение обрабатывается callback-маршрутом приложения (`/auth/confirm`).
7. После confirm пользователь может выполнить login (`/login`).
8. Если это первый взрослый вход без профиля — переход на `/onboarding`.
9. После onboarding — переход в единый `/dashboard`.

### Зоны ответственности
- **Shidao (Next.js):** UI/signup/login/onboarding/dashboard и callback `/auth/confirm`.
- **Supabase Auth (GoTrue):** хранение auth users, выдача confirm-токенов, отправка auth email.
- **SMTP (VK WorkSpace):** транспорт доставки письма подтверждения.

---

## 3) Итоговый рабочий SMTP-сценарий

### Что не работало на текущем VPS
Стандартные SMTP-порты `25`, `465`, `587` в этом окружении не дали рабочего исходящего канала (сетевой timeout/недоступность).

### Что диагностировано
Практическая проверка показала:
- `smtp.mail.ru:25/465/587` — нерабочие для текущего VPS;
- `smtp.mail.ru:2525` — доступен и проходит STARTTLS.

### Фактический рабочий результат
Для текущего окружения подтверждён рабочий вариант:
- `SMTP_HOST=smtp.mail.ru`
- `SMTP_PORT=2525`

Это не гипотеза, а operational-конфигурация, на которой работает confirm flow.

---

## 4) Актуальный `.env` шаблон (безопасный)

```env
# Внешние URL
SUPABASE_PUBLIC_URL=https://supabase.shidao.ru
API_EXTERNAL_URL=https://supabase.shidao.ru
SITE_URL=https://shidao.ru

# Redirect/callback для confirm flow
ADDITIONAL_REDIRECT_URLS=https://shidao.ru/auth/confirm,http://localhost:3000/auth/confirm

# Email signup
ENABLE_EMAIL_SIGNUP=true
ENABLE_EMAIL_AUTOCONFIRM=false

# SMTP (VK WorkSpace)
SMTP_HOST=smtp.mail.ru
SMTP_PORT=2525
SMTP_USER=auth@shidao.ru
SMTP_ADMIN_EMAIL=auth@shidao.ru
SMTP_SENDER_NAME=ShiDao
SMTP_PASS=<app-password>

# Дополнительная host-валидация/линки mailer в GoTrue
GOTRUE_MAILER_EXTERNAL_HOSTS=shidao.ru,supabase.shidao.ru,localhost
```

---

## 5) Критичные пояснения по настройке

1. `SMTP_PASS` — это **пароль приложения** VK WorkSpace, не обычный пароль почтового ящика.
2. `API_EXTERNAL_URL` и `SUPABASE_PUBLIC_URL` не должны указывать на некорректный HTTPS endpoint с `:8000`.
3. `ADDITIONAL_REDIRECT_URLS` обязателен для корректного confirm callback.
4. Ошибочные URL/порты ломают verify/confirm flow даже при «живом» SMTP.

---

## 6) Confirm / verify flow (что исправлено и как работает сейчас)

Ранее были инциденты, когда verify link вёл на неправильный URL/порт, из-за чего подтверждение не завершалось в приложении.

Текущее рабочее состояние:
- verify link возвращает пользователя в приложение через корректный callback;
- пользователь без подтверждения email не может пройти нормальный login;
- после подтверждения email вход становится доступен;
- дальше соблюдается обычный маршрут: login → onboarding (если нужно) → dashboard.

---

## 7) Troubleshooting / operational runbook

### 7.1 Проверить env внутри контейнера auth

```bash
docker compose exec auth env | egrep 'SMTP|ENABLE_EMAIL|SITE_URL|SUPABASE_PUBLIC_URL|API_EXTERNAL_URL|ADDITIONAL_REDIRECT_URLS|GOTRUE_MAILER_EXTERNAL_HOSTS'
```

Что проверяем:
- `ENABLE_EMAIL_AUTOCONFIRM=false`
- `SMTP_HOST=smtp.mail.ru`
- `SMTP_PORT=2525`
- корректные внешние URL и callback URL.

### 7.2 Перезапустить сервисы после изменения env

```bash
docker compose up -d --force-recreate auth kong studio
```

Минимум пересоздать `auth`; на практике обычно пересоздаём `auth kong studio` единым шагом.

### 7.3 Смотреть логи auth

```bash
docker compose logs auth --tail 200 -f
```

Типовая интерпретация:
- timeout/connect errors → сеть/egress/порт;
- `535` / `authentication failed` → неверные SMTP credentials (часто не app-password);
- жалобы на redirect/callback → ошибка `SITE_URL` / `API_EXTERNAL_URL` / `ADDITIONAL_REDIRECT_URLS`.

### 7.4 Проверить SMTP connectivity

```bash
nc -4 -vz -w 5 smtp.mail.ru 2525
```

- timeout/refused → сетевой уровень;
- connected → TCP-канал есть, идём к TLS/SMTP auth проверке.

### 7.5 Проверить STARTTLS

```bash
openssl s_client -starttls smtp -connect smtp.mail.ru:2525 -servername smtp.mail.ru -brief
```

- TLS не поднимается → TLS/маршрут/middlebox проблема;
- TLS поднимается → проверяем SMTP auth и логи GoTrue.

### 7.6 Быстрая классификация инцидента

- **Сетевой timeout**: `nc`/`openssl` не проходят.
- **SMTP auth проблема**: соединение есть, но ошибка после AUTH.
- **Redirect URL проблема**: письмо отправляется, но verify callback ломается.
- **Письмо отправлено, но не во Inbox**: transport ок, проблема в deliverability/антиспаме.
- **Письмо в Spam**: transport исправен, нужно работать с доменной репутацией и DNS-политиками.

### 7.7 Фиксация для текущего окружения

Для этого VPS рабочий submission-порт — **`2525`**. Проверять его в первую очередь.

---

## 8) Deliverability и антиспам

Важно разделять два слоя:
1. **SMTP transport** (письмо технически отправляется).
2. **Deliverability** (письмо попадает во Входящие, а не в Spam).

Минимум для домена отправителя:
- SPF должен быть настроен.
- DKIM должен быть настроен.
- DMARC должен быть настроен отдельно.

Даже при рабочем SMTP новый домен/новый отправитель может временно попадать в Spam. Это нормальный этап прогрева репутации.

---

## 9) DMARC: практический старт

Рекомендуемый стартовый режим — мониторинг (`p=none`) с отчётами.

Пример записи:

```txt
Host: _dmarc
Value: v=DMARC1; p=none; rua=mailto:auth@shidao.ru; adkim=s; aspf=s
```

Пояснения:
- `rua=mailto:...` — адрес для aggregate reports.
- `p=none` — наблюдение без жёсткой блокировки.
- после стабилизации доставляемости можно усилить политику до `p=quarantine` или `p=reject`.

---

## 10) Как читать отчёты deliverability (например, MXToolbox)

Типичная ситуация:
- SPF: valid
- DKIM: enabled/valid
- MX: ok
- DMARC: missing

В этом случае отчёт всё равно будет ругаться. Наличие SPF и DKIM **не означает**, что DMARC уже настроен.

---

## 11) Security notes

- Не коммитить реальные `.env` в git.
- Не хранить реальные SMTP credentials в документации.
- Если секреты засветились в чатах/логах/скриншотах — ротировать.
- Пароль приложения (`SMTP_PASS`) хранить только в env/secret store.

---

## 12) Operational checklist (короткий)

1. Проверить env (URL, redirect, SMTP, `ENABLE_EMAIL_AUTOCONFIRM=false`).
2. Перезапустить `auth` (обычно `auth kong studio`).
3. Протестировать signup.
4. Убедиться, что письмо пришло (Inbox/Spam).
5. Пройти confirm link и проверить callback.
6. Проверить login после подтверждения.
7. Если письмо в Spam — проверить SPF/DKIM/DMARC и репутацию отправителя.
