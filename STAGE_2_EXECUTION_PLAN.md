# SCANFORGE — STAGE 2 EXECUTION PLAN

## (Domain Model + Storage Refactor)

Date: 2026-03-26
Branch target: `dev` -> `stage-2-domain-refactor`

---

# 1. Goal

Перевести проект с:

`Snapshot JSON storage -> Normalized domain-driven storage`

Чтобы:

- убрать технический долг
- разблокировать pipeline (`OCR -> Translation -> Export`)
- сделать систему расширяемой

---

# 2. Что запрещено на этапе

Не делаем:

- translation UI
- cleaning/redraw
- новые кнопки/инструменты
- FastAPI/микросервисы
- сложный UX

Если хочется "чуть-чуть добавить фичу" -> это уже выход за рамки этапа.

---

# 3. Целевая архитектура

Текущая:

`React -> Zustand -> JSON blob`

Целевая:

`React -> Zustand -> Repository Layer -> SQLite (normalized)`

---

# 4. Domain Model

## 4.1 Project

```ts
type Project = {
  id: string
  name: string
  createdAt: number
  updatedAt: number
}
```

## 4.2 Page

```ts
type Page = {
  id: string
  projectId: string
  order: number
  imagePath: string
  width: number
  height: number
}
```

## 4.3 Region

```ts
type Region = {
  id: string
  pageId: string

  x: number
  y: number
  width: number
  height: number

  rotation: number

  sourceText: string
  translatedText: string

  status: 'idle' | 'ocr_done' | 'translated'

  locked: boolean
  visible: boolean

  ocrConfidence?: number
}
```

## 4.4 Job

```ts
type Job = {
  id: string
  type: 'OCR' | 'TRANSLATE'

  status: 'queued' | 'running' | 'done' | 'failed'

  projectId: string
  pageId?: string

  progress: number

  createdAt: number
  updatedAt: number

  error?: string
}
```

---

# 5. SQLite схема

```sql
CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  name TEXT,
  created_at INTEGER,
  updated_at INTEGER
);

CREATE TABLE pages (
  id TEXT PRIMARY KEY,
  project_id TEXT,
  page_order INTEGER,
  image_path TEXT,
  width INTEGER,
  height INTEGER
);

CREATE TABLE regions (
  id TEXT PRIMARY KEY,
  page_id TEXT,
  x REAL,
  y REAL,
  width REAL,
  height REAL,
  rotation REAL,
  source_text TEXT,
  translated_text TEXT,
  status TEXT,
  locked INTEGER,
  visible INTEGER,
  ocr_confidence REAL
);

CREATE TABLE jobs (
  id TEXT PRIMARY KEY,
  type TEXT,
  status TEXT,
  project_id TEXT,
  page_id TEXT,
  progress REAL,
  created_at INTEGER,
  updated_at INTEGER,
  error TEXT
);
```

---

# 6. Repository Layer

Создать:

```text
src/repositories/
  projectRepository.ts
  pageRepository.ts
  regionRepository.ts
  jobRepository.ts
```

Пример:

```ts
class RegionRepository {
  async getByPage(pageId: string): Promise<Region[]>

  async create(region: Region): Promise<void>

  async update(region: Region): Promise<void>

  async delete(id: string): Promise<void>
}
```

---

# 7. Миграция

Критично:

1. При загрузке старого проекта:
   - распарсить JSON
   - разложить по таблицам
2. После миграции:
   - сохранить в новую структуру
   - JSON оставить только как fallback

---

# 8. State Management (Zustand)

Было:

```ts
project = { pages: [...], regions: [...] }
```

Станет:

```ts
projectStore -> project meta
pageStore -> pages
regionStore -> regions (по pageId)
jobStore -> jobs
```

---

# 9. Undo/Redo

Пока не трогаем.

Оставить snapshot-based.

Но:

- хранить только editor state
- не тащить весь проект

---

# 10. OCR Pipeline

Адаптация:

Было:

- работаем с JSON регионами

Станет:

- читаем регионы из DB
- обновляем напрямую в DB

---

# 11. Критерии готовности

Этап завершён если:

- можно создать проект
- страницы сохраняются в DB
- регионы сохраняются в DB
- OCR обновляет регионы через DB
- проект восстанавливается после перезапуска
- JSON snapshot больше не основной источник

---

# 12. Риски

## 12.1 Поломка редактора

Фикс:

- вводить репозитории постепенно

## 12.2 Потеря данных

Фикс:

- backup JSON

## 12.3 Дублирование состояния

Фикс:

- DB = single source of truth

---

# 13. Порядок работ

1. создать SQLite schema
2. сделать repositories
3. подключить pages
4. подключить regions
5. адаптировать OCR
6. добавить jobs
7. сделать миграцию
8. убрать зависимость от JSON

---

# 14. Финальная мысль

Этот этап — не про "добавить фичи".

Это этап:

`сделать фундамент, чтобы проект не развалился через 2 недели`

Если всё сделать правильно:

- следующий этап пойдёт быстро
- код станет чище
- ИИ перестанет ломать архитектуру

Если нет:

- проект утонет в хаосе уже на translation
- и придётся переписывать всё с нуля

---

# End of Document
