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

- **React 19** + **TypeScript 5.6**
- **Vite** + **Tauri 2**
- **Zustand** (все state stores)
- **Framer Motion** (анимации)
- **Tailwind CSS 4** (стилизация)

## Фичи

| Фича | Статус |
|---|---|
| Открытие/сохранение проектов (.scanforge.json) | ✅ |
| Импорт PNG, JPG, PDF, CBZ, CBR | ✅ |
| Прямоугольные и полигональные регионы | ✅ |
| Snap-to-grid, snap-to-edges | ✅ |
| Кисть очистки/ластик | ✅ |
| Batch-edit регионов (lock, unlock, тип, merge, split) | ✅ |
| Undo/redo (100 шагов) | ✅ |
| OCR (Tesseract, PaddleOCR, MangaOCR, Windows OCR) | ✅ |
| Перевод (mock, local, remote) | ✅ |
| Пайплайн: OCR → Перевод → Inpaint → Экспорт | ✅ |
| AI-агент (OpenAI, Anthropic, Ollama) | ✅ |
| Пресеты проектов | ✅ |
| Текстовые стили | ✅ |
| Источники и мониторинг | ✅ |
| Stitch (склейка страниц) | ✅ |
| Экспорт: PNG, CBZ, PDF, TIFF | ✅ |
| i18n (RU/EN) | ✅ |
| Плагины (пользовательские скрипты) | ✅ |
| Коллаборация (WebSocket + LWW CRDT) | ✅ |
| Темы (Dark, Darker, High Contrast) | ✅ |
| Шаблоны регионов | ✅ |
| PDF-загрузка (pdf.js) | ✅ |
| API-сервер (manga-translator, EasyOCR) | ✅ |
