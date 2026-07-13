# Templates — Шаблоны регионов

Система сохранения и применения presets для регионов (размеры, тип, ориентация).

## Файлы

| Файл | Назначение |
|---|---|
| `types.ts` | Типы `RegionTemplate`, `TemplateCategory` |
| `presets.ts` | Встроенные шаблоны: 4 речевых баллона, 3 SFX, 2 нарратива |
| `store.ts` | `useTemplateStore` — пользовательские шаблоны (Zustand + persist) |

## API

- `addTemplate(t)` — добавить кастомный шаблон (генерирует UUID)
- `removeTemplate(id)` — удалить
- `updateTemplate(id, patch)` — изменить
- `getAllTemplates()` — все шаблоны (встроенные + кастомные)

## TemplatesDialog

В тулбаре: кнопка **📐 Шаблоны**. Позволяет:
- Применить любой встроенный шаблон к текущей странице
- Сохранить свой шаблон с указанием имени, ширины, высоты
- Удалить пользовательские шаблоны

## Зависимости

- `zustand`
- `uuid`
- `useRegionStore` (addRegion)
- `usePageStore` (getActivePage)
