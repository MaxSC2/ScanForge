# ScanForge API Server

**FastAPI сервер для обработки глав манги прямо на телефоне.**

Закидываешь страницы → получаешь готовый ZIP с очищенными и переведёнными страницами.

## Запуск

```bash
cd /sdcard/projects/ScanForge/server
pip install -r requirements.txt
python main.py
```

Сервер запустится на `0.0.0.0:8765`.

Для продакшена с PaddleOCR и Ollama нужны дополнительно:

```bash
pip install paddleocr paddlepaddle httpx
```

## API

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/api/v1/health` | Проверка, жив ли сервер |
| POST | `/api/v1/process` | Загрузить главу (multipart files) → jobId |
| GET | `/api/v1/job/{id}` | Статус задачи |
| GET | `/api/v1/job/{id}/download` | Скачать ZIP с результатом |
| WS | `/api/v1/job/{id}/ws` | Прогресс в реальном времени |

### POST /api/v1/process

Поля формы:
- `files` — изображения (PNG/JPG/WebP/BMP), multiple
- `source_language` — `ja`, `zh`, `ko`, `en`, `ru` (default: `ja`)
- `target_language` — `ru`, `en` и т.д. (default: `ru`)
- `ocr_engine` — `paddle`, `easyocr` (default: `paddle`)
- `translation_provider` — `mock`, `ollama`, `sakura` (default: `mock`)

## Конфигурация через окружение

- `HOST` — хост (default: 0.0.0.0)
- `PORT` — порт (default: 8765)
- `OLLAMA_URL` — URL Ollama (default: http://localhost:11434)

## Использование из Tauri

В приложении ScanForge есть кнопка **Сервер** в тулбаре. Настрой адрес сервера (хост:порт), включи сервер и нажми "Отправить". 

Прогресс отображается через WebSocket. Готовый результат скачивается как ZIP.

## Структура

```
server/
  main.py         — FastAPI приложение, роуты
  pipeline.py     — движок обработки (detect → OCR → translate → inpaint → export)
  requirements.txt
  README.md
```
