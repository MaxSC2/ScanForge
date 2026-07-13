# Themes — Система тем

CSS-переменные для кастомизации внешнего вида.

## Файлы

| Файл | Назначение |
|---|---|
| `types.ts` | Типы `Theme`, `ThemeColors` + 3 встроенных темы: `dark`, `darker`, `high-contrast` |
| `store.ts` | `useThemeStore` — Zustand + persist, применяет CSS-переменные на `:root` |
| `ThemeSelector.tsx` | UI-компонент для выбора темы в настройках |

## Переменные CSS

| Переменная | Назначение |
|---|---|
| `--theme-bg` | Фон приложения |
| `--theme-bg-alt` | Фон панелей |
| `--theme-border` | Цвет границ |
| `--theme-surface` | Поверхность карточек |
| `--theme-surface-hover` | Ховер карточек |
| `--theme-text` | Основной текст |
| `--theme-text-muted` | Приглушённый текст |
| `--theme-text-dim` | Ещё более тусклый текст |
| `--theme-accent` | Акцентный цвет (indigo) |
| `--theme-accent-muted` | Полупрозрачный акцент |
| `--theme-danger` | Красный |
| `--theme-success` | Зелёный |
| `--theme-warning` | Жёлтый |

## Как добавить тему

Добавить объект в `THEMES` в `types.ts`, указав все 14 цветов.

## Зависимости

- `zustand`
