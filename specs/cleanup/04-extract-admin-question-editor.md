# Ticket 04 — Extract the admin question editor into reusable form state and sections

## Objective
Break the admin question edit page into a small page shell plus reusable form-state helpers and section components.

## Why this ticket exists
- `apps/web/src/app/admin/contribute/question/[id]/page.tsx` is 697 lines and combines data loading, form initialization, validation, payload building, blob URL handling, and rendering in one component.
- The page repeats the same `question -> form state` mapping in `fetchData()`, `startEditing()`, `cancelEditing()`, and after save.
- It uses imperative DOM access for tags with `document.getElementById('tag-input')` and never revokes object URLs created for prompt image previews.
- Error handling falls back to `any`, which weakens TypeScript guarantees on an already state-heavy screen.

## Scope
- Extract a pure `buildQuestionFormState(question)` helper and a matching `buildUpdatePayload(form)` helper.
- Move editor state into a dedicated hook such as `useQuestionEditorState`.
- Split the JSX into focused sections such as `PromptEditor`, `ChoiceEditor`, `AcceptedAnswersEditor`, and `TagEditor`.
- Replace DOM queries with controlled inputs.
- Revoke old preview object URLs when files change or the component unmounts.

## Expected benefit
- Much smaller page component with clearer state transitions.
- Less duplicated logic when resetting or saving the form.
- Lower risk of subtle UI bugs and browser memory leaks.

## Acceptance criteria
- The page component is mostly composition and route wiring.
- Form initialization logic exists in one place.
- Prompt image object URLs are cleaned up correctly.
- Tag editing works without direct DOM lookup.

## Out of scope
- Changing the admin feature set or redesigning the UI.
- Refactoring the admin list pages unless needed by the extracted components.