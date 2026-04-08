# Ticket 03 — Build the admin Game Database editor

## Objective
Add an admin interface inside the existing web app so curated game records can be created and edited.

## Why this ticket exists
The schema and APIs are not enough on their own. The feature needs an internal UI that fits the current admin section and makes it easy to manage entries without touching SQL directly.

## Scope
- Add a new Game Database admin route under `apps/web/src/app/admin`.
- Add navigation from the existing admin layout.
- Build a create/edit workflow on top of the typed admin APIs.
- Keep the UI consistent with the current admin stack: Next.js app router, Shadcn UI, Tailwind, and subtle `framer-motion` entry animation.

## Proposed route structure
- `apps/web/src/app/admin/game-catalog/page.tsx`
- Optional extracted client components under `apps/web/src/components/admin/` when the page grows beyond a small shell.

## Form sections

### Basics
- Name
- Slug
- Short description
- Rules content

### Player and time metadata
- Minimum players
- Maximum players
- Ideal players min
- Ideal players max
- Minimum play time
- Maximum play time
- Ease of learning

### Classification
- General tags as freeform chips with autocomplete
- `Requires equipment` checkbox
- Equipment tags as freeform chips with autocomplete

### Metadata
- `Created by` text input with default `admin`
- Read-only timestamps when editing an existing record

## UX requirements
- Show a list of existing game entries alongside or above the editor so admins can reopen and edit records.
- Reuse existing admin patterns where possible instead of creating bespoke controls.
- Keep the page responsive enough to function on smaller widths, even if the primary workflow is desktop-first.
- Disable or hide the equipment tag input when `Requires equipment` is unchecked.
- Surface API validation errors inline or in a toast, matching the current admin tone.

## Deliverables
- A working admin page wired to the new API routes.
- Reusable editor sections if the page becomes state-heavy.
- Navigation entry from the admin shell.

## Acceptance criteria
- An admin can create a new Game Database entry without manual SQL.
- An existing entry can be loaded back into the form and updated.
- Tag and equipment tag input behaves like open-ended taxonomy management, not a fixed enum.
- The page uses the existing admin shell and remains usable on mobile-width screens.

## Dependencies
- Tickets 01 and 02.

## Out of scope
- Authenticated user attribution beyond a freeform `created_by` string.
- Final visual polish for the public-facing browse experience.
- Delete/archive workflows unless they become necessary during implementation.