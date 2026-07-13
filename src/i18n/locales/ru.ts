const ru: Record<string, string> = {
  // Toolbar
  'toolbar.open': 'Открыть изображения, PDF, CBZ, CBR',
  'toolbar.open.short': 'Открыть',
  'toolbar.folder': 'Загрузить папку как главу',
  'toolbar.folder.short': 'Глава',
  'toolbar.openProject': 'Открыть файл проекта (.scanforge.json)',
  'toolbar.openProject.short': 'Открыть проект',
  'toolbar.save': 'Сохранить проект',
  'toolbar.save.short': 'Сохранить',
  'toolbar.exportPNG': 'Экспорт рендера активной страницы в PNG (Ctrl+Shift+E)',
  'toolbar.exportPNG.short': 'Рендер PNG',
  'toolbar.batch': 'Пакетный экспорт нескольких страниц',
  'toolbar.batch.short': 'Пакетный',
  'toolbar.ocr': 'Запустить OCR по выбранным страницам (Ctrl+Shift+O)',
  'toolbar.translate': 'Запустить перевод для выбранной страницы или региона (Ctrl+Shift+T)',
  'toolbar.stitch': 'Склеить выбранные страницы (Ctrl+M)',
  'toolbar.pipeline': 'Пайплайн обработки: OCR → Перевод → Экспорт (Ctrl+Shift+P)',
  'toolbar.pipeline.short': 'Пайплайн',
  'toolbar.server': 'Отправить главу на сервер телефона',
  'toolbar.server.short': 'Сервер',
  'toolbar.sources': 'Источники и мониторинг новых глав',
  'toolbar.sources.short': 'Источники',
  'toolbar.presets': 'Пресеты настроек проекта',
  'toolbar.presets.short': 'Пресеты',
  'toolbar.view': 'Вид',
  'toolbar.undo': 'Отменить (Ctrl+Z)',
  'toolbar.redo': 'Повторить (Ctrl+Shift+Z)',
  'toolbar.zoomIn': 'Увеличить (Ctrl+=)',
  'toolbar.zoomOut': 'Уменьшить (Ctrl+-)',

  // Tools
  'tool.select': 'Выбор',
  'tool.draw': 'Рисование региона',
  'tool.draw.short': 'Регион',
  'tool.polygon': 'Полигон',
  'tool.brush': 'Кисть',
  'tool.pan': 'Панорама',

  // Eraser
  'brush.mode.paint': 'Режим: кисть',
  'brush.mode.erase': 'Режим: ластик',

  // View menu
  'view.realSize': 'Реальный масштаб',
  'view.fitWidth': 'По ширине',
  'view.fitPage': 'По странице',
  'view.overlays': 'Оверлеи регионов',
  'view.overlays.on': 'Показаны',
  'view.overlays.off': 'Скрыты',
  'view.focus': 'Фокус-режим',
  'view.clean': 'Чистый режим',
  'view.settings': 'Настройки',
  'view.shortcuts': 'Горячие клавиши',

  // Manual zoom
  'zoom.reset': 'Ручной сброс масштаба (Ctrl+0)',

  // Inspector
  'inspector.title': 'Инспектор',
  'inspector.pipeline': 'Пайплайн',
  'inspector.regions': 'Регионы',
  'inspector.details': 'Детали',
  'inspector.noPage': 'Страница не открыта',
  'inspector.noPage.desc': 'Открой страницу или проект, чтобы редактировать регионы.',
  'inspector.noRegions': 'Регионов пока нет',
  'inspector.noRegions.desc': 'Нарисуй регион на холсте, и он появится в списке.',
  'inspector.noSelection': 'Регион не выбран',
  'inspector.noSelection.desc': 'Кликни по региону на холсте или открой список регионов.',
  'inspector.search': 'Поиск регионов...',

  // Region details
  'region.label': 'Название',
  'region.kind.speech': 'Речь',
  'region.kind.sfx': 'SFX',
  'region.kind.narration': 'Нарратив',
  'region.kind.other': 'Другое',
  'region.duplicate': 'Дублировать',
  'region.split': 'Разделить',
  'region.delete': 'Удалить регион',

  // Batch region actions
  'region.batch.lock': 'Заблок.',
  'region.batch.unlock': 'Разблок.',
  'region.batch.switchType': 'Сменить тип',
  'region.batch.merge': 'Слить',
  'region.batch.clear': 'Сброс',
  'region.batch.count': 'Выбрано: {count}',

  // Pipeline dialog
  'pipeline.title': 'Пайплайн обработки',
  'pipeline.mode.ocrTranslate': 'OCR → Перевод',
  'pipeline.mode.ocrTranslate.desc': 'Только распознать и перевести текст',
  'pipeline.mode.full': 'Полный пайплайн',
  'pipeline.mode.full.desc': 'OCR → Перевод → Очистка → Экспорт PNG',
  'pipeline.mode.auto': 'AI-детекция → Перевод → Экспорт',
  'pipeline.mode.auto.desc': 'Авто-поиск текста (PaddleOCR) → Очистка → Экспорт PNG. Регионы НЕ нужны!',
  'pipeline.mode.auto.desktop': 'Доступно только в Tauri (десктоп)',
  'pipeline.start': 'Запустить пайплайн',
  'pipeline.start.auto': 'AI-детекция + перевод + экспорт',
  'pipeline.progress': 'AI детекция: {percent}%',
  'pipeline.running': 'Выполняется {count} задач(а)...',
  'pipeline.collapse': 'Свернуть',

  // Context menu
  'context.ocr': 'OCR региона',
  'context.translate': 'Перевести регион',
  'context.type': 'Тип: {type}',
  'context.lock': 'Заблокировать',
  'context.unlock': 'Разблокировать',
  'context.hide': 'Скрыть',
  'context.show': 'Показать',
  'context.bringFront': 'На передний план',
  'context.sendBack': 'На задний план',
  'context.group': 'Сгруппировать',
  'context.ungroup': 'Разгруппировать',
  'context.autoNumber': 'Автонумеровать страницу',
  'context.copyText': 'Копировать текст',
  'context.delete': 'Удалить',

  // Pages panel
  'pages.title': 'Страницы',
  'pages.empty.title': 'Страниц пока нет',
  'pages.empty.desc': 'Открой изображения или перетащи файлы на холст',
  'pages.selectAll': 'Выбрать все',
  'pages.clear': 'Сброс',
  'pages.selected': 'Выбрано: {count}',
  'pages.deleteSelected': 'Удалить выбранные ({count})',
  'pages.duplicate': 'Дублировать страницу',
  'pages.delete': 'Удалить страницу',
  'pages.delete.confirm.title': 'Удалить страницу?',
  'pages.delete.confirm.msg': 'Страница и все её регионы будут безвозвратно удалены.',
  'pages.deleteBatch.confirm.title': 'Удалить {count} страниц{plural}?',
  'pages.deleteBatch.confirm.msg': 'Выбранные страницы и все их регионы будут безвозвратно удалены.',
  'pages.deleteBatch.confirm.label': 'Удалить ({count})',

  // Pipeline status
  'stage.ocr': 'OCR',
  'stage.translate': 'Перевод',
  'stage.export': 'Экспорт',

  // Server dialog
  'server.title': 'Отправка на сервер',
  'server.host': 'Хост',
  'server.port': 'Порт',
  'server.send': 'Отправить',
  'server.download': 'Скачать результат',
  'server.progress': 'Прогресс',
  'server.close': 'Закрыть',

  // Presets dialog
  'presets.title': 'Пресеты проектов',
  'presets.save': 'Сохранить',
  'presets.load': 'Загрузить',
  'presets.empty': 'Нет сохранённых пресетов',
  'presets.placeholder': 'Название пресета...',
  'presets.saved': 'Пресет «{name}» сохранён',
  'presets.applied': 'Пресет «{name}» применён',
  'presets.deleted': 'Пресет «{name}» удалён',

  // Sources dialog
  'sources.title': 'Источники',
  'sources.subscriptions': 'Подписки',
  'sources.chapters': 'Главы',
  'sources.add': 'Добавить источник',
  'sources.check': 'Проверить',
  'sources.download': 'Скачать',
  'sources.import': 'Импортировать',
  'sources.remove': 'Удалить',
  'sources.url': 'URL источника',
  'sources.name': 'Название',
  'sources.lastCheck': 'Проверено',
  'sources.newChapters': 'Новых глав: {count}',

  // Status bar
  'status.pages': 'Страниц: {count}',
  'status.regionCount': 'Регионов: {count}',
  'status.zoom': '{zoom}%',

  // Confirm dialog
  'confirm.cancel': 'Отмена',
  'confirm.confirm': 'Подтвердить',
  'confirm.delete': 'Удалить',

  // Toast messages
  'toast.saved': 'Проект сохранён',
  'toast.ocrQueued': 'OCR добавлен в очередь',
  'toast.translateQueued': 'Перевод добавлен в очередь',
  'toast.exportQueued': 'Экспорт добавлен в очередь',
  'toast.noPages': 'Нет страниц для обработки',

  // Image processing
  'image.processing': 'Обработка изображений',
  'image.inpaint': 'Inpaint',
  'image.clean': 'Очистка',
  'image.upscale': 'Upscale',

  // Templates
  'templates.title': 'Шаблоны регионов',
  'templates.save': 'Сохранить',
  'templates.namePlaceholder': 'Имя шаблона',
  'templates.custom': 'Пользовательские',
  'templates.apply': 'Шаблон «{name}» применён',
  'templates.saved': 'Шаблон «{name}» сохранён',
  'templates.removed': 'Шаблон «{name}» удалён',
  'templates.noPage': 'Открой страницу для применения шаблона',

  // Settings
  'settings.title': 'Настройки',
  'settings.language': 'Язык',
  'settings.ocr': 'OCR',
  'settings.translation': 'Перевод',
  'settings.export': 'Экспорт',
  'settings.general': 'Общие',

  // Plugins
  'plugins.title': 'Плагины',
  'plugins.install': 'Установить плагин',
  'plugins.placeholder': '/* @id my-plugin @name My Plugin @version 1.0 */ ...',
  'plugins.installing': 'Установка...',
  'plugins.empty': 'Нет установленных плагинов',
  'plugins.installed': 'Плагин «{name}» установлен',
  'plugins.removed': 'Плагин «{name}» удалён',
  'plugins.installError': 'Не удалось установить плагин. Проверь формат.',

  // Collaboration
  'collab.title': 'Коллаборация',
  'collab.server': 'Сервер',
  'collab.username': 'Имя',
  'collab.serverPlaceholder': 'ws://localhost:8080',
  'collab.usernamePlaceholder': 'User',
  'collab.connected': 'Подключено',
  'collab.disconnected': 'Отключено',
  'collab.reconnecting': 'Переподключение...',
  'collab.users': 'Участники ({count})',
  'collab.connect': 'Подключиться',
  'collab.disconnect': 'Отключиться',
  'collab.toast.connected': 'Подключено к коллаборации',
  'collab.toast.disconnected': 'Отключено от коллаборации',
};

export default ru;
