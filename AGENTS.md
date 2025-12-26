# Agent Instructions: Project Standards & Workflow

## Goal
- This is an app that hosts a local multiplayer type of collection of games. There is a host (laptop screen) and 2 or more players (mobile screen). Players join by entering a room code. 

For all games, we'll follow a simple architecture:

The Host (Laptop): Acts as the "Display." It manages the game state, timer, and game data.

The Client (Phone): Acts as the "Controller." It sends inputs (names, game moves) to the server.

The Server: The middleman. It validates the 4-letter room code, tracks scores, and broadcasts game specific events.

## 🛠 Tech Stack
- **Framework:** Next.js 15 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS + Shadcn UI
- **Database:** Neon DB (PostgreSQL)
- **Animations:** Framer Motion

---

## 🎨 UI & React Standards
- **Component Style:** Use **functional components** and React hooks exclusively.
- **Theming:** All UI must be fully compatible with **Light and Dark mode** using Tailwind's `dark:` utilities.
- **Animations:** Every new page must include subtle entry animations using the `framer-motion` library.
- **Modularity:** - Prioritize reusability. Create shared components for repeating patterns.
- **Action:** Before building a new component, check the existing custom components folder to see if an existing one can be adapted or reused.
- **Component Library:**
1. Use and extend the existing **Shadcn UI** components for consistency.
2. Try to reuse existing custom components in `components/shared/` before creating new ones.
3. Create new custom components in `components/shared/` for any new UI patterns that are reused across multiple pages.

- **Design preferences:**
1. Don't use emojis in the UI.
2. Don't use color gradients.

## General Coding Style
- Use consistent formatting as per the existing codebase (indentation, semicolons, quotes, etc.).
- Prefer functional components and hooks for React/Next.js code.
- Use TypeScript types and interfaces for all function parameters, props, and return values.
- Use named exports unless a default export is clearly more appropriate.
- Keep files and components small and focused on a single responsibility.
- Use absolute imports (e.g., `src/components/...`) if the project is configured for it, otherwise use relative imports.
- Write clear, concise, and descriptive comments where necessary, but avoid redundant comments.
- Use async/await for asynchronous code, avoid .then/.catch chaining.
- Use destructuring for props inside the component and object parameters where it improves readability.
- Prefer `const` over `let` unless reassignment is necessary.
- Use template literals for string concatenation when variables are involved.
- Use Typescript strict mode and avoid using `any` type unless absolutely necessary.

## React & Next.js Specific
- **Do not import React** at the top of component files; Next.js does not require it.
- Import hooks and functions directly from `react` (e.g., `import { useState } from 'react'`), **do not** use `React.useState` or similar patterns.
- Use Next.js conventions for file and folder structure (e.g., `app/`, `components/`, `lib/`).
- Use Next.js routing and API conventions for new pages and endpoints.
- Use server and client components appropriately as per Next.js 15+ standards.

---

## 💾 Database Workflow (Neon DB)
For any task involving database modifications (Create, Update, Alter), follow these two steps:

1. **Migration Files:** Create a new `.sql` file in `db/migrations/` using a sequential naming convention (e.g., `001_migration.sql`, `002_migration.sql`).
2. **Schema Documentation:** Maintain an up-to-date representation of the database schema in Markdown format within `db/migrations/schema/`.

---

## 🏷 TypeScript & Data Integrity
- **Type Mapping:** TypeScript types must strictly match database column names.
- **Type Sharing:** Maintain a unified set of types/interfaces that are shared across API routes, server-side logic, and the client-side UI to ensure end-to-end type safety.


## Feature Documentation
- update the markdown document if a feature is changed or modified. If a new feature is created and its own heading added to the features file (GAME_LOGIC.md), update the table of contents at the top as well.

---

## 📁 Key Directory Structure Reference
- `db/migrations/`: Sequential SQL migration files.
- `db/migrations/schema/`: Markdown files documenting the current schema.
- `components/shared/`: Reusable, custom UI components.
- `app/`: Next.js 15 App Router pages and layouts.