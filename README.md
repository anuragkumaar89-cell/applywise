# ApplyWise

ApplyWise is a small full-stack job-search tracker that turns a scattered application process into a clear pipeline. Add roles, track their status, keep notes, and see your search at a glance.

## Features

- Create, edit, and delete job applications
- Track Wishlist, Applied, Interview, Offer, and Rejected stages
- Search by company or role and filter by status
- Dashboard metrics for total applications, active applications, interviews, and response rate
- Persistent SQLite storage
- Input validation, safe URL handling, and HTTP security headers
- Responsive, accessible interface
- Automated API tests with Node's built-in test runner

## Run locally

Requirements: Node.js 22.13 or later (Node 24 recommended).

```powershell
npm.cmd start
```

Open [http://localhost:3000](http://localhost:3000). The SQLite database is created at `data/applywise.sqlite` on first launch.

To run in watch mode:

```powershell
npm.cmd run dev
```

To run the tests:

```powershell
npm.cmd test
```

Set `PORT` to change the server port. Set `DB_PATH` to choose another SQLite file:

```powershell
$env:PORT = "4000"
$env:DB_PATH = "data/local.sqlite"
npm.cmd start
```

## API

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | Health check |
| `GET` | `/api/applications` | List applications; optional `search` and `status` query parameters |
| `GET` | `/api/applications/:id` | Read one application |
| `POST` | `/api/applications` | Create an application |
| `PATCH` | `/api/applications/:id` | Update application fields |
| `DELETE` | `/api/applications/:id` | Delete an application |
| `GET` | `/api/stats` | Get dashboard and pipeline counts |

Application fields: `company` and `role` are required; `status`, `appliedOn` (`YYYY-MM-DD`), `url`, and `notes` are optional.

## Project structure

```text
public/       Responsive dashboard
src/db.js     SQLite schema and connection
src/server.js REST API and static file server
src/validation.js Request validation and status rules
test/         API integration tests
```

## Resume-ready description

**ApplyWise — Full-stack Job Application Tracker**  
Built a responsive job-search dashboard with a REST API and SQLite persistence. Implemented CRUD workflows, searchable and filterable application pipelines, live dashboard metrics, input validation, security headers, and automated API integration tests using Node.js's built-in test runner.

**Suggested resume bullets (adjust to match your own work):**

- Designed and built a full-stack application tracker using Node.js, SQLite, and modern JavaScript, supporting persistent CRUD workflows across five application stages.
- Created REST endpoints with input validation and automated integration tests; added searchable filters and aggregate pipeline metrics for at-a-glance job-search reporting.
- Developed a responsive, keyboard-accessible dashboard with form validation, inline editing, and clear empty/error states without third-party runtime dependencies.

## Next steps to make it your own

- Add your name, a short project demo, and screenshots to this README.
- Deploy it and link the live demo from your resume.
- Add authentication and per-user data isolation before using it as a public multi-user service.
- Add interview reminders or CSV export as a follow-up feature.
