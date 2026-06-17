---
title: Редактирование секретов
description: Редактирование включено по умолчанию — Authorization, Cookie и Set-Cookie вырезаются из записей до попадания на диск. Добавляйте шаблоны заголовков и тела, разрешайте cookie или редактируйте программно.
---

Записи коммитятся в git, поэтому секреты вырезаются до того, как что-либо будет записано на диск. Редактирование **включено по умолчанию**; прокси заменяет значения этих заголовков запроса/ответа на `[REDACTED]`:

- `Authorization`
- `Cookie`
- `Set-Cookie`

Это безопасно: сопоставление при воспроизведении игнорирует эти заголовки, поэтому редактирование никогда не ломает воспроизведение. Оно применяется к записям `.mock.json`, записям WebSocket и файлам `.har`. Чтобы отключить редактирование, передайте `--no-redact` в CLI или задайте `redaction: false` в [конфигурации](/ru/docs/guides/config/).

Когда чувствительны лишь *некоторые* cookie, разрешите безобидные по имени (например, cookie `theme` или A/B-теста). Разрешённые cookie сохраняют свои значения внутри `Cookie`/`Set-Cookie`; все остальные по-прежнему редактируются.

:::note[Как редактируются файлы `.har`]
Файлы `.har` пишет `routeFromHAR` из Playwright, а не прокси, поэтому они редактируются отдельным проходом. `playwrightProxy.teardown()` перезаписывает каждый `.har` в каталоге записей, используя **ту же конфигурацию редактирования**, что и прокси (заголовки, `allowCookies` и `bodyPatterns` применяются и к заголовкам, и к разобранным массивам `cookies`). Это выполняется из вашего **`globalTeardown`** Playwright — поэтому редактирование HAR требует `globalTeardown`, вызывающего `playwrightProxy.teardown()` (это [рекомендуемая настройка](/ru/docs/integrations/playwright/#global-teardown-recommended), создаваемая `init`).

Оно не может выполняться для каждого теста: Playwright сбрасывает HAR при закрытии контекста, но не дожидается обработчиков закрытия, поэтому редактирование там конкурирует с завершением процесса и может усечь файл. teardown получает конфигурацию из `/__control` (прокси должен быть запущен; если он недоступен, всё равно применяются встроенные значения заголовков по умолчанию), перезаписывает только реально изменённые файлы и оставляет тела ответов в base64 нетронутыми. Для эшелонированной защиты всё равно записывайте с короткоживущими тестовыми учётными данными и просматривайте HAR перед коммитом — см. рекомендуемый паттерн аутентификации ниже.
:::

## Рекомендуемый паттерн аутентификации

Чтобы полностью убрать поток входа и учётные данные из записей, выполняйте аутентификацию в **setup project** Playwright с прокси в режиме `transparent`, сохраняйте `storageState` в **исключённый из git** `auth-state.json` и переиспользуйте его в тестах. Тогда записанные запросы несут только (отредактированные) заголовки сессии, но никогда сам вход.

Рабочую настройку против реального провайдера аутентификации см. в [примере аутентифицированного приложения](/ru/docs/reference/examples/#authenticated-app).

## Настройка того, что редактируется

Заголовки по умолчанию применяются всегда (пока редактирование включено); вы можете добавить к ним.

### Флаги CLI

- `--no-redact` — отключить редактирование секретов (включено по умолчанию).
- `--redact` — включить редактирование секретов; нужно только чтобы снова включить, когда конфигурация задаёт `redaction: false`.
- `--redact-headers <names>` — дополнительные имена заголовков для редактирования, через запятую (объединяются со значениями по умолчанию).
- `--redact-body <patterns>` — шаблоны regex через запятую для редактирования из тел запроса/ответа.
- `--allow-headers <names>` — имена заголовков через запятую, исключаемые из редактирования (например, `set-cookie`).
- `--allow-cookies <names>` — имена cookie через запятую, оставляемые без редактирования внутри `Cookie`/`Set-Cookie`.

```bash
# Redaction is already on; also redact an API-key header and "sk_live_..." tokens, keep the theme cookie
test-proxy-recorder http://localhost:8000 \
  --redact-headers x-api-key \
  --redact-body "sk_live_[a-zA-Z0-9]+" \
  --allow-cookies theme,locale
```

### Программно

При создании `ProxyServer` напрямую:

```typescript
import { ProxyServer } from 'test-proxy-recorder';

// Passing this object enables redaction; pass `false` (or nothing) to keep it off.
const proxy = new ProxyServer('http://localhost:3000', './recordings', undefined, {
  headers: ['x-api-key', 'x-auth'],    // extra headers, merged with the defaults
  bodyPatterns: [/sk_live_[a-z0-9]+/i], // regexes replaced in request/response bodies
  allowHeaders: ['set-cookie'],        // never redact these headers
  allowCookies: ['theme', 'locale'],   // keep these cookies inside Cookie/Set-Cookie
  placeholder: '[REDACTED]',           // default
});
```

`redactSession(session, config)` также экспортируется, если вы хотите самостоятельно редактировать существующие записи.
