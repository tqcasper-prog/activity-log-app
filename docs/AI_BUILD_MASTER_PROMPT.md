# Master Prompt — Build Life & Health Planner

Product specification: docs/LIFE_HEALTH_PLANNER.md
Repository: tqcasper-prog/activity-log-app
Current MVP branch: feat/life-health-planner-mvp

## Rules
- Read product specification and audit the implementation before changes.
- Preserve Node.js + Express + plain HTML/CSS/JavaScript.
- Preserve and migrate legacy LocalStorage data without deleting original keys.
- Thai-first responsive UI; all visible actions must work.
- Use real dates and numeric durations. Validate input and escape user content.
- Keep health/routine data local unless owner explicitly authorizes cloud storage.
- No paid services, paid AI, subscriptions, billing, or hidden data transfer.
- Export/import and destructive-action confirmation are required.
- Never claim a test, deployment, or cloud sync unless verified.

## Modules
Overview, Schedule, Actual Time Logs, Exercise, Nutrition, Body Metrics, Reports, Settings.

## Current MVP
See docs/LIFE_HEALTH_PLANNER.md for implemented scope and limitations. Tests use Node built-in test runner with node --test.

## Next milestones
M1 recurring-series controls and deep schema validation.
M2 overlap-safe time aggregation and richer reports.
M3 exercise performance/recovery analytics.
M4 nutrition history and body-metric trends.
M5 explainable recommendations.
M6 cloud readiness only after explicit owner approval.
M7 accessibility, security, and release QA.
