# Plugins — Система плагинов

Позволяет устанавливать пользовательские скрипты, расширяющие функциональность ScanForge.

## Файлы

| Файл | Назначение |
|---|---|
| `types.ts` | Типы: `PluginManifest`, `PluginAPI`, `PluginFactory`, `PluginToolbarAction` |
| `registry.ts` | `usePluginRegistry` — Zustand store со списком установленных плагинов и их статусом (enabled/disabled). Persist в localStorage. |
| `api.ts` | `getPluginAPI()` — фабрика, возвращающая sandbox API для плагина. `emitEvent()` — рассылка событий в плагины. `getToolbarActions()` — сбор кнопок от плагинов. |
| `loader.ts` | `loadPluginFromSource(source)` — парсит `/* @id @name @version */` из кода и eval'ит. `loadPluginFromUrl(url)` — загрузка с URL. |

## API плагина (PluginAPI)

| Метод | Описание |
|---|---|
| `getPages()` | Все страницы |
| `getActivePage()` | Активная страница |
| `getRegions(pageId)` | Регионы страницы |
| `addRegion(pageId, rect)` | Создать регион |
| `updateRegion(pageId, id, patch)` | Обновить регион |
| `deleteRegion(pageId, id)` | Удалить регион |
| `showToast(msg, type?)` | Показать уведомление |
| `fetchJson(url, options?)` | HTTP-запрос + JSON |
| `onRegionCreate(cb)` | Подписка на создание региона (возвращает unsubscribe) |
| `onRegionUpdate(cb)` | Подписка на обновление региона |
| `onPageOpen(cb)` | Подписка на открытие страницы |
| `addToolbarAction(action)` | Добавить кнопку в тулбар |

## Формат плагина

```js
/* @id hello-world @name Hello World @version 1.0 @description Example plugin @author You */
(ctx) => {
  ctx.api.showToast('Hello from plugin!');
  const unsub = ctx.api.onRegionCreate((region) => {
    console.log('Region created:', region);
  });
  // cleanup on unload (optional)
  return () => unsub();
};
```

Обязательные теги: `@id`, `@name`, `@version`.
Тело — функция, получающая `{ api, manifest }`.
Если функция возвращает функцию, она вызывается при отключении плагина.

## Зависимости

- `zustand` (registry store)
- `localStorage` (persist + plugin sources)
