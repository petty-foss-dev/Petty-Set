import { useEffect, useReducer, useRef, useState } from "react";
import type { ChangeEvent, SetStateAction } from "react";
import {
  Camera,
  ChevronDown,
  Clapperboard,
  Download,
  Copy,
  Eye,
  EyeOff,
  FileImage,
  FileText,
  Focus,
  Grip,
  LampDesk,
  LayoutGrid,
  Lightbulb,
  Lock,
  LockOpen,
  Menu,
  Move3D,
  MousePointer2,
  PenLine,
  Plus,
  Save,
  Square,
  Trash2,
  Redo2,
  Undo2,
  Upload,
  UserRound,
  Video,
  X,
} from "lucide-react";
import Stage from "./Stage";
import type { ViewMode } from "./Stage";
import { id, isProject, loadProject, makeItem, wallBetween } from "./model";
import type { ItemKind, Project, SceneItem, SetScene, Shot } from "./model";
import { historyReducer, projectHistory } from "./history";
import "./App.css";

const itemIcons: Record<ItemKind, typeof Square> = {
  wall: Square,
  actor: UserRound,
  camera: Camera,
  light: LampDesk,
  table: LayoutGrid,
  chair: Grip,
  box: Square,
};
const itemNames: Record<ItemKind, string> = {
  wall: "Wall",
  actor: "Actor",
  camera: "Camera",
  light: "Light",
  table: "Table",
  chair: "Chair",
  box: "Block",
};

function download(name: string, contents: string, type: string) {
  const url = URL.createObjectURL(new Blob([contents], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

function App() {
  const [history, dispatch] = useReducer(historyReducer, undefined, () =>
    projectHistory(loadProject()),
  );
  const project = history.present;
  const [sceneId, setSceneId] = useState(project.scenes[0].id);
  const [shotId, setShotId] = useState<string | undefined>(
    project.scenes[0].shots[0]?.id,
  );
  const [selectedId, setSelectedId] = useState<string>();
  const [mode, setMode] = useState<ViewMode>("stage");
  const [tool, setTool] = useState<"select" | "wall">("select");
  const [order, setOrder] = useState<"story" | "shoot">("story");
  const [showAdd, setShowAdd] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [mobilePanel, setMobilePanel] = useState<"left" | "right" | null>(null);
  const captureRef = useRef<(() => string) | null>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const floorplanRef = useRef<HTMLInputElement>(null);
  const scene =
    project.scenes.find((value) => value.id === sceneId) ?? project.scenes[0];
  const shot =
    scene.shots.find((value) => value.id === shotId) ?? scene.shots[0];
  const stageScene = {
    ...scene,
    items: scene.items.map((item) =>
      item.kind === "actor" && shot?.actorMarks?.[item.id]
        ? { ...item, ...shot.actorMarks[item.id] }
        : item,
    ),
  };
  const selected = stageScene.items.find((value) => value.id === selectedId);
  const orderedShots =
    order === "story"
      ? scene.shots
      : scene.shootOrder
          .map((value) => scene.shots.find((shot) => shot.id === value))
          .filter((value): value is Shot => !!value);

  useEffect(() => {
    localStorage.setItem("petty-set-project", JSON.stringify(project));
  }, [project]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "z")
        return;
      const target = event.target as HTMLElement;
      if (target.closest("input, textarea, [contenteditable]")) return;
      event.preventDefault();
      dispatch({ type: event.shiftKey ? "redo" : "undo" });
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  function setProject(update: SetStateAction<Project>) {
    dispatch({
      type: "edit",
      update: typeof update === "function" ? update : () => update,
    });
  }

  function updateScene(fn: (scene: SetScene) => SetScene) {
    setProject((current) => {
      const index = current.scenes.findIndex((value) => value.id === scene.id);
      if (index < 0) return current;
      const updated = fn(current.scenes[index]);
      if (updated === current.scenes[index]) return current;
      const scenes = [...current.scenes];
      scenes[index] = updated;
      return { ...current, scenes };
    });
  }

  function updateItem(id: string, patch: Partial<SceneItem>) {
    const source = scene.items.find((item) => item.id === id);
    if (
      source?.kind === "actor" &&
      shot &&
      !source.locked &&
      ["x", "y", "z", "rotation"].some((key) => key in patch)
    ) {
      const currentMark = shot.actorMarks?.[id] ?? {
        x: source.x,
        y: source.y,
        z: source.z,
        rotation: source.rotation,
      };
      const mark = {
        x: patch.x ?? currentMark.x,
        y: patch.y ?? currentMark.y,
        z: patch.z ?? currentMark.z,
        rotation: patch.rotation ?? currentMark.rotation,
      };
      updateScene((current) => ({
        ...current,
        shots: current.shots.map((value) =>
          value.id === shot.id
            ? { ...value, actorMarks: { ...value.actorMarks, [id]: mark } }
            : value,
        ),
      }));
      return;
    }
    updateScene((current) => {
      const item = current.items.find((value) => value.id === id);
      if (!item || (item.locked && !("locked" in patch || "hidden" in patch)))
        return current;
      return {
        ...current,
        items: current.items.map((value) =>
          value.id === id ? { ...value, ...patch } : value,
        ),
      };
    });
  }

  function addItem(kind: ItemKind) {
    const next = makeItem(
      kind,
      scene.items.filter((item) => item.kind === kind).length + 1,
    );
    updateScene((current) => ({ ...current, items: [...current.items, next] }));
    setSelectedId(next.id);
    setMode("stage");
    setShowAdd(false);
    setMobilePanel("right");
  }

  function addWall(
    start: { x: number; z: number },
    end: { x: number; z: number },
  ) {
    const wall = wallBetween(
      start,
      end,
      scene.items.filter((item) => item.kind === "wall").length + 1,
    );
    updateScene((current) => ({ ...current, items: [...current.items, wall] }));
    setSelectedId(wall.id);
  }

  function duplicateSelected() {
    if (!selected) return;
    const copy: SceneItem = {
      ...selected,
      id: id(),
      name: `${selected.name} copy`,
      x: selected.x + 0.5,
      z: selected.z + 0.5,
      hidden: false,
      locked: false,
    };
    updateScene((current) => ({ ...current, items: [...current.items, copy] }));
    setSelectedId(copy.id);
  }

  function deleteSelected() {
    if (!selected) return;
    const linkedShots = scene.shots.filter(
      (value) => value.cameraId === selected.id,
    );
    if (
      linkedShots.length &&
      !window.confirm(
        `Deleting this camera will also delete ${linkedShots.length} linked shot${linkedShots.length === 1 ? "" : "s"}. Continue?`,
      )
    )
      return;
    updateScene((current) => ({
      ...current,
      items: current.items.filter((item) => item.id !== selected.id),
      shots: current.shots
        .filter((value) => value.cameraId !== selected.id)
        .map((value) => {
          if (!value.actorMarks?.[selected.id]) return value;
          const actorMarks = { ...value.actorMarks };
          delete actorMarks[selected.id];
          return { ...value, actorMarks };
        }),
      shootOrder: current.shootOrder.filter(
        (value) => !linkedShots.some((shot) => shot.id === value),
      ),
    }));
    setSelectedId(undefined);
    if (shot?.cameraId === selected.id)
      setShotId(
        scene.shots.find((value) => value.cameraId !== selected.id)?.id,
      );
  }

  function addShot() {
    const source = scene.items.find((item) => item.id === shot?.cameraId);
    const camera = {
      ...makeItem(
        "camera",
        scene.items.filter((item) => item.kind === "camera").length + 1,
      ),
      x: (source?.x ?? 0) + 0.5,
      z: (source?.z ?? 3) + 0.5,
      rotation: source?.rotation ?? 0,
      focalLength: source?.focalLength ?? 35,
    };
    const next: Shot = {
      id: id(),
      title: `Shot ${scene.shots.length + 1}`,
      cameraId: camera.id,
      notes: "",
      duration: 5,
      actorMarks: Object.fromEntries(
        scene.items
          .filter((item) => item.kind === "actor")
          .map((item) => {
            const mark = shot?.actorMarks?.[item.id] ?? item;
            return [
              item.id,
              { x: mark.x, y: mark.y, z: mark.z, rotation: mark.rotation },
            ];
          }),
      ),
    };
    updateScene((current) => ({
      ...current,
      items: [...current.items, camera],
      shots: [...current.shots, next],
      shootOrder: [...current.shootOrder, next.id],
    }));
    setShotId(next.id);
    setSelectedId(camera.id);
  }

  function updateShot(patch: Partial<Shot>) {
    if (!shot) return;
    updateScene((current) => ({
      ...current,
      shots: current.shots.map((value) =>
        value.id === shot.id ? { ...value, ...patch } : value,
      ),
    }));
  }

  function moveShot(direction: -1 | 1) {
    if (!shot) return;
    updateScene((current) => {
      const ids =
        order === "shoot"
          ? [...current.shootOrder]
          : current.shots.map((value) => value.id);
      const position = ids.indexOf(shot.id);
      const other = position + direction;
      if (other < 0 || other >= ids.length) return current;
      [ids[position], ids[other]] = [ids[other], ids[position]];
      return order === "shoot"
        ? { ...current, shootOrder: ids }
        : {
            ...current,
            shots: ids.map((value) =>
              current.shots.find((shot) => shot.id === value)!,
            ),
          };
    });
  }

  function capture() {
    if (!shot || !captureRef.current) return;
    const frame = captureRef.current();
    updateShot({ frame });
  }

  async function exportPDF() {
    const { jsPDF } = await import("jspdf");
    const pdf = new jsPDF({
      orientation: "landscape",
      unit: "mm",
      format: "a4",
    });
    const shots = orderedShots;
    shots.forEach((entry, index) => {
      if (index) pdf.addPage();
      pdf.setFillColor(22, 25, 27);
      pdf.rect(0, 0, 297, 24, "F");
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(18);
      pdf.text(project.name, 12, 15);
      pdf.setFontSize(10);
      pdf.text(
        `${scene.name}  /  ${order === "shoot" ? "Shoot" : "Story"} order`,
        285,
        15,
        { align: "right" },
      );
      pdf.setTextColor(26, 29, 31);
      pdf.setFontSize(17);
      pdf.text(`${index + 1}. ${entry.title}`, 12, 39);
      if (entry.frame) pdf.addImage(entry.frame, "PNG", 12, 48, 174, 98);
      else {
        pdf.setFillColor(227, 229, 227);
        pdf.rect(12, 48, 174, 98, "F");
        pdf.setFontSize(11);
        pdf.text("Capture a camera frame to show it here.", 22, 98);
      }
      pdf.setFontSize(11);
      pdf.text(entry.notes || "No shot notes", 196, 56, { maxWidth: 88 });
      const camera = scene.items.find((item) => item.id === entry.cameraId);
      pdf.setFontSize(9);
      pdf.text(
        `${camera?.focalLength ?? 35} mm   ·   ${entry.duration}s`,
        12,
        157,
      );
    });
    if (shots.length === 0) {
      pdf.setFontSize(18);
      pdf.text("No shots yet", 12, 38);
    }
    pdf.save(
      `${project.name.replace(/[^a-z0-9-]/gi, "-").toLowerCase()}-storyboard.pdf`,
    );
    setShowExport(false);
  }

  async function importProject(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const value: unknown = JSON.parse(await file.text());
      if (!isProject(value)) throw new Error("Unsupported project");
      dispatch({ type: "replace", project: value });
      setSceneId(value.scenes[0].id);
      setShotId(value.scenes[0].shots[0]?.id);
      setSelectedId(undefined);
    } catch {
      window.alert("This is not a valid Petty: Set project file.");
    }
    event.target.value = "";
  }

  function uploadFloorplan(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () =>
      updateScene((current) => ({
        ...current,
        floorplan: String(reader.result),
      }));
    reader.readAsDataURL(file);
    event.target.value = "";
  }

  const cameraItem = scene.items.find((item) => item.id === shot?.cameraId);

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-symbol">
            <Focus size={22} strokeWidth={2.5} />
          </span>
          <span>
            petty<span className="brand-colon">:</span> set
          </span>
        </div>
        <div className="topbar-divider" />
        <input
          className="project-title"
          value={project.name}
          aria-label="Film name"
          onChange={(event) =>
            setProject((current) => ({ ...current, name: event.target.value }))
          }
        />
        <div className="history-actions">
          <button
            className="icon-button"
            aria-label="Undo"
            title="Undo (⌘Z)"
            disabled={!history.past.length}
            onClick={() => dispatch({ type: "undo" })}
          >
            <Undo2 size={17} />
          </button>
          <button
            className="icon-button"
            aria-label="Redo"
            title="Redo (⌘⇧Z)"
            disabled={!history.future.length}
            onClick={() => dispatch({ type: "redo" })}
          >
            <Redo2 size={17} />
          </button>
        </div>
        <span className="save-status">
          <Save size={14} />
          Saved locally
        </span>
        <div className="topbar-actions">
          <button
            className="icon-button mobile-menu"
            aria-label="Scenes and objects"
            onClick={() =>
              setMobilePanel(mobilePanel === "left" ? null : "left")
            }
          >
            <Menu size={19} />
          </button>
          <button
            className="secondary-button"
            onClick={() => importRef.current?.click()}
          >
            <Upload size={16} /> <span>Import</span>
          </button>
          <button
            className="primary-button"
            onClick={() => setShowExport(!showExport)}
          >
            <Download size={16} /> Export <ChevronDown size={14} />
          </button>
        </div>
        {showExport && (
          <div className="popover export-menu">
            <button
              onClick={() => {
                download(
                  `${project.name || "project"}.pettyset.json`,
                  JSON.stringify(project, null, 2),
                  "application/json",
                );
                setShowExport(false);
              }}
            >
              <Save size={16} /> Project file <small>Editable backup</small>
            </button>
            <button onClick={exportPDF}>
              <FileText size={16} /> Storyboard PDF{" "}
              <small>{order === "shoot" ? "Shoot" : "Story"} order</small>
            </button>
            <button
              onClick={() => {
                const image = captureRef.current?.();
                if (image) {
                  const link = document.createElement("a");
                  link.href = image;
                  link.download = `${shot?.title || "stage"}.png`;
                  link.click();
                }
                setShowExport(false);
              }}
            >
              <FileImage size={16} /> Current view PNG{" "}
              <small>Full resolution</small>
            </button>
          </div>
        )}
        <input
          ref={importRef}
          hidden
          type="file"
          accept=".json,.pettyset.json,application/json"
          onChange={importProject}
        />
        <input
          ref={floorplanRef}
          hidden
          type="file"
          accept="image/*"
          onChange={uploadFloorplan}
        />
      </header>

      <div className="workspace">
        <aside className={`left-panel ${mobilePanel === "left" ? "open" : ""}`}>
          <div className="panel-heading">
            <span>Production</span>
            <button
              className="icon-button mobile-close"
              aria-label="Close panel"
              onClick={() => setMobilePanel(null)}
            >
              <X size={18} />
            </button>
          </div>
          <div className="scene-picker">
            <label htmlFor="scene-select">SCENE</label>
            <select
              id="scene-select"
              value={scene.id}
              onChange={(event) => {
                setSceneId(event.target.value);
                const next = project.scenes.find(
                  (value) => value.id === event.target.value,
                );
                setShotId(next?.shots[0]?.id);
                setSelectedId(undefined);
              }}
            >
              {project.scenes.map((value) => (
                <option key={value.id} value={value.id}>
                  {value.name}
                </option>
              ))}
            </select>
            <button
              className="text-button"
              onClick={() => {
                const next: SetScene = {
                  id: id(),
                  name: `Scene ${project.scenes.length + 1}`,
                  items: [],
                  shots: [],
                  shootOrder: [],
                };
                setProject((current) => ({
                  ...current,
                  scenes: [...current.scenes, next],
                }));
                setSceneId(next.id);
                setShotId(undefined);
                setSelectedId(undefined);
              }}
            >
              <Plus size={15} /> New scene
            </button>
          </div>
          <div className="section-title">
            <span>
              SET OBJECTS <b>{scene.items.length}</b>
            </span>
            <button
              className="icon-button"
              aria-label="Add object"
              onClick={() => setShowAdd(!showAdd)}
            >
              <Plus size={17} />
            </button>
          </div>
          {showAdd && (
            <div className="add-grid">
              {(Object.keys(itemNames) as ItemKind[]).map((kind) => {
                const Icon = itemIcons[kind];
                return (
                  <button key={kind} onClick={() => addItem(kind)}>
                    <Icon size={19} />
                    <span>{itemNames[kind]}</span>
                  </button>
                );
              })}
            </div>
          )}
          <div className="object-list">
            {scene.items.map((item) => {
              const Icon = itemIcons[item.kind];
              return (
                <button
                  key={item.id}
                  className={`object-row ${item.id === selectedId ? "selected" : ""}`}
                  onClick={() => {
                    setSelectedId(item.id);
                    setMobilePanel(null);
                  }}
                >
                  <span className={`object-icon ${item.kind}`}>
                    <Icon size={16} />
                  </span>
                  <span>{item.name}</span>
                  <span className="object-type">{itemNames[item.kind]}</span>
                </button>
              );
            })}
          </div>
          <div className="left-bottom">
            <button onClick={() => floorplanRef.current?.click()}>
              <Upload size={16} />{" "}
              {scene.floorplan ? "Replace floor plan" : "Import floor plan"}
            </button>
            {scene.floorplan && (
              <button
                className="remove-plan"
                onClick={() =>
                  updateScene((current) => ({
                    ...current,
                    floorplan: undefined,
                  }))
                }
              >
                Remove
              </button>
            )}
          </div>
        </aside>

        <main className="main-area">
          <div className="viewport-toolbar">
            <div className="mode-switch">
              <button
                className={mode === "stage" ? "active" : ""}
                onClick={() => {
                  setMode("stage");
                  setTool("select");
                }}
              >
                <Move3D size={16} /> 3D stage
              </button>
              <button
                className={mode === "plan" ? "active" : ""}
                onClick={() => setMode("plan")}
              >
                <LayoutGrid size={16} /> Plan
              </button>
              <button
                className={mode === "camera" ? "active" : ""}
                onClick={() => {
                  setMode("camera");
                  setTool("select");
                }}
                disabled={!shot}
              >
                <Camera size={16} /> Camera
              </button>
            </div>
            <div className="tool-switch">
              <button
                className={tool === "select" ? "active" : ""}
                aria-label="Select tool"
                title="Select and move"
                onClick={() => setTool("select")}
              >
                <MousePointer2 size={15} />
              </button>
              <button
                className={tool === "wall" ? "active" : ""}
                aria-label="Draw wall"
                title="Draw walls in plan view"
                onClick={() => {
                  setTool("wall");
                  setMode("plan");
                  setSelectedId(undefined);
                }}
              >
                <PenLine size={15} /> Draw wall
              </button>
            </div>
            <div className="view-label">
              {mode === "camera"
                ? `${cameraItem?.focalLength ?? 35} mm · Super 35`
                : mode === "plan"
                  ? "TOP VIEW · METERS"
                  : "PERSPECTIVE VIEW"}
            </div>
            <button
              className="icon-button mobile-inspector"
              aria-label="Shot and object details"
              onClick={() =>
                setMobilePanel(mobilePanel === "right" ? null : "right")
              }
            >
              <Focus size={20} />
            </button>
          </div>
          <div className="stage-wrap">
            <Stage
              scene={stageScene}
              shot={shot}
              selectedId={selectedId}
              mode={mode}
              tool={tool}
              onSelect={setSelectedId}
              onMove={(value, x, y, z) => updateItem(value, { x, y, z })}
              onAddWall={addWall}
              captureRef={captureRef}
            />
            <div className="stage-hint">
              {tool === "wall" && mode === "plan"
                ? "Drag on the plan to draw a wall · snaps to 0.25 m"
                : mode === "camera"
                  ? "Shot preview · select 3D stage to edit"
                  : "Click an object to select · drag the arrows to move · scroll to zoom"}
            </div>
            {mode === "camera" && (
              <div className="camera-actions">
                <button onClick={capture}>
                  <Camera size={16} /> Capture frame
                </button>
              </div>
            )}
          </div>
          <section className="shot-panel">
            <div className="shot-panel-heading">
              <div>
                <span className="eyebrow">SEQUENCE</span>
                <h2>
                  Shots <span>{scene.shots.length}</span>
                </h2>
              </div>
              <div className="shot-controls">
                <div className="order-switch">
                  <button
                    className={order === "story" ? "active" : ""}
                    onClick={() => setOrder("story")}
                  >
                    Story order
                  </button>
                  <button
                    className={order === "shoot" ? "active" : ""}
                    onClick={() => setOrder("shoot")}
                  >
                    Shoot order
                  </button>
                </div>
                <button className="small-primary" onClick={addShot}>
                  <Plus size={16} /> Add shot
                </button>
              </div>
            </div>
            <div className="shot-strip">
              {orderedShots.map((entry, index) => (
                <button
                  key={entry.id}
                  className={`shot-card ${entry.id === shot?.id ? "active" : ""}`}
                  onClick={() => {
                    setShotId(entry.id);
                    setSelectedId(entry.cameraId);
                  }}
                >
                  <div className="shot-thumb">
                    {entry.frame ? (
                      <img src={entry.frame} alt="Captured shot" />
                    ) : (
                      <>
                        <Video size={23} />
                        <span>NO FRAME</span>
                      </>
                    )}
                  </div>
                  <div className="shot-card-meta">
                    <b>{String(index + 1).padStart(2, "0")}</b>
                    <span>{entry.title}</span>
                    <small>
                      {scene.items.find((item) => item.id === entry.cameraId)
                        ?.focalLength ?? 35}
                      mm
                    </small>
                  </div>
                </button>
              ))}
              {!scene.shots.length && (
                <p className="empty-shots">
                  Add a shot to place a camera and start your storyboard.
                </p>
              )}
            </div>
          </section>
        </main>

        <aside
          className={`right-panel ${mobilePanel === "right" ? "open" : ""}`}
        >
          <div className="panel-heading">
            <span>Inspector</span>
            <button
              className="icon-button mobile-close"
              aria-label="Close panel"
              onClick={() => setMobilePanel(null)}
            >
              <X size={18} />
            </button>
          </div>
          {selected ? (
            <div className="inspector-content">
              <div className="inspector-kind">
                {itemNames[selected.kind].toUpperCase()}
              </div>
              <input
                className="inspector-name"
                aria-label="Object name"
                value={selected.name}
                disabled={selected.locked}
                onChange={(event) =>
                  updateItem(selected.id, { name: event.target.value })
                }
              />
              <div className="inspector-actions">
                <button
                  aria-label="Duplicate object"
                  title="Duplicate object"
                  onClick={duplicateSelected}
                >
                  <Copy size={16} />
                </button>
                <button
                  aria-label={selected.hidden ? "Show object" : "Hide object"}
                  title={selected.hidden ? "Show object" : "Hide object"}
                  onClick={() =>
                    updateItem(selected.id, { hidden: !selected.hidden })
                  }
                >
                  {selected.hidden ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
                <button
                  aria-label={selected.locked ? "Unlock object" : "Lock object"}
                  title={selected.locked ? "Unlock object" : "Lock object"}
                  onClick={() =>
                    updateItem(selected.id, { locked: !selected.locked })
                  }
                >
                  {selected.locked ? (
                    <Lock size={16} />
                  ) : (
                    <LockOpen size={16} />
                  )}
                </button>
              </div>
              <fieldset className="inspector-fields" disabled={selected.locked}>
                {selected.kind === "actor" && shot && (
                  <div className="actor-mark-note">
                    Position and facing are saved for this shot.
                    {shot.actorMarks?.[selected.id] && (
                      <button
                        onClick={() =>
                          updateScene((current) => ({
                            ...current,
                            shots: current.shots.map((value) => {
                              if (value.id !== shot.id) return value;
                              const actorMarks = { ...value.actorMarks };
                              delete actorMarks[selected.id];
                              return { ...value, actorMarks };
                            }),
                          }))
                        }
                      >
                        Reset mark
                      </button>
                    )}
                  </div>
                )}
                <div className="field-section">
                  <h3>Transform</h3>
                  <div className="field-grid">
                    {(["x", "y", "z"] as const).map((key) => (
                      <label key={key}>
                        <span>{key.toUpperCase()}</span>
                        <input
                          type="number"
                          step="0.1"
                          value={Number(selected[key].toFixed(2))}
                          onChange={(event) =>
                            updateItem(selected.id, {
                              [key]: Number(event.target.value),
                            })
                          }
                        />
                      </label>
                    ))}
                  </div>
                  <label className="full-field">
                    <span>Rotation</span>
                    <div>
                      <input
                        type="number"
                        value={selected.rotation}
                        onChange={(event) =>
                          updateItem(selected.id, {
                            rotation: Number(event.target.value),
                          })
                        }
                      />
                      <em>°</em>
                    </div>
                  </label>
                </div>
                <div className="field-section">
                  <h3>Dimensions</h3>
                  <div className="field-grid">
                    {(["width", "height", "depth"] as const).map((key) => (
                      <label key={key}>
                        <span>{key}</span>
                        <input
                          type="number"
                          min="0.1"
                          step="0.1"
                          value={selected[key]}
                          onChange={(event) =>
                            updateItem(selected.id, {
                              [key]: Math.max(0.1, Number(event.target.value)),
                            })
                          }
                        />
                      </label>
                    ))}
                  </div>
                </div>
                {selected.kind === "wall" && (
                  <div className="field-section">
                    <h3>Opening</h3>
                    <label className="full-field">
                      <span>Type</span>
                      <select
                        value={selected.opening?.type ?? "none"}
                        onChange={(event) => {
                          const type = event.target.value;
                          updateItem(selected.id, {
                            opening:
                              type === "none"
                                ? undefined
                                : {
                                    type: type as "door" | "window",
                                    offset: 0,
                                    width: Math.min(1, selected.width - 0.1),
                                    height: type === "door" ? 2.1 : 1,
                                    sill: type === "door" ? 0 : 1,
                                  },
                          });
                        }}
                      >
                        <option value="none">None</option>
                        <option value="door">Doorway</option>
                        <option value="window">Window</option>
                      </select>
                    </label>
                    {selected.opening && (
                      <>
                        <div className="field-grid opening-fields">
                          {(["offset", "width", "height"] as const).map(
                            (key) => (
                              <label key={key}>
                                <span>{key}</span>
                                <input
                                  type="number"
                                  step="0.1"
                                  min={key === "offset" ? undefined : 0.1}
                                  value={selected.opening![key]}
                                  onChange={(event) =>
                                    updateItem(selected.id, {
                                      opening: {
                                        ...selected.opening!,
                                        [key]: Number(event.target.value),
                                      },
                                    })
                                  }
                                />
                              </label>
                            ),
                          )}
                        </div>
                        {selected.opening.type === "window" && (
                          <label className="full-field">
                            <span>Sill height</span>
                            <input
                              type="number"
                              min="0"
                              step="0.1"
                              value={selected.opening.sill}
                              onChange={(event) =>
                                updateItem(selected.id, {
                                  opening: {
                                    ...selected.opening!,
                                    sill: Number(event.target.value),
                                  },
                                })
                              }
                            />
                          </label>
                        )}
                      </>
                    )}
                  </div>
                )}
                {selected.kind === "camera" && (
                  <div className="field-section">
                    <h3>Lens</h3>
                    <label className="full-field">
                      <span>Focal length</span>
                      <div>
                        <input
                          type="number"
                          min="8"
                          max="400"
                          value={selected.focalLength ?? 35}
                          onChange={(event) =>
                            updateItem(selected.id, {
                              focalLength: Number(event.target.value),
                            })
                          }
                        />
                        <em>mm</em>
                      </div>
                    </label>
                    <p className="field-note">Super 35 sensor · 24 mm height</p>
                  </div>
                )}
                {selected.kind === "light" && (
                  <div className="field-section">
                    <h3>Light</h3>
                    <label className="full-field">
                      <span>Intensity</span>
                      <input
                        type="range"
                        min="0"
                        max="8"
                        step=".1"
                        value={selected.intensity ?? 2}
                        onChange={(event) =>
                          updateItem(selected.id, {
                            intensity: Number(event.target.value),
                          })
                        }
                      />
                    </label>
                    <label className="full-field">
                      <span>Beam spread</span>
                      <div>
                        <input
                          type="number"
                          min="5"
                          max="160"
                          value={selected.spread ?? 45}
                          onChange={(event) =>
                            updateItem(selected.id, {
                              spread: Number(event.target.value),
                            })
                          }
                        />
                        <em>°</em>
                      </div>
                    </label>
                    <label className="full-field">
                      <span>Color</span>
                      <input
                        type="color"
                        value={selected.color ?? "#fff4df"}
                        onChange={(event) =>
                          updateItem(selected.id, { color: event.target.value })
                        }
                      />
                    </label>
                    <p className="field-note">
                      Preview lighting is illustrative, not photometric.
                    </p>
                  </div>
                )}
              </fieldset>
              <button className="delete-button" onClick={deleteSelected}>
                <Trash2 size={15} /> Delete object
              </button>
            </div>
          ) : (
            <div className="inspector-empty">
              <Lightbulb size={23} />
              <p>Select an object on the stage or in the list to edit it.</p>
            </div>
          )}
          {shot && (
            <div className="shot-inspector">
              <div className="section-title">
                <span>CURRENT SHOT</span>
                <Clapperboard size={16} />
              </div>
              <label>
                Title
                <input
                  value={shot.title}
                  onChange={(event) =>
                    updateShot({ title: event.target.value })
                  }
                />
              </label>
              <label>
                Notes
                <textarea
                  rows={3}
                  value={shot.notes}
                  onChange={(event) =>
                    updateShot({ notes: event.target.value })
                  }
                  placeholder="Blocking, action, or setup notes"
                />
              </label>
              <label>
                Duration <span className="unit">seconds</span>
                <input
                  type="number"
                  min="1"
                  value={shot.duration}
                  onChange={(event) =>
                    updateShot({
                      duration: Math.max(1, Number(event.target.value)),
                    })
                  }
                />
              </label>
              <div className="shot-inspector-actions">
                <button
                  onClick={() => moveShot(-1)}
                  aria-label="Move shot earlier"
                >
                  ↑
                </button>
                <button
                  onClick={() => moveShot(1)}
                  aria-label="Move shot later"
                >
                  ↓
                </button>
                <button
                  onClick={() => {
                    updateScene((current) => ({
                      ...current,
                      shots: current.shots.filter(
                        (value) => value.id !== shot.id,
                      ),
                      shootOrder: current.shootOrder.filter(
                        (value) => value !== shot.id,
                      ),
                    }));
                    setShotId(
                      scene.shots.find((value) => value.id !== shot.id)?.id,
                    );
                  }}
                  aria-label="Delete shot"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

export default App;
