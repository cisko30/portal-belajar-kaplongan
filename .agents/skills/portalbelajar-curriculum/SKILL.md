---
name: portalbelajar-curriculum
description: >-
  Manage Portal Belajar classes, subject metadata (mapel), quizzes, game packs, skill competencies, and student submission rules in accordance with AGENTS.md invariants. Use when modifying quizzes, materials, grading, or student skill tracking.
---

# Portal Belajar — Curriculum, Quiz & Skill Invariants

Always enforce these project rules when editing educational features in `public/feature-panels.js`, `public/game-quiz.html`, `src/lib/`, or `colab/colab_server.py`.

## Mandatory Invariants (from AGENTS.md)

1. **Class Whitelist & Mapel**:
   - Supported classes: `VIII-A..D` (`KKA`), `X-1..4` (`Informatika`, `KKA`), `XI-2`, `XI-4` (`KKA`), `XII-2`, `XII-4` (`Informatika`).
   - Keep `mapel` field optional on legacy items so unclassified materials stay visible for teacher classification.
2. **Staff Authorization**:
   - Teacher/Admin actions (`dashboard-guru.html`, `game-quiz.html?kelola=1`, catalog publishing, grading) must verify credentials with the backend (`/api/teacher-session`) whenever a backend is active; browser `localStorage` flags alone never bypass a `401` response.
3. **Safe Concurrent Catalog Writes**:
   - Catalog writes must carry the last-read `updatedAt` revision and reject stale writes. New game/quiz packs must carry a unique `id` (`crypto.randomUUID()`).
4. **Student Submission Identity & Scoring**:
   - Student submissions use NIS (`userId`) as primary identity, with class-scoped fallback for legacy names.
   - Task/LKPD submissions must strip self-graded fields (`nilai`, `status`, `catatan`); quiz scores are computed purely from `benar / total`.
5. **Skill & Competency Sync**:
   - Student skill progress derives from completed materi, graded submissions, quiz scores, and `pb.game.xp`; teacher endorsements are stored via shared `Activity` without overwriting catalog items.
