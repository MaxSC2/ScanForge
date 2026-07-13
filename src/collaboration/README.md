# Collaboration — Коллаборация через WebSocket

Позволяет нескольким пользователям редактировать проект одновременно.
Работает по принципу relay server: сервер просто пересылает сообщения между клиентами.

## Файлы

| Файл | Назначение |
|---|---|
| `types.ts` | Типы: `CollabUser`, `CollabOp`, `CollabMessage`, `CollabState` |
| `store.ts` | `useCollabStore` — Zustand store с состоянием подключения, списком пользователей, очередью неотправленных op. Persist serverUrl и userName. |
| `sync.ts` | WebSocket клиент: connect, disconnect, reconnect (3s), отправка/приём op, broadcast функции. |

## Протокол

### Клиент → Сервер
```json
{ "type": "join", "user": { "id": "...", "name": "...", "color": "..." } }
{ "type": "op", "op": { "id": "...", "type": "region:create", "userId": "...", "timestamp": ..., "pageId": "...", "payload": {...} } }
{ "type": "ack", "opId": "..." }
```

### Сервер → Клиент
```json
{ "type": "users", "users": [...] }
{ "type": "op", "op": {...} }
{ "type": "ack", "opId": "..." }
```

## Типы операций

| op.type | payload | Действие |
|---|---|---|
| `region:create` | `Region` | Добавить регион |
| `region:update` | `{ id, ...patch }` | Обновить поля региона |
| `region:delete` | `{ id }` | Удалить регион |

## Как запустить сервер

```bash
node collab-server.js [port]
# По умолчанию ws://localhost:8080
```

Сервер — простая заглушка без сохранения состояния. Нужен Node.js с пакетом `ws`.

## Интеграция

- `useRegionStore` вызывает `broadcastRegionCreate/Update/Delete` если `isCollabConnected() === true`
- Входящие op применяются к локальному `useRegionStore` (create/update/delete)
- Конфликты решаются стратегией Last-Writer-Wins (по timestamp)
- Неотправленные op хранятся в `pendingOps` и отправляются при переподключении

## Зависимости

- `zustand` (store)
- `localStorage` (persist + userId)
- `ws` (серверная часть, npm пакет)
