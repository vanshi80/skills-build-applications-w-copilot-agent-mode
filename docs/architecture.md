# OctoFit Tracker architecture

OctoFit Tracker is a three-tier application for a school fitness program. The starter code includes API contracts and intentionally incomplete implementation points so you can use GitHub Copilot agent mode in a test-driven loop.

![Three-tier OctoFit architecture](../.github/images/octofit-architecture.svg)

## Tier boundaries

- **Presentation tier**: React 19, Vite, React Router, Bootstrap, and a shared API client in `octofit-tracker/frontend/src`.
- **Logic tier**: Express and TypeScript routes/services in `octofit-tracker/backend/src` expose `/api/*` behavior on port `8000`.
- **Data tier**: Mongoose models and seed data in `octofit-tracker/backend/src/models` and `src/scripts/seed.ts` persist to MongoDB on port `27017`.

## Ports and environment rules

- MongoDB: `27017`
- Express API: `8000`
- Vite frontend: `5173`
- The browser calls relative `/api` paths. Vite proxies them to `http://localhost:8000`, so the unauthenticated API port stays private in Codespaces. `VITE_API_BASE_URL` can override the base URL.

## API contract

| Capability | Method and path | Expected behavior |
| --- | --- | --- |
| Activity tracking | `GET /api/activities`, `POST /api/activities` | List and create valid activity records. POST accepts `userId`, `teamId`, `type`, and `minutes`; `userId` and `teamId` must be well-formed IDs for an existing user and team; otherwise respond with a deliberate 4xx (never a 500 from a cast error). A created activity stores the submitted `user`, `team`, `type`, and `minutes` plus computed `points` and `occurredAt`. |
| Teams | `GET /api/teams`, `POST /api/teams` | List and create teams with members. Created and listed teams keep the submitted `name` and `mascot`. Reject a team without a name with `400`. |
| Leaderboard | `GET /api/leaderboard` | Return teams ordered by the sum of their activity points, highest first. Each entry has `teamName`, `totalPoints`, and a 1-based `rank`. |
| Workout suggestions | `GET /api/workouts/suggestions/:userEmail` | Recommend workouts from recent activity patterns for the matching seeded user's email address. The first suggestion's `focus` matches that user's goal or recent activity, with a `reason` explaining why. An email with no matching user returns a deliberate 4xx (for example, `404`). |

## Implementation decisions

- Presentation tier decision: Keep React components responsible for rendering and user interaction. Use the shared API client with relative `/api` paths; keep persistence and business rules out of the frontend. Every data-driven page should provide accessible loading, empty, and error states.
- Logic tier decision: Keep HTTP validation, orchestration, and response formatting in Express routes/services. Validate request shape and referenced records before writes, return deliberate 4xx responses for invalid or unknown input, and avoid exposing database cast errors as 500s.
- Data tier decision: Use Mongoose models to define required fields, types, and references. Keep seed data representative of all four API capabilities and make seeding idempotent.
- Activity tracking approach: Accept `userId`, `teamId`, `type`, and `minutes`; validate both IDs and confirm the user and team exist before creating an activity. Store the corresponding user/team references and submitted values with server-computed `points` and `occurredAt`. Keep the scoring rule in backend logic rather than the UI.
- Team management approach: Require a name, retain the submitted name and mascot, and store members as user references. Use the same team model for listing and creation.
- Leaderboard approach: Calculate each team's total from its activities' points, order teams by total points descending, and assign ranks starting at 1. Return the contract fields `teamName`, `totalPoints`, and `rank`.
- Workout suggestions approach: Find the user by email and use their goal and recent activity patterns to select relevant workouts. Include a human-readable reason for the first suggestion; return a deliberate 4xx when no user matches.

## Test plan

Run the focused contract tests after changes in their respective tiers, then run both builds to catch type-checking and bundling errors.

- **Data tier:** `npm run test:data --prefix octofit-tracker/backend` — model validation failures indicate that required fields or schema constraints do not match the data contract. Latest baseline: 4 of 5 tests failed for User, Team, Activity, and Workout validation; the idempotent seed test passed.
- **API:** `npm run test:api --prefix octofit-tracker/backend` — failures indicate incorrect status codes, response data, or endpoint behavior. Latest baseline: all 4 tests failed; invalid Activity/Team inputs returned 501 instead of 400, the leaderboard was empty, and a workout suggestion lacked the expected reason.
- **Frontend:** `npm test --prefix octofit-tracker/frontend` — failures indicate missing or incorrect API-backed rendering or accessible loading, empty, and error states. Latest baseline: all 15 tests failed, covering the primary page content/suggestion behavior and those states across the four pages.
- **Backend build:** `npm run build --prefix octofit-tracker/backend` — a failure indicates backend TypeScript type-checking errors. Latest run passed.
- **Frontend build:** `npm run build --prefix octofit-tracker/frontend` — a failure indicates frontend type-checking or Vite production-bundling errors. Latest run passed.
