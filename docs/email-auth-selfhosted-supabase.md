# Email auth в Shidao на self-hosted Supabase (рабочий SMTP flow)

## 1) Контекст и цель документа

Этот документ фиксирует **реально рабочую** схему email-аутентификации в проекте Shidao для self-hosted Supabase, чтобы через месяцы можно было быстро восстановить:

- архитектуру и точки интеграции;
- рабочие SMTP-настройки;
- историю инцидента с недоступными портами;
- шаги диагностики и восстановления.

> Важно: здесь используются только безопасные примеры переменных и placeholder-значения. Реальные секреты и пароли в репозиторий не добавляются.

---

## 2) Общая архитектура

### Компоненты

- Приложение **Shidao** (Next.js) работает отдельно.
- **Supabase (self-hosted)** развёрнут отдельно.
- Email auth выполняется через **Supabase Auth / GoTrue**.
- Отправка писем выполняется через внешний **SMTP**.
- SMTP-провайдер: **VK WorkSpace**.
- Домен отправителя: `shidao.ru`.
- Сервисный ящик: `auth@shidao.ru`.

### Зачем нужен SMTP

Когда включено подтверждение email (`ENABLE_EMAIL_AUTOCONFIRM=false`), Supabase Auth должен отправлять пользователю письмо с verify/confirm-ссылкой. Без рабочего SMTP-канала пользователь не сможет подтвердить адрес и завершить вход по email.

### Рабочая цепочка (end-to-end)

1. Пользователь регистрируется в Shidao.
2. Supabase Auth создаёт user в состоянии ожидания подтверждения email.
3. Supabase Auth отправляет письмо через SMTP (VK WorkSpace).
4. Пользователь открывает confirm-ссылку из письма.
5. Email подтверждается.
6. После подтверждения пользователь может войти в систему.

---

## 3) Почему изначально не работало (операционный инцидент)

Ниже — краткая фиксация фактов из реальной диагностики VPS.

### Что наблюдали

1. Исходящие соединения на SMTP-порты `25/465/587` с VPS не проходили.
2. Проверки сетевой доступности показали:
   - `google.com:443` — доступно;
   - `smtp.mail.ru:25/465/587` — timeout;
   - `smtp.yandex.ru:465/587` — timeout;
   - `smtp.gmail.com:465/587` — timeout.
3. При этом `smtp.mail.ru:2525` оказался доступен.
4. Практические проверки:
   - `nc -4 -vz -w 5 smtp.mail.ru 2525` — успешно;
   - `openssl s_client -starttls smtp -connect smtp.mail.ru:2525 -servername smtp.mail.ru -brief` — успешно.

### Вывод

Для текущего VPS реальный рабочий SMTP submission-порт — **`2525`**.

Именно поэтому рабочая конфигурация использует:

- `SMTP_HOST=smtp.mail.ru`
- `SMTP_PORT=2525`

Это operational note: если снова появится симптом "письма не отправляются", первым делом перепроверять сетевую доступность именно этого порта из окружения, где запущен `auth` контейнер.

---

## 4) Рабочая конфигурация (self-hosted Supabase)

Ниже пример рабочего блока переменных для self-hosted Supabase email auth.

> Внимание: это шаблон. Не вставляйте в документацию реальные пароли/токены.

```env
# Public URLs
SUPABASE_PUBLIC_URL=https://supabase.shidao.ru
API_EXTERNAL_URL=https://supabase.shidao.ru
SITE_URL=https://shidao.ru

# Redirect URLs для confirm flow
ADDITIONAL_REDIRECT_URLS=https://shidao.ru/auth/confirm,http://localhost:3000/auth/confirm

# Email signup behavior
ENABLE_EMAIL_SIGNUP=true
ENABLE_EMAIL_AUTOCONFIRM=false

# SMTP (VK WorkSpace / Mail.ru)
SMTP_HOST=smtp.mail.ru
SMTP_PORT=2525
SMTP_USER=auth@shidao.ru
SMTP_ADMIN_EMAIL=auth@shidao.ru
SMTP_SENDER_NAME=ShiDao
SMTP_PASS=<app-password>

# Опционально: чтобы GoTrue корректно считал внешние хосты
# и не шумел warning-ами по host validation / mailer links
GOTRUE_MAILER_EXTERNAL_HOSTS=shidao.ru,supabase.shidao.ru,localhost
```

### Пояснения по ключевым переменным

- `SITE_URL` — базовый URL приложения (куда должен возвращаться пользователь).
- `SUPABASE_PUBLIC_URL` — внешний публичный URL self-hosted Supabase.
- `API_EXTERNAL_URL` — внешний URL API Supabase (обычно совпадает с public URL).
- `ADDITIONAL_REDIRECT_URLS` — допустимые redirect/callback URL для confirm flow.
- `ENABLE_EMAIL_SIGNUP` — разрешает регистрацию по email.
- `ENABLE_EMAIL_AUTOCONFIRM`:
  - `true` → email подтверждение отключено (письмо не требуется);
  - `false` → email подтверждение обязательно (письмо обязательно).
- `SMTP_*` — параметры SMTP транспорта для отправки confirm-писем.
- `GOTRUE_MAILER_EXTERNAL_HOSTS` — полезно для корректного поведения mailer/redirect host validation в self-hosted окружении.

---

## 5) Специфика VK WorkSpace

Используется корпоративная почта VK WorkSpace:

- SMTP host: `smtp.mail.ru`
- сервисный SMTP user: `auth@shidao.ru`
- SMTP password: **пароль приложения**, а не обычный пароль ящика.

### Что такое пароль приложения

Пароль приложения — отдельный пароль, который генерируется в интерфейсе VK WorkSpace для SMTP/IMAP/клиентских интеграций.

Почему это важно:

- основной пароль ящика нельзя использовать для SMTP-интеграции в production-автоматизации;
- пароль приложения проще ротацировать и отзывать при инцидентах;
- при утечке пароль приложения нужно немедленно перевыпустить и обновить `SMTP_PASS`.

---

## 6) Поведение системы после настройки

Рабочий flow при `ENABLE_EMAIL_AUTOCONFIRM=false`:

1. Пользователь регистрируется.
2. Попадает на страницу ожидания подтверждения email.
3. В Supabase Auth создаётся user со статусом ожидания подтверждения.
4. На email приходит письмо.
5. Пользователь открывает confirm link.
6. После подтверждения может войти.
7. Если это первый взрослый вход без профиля — пользователь идёт на `/onboarding`.
8. После выбора профиля — попадает на `/dashboard`.

Режимы:

- `ENABLE_EMAIL_AUTOCONFIRM=true` → письмо не требуется, подтверждение email пропускается.
- `ENABLE_EMAIL_AUTOCONFIRM=false` → письмо обязательно, без подтверждения вход не завершится.

---

## 7) Known issues и тонкости доставляемости

Письма могут попадать в спам, даже если SMTP технически работает.

Типичные причины:

- новый отправитель;
- новый домен;
- не до конца настроенные репутационные DNS-записи.

Что проверить/донастроить отдельно:

- SPF
- DKIM
- DMARC

Важно: это обычно **не блокирует сам факт отправки**, но сильно влияет на доставляемость во входящие.

---

## 8) Troubleshooting / Runbook

Ниже команды и логика диагностики, которые уже использовались на практике.

### 8.1 Проверка env внутри auth-контейнера

```bash
docker compose exec auth env | egrep 'SMTP|ENABLE_EMAIL|SITE_URL|ADDITIONAL_REDIRECT_URLS'
```

Проверяем, что контейнер действительно видит актуальные значения (`SMTP_HOST`, `SMTP_PORT=2525`, `ENABLE_EMAIL_AUTOCONFIRM`, `SITE_URL`, redirect URL).

### 8.2 Проверка доступности SMTP порта

```bash
nc -4 -vz -w 5 smtp.mail.ru 2525
```

Если timeout/ошибка соединения — это сетевой уровень (маршрут, egress-фильтрация, ограничения VPS/провайдера).

### 8.3 Проверка STARTTLS

```bash
openssl s_client -starttls smtp -connect smtp.mail.ru:2525 -servername smtp.mail.ru -brief
```

Если TCP есть, но TLS не поднимается — проблема в TLS/handshake/доступности сервера или в сетевом middlebox.

### 8.4 Логи Supabase Auth

```bash
docker compose logs auth --tail 200 -f
```

В логах ищем признаки:

- ошибки SMTP auth (`535`, `authentication failed`) → неверный `SMTP_USER`/`SMTP_PASS` (часто не app-password);
- сетевые timeout/connect errors → сетевой инцидент (порт/маршрут/egress);
- ошибки redirect/verify link → проблема в `SITE_URL`, `API_EXTERNAL_URL`, `ADDITIONAL_REDIRECT_URLS`.

### 8.5 Перезапуск сервисов после изменения `.env`

```bash
docker compose up -d --force-recreate auth kong studio
```

После правок env обязательно пересоздать минимум `auth` (и связанные gateway/UI компоненты, если от них зависит URL-конфигурация).

### 8.6 Как быстро классифицировать проблему

- **Проблема в сети**:
  - `nc`/`openssl` до SMTP-host:port не проходят;
  - в логах `connection timeout` / `i/o timeout`.

- **Проблема SMTP auth**:
  - соединение и TLS поднимаются;
  - в логах `authentication failed` / SMTP-коды отказа после AUTH.

- **Проблема verify/redirect URL**:
  - письмо уходит, но confirm link ведёт не туда/не обрабатывается;
  - лог/поведение указывает на несоответствие `SITE_URL`, `API_EXTERNAL_URL`, `ADDITIONAL_REDIRECT_URLS`.

- **Письмо отправилось, но не пришло во Inbox**:
  - в auth-логах нет SMTP ошибок;
  - проверять Spam/Junk и deliverability (SPF/DKIM/DMARC, репутация домена/ящика).

---

## 9) Security notes

- Не хранить реальные SMTP credentials в репозитории.
- Не коммитить реальные `.env`.
- В документации использовать только placeholders.
- Если секреты когда-либо светились в логах/чате/скриншотах — их нужно ротировать.
- Пароль приложения VK WorkSpace хранить только в env/secret store.

---

## 10) Короткий operational checklist

1. Проверить env в `auth` контейнере.
2. Проверить `smtp.mail.ru:2525` (`nc` + `openssl`).
3. Проверить логи `auth` на SMTP auth/timeout/redirect ошибки.
4. Пересоздать `auth` после env-изменений.
5. Проверить spam и DNS-репутацию (SPF/DKIM/DMARC), если отправка есть, а входящих нет.
