# WordSteady content packs (JSON contract)

This folder contains the content-only JSON packs used by `play.html` + `scripts/play.js`.

- Today’s pack: `data/today.json`
- Dated packs (optional): `data/words/YYYY-MM-DD.json`
  - Example URL: `/play.html?date=2026-01-18`

The game engine does **not** contain per-word edits. If a pack matches this contract, the session works.

---

## Pack schema (required)

### Root
- `meta` (object)
- `word` (object)
- `meaning` (string)
- `example` (string)
- `step3Target` (number)
- `starters` (array)
- `finishes` (array)

---

## `meta` (required)
- `meta.id` (string)
  - Recommended: `YYYY-MM-DD` for normal packs
- `meta.minutes` (number)
  - Display-only estimate (e.g. `6`)

Example:
```json
"meta": { "id": "2026-01-17", "minutes": 6 }
