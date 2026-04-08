# Ticket 03 — Build the admin Game Database editor

## Objective
Add an admin interface inside the existing web app so curated game records can be created and edited.

## Why this ticket exists
The schema and APIs are not enough on their own. The feature needs an internal UI that fits the current admin section and makes it easy to manage entries without touching SQL directly.

## Scope
- Add a new Game Database admin route under `apps/web/src/app/admin`.
- Add navigation from the existing admin layout.
- Build a list-first create/edit workflow on top of the typed admin APIs.
- Keep the UI consistent with the current admin stack: Next.js app router, Shadcn UI, Tailwind, and subtle `framer-motion` entry animation.

## Proposed route structure
- `apps/web/src/app/admin/game-catalog/page.tsx`
- `apps/web/src/app/admin/game-catalog/new/page.tsx`
- `apps/web/src/app/admin/game-catalog/[id]/page.tsx`
- Extract client components under `apps/web/src/components/admin/` for the list and editor flows.

## Form sections

### Identity header
- Large title input
- Smaller editable slug field directly below the title

### Left sidebar metadata
- Minimum players and maximum players on the same row
- Ideal players min and ideal players max on the next row
- Minimum and maximum play time on the next row
- Ease of learning
- General tags
- Equipment requirement and equipment tags
- Metadata such as `created_by` and timestamps

### Main editor pane
- Short description
- Large rules text area

## UX requirements
- Make `/admin/game-catalog` a dedicated list page that shows existing entries and a prominent create button in the top-right area.
- Open both create and edit actions in their own dedicated editor routes instead of inline on the list page.
- Place the editable title and slug at the top of the editor.
- Reuse existing admin patterns where possible instead of creating bespoke controls.
- Keep the page responsive enough to function on smaller widths, even if the primary workflow is desktop-first.
- Disable or hide the equipment tag input when `Requires equipment` is unchecked.
- Surface API validation errors inline or in a toast, matching the current admin tone.

## Deliverables
- A working admin list page wired to the new API routes.
- A dedicated create/edit editor page wired to the same API routes.
- Reusable editor sections for the sidebar metadata and rules pane.
- Navigation entry from the admin shell.

## Acceptance criteria
- An admin can create a new Game Database entry without manual SQL.
- An existing entry can be loaded back into the form and updated.
- Admins land on a list of existing games before entering the create or edit flow.
- Tag and equipment tag input behaves like open-ended taxonomy management, not a fixed enum.
- The page uses the existing admin shell and remains usable on mobile-width screens.

## Dependencies
- Tickets 01 and 02.

## Out of scope
- Authenticated user attribution beyond a freeform `created_by` string.
- Final visual polish for the public-facing browse experience.
- Delete/archive workflows unless they become necessary during implementation.