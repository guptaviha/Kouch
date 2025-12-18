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

---

## 💾 Database Workflow (Neon DB)
For any task involving database modifications (Create, Update, Alter), follow these two steps:

1. **Migration Files:** Create a new `.sql` file in `db/migrations/` using a sequential naming convention (e.g., `001_migration.sql`, `002_migration.sql`).
2. **Schema Documentation:** Maintain an up-to-date representation of the database schema in Markdown format within `db/migrations/schema/`.

---

## 🏷 TypeScript & Data Integrity
- **Type Mapping:** TypeScript types must strictly match database column names.
- **Type Sharing:** Maintain a unified set of types/interfaces that are shared across API routes, server-side logic, and the client-side UI to ensure end-to-end type safety.

---

## 📁 Key Directory Structure Reference
- `db/migrations/`: Sequential SQL migration files.
- `db/migrations/schema/`: Markdown files documenting the current schema.
- `components/shared/`: Reusable, custom UI components.
- `app/`: Next.js 15 App Router pages and layouts.