# ScanForge ENGINEERING SPEC

## Architecture

UI → API → Services → Storage

## Region Model

id, bbox, text, translation, style

## Action System

All changes = actions Undo/redo stacks

## State Machines

Region & Page lifecycle

## Canvas Rules

-   layered rendering
-   lazy render
-   batch updates

## Jobs

queued → running → done/failed

## Storage

SQLite + local FS
