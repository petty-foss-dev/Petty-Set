# petty: set

An open-source, local-first browser editor for visual shot planning and 3D previsualization. This project is part of the Petty FOSS family. It is an independent implementation inspired by film planning tools, including Lensflare, Open Shot Designer, and Blocking Room. It does not use their code, branding, or assets.

## Run locally

```sh
npm install
npm run dev
```

Open the address printed by Vite. The app stores the current project in this browser's local storage. Export a project file regularly if you need a durable backup.

## Current features

- One film with multiple scenes; each scene has a separate editable 3D set.
- Draw walls on a quarter-meter grid, add doorways and windows, and position blocks, tables, chairs, actors, cameras, and lights. Edit dimensions, rotation, camera focal length, and light intensity, spread, and color.
- Undo and redo project edits; duplicate, hide, and lock set objects.
- Set actor positions and facing per shot, with marks visible on the plan.
- Import an image floor plan as a set reference.
- Switch between orbiting 3D stage, top plan, and camera view.
- Add shots with separate cameras; arrange story and shoot order independently.
- Capture camera frames into the storyboard; edit shot notes and duration.
- Export editable JSON, view PNG, and storyboard PDF.

## Parity roadmap

This is an early editor, not yet a feature-complete Lensflare equivalent. The next work should add:

See the [feature gap matrix](docs/FEATURE_GAP.md) for a detailed comparison and build order.

1. Modeling tools: connected walls, room scale controls, broader snapping, grouping, and a larger original asset catalog.
2. Cinematography: more sensors and lenses, focus and depth of field, framelines, camera paths, and take variants.
3. Performance planning: actor poses and animation library, blocking paths, lighting modifiers, power routing, and alternate plans.
4. Production outputs: floorplan and shoot-day sheets, equipment lists, batch exports, and polished print layouts.
5. Collaboration: project accounts, shareable review links, comments, crew roles, editing, and branding. This requires an optional server; local projects should continue to work without one.

## References

- [Lensflare](https://lensflare.io/) — product and workflow reference.
- [Open Shot Designer](https://github.com/koosoli/OpenShotDesigner) — GPLv3 production planning reference.
- [Blocking Room](https://github.com/mangerik/Blocking-Room) — MIT 3D blocking reference.

## License

AGPL-3.0-or-later, matching the other Petty FOSS projects. See [LICENSE](LICENSE).
