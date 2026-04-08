# Ticket 04 — Build the public Game Database browse experience

## Objective
Add a public-facing Game Database UI with a mobile-friendly grid and sidebar filters for curated game entries.

## Why this ticket exists
This feature is only valuable if players can browse it. The public surface should make it easy to discover games by player count, time, learning curve, and equipment needs.

## Scope
- Add a public browse route inside the existing web app.
- Add a basic detail route for viewing rules and full metadata.
- Wire the page to the new public Game Database APIs.
- Keep the implementation structurally sound, but intentionally light on final visual design until the reference screenshot arrives.

## Proposed route structure
- `apps/web/src/app/games/database/page.tsx`
- `apps/web/src/app/games/database/[slug]/page.tsx`

## Browse page requirements
- Desktop layout: filters on the left, result grid on the right.
- Mobile layout: filters move into a drawer, sheet, or collapsible panel.
- Each card should show only the basic fields needed for browsing:
  - Name
  - Short description
  - Player range
  - Ideal player range when available
  - Play time range
  - Ease of learning
  - General tags
  - Equipment required yes/no
- Provide empty, loading, and no-results states.

## Filter requirements
- Player count
- Time to play
- Ease of learning
- General tags
- `Requires equipment`
- Equipment tags

## Detail page requirements
- Show the game name and summary metadata.
- Render the full rules content.
- Show tags, equipment requirements, `created_by`, and timestamps.
- Provide a clear path back to the browse page.

## Implementation notes
- Keep the initial UI field set basic until the screenshot-driven design pass arrives.
- Use the current site stack: Tailwind, Shadcn UI, and light `framer-motion` entry animation.
- Reuse shared layout or card primitives from `components/shared/` where it makes sense.
- Do not overload the first pass with ranking, personalization, or advanced search.

## Deliverables
- A public browse page.
- A basic detail page.
- Responsive filter interactions tied to the typed public API.

## Acceptance criteria
- Users can browse a grid of curated games on desktop and mobile.
- Users can filter by all requested metadata.
- Users can open a detail view to read the rules.
- The UI intentionally stays structurally simple until the reference design is provided.

## Dependencies
- Tickets 01 and 02.

## Out of scope
- Final screenshot-matched design work.
- Saved filters, favorites, recommendations, or SEO tuning beyond normal metadata.