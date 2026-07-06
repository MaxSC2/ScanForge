# ScanForge — Планы

## AI Agent System

Цель: AI-агент, который может анализировать проект, вызывать инструменты и выполнять
многошаговые задачи (OCR, перевод, экспорт).

### Архитектура

```
Agent Chat UI (сайдбар)
  → Agent Orchestrator (src/services/ai/)
    → AI Provider (OpenAI / Anthropic / Ollama)
    → Tool System (10-15 инструментов)
      → Stores (useJobStore, useRegionStore, usePageStore, etc.)
```

### Компоненты

1. `src/services/ai/provider.ts` — абстракция API (OpenAI, Anthropic, Ollama)
2. `src/services/ai/tools.ts` — definition всех инструментов (name, description, schema)
3. `src/services/ai/orchestrator.ts` — цикл: думает → вызывает инструменты → результат
4. `src/services/ai/types.ts` — Message, ToolCall, AgentResult и т.д.
5. `src/stores/useAgentStore.ts` — состояние: чат, статус, настройки
6. `src/components/AgentChat.tsx` — UI: чат-панель в сайдбаре
7. `src/components/SettingsDialog.tsx` — секция AI: API ключи, endpoint, модель

### Инструменты

| Инструмент | Описание |
|---|---|
| `ocr_page` | Запустить OCR на странице/регионах |
| `translate_page` | Запустить перевод |
| `add_region` | Создать регион |
| `update_region` | Изменить регион (геометрия, свойства) |
| `delete_region` | Удалить регион |
| `batch_update_regions` | Пакетное обновление |
| `reorder_regions` | Пересортировать регионы |
| `auto_number_regions` | Автонумерация по топологии |
| `stitch_pages` | Склеить страницы |
| `export_page` | Экспорт рендера |
| `get_page_info` | Инфо о странице |
| `list_pages` | Список страниц |
| `search_project` | Поиск по проекту |
| `undo` | Отменить последнее действие |
| `redo` | Повторить |

### Этапы

1. AI Provider — абстракция API
2. Tool definitions + dispatcher
3. Agent orchestrator (loop)
4. useAgentStore
5. AgentChat UI
6. Интеграция в сайдбар
7. Настройки (API ключи, модель)
8. Cистемный промпт + инструкции

### Заметки

- Все вызовы инструментов валидировать на клиенте перед отправкой AI
- История переписки хранить в localStorage или SQLite
- AI никогда не получает прямого доступа к файловой системе
- Rate limiting на API вызовы
- Возможность прервать агента (AbortController)
