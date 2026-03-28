# AI Operating System — ScanForge

## Purpose

Define how AI is used in development.

---

## Roles

### Implementer
- writes code
- executes tasks
- follows templates

---

### Reviewer
- checks correctness
- finds bugs
- validates logic

---

### Refactor assistant
- improves structure
- cleans code
- maintains architecture

---

### Docs assistant
- updates documentation
- aligns docs with system state

---

## What AI can be trusted with

- implementing scoped tasks
- generating structured code
- following templates
- suggesting improvements

---

## What AI cannot be trusted with

- deciding architecture alone
- expanding scope
- assuming system state
- declaring features "done" without verification

---

## Guardrails (mandatory)

AI must:

- read `scanforge/docs/CURRENT_STAGE.md` before work
- stay within stage scope
- not modify architecture without `scanforge/docs/DECISIONS.md` update
- not invent implementation status
- not skip verification
- not introduce work outside the current stage scope
- not treat work as complete before the relevant checks in `scanforge/docs/STAGE_GATE.md`

---

## Task workflow

1. define task via `templates/`
2. provide context (stage + files)
3. assign AI role (implementer/reviewer/etc)
4. execute task
5. verify result
6. accept / reject / refine

---

## Rule

AI is a tool, not an authority.

All final decisions are made by the product owner.
