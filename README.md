# ScanForge

Turn-key scanlation tool. Runs in browser (dev) or Tauri (desktop).

## Архитектура

```
src/
├── collaboration/     # WebSocket + LWW CRDT sync
├── components/        # UI dialogs (Plugins, Collab, Templates, Pipeline, etc.)
├── export/            # Batch/PDF/TIFF export
├── features/          # Feature-grouped panels & toolbar
├── hooks/             # React hooks (keyboard, etc.)
├── i18n/              # Интернационализация (RU/EN)
├── plugins/           # Plugin API + loader + registry
├── services/          # OCR, AI, translation, CBZ, PDF loading
├── stores/            # Zustand stores (regions, pages, history, jobs, etc.)
├── templates/         # Region template system
├── tests/             # Vitest unit tests
├── themes/            # CSS variable theme system
├── types/             # TypeScript types
└── utils/             # TIFF encoder, CBZ builder, snapping, etc.
```

## Быстрый старт

```bash
npm install
npm run dev          # Browser mode
npm run tauri dev    # Desktop (requires Tauri)
node collab-server.js  # WebSocket relay (для коллаборации)
```

## Технологии

- **React 19** + **TypeScript 5.9**
- **Vite 7** + **Tauri 2**
- **Zustand** (state stores)
- **Motion** (анимации)
- **Tailwind CSS 4** (стилизация)

## Возможности и ограничения

| Возможность | Текущее состояние |
|---|---|
| Проекты и автосохранение | ✅ Нормализованное domain-state; snapshot используется как recovery fallback |
| Импорт PNG, JPG, PDF, CBZ, CBR | ✅ Реализован |
| Прямоугольные регионы и batch-операции | ✅ Реализовано |
| Snap-to-grid / snap-to-edges | ✅ Реализовано |
| Кисть очистки / ластик | ✅ Реализовано |
| Undo/redo | ✅ До 100 шагов; data-URL изображения дедуплицируются между snapshot |
| OCR | ✅ Windows OCR на desktop; Tesseract.js в browser с выбором модели для ja/zh/ko/en |
| Дополнительные OCR движки | ⚠️ Зависят от runtime/адаптера; capability не везде одинакова |
| Перевод | ⚠️ Browser: local/mock/offline/DeepL/Libre/Ollama/Sakura; desktop Tauri backend: local/mock |
| `remote` translation provider | ⚠️ Не реализован как полноценный backend |
| Pipeline: OCR → Translate → Inpaint → Export | ✅ Основной pipeline реализован; провайдерные ограничения зависят от runtime |
| AI-агент | ✅ Провайдеры определяются AI runtime/config |
| Источники и мониторинг | ✅ HTTP(S) с таймаутами; polling последовательный |
| Stitch | ✅ Реализован |
| Экспорт PNG/CBZ/PDF/TIFF | ✅ Реализован |
| i18n RU/EN | ✅ Реализовано |
| Плагины | ⚠️ Пользовательские скрипты считаются trusted code |
| Коллаборация | ⚠️ WebSocket + LWW CRDT с server-side room isolation; аутентификация пока не реализована |
| Темы | ✅ Dark / Darker / High Contrast |
| Шаблоны регионов | ✅ Реализованы |
| PDF loading | ✅ Реализован |
| API-сервер | ⚠️ Локальные/сетевые HTTP endpoints; полноценная auth/TLS модель не реализована |
