import { Stage, Layer, Image as KonvaImage, Rect } from 'react-konva';
import { Upload } from 'lucide-react';
import { ContextMenu } from '../../components/ContextMenu';
import { shouldRenderRegionLabel } from './canvasPerformance';
import { CanvasGrid } from './CanvasGrid';
import { CanvasEmptyState } from './CanvasEmptyState';
import { Minimap } from './Minimap';
import { RegionRect } from './RegionRect';
import { useEditorCanvas } from './useEditorCanvas';

export function EditorCanvas() {
  const {
    containerRef,
    size,
    ctxMenu,
    setCtxMenu,
    drawRect,
    activePage,
    zoom,
    stagePosition,
    tool,
    cleanView,
    regionOverlaysVisible,
    gridVisible,
    labelsVisible,
    minimapVisible,
    selectedRegionId,
    image,
    isDragging,
    visibleRegions,
    contextMenuItems,
    cursor,
    handleWheel,
    handleDragEnd,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleStageClick,
    handleRegionContextMenu,
  } = useEditorCanvas();

  if (!activePage) {
    return (
      <CanvasEmptyState
        containerRef={containerRef}
        isDragging={isDragging}
        handleDragOver={handleDragOver}
        handleDragLeave={handleDragLeave}
        handleDrop={handleDrop}
      />
    );
  }

  return (
    <div
      ref={containerRef}
      className={`relative h-full w-full ${cleanView ? 'bg-transparent' : ''}`}
      style={{ cursor }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {cleanView ? (
        <div aria-hidden className="pointer-events-none absolute inset-0 z-0">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.02)_0%,rgba(24,24,27,0.06)_42%,rgba(0,0,0,0)_70%)]" />
          <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-white/[0.03] to-transparent" />
        </div>
      ) : null}

      {isDragging ? (
        <div className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center rounded-lg border-2 border-dashed border-indigo-500/30 bg-indigo-500/5">
          <div className="flex flex-col items-center gap-2">
            <Upload size={28} className="animate-bounce text-indigo-400" />
            <p className="text-sm font-medium text-indigo-300">Отпусти, чтобы добавить страницы</p>
          </div>
        </div>
      ) : null}

      <Stage
        width={size.width}
        height={size.height}
        scaleX={zoom}
        scaleY={zoom}
        x={stagePosition.x}
        y={stagePosition.y}
        draggable={tool === 'pan'}
        onWheel={handleWheel}
        onDragEnd={handleDragEnd}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onClick={handleStageClick}
      >
        <Layer>
          {cleanView ? (
            <Rect
              x={-12}
              y={-12}
              width={activePage.naturalWidth + 24}
              height={activePage.naturalHeight + 24}
              fill="rgba(5,10,24,0.68)"
              shadowColor="#000000"
              shadowBlur={46}
              shadowOpacity={0.6}
              shadowOffsetX={0}
              shadowOffsetY={18}
              listening={false}
            />
          ) : null}

          <Rect
            x={0}
            y={0}
            width={activePage.naturalWidth}
            height={activePage.naturalHeight}
            fill={cleanView ? '#09090b' : '#1a1a2e'}
            cornerRadius={0}
            listening={false}
          />

          {image ? (
            <KonvaImage
              image={image}
              width={activePage.naturalWidth}
              height={activePage.naturalHeight}
              listening={false}
            />
          ) : null}

          {gridVisible ? (
            <CanvasGrid
              width={activePage.naturalWidth}
              height={activePage.naturalHeight}
            />
          ) : null}

          {regionOverlaysVisible
            ? visibleRegions.map((region) => (
                <RegionRect
                  key={region.id}
                  region={region}
                  isSelected={region.id === selectedRegionId}
                  showLabelOverlay={shouldRenderRegionLabel({
                    labelsVisible,
                    zoom,
                    isSelected: region.id === selectedRegionId,
                  })}
                  onContextMenu={handleRegionContextMenu(region.id)}
                />
              ))
            : null}

          {drawRect ? (
            <Rect
              x={drawRect.x}
              y={drawRect.y}
              width={drawRect.width}
              height={drawRect.height}
              fill="rgba(99,102,241,0.08)"
              stroke="#6366f1"
              strokeWidth={1.5}
              dash={[6, 4]}
              listening={false}
            />
          ) : null}
        </Layer>
      </Stage>

      {minimapVisible && !cleanView ? (
        <Minimap
          imageUrl={activePage.imageUrl}
          imageWidth={activePage.naturalWidth}
          imageHeight={activePage.naturalHeight}
          stageWidth={size.width}
          stageHeight={size.height}
        />
      ) : null}

      {ctxMenu ? (
        <ContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          items={contextMenuItems}
          onClose={() => setCtxMenu(null)}
        />
      ) : null}
    </div>
  );
}
