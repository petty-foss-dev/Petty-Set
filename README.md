# petty: set

An open-source, local-first browser editor for visual shot planning and 3D previsualization. This project is part of the Petty FOSS family. It is an independent implementation inspired by film planning tools, including Lensflare, Open Shot Designer, and Blocking Room. It does not use their code, branding, or assets.

## Run locally

```sh
npm install
npm run dev
```

Open the address printed by Vite. The app stores the current project in this browser's local storage. Export a project file regularly if you need a durable backup.

## Preview

![Furnished rooms with an editable camera route](docs/screenshots/multi-room.jpg)

![Camera view inside the furnished scene](docs/screenshots/furnished-camera.jpg)

![Exterior scene with actor motion preview](docs/screenshots/exterior-motion.jpg)

![Backlot Main Street scene](docs/screenshots/backlot-main-street.png)

## Current features

- One film with multiple scenes; each scene has a separate editable 3D set.
- Draw walls on a quarter-meter grid with endpoint snapping, add framed doorways and windows, and position blocks, tables, chairs, sofas, bookcases, plants, rugs, wooden drawing mannequins with visible joints, camera tripods, and softbox lights. Edit dimensions, rotation, camera focal length, and light intensity, spread, and color.
- Add a furnished sample scene without replacing the current scene. All sample objects remain editable.
- Build an outdoor scene with grass, asphalt, sand, or studio ground; set sky color and sun direction/elevation; add original trees, park benches, vehicles, and paved ground patches. An exterior sample scene demonstrates the catalog.
- Dress a stylized backlot street with editable storefront, brick, and theater facades, streetlamps, barrels, sidewalks, and wooden actors. The Main Street sample includes an actor route and camera shot. The editor uses a warm studio palette inspired by classic movie-making games; all scene geometry and styling are original.
- Extend a selected wall into an adjoining room with a doorway, then furnish that room and route a camera move through it with editable waypoints.
- Import self-contained glTF 2.0 `.glb` assets up to 1 MB. Models are embedded in local project data and JSON exports; browser storage is capped at roughly 3 MB of project JSON.
- Switch lights between softbox, spotlight, and practical bulb previews. Set actor wood finish and choose a cinema, mirrorless, or broadcast camera body with sensor and lens presets.
- Undo and redo project edits; duplicate, hide, and lock set objects.
- Set actor positions and facing per shot, then add an end mark and waypoints for each actor. Preview actor movement with the shot timeline in stage, plan, or camera view; the mannequin shows a simple walk swing during playback.
- Import an image floor plan as a set reference; set its width, height, position, rotation, and opacity.
- Switch between orbiting 3D stage, top plan, and camera view.
- Add shots with separate cameras; choose a sensor gate, focal length, aperture, focus distance, and shot aspect ratio. The camera view shows framing guides and approximate depth-of-field limits.
- Arrange story and shoot order independently and export a shot-list CSV in either order.
- Capture camera frames into the storyboard; edit shot notes and duration.
- Export editable JSON, view PNG, and storyboard PDF.

## Parity roadmap

See the [feature gap matrix](docs/FEATURE_GAP.md) for a detailed comparison and build order.

This is an early editor, not yet a feature-complete Lensflare equivalent. The next work should add:

1. Modeling tools: connected wall corners, room scale controls, broader snapping, grouping, and a larger original asset catalog.
2. Cinematography: named camera bodies and lenses, visual depth of field, curved camera paths, collision-aware movement, and take variants.
3. Performance planning: manual joint posing, an action library, route timing/easing and collision checks, more lighting modifiers, power routing, and alternate plans.
4. Production outputs: floorplan and shoot-day sheets, equipment lists, batch exports, and polished print layouts.
5. Collaboration: project accounts, shareable review links, comments, crew roles, editing, and branding. This requires an optional server; local projects should continue to work without one.

## References

- [Lensflare](https://lensflare.io/) — product and workflow reference.
- [Open Shot Designer](https://github.com/koosoli/OpenShotDesigner) — GPLv3 production planning reference.
- [Blocking Room](https://github.com/mangerik/Blocking-Room) — MIT 3D blocking reference.
- [The Movies manual](https://cdn.steamstatic.com/steam/apps/7900/manuals/manual_english.pdf?t=1447351040) — set dressing, actor placement, weather, and lighting workflow reference.

## License

AGPL-3.0-or-later, matching the other Petty FOSS projects. See [LICENSE](LICENSE).
