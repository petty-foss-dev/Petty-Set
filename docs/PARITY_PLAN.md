# Petty: Set parity plan

Target: the complete public [Lensflare](https://lensflare.io/) planning workflow, implemented independently with original code and assets. The [feature gap matrix](FEATURE_GAP.md) records the current baseline. This plan is an execution order, not a claim that advertised features have been audited inside Lensflare's signed-in editor.

## Product rules

- Keep local projects usable without an account or server. Hosted review and crew editing are optional services.
- Save one authoritative scene and shot model. Exports must derive from it rather than maintaining separate versions of the plan.
- Make imported assets portable and licensed for redistribution. Do not copy Lensflare's models, UI, or branding.
- Treat plan lighting as an estimate. Label calibrated photometry and indirect-light rendering separately from Lensflare parity.
- Ship each phase only after project round-trip validation, regression tests, and browser workflow checks.

## Delivery phases

| Phase                             | Work                                                                                                                                                                        | Acceptance gate                                                                                                                                                       |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Production handoff             | Single and batch shoot-day sheets, shot-list PDF, camera still export, consistent print layout                                                                              | Exported pages show the correct shot camera, actor marks, lights, power loads and set geometry in both story and shoot order; multi-page PDFs print without clipping. |
| 2. Shot setup variants            | Per-shot fixture positions and settings, saved Plan A/B alternatives, setup groups and comparison                                                                           | Switching a plan changes its preview and exports without changing the base set or other shots; JSON round-trip and undo/redo preserve every variant.                  |
| 3. Spatial editing                | Irregular room outlines, collinear wall overlap handling, multiple openings, finishes, multi-select, align/group, layers, keyboard commands, tracing over floor-plan images | Shared walls stay connected through edits; area and dimensions recalculate; doors/windows survive wall edits; locked or hidden layers behave predictably.             |
| 4. Asset library                  | Larger original furniture, architecture, vegetation and vehicle catalog; material controls; portable large-asset storage                                                    | Assets keep transforms and materials across save/export/import; a large film no longer depends on browser local-storage capacity.                                     |
| 5. Performance blocking           | Saved pose library, inverse-kinematic limb posing, path handles, easing and per-action timing, rigged animation library                                                     | An actor can travel through multiple rooms and transition between poses without joint snapping; marks and animation are shot-specific.                                |
| 6. Cinematography                 | Named camera and lens data, focus/DOF preview, curved camera moves, collision warnings, clean stills at chosen size/aspect                                                  | Camera preview and exported still use the saved sensor, lens, focus and frame; move playback follows editable curves.                                                 |
| 7. Lighting and power             | Modifiers, editable cable routes, equipment and power schedules, object-aware light coverage                                                                                | Plans and sheets agree on fixture setup and electrical totals; collision and overload warnings are actionable.                                                        |
| 8. Collaboration and film library | Multi-film local library, optional hosted persistence, review links, comments, invitations, roles, concurrent edits and branding                                            | A reviewer can comment without editing; authorized crew edits survive conflicts; local-only workflow still works.                                                     |
| 9. Release quality                | Accessibility, responsive/tablet input, large-scene performance, migration and recovery, documentation and license audit                                                    | Core workflows pass automated tests and desktop/tablet browser dogfooding with no data loss or new build warnings.                                                    |

## Parallel technical tracks

**Persistence.** Keep versioned project schema migrations and validate references at import. Move image and GLB bytes out of the current local-storage JSON into IndexedDB before expanding the catalog. Portable project archives must include all assets.

**Geometry.** Normalize wall/opening and room topology before adding more drawing tools. A wall may need multiple openings and several room memberships; splitting, merging and moving endpoints must preserve them.

**Shot state.** A scene owns shared structure. Each shot or named plan stores only differences for lights, cameras, actors and props. Resolve these differences through one function used by the viewport, floor plan, lists and exports.

**Rendering.** Keep the fast interactive preview. Add accurate profiles, soft shadows and indirect light as a separate quality mode with measured performance limits; do not label estimated lux as a calibrated exposure result.

**Hosted service.** Define identity, authorization, review snapshots, edit conflicts, storage limits and backup/restore before enabling crew editing. Keep the service optional for self-hosting.

## Current execution

Phase 1 now has current-shot PNG/PDF sheets, batch PDF and PNG ZIP sheets, a paginated shot-list PDF, a fixture/power schedule PDF and clean camera stills at selectable width and the saved shot aspect. Phase 2 has shot-specific lighting alternatives with independent fixture settings, side-by-side comparison and JSON round-trip. Phase 3 now has click-defined shaped rooms, collinear wall overlap handling, multiple door/window openings per wall in the viewport, plan, lighting trace and shoot-day sheet, and batch selection with alignment, translation, duplication and deletion. Shared partial walls, opening splits, room areas, saved openings and batch undo pass automated or browser checks. The remaining Phase 1 work is richer board and print layout options. Phase 2 still needs setup-level grouping and alternatives for cameras, props and blocking. Phase 3 still needs finishes, layers and tracing tools. Deliver later phases in order, updating this document and the gap matrix as each acceptance gate passes.
