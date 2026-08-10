# Email Auth в ShiDao на self-hosted Supabase

**Статус:** активный runbook для V2
**Канонический Auth-домен приложения:** `v2.shidao.ru`
**SMTP:** существующий VK WorkSpace через `smtp.mail.ru:2525`

## 1) Контекст

Документ фиксирует текущее рабочее устройство email Auth в ShiDao:

- приложение Shidao (Next.js) развёрнуто отдельно;
- Supabase (self-hosted) и Supabase Auth (GoTrue) развёрнуты отдельно;
- SMTP-провайдер: VK WorkSpace (`smtp.mail.ru`);
- домен отправителя: `shidao.ru`;
- служебный ящик: `auth@shidao.ru`.

> В документе только безопасные примеры. Реальные секреты/пароли не хранятся в repo.

---

## 2) Рабочая архитектура (end-to-end)

Цепочка signup в текущем self-hosted режиме V2
(`ENABLE_EMAIL_AUTOCONFIRM=false`):

1. Пользователь регистрируется в Shidao V2 (`https://v2.shidao.ru/join`).
2. Shidao вызывает Supabase Auth signup.
3. Supabase Auth создаёт user в состоянии «email не подтверждён».
4. Supabase Auth отправляет письмо через SMTP (VK WorkSpace).
5. Пользователь получает письмо и открывает verify link.
6. Callback `https://v2.shidao.ru/auth/confirm` сам вызывает
   `/auth/v1/verify`, записывает encrypted app session и выполняет redirect.
7. Для `signup/email` пользователь попадает в `/courses` без обязательного
   повторного login; `recovery` ведёт в `/reset-password`.

Отдельный обычный login работает так:

- email или learner login/PIN создают одну и ту же roleless Account session;
- после login любой Account попадает в `/courses`;
- safe relative `next` может переопределить стандартный маршрут.

`/onboarding` редактирует общие `display_name/locale/timezone` Account и не
создаёт Parent/Teacher profile, не выбирает роль и не является post-login role
gate.

### Зоны ответственности

- **ShiDao (Next.js):** signup/login/onboarding/Courses, encrypted app session
  и callback `/auth/confirm`.
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

## 4) Логический Supabase `.env` шаблон

Это reference без secrets, а не команда перезаписать активный environment.
Перед изменением нужно read-only сверить pinned Compose/GoTrue version и
фактические значения текущего stack.

```env
# Внешние URL
SUPABASE_PUBLIC_URL=https://supabase.shidao.ru
SITE_URL=https://v2.shidao.ru

# Значение version-bound: скопировать фактический URL из pinned stack,
# не добавлять /auth/v1 вслепую.
API_EXTERNAL_URL=<pinned-stack-public-auth-url>

# Redirect/callback для confirm flow
ADDITIONAL_REDIRECT_URLS=https://v2.shidao.ru/auth/confirm,http://localhost:3000/auth/confirm

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
GOTRUE_MAILER_EXTERNAL_HOSTS=shidao.ru,v2.shidao.ru,supabase.shidao.ru,localhost
```

В Coolify для Next.js публичный landing задаётся отдельно:

```env
NEXT_PUBLIC_SITE_URL=https://shidao.ru
NEXT_PUBLIC_APP_URL=https://v2.shidao.ru
```

`NEXT_PUBLIC_APP_URL` имеет приоритет для callback URL. Без него приложение
может построить Auth redirect на landing-only домен.

---

## 5) Критичные пояснения по настройке

1. `SMTP_PASS` — это **пароль приложения** VK WorkSpace, не обычный пароль почтового ящика.
2. `API_EXTERNAL_URL` и `SUPABASE_PUBLIC_URL` не должны указывать на
   некорректный публичный HTTPS endpoint с `:8000`.
3. Формат `API_EXTERNAL_URL` зависит от версии self-hosted Compose. В новых
   версиях default включает `/auth/v1`; существующий pinned stack нельзя
   менять по этому документу вслепую.
4. `ADDITIONAL_REDIRECT_URLS` обязан разрешать
   `https://v2.shidao.ru/auth/confirm`; callback на `shidao.ru` не является
   каноническим, потому что внутренние routes этого домена закрыты.
5. Ошибочные URL/порты ломают verify/confirm flow даже при «живом» SMTP.

---

## 6) Confirm / verify flow (что исправлено и как работает сейчас)

Ранее были инциденты, когда verify link вёл на неправильный URL/порт, из-за чего подтверждение не завершалось в приложении.

Текущее поведение приложения:

- verify link возвращает пользователя в приложение через корректный callback;
- callback валидирует token hash server-side и создаёт app session;
- пользователь без подтверждения email не может пройти обычный login;
- signup/email callback ведёт в `/courses`;
- обычный login ведёт в `/courses` или в validated safe relative `next`;
- `/onboarding` остаётся отдельной roleless Account form, а не login gate.

---

## 7) Troubleshooting / operational runbook

### 7.1 Проверить env внутри контейнера auth

```bash
docker compose exec auth env | grep -E '^(SMTP_HOST|SMTP_PORT|SMTP_USER|SMTP_ADMIN_EMAIL|SMTP_SENDER_NAME|ENABLE_EMAIL_SIGNUP|ENABLE_EMAIL_AUTOCONFIRM|SITE_URL|SUPABASE_PUBLIC_URL|API_EXTERNAL_URL|ADDITIONAL_REDIRECT_URLS|GOTRUE_MAILER_EXTERNAL_HOSTS)='
```

Allowlist намеренно не включает `SMTP_PASS`. Не использовать широкий фильтр
`SMTP`, который может вывести секрет в terminal/log.

Что проверяем:

- `ENABLE_EMAIL_AUTOCONFIRM=false`
- `SMTP_HOST=smtp.mail.ru`
- `SMTP_PORT=2525`
- корректные внешние URL и callback URL.

### 7.2 Перезапустить Auth после изменения env

Сначала через project-local SSH подтвердить exact DB VDS, каталог pinned
Compose и текущий сервис без вывода полного config/environment:

```bash
pwd
docker compose config --services
docker compose ps auth
```

Команду ниже выполнять только из подтверждённого Compose directory текущего
ShiDao stack:

```bash
docker compose up -d --force-recreate auth
```

Не пересоздавать gateway, Studio, DB и весь stack без необходимости. Название
gateway зависит от pinned Compose (`kong` в старых версиях, `api-gw`/Envoy в
новых), поэтому команды из свежего upstream нельзя копировать на активный
контур без platform-upgrade плана.

### 7.3 Смотреть логи auth

```bash
docker compose logs auth --tail 200 -f
```

Логи проверяются локально. Не копировать raw output в чат, issue или hand-off:
перед передачей удалить email, token/hash, redirect query и любые secret values.

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

## 12) Version safety self-hosted stack

Email Auth зависит не только от переменных, но и от pinned версии GoTrue и
Compose. Перед `pull` или широким `force-recreate` прочитать V2 deployment
runbook и сверить текущие images/volumes.

Актуальные upstream breaking notices:

- `API_EXTERNAL_URL` и `/auth/v1`:
  <https://supabase.com/changelog/47093-self-hosted-supabase-api-external-url-to-include-auth-v1>
- переход default gateway с Kong на Envoy:
  <https://supabase.com/changelog/48048-self-hosted-supabase-envoy-becomes-the-default-api-gateway-b>
- переход default DB image с PostgreSQL 15 на 17:
  <https://supabase.com/changelog/46080-self-hosted-supabase-upgrading-from-pg-15-to-17-breaking-change>

Эти notices не являются инструкцией обновить активный stack. Upgrade требует
отдельного backup/rehearsal окна.

---

## 13) Operational checklist (короткий)

1. Проверить env (URL, redirect, SMTP, `ENABLE_EMAIL_AUTOCONFIRM=false`).
2. После точечного env-изменения пересоздать только `auth`; не перезапускать
   gateway/Studio/DB без отдельной причины.
3. Протестировать signup.
4. Убедиться, что письмо пришло (Inbox/Spam).
5. Пройти confirm link и проверить callback.
6. Проверить app session и redirect в `/courses` после подтверждения, а также
   отдельный обычный login.
7. Если письмо в Spam — проверить SPF/DKIM/DMARC и репутацию отправителя.
