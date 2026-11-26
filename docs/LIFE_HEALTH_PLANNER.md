# Life & Health Planner — Product & Technical Specification

- Project: `tqcasper-prog/activity-log-app`
- Feature branch: `feat/life-health-planner-prototype`
- Status: Interactive prototype; local browser storage only
- Last updated: 2026-11-18

## 1. Product goal

Build a personal dashboard that helps the user plan daily life, compare planned time with actual time, track exercise, record meals and estimated nutrition, monitor body measurements, and receive transparent, practical recommendations.

The system must be usable on desktop and mobile. It should support Thai language and the user's current baseline schedule:

- Wake: 06:30
- Workday return home: approximately 18:00
- Dinner / buy food: 18:00–18:40
- Shower and rest: 18:40–19:20
- Exercise or recovery: 19:20–20:10
- Study: 20:20–21:05
- Games / personal time: 21:05–21:50
- Prepare for bed: 21:50–22:00
- Sleep: 22:00

These are editable defaults, not mandatory constraints.

## 2. Prototype implemented

### Files

- `public/index.html`: responsive single-page interface and client-side interactions.
- `server.js`: serves the `public` directory and exposes `GET /health`.

### Screens

1. **Overview** — quick summary of body weight, BMI, food energy, and logged hours.
2. **Schedule** — select a weekday; add, edit, delete, and move activities by changing their day.
3. **Time log** — enter date, category, description, and actual hours; review and delete entries.
4. **Nutrition** — add/edit/delete meals and enter estimated calories, protein, carbohydrate, and fat; show daily totals and basic rule-based suggestions.
5. **Body metrics** — record weight, height, waist, sleep duration, water intake, and notes; calculate BMI as a screening metric only.
6. **Reports** — switch between week/month/year views and show time and nutrition summaries.

### Prototype data handling

The prototype uses browser `localStorage` with the `lhp_` prefix. Data remains in the same browser profile on the same device, but is not synchronized, backed up, shared across devices, or protected by user accounts. Clearing browser data can erase it.

The report page currently uses the saved time-log entries for category totals. The month and year displays are early visual summaries and must be upgraded to use real dates and complete date-range aggregation before production.

Nutrition entries are manually entered estimates. No food database or barcode lookup is connected yet. Never present user-entered estimates as laboratory-accurate nutrition values.

## 3. Functional requirements for the production version

### 3.1 Schedule management

- Create, edit, delete, duplicate, and move an activity to another day.
- Support start and end time as structured values, not free-form text.
- Detect overlapping activities and warn the user; allow intentional overlaps with confirmation.
- Support one-off events and recurring weekly activities.
- Mark planned, completed, skipped, and rescheduled.
- Allow activities outside the default schedule without breaking other entries.
- Compare planned duration with actual time logs.
- Preserve user edits when templates or recommendations are updated.

### 3.2 Actual time tracking

- Log an activity, category, date, start/end time or duration, and optional notes.
- Categories: work, study, exercise, rest, daily life, travel, and custom categories.
- Permit multiple sessions for the same activity in one day.
- Calculate totals by day, week, month, year, category, and custom date range.
- Avoid double counting overlapping time logs; flag overlaps for review.
- Show planned versus actual time, unclassified time, and data completeness.

### 3.3 Exercise tracking

- Store exercise plan version, exercise name, instructions, sets, reps, rest, and progression criteria.
- Log actual sets, repetitions, duration, perceived effort, and optional pain/discomfort notes.
- Provide weekly review and gradual progression only when the user's logged performance and recovery support it.
- Rotate exercise variations deliberately; do not randomly change exercises every week.
- Include rest/recovery days and clear stop guidance for sharp pain, dizziness, or joint pain.
- Exercise recommendations must be conservative and must not diagnose injuries.

### 3.4 Nutrition

- Record meal date/time, meal type, food, serving size, and source of nutrition estimate.
- Store calories, protein, carbohydrate, fat, and optionally fiber, sodium, and micronutrients.
- Calculate daily totals and compare them with editable targets.
- Identify likely gaps and suggest food options that can fill them.
- Clearly label estimates and their confidence/source.
- Do not infer exact nutrients when serving size or recipe is unknown.
- Allow users to correct imported or suggested nutrition values.

### 3.5 Body metrics

- Record weight, height, waist, sleep duration, water intake, and optional user-defined measurements.
- Support dated history and trend charts.
- Calculate BMI only when height and weight are valid; label it as a screening measure, not a diagnosis.
- Do not estimate body fat or muscle mass without an appropriate measurement source.
- Keep health notes private and optional.

### 3.6 Reports and assistant summaries

- Week, month, year, and custom date ranges.
- Time-use charts by category and planned-versus-actual comparisons.
- Nutrition totals and averages, including energy and macros.
- Exercise adherence and performance trends.
- Body metric trends.
- Summaries must state the date range, missing data, and whether values are estimates.
- Recommendations should cite the data points and rules that caused the suggestion.
- Never invent missing measurements or claim that an AI model analyzed data it did not receive.

## 4. Recommended free-first architecture

Keep the current repository and its small Express application for this standalone project. Do not introduce an unrelated framework rewrite.

### Phase A — prototype (implemented)

- Node.js + Express static hosting.
- Plain HTML/CSS/JavaScript.
- Browser localStorage.
- Simple deterministic calculations and rule-based suggestions.
- No paid APIs, no API secrets, and no external AI calls.

### Phase B — multi-device persistence

Recommended candidate: **Supabase Free** (Postgres + Auth + Row Level Security).

Before connecting:
1. Create or select a Supabase project in the user's own account.
2. Confirm the current Free-plan quotas, inactivity/pause policy, backup limitations, and regional availability from official documentation.
3. Create SQL migrations and enable RLS on every exposed user-data table.
4. Associate every personal record with the authenticated user's immutable ID.
5. Write owner-scoped SELECT/INSERT/UPDATE/DELETE policies.
6. Never expose a service-role key in browser code or any `NEXT_PUBLIC_*` variable.
7. Use environment variables for server-side secrets.
8. Add export and delete-my-data flows.
9. Test cross-user isolation before using real personal data.

Suggested tables:
- `profiles`: user preferences, timezone, wake/sleep defaults, goals.
- `activities`: planned activity instances and recurrence metadata.
- `time_logs`: actual time sessions and category.
- `exercise_plans`: versioned plans and progression criteria.
- `exercise_sessions`: performed exercises, sets, reps, effort, notes.
- `food_entries`: foods, serving sizes, meal times, nutrition values, source.
- `body_measurements`: dated measurements and units.
- `daily_summaries`: optional cached aggregates; source records remain authoritative.

All tables containing personal data need an owner key and strict RLS. Do not use public/anonymous read policies for health or activity data.

### Phase C — recommendations without mandatory AI spend

Start with a transparent local/server-side rules engine. Examples:
- If actual study time is below the user's plan for several days, suggest a smaller achievable block rather than judging the user.
- If a nutrition target is not reached, suggest foods based on the remaining estimated macro needs and dietary restrictions.
- If exercise performance is improving and recovery is good, suggest a small progression; otherwise retain or reduce the load.
- If sleep is repeatedly shorter than the user's target, recommend adjusting the schedule rather than taking time from sleep.

An external AI provider is optional, not required for the core product. Free AI tiers and quotas can change, can require a payment method, and may impose rate limits. Do not make the app depend on a free AI quota for essential calculations. If an AI provider is added later:
- verify its current terms and free quota first;
- make AI assistance opt-in;
- send only the minimum necessary data;
- explain what data is sent and to which provider;
- never send health notes by default;
- keep deterministic calculations available when AI is unavailable;
- keep API keys server-side.

## 5. Data model conventions

- Store timestamps in UTC and retain the user's IANA timezone (default suggestion: `Asia/Bangkok`).
- Store date-only values separately from timestamps where appropriate.
- Store durations as integer seconds or minutes, not formatted display strings.
- Store units explicitly (kg, cm, kcal, g, ml).
- Store the nutrition source and whether a value is estimated, imported, or user-confirmed.
- Keep immutable creation timestamps and update timestamps.
- Prefer soft-delete only where recovery/audit is needed; provide permanent deletion for personal data on request.

## 6. Privacy and safety

This application may contain sensitive health and routine data.

- Collect only data needed for requested features.
- Make optional fields genuinely optional.
- Do not expose user data through public URLs, logs, analytics, or client-side secrets.
- Require authentication before cloud persistence.
- Enforce database access with RLS; UI hiding is not security.
- Provide data export and deletion.
- Clearly distinguish informational coaching from medical advice.
- Do not diagnose conditions, prescribe treatment, or encourage extreme dieting/training.
- If users report severe symptoms or concerning unintentional weight loss, advise professional assessment.

## 7. Acceptance criteria

- [ ] Activities can be created, edited, deleted, moved, and scheduled on any day.
- [ ] Actual time entries can be created and corrected independently of the plan.
- [ ] Week/month/year reports use real date ranges and do not double count overlaps.
- [ ] Meals can be recorded with portion sizes and estimated macros.
- [ ] Nutrition summaries explain missing or uncertain values.
- [ ] Body metrics are stored with dates and units.
- [ ] Exercise sessions record actual performance and recovery.
- [ ] Recommendations explain their evidence and do not invent data.
- [ ] Data persists after reload and can be exported.
- [ ] Cloud data is isolated per user by tested RLS policies.
- [ ] Mobile and desktop layouts work.
- [ ] Build, lint, tests, and manual regression checks pass.
- [ ] No unrelated app functionality is changed.

## 8. Current known limitations / next milestones

1. The prototype currently uses a free-form time string for schedule entries; convert to structured start/end times and add overlap detection.
2. Add real dates to time logs and meals; current prototype logs are day-of-week samples, not historical date records.
3. Improve reports to aggregate actual date ranges for week, month, year, and custom ranges.
4. Add exercise completion/performance history and progression rules.
5. Add data export/import before cloud migration.
6. Add Supabase only after the project owner has created/authorized the project and credentials are available.
7. Add an optional AI connector only after privacy and cost review.

## 9. Local development

```bash
npm install
npm start
```

Open `http://localhost:3000`.

Health check: `http://localhost:3000/health`.

No database credentials or paid API keys are required for the current prototype.


## 10. Implementation update — 2026-11-26

The working-app branch adds a first usable, browser-local implementation beyond the original prototype.

### Implemented in this branch

- Replaced the single inline prototype screen with a responsive Thai-language application shell and separate CSS/JavaScript files.
- Added date-aware daily activity records with structured start/end times, status values, edit/delete flows, and overlap warnings.
- Added actual-time entries with date, category, duration, and notes.
- Added a basic exercise library with instructions, target muscles, sets/repetitions, rest guidance, safety notes, and session logging.
- Added dated meal entries with serving description, estimated energy/macros, and source labels.
- Added dated body-measurement history and BMI screening calculation when height is supplied.
- Added week/month/year report range selection using real calendar boundaries and summaries from recorded data.
- Added editable nutrition targets, JSON export/import, and local data deletion.
- Added a dependency-free domain module and Node built-in test cases for date boundaries, duration, overlap detection, summaries, BMI, and legacy-data mapping.
- Replaced the placeholder `npm test` command with `node --test`.

### Data compatibility and privacy

- New records use the `lhp_v2` localStorage key.
- Existing `lhp_*` prototype keys are deliberately left untouched. They are not automatically migrated because the old time and meal records may not contain real dates; assigning dates automatically would corrupt historical reporting.
- Exported JSON is the supported backup mechanism in this branch.
- No cloud database, account system, external AI, analytics, or paid service is connected.

### Not yet complete / not yet verified

- Browser end-to-end tests, responsive manual QA, and real-device checks have not yet been run.
- GitHub Actions CI has not yet been verified.
- Per-occurrence editing for recurring weekly activities, activity duplication, richer charts, and full custom date ranges remain to be implemented.
- Time-log entries currently store durations rather than start/end intervals, so overlapping actual-time logs cannot yet be detected or de-duplicated.
- Existing prototype data is preserved but has no guided migration wizard yet.
- LocalStorage remains device/browser-specific; there is no cross-device sync or authenticated cloud backup.

This update is an incremental working baseline, not a claim that all M0–M7 acceptance criteria are complete.
