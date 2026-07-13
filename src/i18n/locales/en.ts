const en: Record<string, string> = {
  // Toolbar
  'toolbar.open': 'Open images, PDF, CBZ, CBR',
  'toolbar.open.short': 'Open',
  'toolbar.folder': 'Import folder as chapter',
  'toolbar.folder.short': 'Chapter',
  'toolbar.openProject': 'Open project file (.scanforge.json)',
  'toolbar.openProject.short': 'Open project',
  'toolbar.save': 'Save project',
  'toolbar.save.short': 'Save',
  'toolbar.exportPNG': 'Export rendered active page as PNG (Ctrl+Shift+E)',
  'toolbar.exportPNG.short': 'Render PNG',
  'toolbar.batch': 'Batch export multiple pages',
  'toolbar.batch.short': 'Batch',
  'toolbar.ocr': 'Run OCR on selected pages (Ctrl+Shift+O)',
  'toolbar.translate': 'Translate selected page or region (Ctrl+Shift+T)',
  'toolbar.stitch': 'Stitch selected pages (Ctrl+M)',
  'toolbar.pipeline': 'Pipeline: OCR → Translate → Export (Ctrl+Shift+P)',
  'toolbar.pipeline.short': 'Pipeline',
  'toolbar.server': 'Send chapter to phone server',
  'toolbar.server.short': 'Server',
  'toolbar.sources': 'Sources and chapter monitoring',
  'toolbar.sources.short': 'Sources',
  'toolbar.presets': 'Project settings presets',
  'toolbar.presets.short': 'Presets',
  'toolbar.view': 'View',
  'toolbar.undo': 'Undo (Ctrl+Z)',
  'toolbar.redo': 'Redo (Ctrl+Shift+Z)',
  'toolbar.zoomIn': 'Zoom in (Ctrl+=)',
  'toolbar.zoomOut': 'Zoom out (Ctrl+-)',

  // Tools
  'tool.select': 'Select',
  'tool.draw': 'Draw region',
  'tool.draw.short': 'Region',
  'tool.polygon': 'Polygon',
  'tool.brush': 'Brush',
  'tool.pan': 'Pan',

  // Eraser
  'brush.mode.paint': 'Mode: brush',
  'brush.mode.erase': 'Mode: eraser',

  // View menu
  'view.realSize': 'Actual size',
  'view.fitWidth': 'Fit width',
  'view.fitPage': 'Fit page',
  'view.overlays': 'Region overlays',
  'view.overlays.on': 'Shown',
  'view.overlays.off': 'Hidden',
  'view.focus': 'Focus mode',
  'view.clean': 'Clean mode',
  'view.settings': 'Settings',
  'view.shortcuts': 'Keyboard shortcuts',

  // Manual zoom
  'zoom.reset': 'Reset zoom (Ctrl+0)',

  // Inspector
  'inspector.title': 'Inspector',
  'inspector.pipeline': 'Pipeline',
  'inspector.regions': 'Regions',
  'inspector.details': 'Details',
  'inspector.noPage': 'No page open',
  'inspector.noPage.desc': 'Open a page or project to edit regions.',
  'inspector.noRegions': 'No regions yet',
  'inspector.noRegions.desc': 'Draw a region on the canvas and it will appear here.',
  'inspector.noSelection': 'No region selected',
  'inspector.noSelection.desc': 'Click a region on the canvas or open the region list.',
  'inspector.search': 'Search regions...',

  // Region details
  'region.label': 'Label',
  'region.kind.speech': 'Speech',
  'region.kind.sfx': 'SFX',
  'region.kind.narration': 'Narration',
  'region.kind.other': 'Other',
  'region.duplicate': 'Duplicate',
  'region.split': 'Split',
  'region.delete': 'Delete region',

  // Batch region actions
  'region.batch.lock': 'Lock',
  'region.batch.unlock': 'Unlock',
  'region.batch.switchType': 'Switch type',
  'region.batch.merge': 'Merge',
  'region.batch.clear': 'Clear',
  'region.batch.count': 'Selected: {count}',

  // Pipeline dialog
  'pipeline.title': 'Processing pipeline',
  'pipeline.mode.ocrTranslate': 'OCR → Translate',
  'pipeline.mode.ocrTranslate.desc': 'Only recognize and translate text',
  'pipeline.mode.full': 'Full pipeline',
  'pipeline.mode.full.desc': 'OCR → Translate → Inpaint → Export PNG',
  'pipeline.mode.auto': 'AI detect → Translate → Export',
  'pipeline.mode.auto.desc': 'Auto-detect text (PaddleOCR) → Inpaint → Export PNG. Regions NOT needed!',
  'pipeline.mode.auto.desktop': 'Only available in Tauri (desktop)',
  'pipeline.start': 'Run pipeline',
  'pipeline.start.auto': 'AI detect + translate + export',
  'pipeline.progress': 'AI detection: {percent}%',
  'pipeline.running': '{count} job(s) running...',
  'pipeline.collapse': 'Collapse',

  // Context menu
  'context.ocr': 'OCR region',
  'context.translate': 'Translate region',
  'context.type': 'Type: {type}',
  'context.lock': 'Lock',
  'context.unlock': 'Unlock',
  'context.hide': 'Hide',
  'context.show': 'Show',
  'context.bringFront': 'Bring to front',
  'context.sendBack': 'Send to back',
  'context.group': 'Group',
  'context.ungroup': 'Ungroup',
  'context.autoNumber': 'Auto-number page',
  'context.copyText': 'Copy text',
  'context.delete': 'Delete',

  // Pages panel
  'pages.title': 'Pages',
  'pages.empty.title': 'No pages yet',
  'pages.empty.desc': 'Open images or drag files onto the canvas',
  'pages.selectAll': 'Select all',
  'pages.clear': 'Clear',
  'pages.selected': 'Selected: {count}',
  'pages.deleteSelected': 'Delete selected ({count})',
  'pages.duplicate': 'Duplicate page',
  'pages.delete': 'Delete page',
  'pages.delete.confirm.title': 'Delete page?',
  'pages.delete.confirm.msg': 'Page and all its regions will be permanently deleted.',
  'pages.deleteBatch.confirm.title': 'Delete {count} pages?',
  'pages.deleteBatch.confirm.msg': 'Selected pages and all their regions will be permanently deleted.',
  'pages.deleteBatch.confirm.label': 'Delete ({count})',

  // Pipeline status
  'stage.ocr': 'OCR',
  'stage.translate': 'Translate',
  'stage.export': 'Export',

  // Server dialog
  'server.title': 'Send to server',
  'server.host': 'Host',
  'server.port': 'Port',
  'server.send': 'Send',
  'server.download': 'Download result',
  'server.progress': 'Progress',
  'server.close': 'Close',

  // Presets dialog
  'presets.title': 'Project presets',
  'presets.save': 'Save',
  'presets.load': 'Load',
  'presets.empty': 'No saved presets',
  'presets.placeholder': 'Preset name...',
  'presets.saved': 'Preset "{name}" saved',
  'presets.applied': 'Preset "{name}" applied',
  'presets.deleted': 'Preset "{name}" deleted',

  // Sources dialog
  'sources.title': 'Sources',
  'sources.subscriptions': 'Subscriptions',
  'sources.chapters': 'Chapters',
  'sources.add': 'Add source',
  'sources.check': 'Check',
  'sources.download': 'Download',
  'sources.import': 'Import',
  'sources.remove': 'Remove',
  'sources.url': 'Source URL',
  'sources.name': 'Name',
  'sources.lastCheck': 'Last checked',
  'sources.newChapters': 'New chapters: {count}',

  // Status bar
  'status.pages': 'Pages: {count}',
  'status.regionCount': 'Regions: {count}',
  'status.zoom': '{zoom}%',

  // Confirm dialog
  'confirm.cancel': 'Cancel',
  'confirm.confirm': 'Confirm',
  'confirm.delete': 'Delete',

  // Toast messages
  'toast.saved': 'Project saved',
  'toast.ocrQueued': 'OCR queued',
  'toast.translateQueued': 'Translation queued',
  'toast.exportQueued': 'Export queued',
  'toast.noPages': 'No pages to process',

  // Image processing
  'image.processing': 'Image processing',
  'image.inpaint': 'Inpaint',
  'image.clean': 'Clean',
  'image.upscale': 'Upscale',

  // Templates
  'templates.title': 'Region templates',
  'templates.save': 'Save',
  'templates.namePlaceholder': 'Template name',
  'templates.custom': 'Custom',
  'templates.apply': 'Template "{name}" applied',
  'templates.saved': 'Template "{name}" saved',
  'templates.removed': 'Template "{name}" removed',
  'templates.noPage': 'Open a page to apply a template',

  // Settings
  'settings.title': 'Settings',
  'settings.language': 'Language',
  'settings.ocr': 'OCR',
  'settings.translation': 'Translation',
  'settings.export': 'Export',
  'settings.general': 'General',

  // Plugins
  'plugins.title': 'Plugins',
  'plugins.install': 'Install plugin',
  'plugins.placeholder': '/* @id my-plugin @name My Plugin @version 1.0 */ ...',
  'plugins.installing': 'Installing...',
  'plugins.empty': 'No plugins installed',
  'plugins.installed': 'Plugin "{name}" installed',
  'plugins.removed': 'Plugin "{name}" removed',
  'plugins.installError': 'Failed to install plugin. Check format.',

  // Collaboration
  'collab.title': 'Collaboration',
  'collab.server': 'Server',
  'collab.username': 'Name',
  'collab.serverPlaceholder': 'ws://localhost:8080',
  'collab.usernamePlaceholder': 'User',
  'collab.connected': 'Connected',
  'collab.disconnected': 'Disconnected',
  'collab.reconnecting': 'Reconnecting...',
  'collab.users': 'Participants ({count})',
  'collab.connect': 'Connect',
  'collab.disconnect': 'Disconnect',
  'collab.toast.connected': 'Connected to collaboration',
  'collab.toast.disconnected': 'Disconnected from collaboration',
};

export default en;
