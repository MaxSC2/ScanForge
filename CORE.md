# ScanForge CORE SPEC

## Core Idea

Local-first scanlation studio.

## Pipeline

RAW → OCR → Translation → Cleaning → Redraw → Typesetting → QC → Export

## Core Entities

Region (atomic unit) Page Project

## Key Systems

-   Region system
-   Action system (undo/redo)
-   Canvas engine
-   Job system

## Stack

React + TS + Tauri + FastAPI + PaddleOCR + OpenCV

## Principle

Human has final control.
