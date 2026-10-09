# Petty: Set production suite plan

## Product target

Petty: Set should let a production team plan a feature, series, commercial, or live-action/VFX project from script breakdown through shoot and review. The 3D set and shot editor remains a central workflow, connected to production records rather than isolated from them. This target extends beyond [Lensflare parity](PARITY_PLAN.md).

The app must stay open source and local-first. A self-hosted service adds shared projects, large-asset storage, render jobs, and collaboration; it must not become a requirement for opening, editing, backing up, or exporting a local project.

## One production graph

Use stable IDs and explicit references for `Production → Sequence → Script scene → Shot → Take/review`. Script scenes and shots reference reusable sets/locations; schedule entries reference scenes, people, and resources. A script scene can span several shoot days, and a shot can have multiple setups and render versions. Do not make scene names, shot numbers, or array positions act as IDs. Preserve references when users reorder or renumber work.

Records linked to that graph:

| Record         | Planning data                                                                                  | Used by                                          |
| -------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| Script scene   | Scene number, INT/EXT, location, day/night, page length, cast, props, wardrobe, effects, notes | Breakdown, stripboard, shot list, call sheet     |
| Set/location   | Address or stage, floor plan, dimensions, access and constraints, reusable 3D set              | Blocking, tech scout, schedule, logistics        |
| Shot/setup     | Story/shoot order, framing, actors, camera/lens, lighting, movement, duration, status          | Previs, shot list, equipment, storyboard, render |
| Person/role    | Crew, cast, department, contact and availability, scoped access                                | Calls, assignments, approvals                    |
| Resource       | Equipment, prop, costume, vehicle, power, vendor, quantity and availability                    | Breakdown, conflicts, budget, shoot day          |
| Schedule entry | Date, unit, location, scenes, work time, travel and dependencies                               | Stripboard, daily plan, call sheet               |
| Cost line      | Category, quantity, rate, estimate, actual and currency                                        | Budget, resource decisions, reports              |
| Review item    | Target record/version, annotation, assignee, decision and timestamp                            | Storyboard, render, continuity, approvals        |

The existing `Project → SetScene → Shot` data remains readable. Add versioned migrations as records are introduced; do not wrap the present project in an incompatible format or duplicate shot facts in new tables. Generate documents from the graph, with an immutable snapshot recorded when a call sheet or approved plan is issued.

## Capability gates

| Gate                         | Deliverable                                                                                                                             | Acceptance                                                                                                                                                   |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1. Production identity       | Stable scene/shot IDs, production settings, frame rate, units, time zone, revision metadata, migration and recovery                     | Existing films round-trip; renumbering preserves links; export/import retains all records and assets.                                                        |
| 2. Script breakdown          | Fountain import plus manual scene creation; cast, location, day/night, props, wardrobe, effects and notes tied to scenes                | A revised script can be reconciled without losing shot plans; every breakdown item is traceable to a scene.                                                  |
| 3. Scheduling                | Stripboard, shoot days, units, resource availability and conflict checks                                                                | Moving a scene updates daily plans and affected call sheets; location, actor and equipment conflicts are visible.                                            |
| 4. Shot and set planning     | Finish floor-plan tracing, reusable sets, setup variants, rigged actor motion, camera/focus tools, lighting modifiers and power routing | A crew can trace a location, block an actor, animate a camera/light, compare setups and export an actionable plan.                                           |
| 5. Production documents      | Versioned shot lists, storyboards, overheads, equipment lists, schedules, call sheets and continuity notes                              | PDF/CSV exports match approved snapshots, contain source IDs/revisions and print without clipping.                                                           |
| 6. Assets and media          | Large asset store, thumbnails/proxies, license and source metadata, version history, portable project archive                           | Large projects reopen reliably; missing, changed or unlicensed files are identifiable before handoff.                                                        |
| 7. Review and collaboration  | Optional self-hosted accounts, roles, comments, approvals, audit history, conflict handling and backups                                 | Reviewers cannot change plans; concurrent edits neither silently overwrite work nor corrupt the project.                                                     |
| 8. Rendering and interchange | Fast editor preview, progressive path-traced stills, queued animation renders, color-managed output, scene/timeline interchange         | Rendered frames use the saved shot camera, motion and asset versions; exports can be checked in another tool.                                                |
| 9. Scale and reliability     | Tablet input, accessibility, search/filter, pagination/virtualization, diagnostics and restore drills                                   | A benchmark project with 100 script scenes, 1,000 shots and a substantial asset library remains usable; backup and restore are exercised on another machine. |

These are delivery gates, not claims about current functionality. The current [feature gap matrix](FEATURE_GAP.md) covers the visual planning baseline.

## Rendering and interchange

Maintain a quick browser viewport for editing. Add a progressive quality mode for stills, then a self-hosted render worker for high-resolution frames and shot sequences. A render job must pin the production revision, scene, shot, frame range, camera, asset versions, lighting plan, renderer settings and color configuration; returning only an image without that provenance is insufficient for production review.

Evaluate [OpenUSD](https://openusd.org/) for layered 3D scene interchange, [OpenTimelineIO](https://opentimelineio.readthedocs.io/en/latest/) for editorial timing, and [OpenColorIO](https://opencolorio.org/) for consistent color. These are integration targets, not reasons to replace the editor's internal model wholesale. [AYON](https://docs.ayon.dev/) provides prior art for asset publishing and versioned studio workflows. Test a small export/import round-trip before committing to any interchange format.

## First implementation slice

Start with production identity and a script-scene breakdown linked to the existing set scenes and shots. Add stable IDs, scene numbers, INT/EXT, day/night, cast and department tags, then generate a breakdown report from the same records. Preserve all existing local projects through migration. This makes scheduling and call sheets possible without creating a second, conflicting shot database.

Do not start hosted collaboration or a render farm until project migration, asset references, revision snapshots and recovery are reliable. Server capacity improves throughput; it does not make an inaccurate scene or fixture model physically accurate.
