<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Test static game scoring with isolated Playwright contexts in `tests/game_rules_test.py`; intercept all API writes so sample progress never enters real student records.
- Material subject metadata uses the shared catalog's `mapel` field; keep legacy unclassified materials visible for teacher classification instead of guessing their subject.
- Verify staff credentials on the server before displaying teacher/dashboard game management; browser role flags never authorize staff actions.
- Shared catalog writes from browsers must carry the last-read updatedAt revision and reject stale writes, so saved game packs cannot silently disappear; new packs have stable IDs for deletion.
- Student submissions use NIS as their record identity; recap joins shared activity to accounts with class-scoped legacy-name fallback, so different students never replace each other. Quiz submission normalization lives in a pure tested helper to preserve computed scores without allowing task self-grading.
