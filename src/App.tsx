import { useEffect, useMemo, useReducer, useRef, useState } from "react";
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
  Play,
  Pause,
  Plus,
  Save,
  Square,
  Trash2,
  Redo2,
  Ruler,
  Sofa,
  BookOpen,
  Flower2,
  RectangleHorizontal,
  Box as BoxIcon,
  Building2,
  Undo2,
  Upload,
  UserRound,
  Video,
  X,
} from "lucide-react";
import Stage from "./Stage";
import type { ViewMode } from "./Stage";
import {
  extendRoom,
  backlotScene,
  mannequinJointControls,
  mannequinJointsForPose,
  mannequinPoseForJoints,
  furnishedScene,
  outdoorScene,
  id,
  isProject,
  loadProject,
  makeItem,
  wallBetween,
} from "./model";
import type {
  ActorPath,
  ItemKind,
  MannequinJoints,
  Project,
  SceneEnvironment,
  SceneItem,
  SetScene,
  Shot,
} from "./model";
import { historyReducer, projectHistory } from "./history";
import { aspectRatios, cameraOptics, sensors } from "./cinematography";
import type { AspectRatio, SensorId } from "./cinematography";
import { shotListCSV } from "./shotList";
import { actorActions } from "./actorActions";
import type { ActorAction } from "./actorActions";
import * as THREE from "three";
import "./App.css";

const itemIcons: Record<ItemKind, typeof Square> = {
  wall: Square,
  actor: UserRound,
  camera: Camera,
  light: LampDesk,
  power: Lightbulb,
  table: LayoutGrid,
  chair: Grip,
  box: Square,
  sofa: Sofa,
  shelf: BookOpen,
  plant: Flower2,
  rug: RectangleHorizontal,
  tree: Flower2,
  bench: Grip,
  vehicle: BoxIcon,
  ground: RectangleHorizontal,
  facade: Building2,
  streetlamp: Lightbulb,
  barrel: BoxIcon,
  asset: BoxIcon,
};
const itemNames: Record<ItemKind, string> = {
  wall: "Wall",
  actor: "Actor",
  camera: "Camera",
  light: "Light",
  power: "Power source",
  table: "Table",
  chair: "Chair",
  box: "Block",
  sofa: "Sofa",
  shelf: "Bookcase",
  plant: "Plant",
  rug: "Rug",
  tree: "Tree",
  bench: "Park bench",
  vehicle: "Vehicle",
  ground: "Ground patch",
  facade: "Backlot facade",
  streetlamp: "Streetlamp",
  barrel: "Barrel",
  asset: "3D asset",
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
  const [poseMode, setPoseMode] = useState(false);
  const [actionSearch, setActionSearch] = useState("");
  const [order, setOrder] = useState<"story" | "shoot">("story");
  const [showAdd, setShowAdd] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [showFloorplanControls, setShowFloorplanControls] = useState(false);
  const [mobilePanel, setMobilePanel] = useState<"left" | "right" | null>(null);
  const [moveProgress, setMoveProgress] = useState(0);
  const [playingMove, setPlayingMove] = useState(false);
  const captureRef = useRef<(() => string) | null>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const floorplanRef = useRef<HTMLInputElement>(null);
  const assetRef = useRef<HTMLInputElement>(null);
  const moveStartRef = useRef(0);
  const scene =
    project.scenes.find((value) => value.id === sceneId) ?? project.scenes[0];
  const shot =
    scene.shots.find((value) => value.id === shotId) ?? scene.shots[0];
  const environment: SceneEnvironment = scene.environment ?? {
    ground: "studio",
    skyColor: "#dce0de",
    sunAzimuth: 35,
    sunElevation: 55,
  };
  const stageScene = useMemo(
    () => ({
      ...scene,
      items: scene.items.map((item) =>
        item.kind === "actor" && shot?.actorMarks?.[item.id]
          ? { ...item, ...shot.actorMarks[item.id] }
          : item,
      ),
    }),
    [scene, shot],
  );
  const selected = stageScene.items.find((value) => value.id === selectedId);
  const selectedPowerSource = scene.items.find(
    (item) => item.id === selected?.powerSourceId,
  );
  const selectedPowerLoads = scene.items.filter(
    (item) => item.powerSourceId === selected?.id,
  );
  const assignedWatts = selectedPowerLoads.reduce(
    (sum, item) => sum + (item.powerWatts ?? 150),
    0,
  );
  const selectedJoints =
    selected?.kind === "actor"
      ? (shot?.actorJoints?.[selected.id] ??
        selected.mannequinJoints ??
        mannequinJointsForPose(selected.mannequinPose))
      : undefined;
  const orderedShots =
    order === "story"
      ? scene.shots
      : scene.shootOrder
          .map((value) => scene.shots.find((shot) => shot.id === value))
          .filter((value): value is Shot => !!value);
  const activeShotIndex = orderedShots.findIndex(
    (entry) => entry.id === shot?.id,
  );
  const hasMotion =
    !!shot?.cameraEnd ||
    !!Object.keys(shot?.actorPaths ?? {}).length ||
    !!Object.keys(shot?.actorActions ?? {}).length;

  useEffect(() => {
    localStorage.setItem("petty-set-project", JSON.stringify(project));
  }, [project]);

  useEffect(() => {
    if (
      !playingMove ||
      (!shot?.cameraEnd &&
        !Object.keys(shot?.actorPaths ?? {}).length &&
        !Object.keys(shot?.actorActions ?? {}).length)
    )
      return;
    let handle = 0;
    const tick = (now: number) => {
      const progress = Math.min(
        1,
        (now - moveStartRef.current) / (shot.duration * 1000),
      );
      setMoveProgress(progress);
      if (progress < 1) handle = requestAnimationFrame(tick);
      else setPlayingMove(false);
    };
    handle = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(handle);
  }, [
    playingMove,
    shot?.cameraEnd,
    shot?.actorPaths,
    shot?.actorActions,
    shot?.duration,
  ]);

  function resetMove() {
    setPlayingMove(false);
    setMoveProgress(0);
  }

  function activateShot(entry: Shot) {
    setShotId(entry.id);
    resetMove();
    setSelectedId(entry.cameraId);
  }

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

  function updateEnvironment(patch: Partial<SceneEnvironment>) {
    updateScene((current) => ({
      ...current,
      environment: {
        ground: "studio",
        skyColor: "#dce0de",
        sunAzimuth: 35,
        sunElevation: 55,
        ...current.environment,
        ...patch,
      },
    }));
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

  async function importAsset(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > 1_000_000) {
      window.alert(
        "Use a GLB smaller than 1 MB. This local project embeds imported assets in its JSON export.",
      );
      return;
    }
    if (!file.name.toLowerCase().endsWith(".glb")) {
      window.alert("Choose a binary glTF (.glb) model.");
      return;
    }
    try {
      const bytes = await file.arrayBuffer();
      const header = new DataView(bytes);
      if (
        header.getUint32(0, true) !== 0x46546c67 ||
        header.getUint32(4, true) !== 2
      )
        throw new Error("Invalid GLB");
      const jsonLength = header.getUint32(12, true);
      if (
        header.getUint32(16, true) !== 0x4e4f534a ||
        20 + jsonLength > bytes.byteLength
      )
        throw new Error("Invalid GLB JSON");
      const manifest = JSON.parse(
        new TextDecoder().decode(bytes.slice(20, 20 + jsonLength)),
      ) as { buffers?: { uri?: string }[]; images?: { uri?: string }[] };
      if (
        [...(manifest.buffers ?? []), ...(manifest.images ?? [])].some(
          (entry) => entry.uri && !entry.uri.startsWith("data:"),
        )
      )
        throw new Error("External resource");
      const { GLTFLoader } = await import("three/addons/loaders/GLTFLoader.js");
      const model = await new GLTFLoader().parseAsync(bytes, "");
      const box = new THREE.Box3().setFromObject(model.scene);
      if (box.isEmpty()) throw new Error("Empty model");
      const encoded = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(",")[1]);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
      const assetData = `data:model/gltf-binary;base64,${encoded}`;
      const currentBytes = JSON.stringify(project).length;
      if (currentBytes + assetData.length > 3_000_000) {
        window.alert(
          "This project is near the browser storage limit. Export a project backup or use a smaller asset.",
        );
        return;
      }
      const size = box.getSize(new THREE.Vector3());
      const next = {
        ...makeItem(
          "asset",
          scene.items.filter((item) => item.kind === "asset").length + 1,
        ),
        name: file.name.replace(/\.glb$/i, ""),
        width: Math.max(0.1, size.x),
        height: Math.max(0.1, size.y),
        depth: Math.max(0.1, size.z),
        assetData,
      };
      updateScene((current) => ({
        ...current,
        items: [...current.items, next],
      }));
      setSelectedId(next.id);
      setMode("stage");
    } catch {
      window.alert(
        "This GLB could not be loaded. Export a self-contained glTF 2.0 binary model and try again.",
      );
    }
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
      ...(selected.kind === "actor" && selectedJoints
        ? { mannequinJoints: { ...selectedJoints } }
        : {}),
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
      items: current.items
        .filter((item) => item.id !== selected.id)
        .map((item) =>
          item.powerSourceId === selected.id
            ? { ...item, powerSourceId: undefined }
            : item,
        ),
      shots: current.shots
        .filter((value) => value.cameraId !== selected.id)
        .map((value) => {
          if (
            !value.actorMarks?.[selected.id] &&
            !value.actorPaths?.[selected.id] &&
            !value.actorJoints?.[selected.id] &&
            !value.actorActions?.[selected.id]
          )
            return value;
          const actorMarks = { ...value.actorMarks };
          const actorPaths = { ...value.actorPaths };
          const actorJoints = { ...value.actorJoints };
          const actorActions = { ...value.actorActions };
          delete actorMarks[selected.id];
          delete actorPaths[selected.id];
          delete actorJoints[selected.id];
          delete actorActions[selected.id];
          return {
            ...value,
            actorMarks,
            actorPaths,
            actorJoints,
            actorActions,
          };
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
    if (shot?.cameraId === selected.id) resetMove();
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
      cameraBody: source?.cameraBody ?? "cinema",
      sensor: source?.sensor ?? "super35",
      aperture: source?.aperture ?? 2.8,
      focusDistance: source?.focusDistance ?? 3,
    };
    const next: Shot = {
      id: id(),
      title: `Shot ${scene.shots.length + 1}`,
      cameraId: camera.id,
      notes: "",
      duration: 5,
      aspectRatio: shot?.aspectRatio ?? "16:9",
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
      actorJoints: shot?.actorJoints
        ? Object.fromEntries(
            Object.entries(shot.actorJoints).map(([actorId, joints]) => [
              actorId,
              { ...joints },
            ]),
          )
        : undefined,
      actorActions: shot?.actorActions
        ? Object.fromEntries(
            Object.entries(shot.actorActions).map(([actorId, action]) => [
              actorId,
              { ...action },
            ]),
          )
        : undefined,
    };
    updateScene((current) => ({
      ...current,
      items: [...current.items, camera],
      shots: [...current.shots, next],
      shootOrder: [...current.shootOrder, next.id],
    }));
    setShotId(next.id);
    resetMove();
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

  function updateActorPath(actorId: string, path?: ActorPath) {
    if (!shot) return;
    const actorPaths = { ...shot.actorPaths };
    if (path) actorPaths[actorId] = path;
    else delete actorPaths[actorId];
    updateShot({ actorPaths });
    resetMove();
  }

  function updateActorJoints(actorId: string, joints?: MannequinJoints) {
    if (shot) {
      const actorJoints = { ...shot.actorJoints };
      if (joints) actorJoints[actorId] = joints;
      else delete actorJoints[actorId];
      updateShot({ actorJoints });
    } else {
      updateItem(actorId, { mannequinJoints: joints });
    }
  }

  function updateActorAction(actorId: string, action?: ActorAction) {
    if (!shot) return;
    const actorActions = { ...shot.actorActions };
    if (action) actorActions[actorId] = action;
    else delete actorActions[actorId];
    updateShot({ actorActions });
    resetMove();
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
      resetMove();
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
    reader.onload = () => {
      const source = String(reader.result);
      const image = new Image();
      image.onload = () => {
        updateScene((current) => ({
          ...current,
          floorplan: source,
          floorplanPlacement: {
            x: 0,
            z: 0,
            width: 10,
            height: Number(
              ((10 * image.naturalHeight) / image.naturalWidth).toFixed(2),
            ),
            rotation: 0,
            opacity: 0.65,
          },
        }));
        setShowFloorplanControls(true);
        setMode("plan");
      };
      image.onerror = () => window.alert("This image could not be read.");
      image.src = source;
    };
    reader.readAsDataURL(file);
    event.target.value = "";
  }

  function updateFloorplanPlacement(
    patch: Partial<NonNullable<SetScene["floorplanPlacement"]>>,
  ) {
    updateScene((current) => ({
      ...current,
      floorplanPlacement: {
        x: 0,
        z: 0,
        width: 10,
        height: 10,
        rotation: 0,
        opacity: 0.65,
        ...current.floorplanPlacement,
        ...patch,
      },
    }));
  }

  const cameraItem = scene.items.find((item) => item.id === shot?.cameraId);
  const optics = cameraItem
    ? cameraOptics(
        cameraItem.sensor ?? "super35",
        cameraItem.focalLength ?? 35,
        cameraItem.aperture ?? 2.8,
        cameraItem.focusDistance ?? 3,
        shot?.aspectRatio ?? "16:9",
      )
    : undefined;

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
                download(
                  `${project.name || "project"}-${order}-shot-list.csv`,
                  shotListCSV(scene, orderedShots),
                  "text/csv;charset=utf-8",
                );
                setShowExport(false);
              }}
            >
              <FileText size={16} /> Shot list CSV{" "}
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
        <input
          ref={assetRef}
          hidden
          type="file"
          accept=".glb,model/gltf-binary"
          onChange={importAsset}
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
                resetMove();
                setSelectedId(undefined);
              }}
            >
              {project.scenes.map((value) => (
                <option key={value.id} value={value.id}>
                  {value.name}
                </option>
              ))}
            </select>
            <input
              className="scene-name"
              aria-label="Scene name"
              value={scene.name}
              onChange={(event) =>
                updateScene((current) => ({
                  ...current,
                  name: event.target.value,
                }))
              }
            />
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
                resetMove();
                setSelectedId(undefined);
              }}
            >
              <Plus size={15} /> New scene
            </button>
            <button
              className="text-button"
              onClick={() => {
                const next = furnishedScene();
                setProject((current) => ({
                  ...current,
                  scenes: [...current.scenes, next],
                }));
                setSceneId(next.id);
                setShotId(next.shots[0].id);
                resetMove();
                setSelectedId(undefined);
                setMode("stage");
              }}
            >
              <Sofa size={15} /> Furnished scene
            </button>
            <button
              className="text-button"
              onClick={() => {
                const next = outdoorScene();
                setProject((current) => ({
                  ...current,
                  scenes: [...current.scenes, next],
                }));
                setSceneId(next.id);
                setShotId(next.shots[0].id);
                resetMove();
                setSelectedId(undefined);
                setMode("stage");
              }}
            >
              <Flower2 size={15} /> Outdoor scene
            </button>
            <button
              className="text-button"
              onClick={() => {
                const next = backlotScene();
                setProject((current) => ({
                  ...current,
                  scenes: [...current.scenes, next],
                }));
                setSceneId(next.id);
                setShotId(next.shots[0].id);
                resetMove();
                setSelectedId(undefined);
                setMode("stage");
              }}
            >
              <Building2 size={15} /> Backlot scene
            </button>
          </div>
          <div className="environment-fields">
            <h3>Setting</h3>
            <label>
              <span>Ground</span>
              <select
                value={environment.ground}
                onChange={(event) =>
                  updateEnvironment({
                    ground: event.target.value as SceneEnvironment["ground"],
                    skyColor:
                      scene.environment?.skyColor ??
                      (event.target.value === "studio" ? "#dce0de" : "#a9cce4"),
                  })
                }
              >
                <option value="studio">Studio</option>
                <option value="grass">Grass</option>
                <option value="asphalt">Asphalt</option>
                <option value="sand">Sand</option>
              </select>
            </label>
            <div className="environment-pair">
              <label>
                <span>Sky</span>
                <input
                  type="color"
                  value={environment.skyColor}
                  onChange={(event) =>
                    updateEnvironment({ skyColor: event.target.value })
                  }
                />
              </label>
              <label>
                <span>Sun angle °</span>
                <input
                  type="number"
                  min="0"
                  max="90"
                  value={environment.sunElevation}
                  onChange={(event) =>
                    updateEnvironment({
                      sunElevation: Math.max(
                        0,
                        Math.min(90, Number(event.target.value)),
                      ),
                    })
                  }
                />
              </label>
            </div>
            <label>
              <span>Sun direction °</span>
              <input
                type="range"
                min="-180"
                max="180"
                value={environment.sunAzimuth}
                onChange={(event) =>
                  updateEnvironment({ sunAzimuth: Number(event.target.value) })
                }
              />
            </label>
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
              {(Object.keys(itemNames) as ItemKind[])
                .filter((kind) => kind !== "asset")
                .map((kind) => {
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
            <button onClick={() => assetRef.current?.click()}>
              <Upload size={16} /> Import 3D asset
            </button>
            <button onClick={() => floorplanRef.current?.click()}>
              <Upload size={16} />{" "}
              {scene.floorplan ? "Replace floor plan" : "Import floor plan"}
            </button>
            {scene.floorplan && (
              <>
                <button
                  onClick={() =>
                    setShowFloorplanControls(!showFloorplanControls)
                  }
                >
                  <Ruler size={15} /> Scale
                </button>
                <button
                  className="remove-plan"
                  onClick={() => {
                    updateScene((current) => ({
                      ...current,
                      floorplan: undefined,
                      floorplanPlacement: undefined,
                    }));
                    setShowFloorplanControls(false);
                  }}
                >
                  Remove
                </button>
              </>
            )}
          </div>
          {scene.floorplan && showFloorplanControls && (
            <div className="floorplan-controls">
              <h3>Floor plan placement</h3>
              <p>Match width and height to known dimensions in meters.</p>
              <div className="floorplan-field-grid">
                {(["width", "height", "x", "z", "rotation"] as const).map(
                  (key) => (
                    <label key={key}>
                      <span>
                        {key === "rotation"
                          ? "Rotation °"
                          : key === "width" || key === "height"
                            ? `${key} m`
                            : key.toUpperCase()}
                      </span>
                      <input
                        type="number"
                        step={key === "rotation" ? 1 : 0.1}
                        min={
                          key === "width" || key === "height" ? 0.1 : undefined
                        }
                        value={
                          scene.floorplanPlacement?.[key] ??
                          (key === "width" || key === "height" ? 10 : 0)
                        }
                        onChange={(event) =>
                          updateFloorplanPlacement({
                            [key]:
                              key === "width" || key === "height"
                                ? Math.max(0.1, Number(event.target.value))
                                : Number(event.target.value),
                          })
                        }
                      />
                    </label>
                  ),
                )}
                <label>
                  <span>Opacity %</span>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="5"
                    value={Math.round(
                      (scene.floorplanPlacement?.opacity ?? 0.65) * 100,
                    )}
                    onChange={(event) =>
                      updateFloorplanPlacement({
                        opacity: Math.max(
                          0,
                          Math.min(1, Number(event.target.value) / 100),
                        ),
                      })
                    }
                  />
                </label>
              </div>
            </div>
          )}
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
              {selected?.kind === "actor" &&
                !selected.locked &&
                mode === "stage" && (
                  <button
                    className={poseMode ? "active" : ""}
                    aria-label="Pose actor in 3D"
                    title="Drag the amber joints to pose this actor"
                    aria-pressed={poseMode}
                    onClick={() => {
                      setTool("select");
                      setPoseMode((value) => !value);
                    }}
                  >
                    <UserRound size={15} /> Pose
                  </button>
                )}
            </div>
            <div className="view-label">
              {mode === "camera"
                ? `${cameraItem?.focalLength ?? 35} mm · ${sensors[cameraItem?.sensor ?? "super35"].label}`
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
              scene={scene}
              shot={shot}
              selectedId={moveProgress > 0 ? undefined : selectedId}
              mode={mode}
              tool={tool}
              poseMode={
                poseMode &&
                selected?.kind === "actor" &&
                !selected.locked &&
                mode === "stage"
              }
              onSelect={setSelectedId}
              onMove={(value, x, y, z) => updateItem(value, { x, y, z })}
              onPoseJoints={updateActorJoints}
              onAddWall={addWall}
              captureRef={captureRef}
              moveProgress={moveProgress}
            />
            {mode === "camera" && orderedShots.length > 1 && (
              <div className="camera-shot-switch">
                <button
                  aria-label="Previous shot camera"
                  disabled={activeShotIndex <= 0}
                  onClick={() =>
                    activateShot(orderedShots[activeShotIndex - 1])
                  }
                >
                  ←
                </button>
                <span>
                  {shot?.title} · {activeShotIndex + 1} / {orderedShots.length}
                </span>
                <button
                  aria-label="Next shot camera"
                  disabled={activeShotIndex >= orderedShots.length - 1}
                  onClick={() =>
                    activateShot(orderedShots[activeShotIndex + 1])
                  }
                >
                  →
                </button>
              </div>
            )}
            {mode === "camera" && shot && (
              <svg
                className="frame-guide"
                viewBox={`0 0 ${aspectRatios[shot.aspectRatio ?? "16:9"]} 1`}
                preserveAspectRatio="xMidYMid meet"
                aria-label={`${shot.aspectRatio ?? "16:9"} framing guide`}
              >
                <rect
                  x="0.01"
                  y="0.01"
                  width={aspectRatios[shot.aspectRatio ?? "16:9"] - 0.02}
                  height="0.98"
                  fill="none"
                  stroke="#ffffffcc"
                  strokeWidth="0.006"
                />
                <line
                  x1={aspectRatios[shot.aspectRatio ?? "16:9"] / 3}
                  x2={aspectRatios[shot.aspectRatio ?? "16:9"] / 3}
                  y1="0.01"
                  y2="0.99"
                  stroke="#ffffff55"
                  strokeWidth="0.003"
                />
                <line
                  x1={(aspectRatios[shot.aspectRatio ?? "16:9"] * 2) / 3}
                  x2={(aspectRatios[shot.aspectRatio ?? "16:9"] * 2) / 3}
                  y1="0.01"
                  y2="0.99"
                  stroke="#ffffff55"
                  strokeWidth="0.003"
                />
                <line
                  x1="0.01"
                  x2={aspectRatios[shot.aspectRatio ?? "16:9"] - 0.01}
                  y1="0.333"
                  y2="0.333"
                  stroke="#ffffff55"
                  strokeWidth="0.003"
                />
                <line
                  x1="0.01"
                  x2={aspectRatios[shot.aspectRatio ?? "16:9"] - 0.01}
                  y1="0.667"
                  y2="0.667"
                  stroke="#ffffff55"
                  strokeWidth="0.003"
                />
              </svg>
            )}
            <div className="stage-hint">
              {poseMode && selected?.kind === "actor" && mode === "stage"
                ? "Drag amber joints · head and shoulders move in two directions · scroll to zoom"
                : tool === "wall" && mode === "plan"
                  ? "Drag on the plan to draw a wall · snaps to wall ends or 0.25 m"
                  : mode === "camera"
                    ? "Shot preview · select 3D stage to edit"
                    : "Click an object to select · drag the arrows to move · scroll to zoom"}
            </div>
            {(mode === "camera" || (mode === "stage" && hasMotion)) && (
              <div className="camera-actions">
                {shot && hasMotion && (
                  <button
                    onClick={() => {
                      moveStartRef.current =
                        performance.now() -
                        (moveProgress >= 1 ? 0 : moveProgress) *
                          shot.duration *
                          1000;
                      if (moveProgress >= 1) setMoveProgress(0);
                      setPlayingMove(!playingMove);
                    }}
                  >
                    {playingMove ? <Pause size={16} /> : <Play size={16} />}
                    {playingMove ? "Pause motion" : "Play motion"}
                  </button>
                )}
                {mode === "camera" && (
                  <button onClick={capture}>
                    <Camera size={16} /> Capture frame
                  </button>
                )}
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
                  onClick={() => activateShot(entry)}
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
                    Position, facing, and joint pose are saved for this shot.
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
                {selected.kind === "actor" && (
                  <>
                    <label className="full-field">
                      <span>Pose</span>
                      <select
                        value={mannequinPoseForJoints(selectedJoints!)}
                        onChange={(event) => {
                          if (event.target.value !== "custom")
                            updateActorJoints(
                              selected.id,
                              mannequinJointsForPose(
                                event.target
                                  .value as SceneItem["mannequinPose"],
                              ),
                            );
                        }}
                      >
                        <option value="neutral">Neutral</option>
                        <option value="greeting">Greeting</option>
                        <option value="pointing">Pointing</option>
                        <option value="custom" disabled>
                          Custom
                        </option>
                      </select>
                    </label>
                    <details className="pose-editor">
                      <summary>Fine tune joints</summary>
                      {(["Head", "Arms", "Legs"] as const).map((group) => (
                        <div className="pose-group" key={group}>
                          <h4>{group}</h4>
                          {mannequinJointControls
                            .filter((control) => control.group === group)
                            .map(({ key, label, min, max }) => (
                              <label key={key} className="pose-joint">
                                <span>
                                  {label}
                                  <output>{selectedJoints![key]}°</output>
                                </span>
                                <input
                                  type="range"
                                  aria-label={label}
                                  min={min}
                                  max={max}
                                  step="1"
                                  value={selectedJoints![key]}
                                  onChange={(event) =>
                                    updateActorJoints(selected.id, {
                                      ...selectedJoints!,
                                      [key]: Number(event.target.value),
                                    })
                                  }
                                />
                              </label>
                            ))}
                        </div>
                      ))}
                      <button
                        type="button"
                        className="pose-reset"
                        onClick={() => updateActorJoints(selected.id)}
                      >
                        Reset to actor default
                      </button>
                    </details>
                    <label className="full-field">
                      <span>Wood finish</span>
                      <input
                        type="color"
                        value={selected.color ?? "#d2ab7d"}
                        onChange={(event) =>
                          updateItem(selected.id, { color: event.target.value })
                        }
                      />
                    </label>
                  </>
                )}
                {selected.kind === "facade" && (
                  <>
                    <label className="full-field">
                      <span>Facade style</span>
                      <select
                        value={selected.facadeStyle ?? "storefront"}
                        onChange={(event) =>
                          updateItem(selected.id, {
                            facadeStyle: event.target
                              .value as SceneItem["facadeStyle"],
                          })
                        }
                      >
                        <option value="storefront">Storefront</option>
                        <option value="brick">Brick</option>
                        <option value="theater">Theater</option>
                      </select>
                    </label>
                    <label className="full-field">
                      <span>Paint</span>
                      <input
                        type="color"
                        value={selected.color ?? "#c5ae83"}
                        onChange={(event) =>
                          updateItem(selected.id, { color: event.target.value })
                        }
                      />
                    </label>
                    <label className="full-field">
                      <span>Sign</span>
                      <input
                        type="text"
                        maxLength={24}
                        value={selected.signText ?? ""}
                        onChange={(event) =>
                          updateItem(selected.id, {
                            signText: event.target.value,
                          })
                        }
                      />
                    </label>
                  </>
                )}
                {selected.kind === "ground" && (
                  <label className="full-field">
                    <span>Surface</span>
                    <select
                      value={selected.surfaceStyle ?? "plain"}
                      onChange={(event) =>
                        updateItem(selected.id, {
                          surfaceStyle: event.target
                            .value as SceneItem["surfaceStyle"],
                        })
                      }
                    >
                      <option value="plain">Plain</option>
                      <option value="road">Road markings</option>
                      <option value="sidewalk">Sidewalk and curb</option>
                    </select>
                  </label>
                )}
                {selected.kind === "barrel" && (
                  <label className="full-field">
                    <span>Wood finish</span>
                    <input
                      type="color"
                      value={selected.color ?? "#98663f"}
                      onChange={(event) =>
                        updateItem(selected.id, { color: event.target.value })
                      }
                    />
                  </label>
                )}
                {(
                  ["tree", "bench", "vehicle", "ground"] as ItemKind[]
                ).includes(selected.kind) && (
                  <label className="full-field">
                    <span>
                      {selected.kind === "tree"
                        ? "Foliage"
                        : selected.kind === "vehicle"
                          ? "Paint"
                          : selected.kind === "ground"
                            ? "Surface color"
                            : "Wood finish"}
                    </span>
                    <input
                      type="color"
                      value={
                        selected.color ??
                        {
                          tree: "#617d4d",
                          bench: "#a4744d",
                          vehicle: "#547988",
                          ground: "#c3bca9",
                        }[
                          selected.kind as
                            "tree" | "bench" | "vehicle" | "ground"
                        ]
                      }
                      onChange={(event) =>
                        updateItem(selected.id, { color: event.target.value })
                      }
                    />
                  </label>
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
                {selected.kind === "actor" && shot && (
                  <div className="field-section actor-action-fields">
                    <h3>Action on mark</h3>
                    <input
                      type="search"
                      aria-label="Search actor actions"
                      placeholder="Search actions"
                      value={actionSearch}
                      onChange={(event) => setActionSearch(event.target.value)}
                    />
                    <div className="action-library">
                      {actorActions
                        .filter((action) =>
                          `${action.label} ${action.detail}`
                            .toLowerCase()
                            .includes(actionSearch.toLowerCase()),
                        )
                        .map((action) => (
                          <button
                            key={action.id}
                            type="button"
                            className={
                              shot.actorActions?.[selected.id]?.id === action.id
                                ? "active"
                                : ""
                            }
                            onClick={() =>
                              updateActorAction(selected.id, {
                                id: action.id,
                                loop: true,
                                speed: 1,
                              })
                            }
                          >
                            <strong>{action.label}</strong>
                            <small>{action.detail}</small>
                          </button>
                        ))}
                    </div>
                    {shot.actorActions?.[selected.id] && (
                      <>
                        <label className="full-field">
                          <input
                            type="checkbox"
                            checked={shot.actorActions[selected.id].loop}
                            onChange={(event) =>
                              updateActorAction(selected.id, {
                                ...shot.actorActions![selected.id],
                                loop: event.target.checked,
                              })
                            }
                          />{" "}
                          Loop throughout the shot
                        </label>
                        <label className="full-field">
                          <span>Action speed</span>
                          <input
                            type="range"
                            min="0.25"
                            max="3"
                            step="0.25"
                            value={shot.actorActions[selected.id].speed}
                            onChange={(event) =>
                              updateActorAction(selected.id, {
                                ...shot.actorActions![selected.id],
                                speed: Number(event.target.value),
                              })
                            }
                          />
                        </label>
                        <button
                          type="button"
                          className="text-button"
                          onClick={() => updateActorAction(selected.id)}
                        >
                          Clear action
                        </button>
                      </>
                    )}
                  </div>
                )}
                {selected.kind === "actor" && shot && (
                  <div className="field-section actor-motion-fields">
                    <h3>Actor movement</h3>
                    <label className="full-field">
                      <input
                        type="checkbox"
                        checked={!!shot.actorPaths?.[selected.id]}
                        onChange={(event) =>
                          updateActorPath(
                            selected.id,
                            event.target.checked
                              ? {
                                  waypoints: [],
                                  end: {
                                    x: Number((selected.x + 1).toFixed(2)),
                                    y: selected.y,
                                    z: Number((selected.z - 1).toFixed(2)),
                                    rotation: selected.rotation,
                                  },
                                }
                              : undefined,
                          )
                        }
                      />{" "}
                      Move during this shot
                    </label>
                    {shot.actorPaths?.[selected.id] && (
                      <>
                        {shot.actorPaths[selected.id].waypoints.map(
                          (point, index) => (
                            <div className="waypoint-fields" key={index}>
                              <div className="waypoint-heading">
                                Actor waypoint {index + 1}
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateActorPath(selected.id, {
                                      ...shot.actorPaths![selected.id],
                                      waypoints: shot.actorPaths![
                                        selected.id
                                      ].waypoints.filter((_, i) => i !== index),
                                    })
                                  }
                                >
                                  Remove
                                </button>
                              </div>
                              <div className="field-grid">
                                {(["x", "y", "z", "rotation"] as const).map(
                                  (key) => (
                                    <label key={key}>
                                      <span>
                                        {key === "rotation"
                                          ? "Facing °"
                                          : key.toUpperCase()}
                                      </span>
                                      <input
                                        type="number"
                                        step={key === "rotation" ? 1 : 0.1}
                                        value={Number(point[key].toFixed(2))}
                                        onChange={(event) =>
                                          updateActorPath(selected.id, {
                                            ...shot.actorPaths![selected.id],
                                            waypoints: shot.actorPaths![
                                              selected.id
                                            ].waypoints.map((entry, i) =>
                                              i === index
                                                ? {
                                                    ...entry,
                                                    [key]: Number(
                                                      event.target.value,
                                                    ),
                                                  }
                                                : entry,
                                            ),
                                          })
                                        }
                                      />
                                    </label>
                                  ),
                                )}
                              </div>
                            </div>
                          ),
                        )}
                        <button
                          type="button"
                          className="waypoint-add"
                          onClick={() => {
                            const path = shot.actorPaths![selected.id];
                            const previous = path.waypoints.at(-1) ?? selected;
                            updateActorPath(selected.id, {
                              ...path,
                              waypoints: [
                                ...path.waypoints,
                                {
                                  x: Number(
                                    ((previous.x + path.end.x) / 2).toFixed(2),
                                  ),
                                  y: Number(
                                    ((previous.y + path.end.y) / 2).toFixed(2),
                                  ),
                                  z: Number(
                                    ((previous.z + path.end.z) / 2).toFixed(2),
                                  ),
                                  rotation: previous.rotation,
                                },
                              ],
                            });
                          }}
                        >
                          <Plus size={14} /> Add actor waypoint
                        </button>
                        <div className="field-grid">
                          {(["x", "y", "z", "rotation"] as const).map((key) => (
                            <label key={key}>
                              <span>
                                End{" "}
                                {key === "rotation"
                                  ? "facing °"
                                  : key.toUpperCase()}
                              </span>
                              <input
                                type="number"
                                step={key === "rotation" ? 1 : 0.1}
                                value={Number(
                                  shot.actorPaths![selected.id].end[
                                    key
                                  ].toFixed(2),
                                )}
                                onChange={(event) =>
                                  updateActorPath(selected.id, {
                                    ...shot.actorPaths![selected.id],
                                    end: {
                                      ...shot.actorPaths![selected.id].end,
                                      [key]: Number(event.target.value),
                                    },
                                  })
                                }
                              />
                            </label>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )}
                {selected.kind === "wall" && (
                  <div className="field-section">
                    <h3>Opening</h3>
                    <button
                      type="button"
                      disabled={
                        selected.opening?.type === "window" ||
                        selected.roomExtended
                      }
                      onClick={() =>
                        updateScene((current) => ({
                          ...current,
                          items: extendRoom(current.items, selected.id),
                        }))
                      }
                    >
                      <Plus size={15} /> Extend room from this wall
                    </button>
                    <p className="field-note">
                      Adds three walls and a doorway; furnish the new room from
                      the object catalog.
                    </p>
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
                    <h3>Camera and lens</h3>
                    <label className="full-field">
                      <span>Body</span>
                      <select
                        value={selected.cameraBody ?? "cinema"}
                        onChange={(event) =>
                          updateItem(selected.id, {
                            cameraBody: event.target
                              .value as SceneItem["cameraBody"],
                          })
                        }
                      >
                        <option value="cinema">Cinema rig</option>
                        <option value="mirrorless">Mirrorless body</option>
                        <option value="broadcast">Broadcast camera</option>
                      </select>
                    </label>
                    <label className="full-field">
                      <span>Sensor gate</span>
                      <select
                        value={selected.sensor ?? "super35"}
                        onChange={(event) =>
                          updateItem(selected.id, {
                            sensor: event.target.value as SensorId,
                          })
                        }
                      >
                        {Object.entries(sensors).map(([id, sensor]) => (
                          <option key={id} value={id}>
                            {sensor.label} · {sensor.width} × {sensor.height} mm
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="full-field">
                      <span>Lens preset</span>
                      <select
                        value={
                          [18, 24, 35, 50, 85].includes(
                            selected.focalLength ?? 35,
                          )
                            ? (selected.focalLength ?? 35)
                            : "custom"
                        }
                        onChange={(event) => {
                          const focalLength = Number(event.target.value);
                          if (Number.isFinite(focalLength))
                            updateItem(selected.id, { focalLength });
                        }}
                      >
                        {[18, 24, 35, 50, 85].map((mm) => (
                          <option key={mm} value={mm}>
                            {mm} mm
                          </option>
                        ))}
                        {![18, 24, 35, 50, 85].includes(
                          selected.focalLength ?? 35,
                        ) && <option value="custom">Custom</option>}
                      </select>
                    </label>
                    <label className="full-field">
                      <span>Focal length</span>
                      <div>
                        <input
                          type="number"
                          min="8"
                          max="400"
                          value={selected.focalLength ?? 35}
                          onChange={(event) => {
                            const focalLength = Math.max(
                              8,
                              Number(event.target.value),
                            );
                            updateItem(selected.id, {
                              focalLength,
                              focusDistance: Math.max(
                                selected.focusDistance ?? 3,
                                focalLength / 1000 + 0.01,
                              ),
                            });
                          }}
                        />
                        <em>mm</em>
                      </div>
                    </label>
                    <label className="full-field">
                      <span>Aperture</span>
                      <div>
                        <input
                          type="number"
                          min="0.7"
                          max="32"
                          step="0.1"
                          value={selected.aperture ?? 2.8}
                          onChange={(event) =>
                            updateItem(selected.id, {
                              aperture: Math.max(
                                0.7,
                                Number(event.target.value),
                              ),
                            })
                          }
                        />
                        <em>f/</em>
                      </div>
                    </label>
                    <label className="full-field">
                      <span>Focus distance</span>
                      <div>
                        <input
                          type="number"
                          min={Math.max(
                            0.1,
                            (selected.focalLength ?? 35) / 1000 + 0.01,
                          )}
                          step="0.1"
                          value={selected.focusDistance ?? 3}
                          onChange={(event) =>
                            updateItem(selected.id, {
                              focusDistance: Math.max(
                                0.1,
                                (selected.focalLength ?? 35) / 1000 + 0.01,
                                Number(event.target.value),
                              ),
                            })
                          }
                        />
                        <em>m</em>
                      </div>
                    </label>
                    {selected.id === cameraItem?.id && optics && (
                      <p className="field-note">
                        {optics.horizontalFov.toFixed(1)}° ×{" "}
                        {optics.verticalFov.toFixed(1)}° field of view ·
                        approximate focus {optics.nearFocus.toFixed(2)} m to{" "}
                        {Number.isFinite(optics.farFocus)
                          ? `${optics.farFocus.toFixed(2)} m`
                          : "∞"}
                      </p>
                    )}
                  </div>
                )}
                {selected.kind === "light" && (
                  <div className="field-section">
                    <h3>Light</h3>
                    <label className="full-field">
                      <span>Source</span>
                      <select
                        value={selected.lightType ?? "softbox"}
                        onChange={(event) =>
                          updateItem(selected.id, {
                            lightType: event.target
                              .value as SceneItem["lightType"],
                          })
                        }
                      >
                        <option value="softbox">Softbox</option>
                        <option value="spot">Spotlight</option>
                        <option value="practical">Practical bulb</option>
                      </select>
                    </label>
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
                    {selected.lightType !== "practical" && (
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
                    )}
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
                    <label className="full-field">
                      <span>Power draw</span>
                      <div>
                        <input
                          type="number"
                          min="1"
                          step="10"
                          value={selected.powerWatts ?? 150}
                          onChange={(event) =>
                            updateItem(selected.id, {
                              powerWatts: Math.max(
                                1,
                                Number(event.target.value),
                              ),
                            })
                          }
                        />
                        <em>W</em>
                      </div>
                    </label>
                    <label className="full-field">
                      <span>Power source</span>
                      <select
                        value={selected.powerSourceId ?? ""}
                        onChange={(event) =>
                          updateItem(selected.id, {
                            powerSourceId: event.target.value || undefined,
                          })
                        }
                      >
                        <option value="">Unassigned</option>
                        {scene.items
                          .filter((item) => item.kind === "power")
                          .map((source) => (
                            <option key={source.id} value={source.id}>
                              {source.name}
                            </option>
                          ))}
                      </select>
                    </label>
                    {selectedPowerSource && (
                      <p className="field-note">
                        Estimated cable run:{" "}
                        {Math.hypot(
                          selected.x - selectedPowerSource.x,
                          selected.z - selectedPowerSource.z,
                        ).toFixed(1)}{" "}
                        m
                      </p>
                    )}
                    <p className="field-note">
                      Preview lighting is illustrative, not photometric.
                    </p>
                  </div>
                )}
                {selected.kind === "power" && (
                  <div className="field-section">
                    <h3>Power distribution</h3>
                    <label className="full-field">
                      <span>Capacity</span>
                      <div>
                        <input
                          type="number"
                          min="1"
                          step="100"
                          value={selected.capacityWatts ?? 2000}
                          onChange={(event) =>
                            updateItem(selected.id, {
                              capacityWatts: Math.max(
                                1,
                                Number(event.target.value),
                              ),
                            })
                          }
                        />
                        <em>W</em>
                      </div>
                    </label>
                    <p className="field-note">
                      {selectedPowerLoads.length} fixtures · {assignedWatts} W
                      assigned
                      {assignedWatts > (selected.capacityWatts ?? 2000) &&
                        " · Over capacity"}
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
                Aspect ratio
                <select
                  value={shot.aspectRatio ?? "16:9"}
                  onChange={(event) =>
                    updateShot({
                      aspectRatio: event.target.value as AspectRatio,
                    })
                  }
                >
                  {Object.keys(aspectRatios).map((ratio) => (
                    <option key={ratio} value={ratio}>
                      {ratio}
                    </option>
                  ))}
                </select>
              </label>
              <div className="camera-move-fields">
                <label>
                  <input
                    type="checkbox"
                    checked={!!shot.cameraEnd}
                    onChange={(event) => {
                      setPlayingMove(false);
                      setMoveProgress(0);
                      updateShot({
                        cameraWaypoints: event.target.checked ? [] : undefined,
                        cameraEnd:
                          event.target.checked && cameraItem
                            ? {
                                x: cameraItem.x,
                                z: cameraItem.z - 3,
                                height: cameraItem.height,
                                rotation: cameraItem.rotation,
                              }
                            : undefined,
                      });
                    }}
                  />{" "}
                  Camera move through set
                </label>
                {shot.cameraEnd && (
                  <>
                    {(shot.cameraWaypoints ?? []).map((point, index) => (
                      <div className="waypoint-fields" key={index}>
                        <div className="waypoint-heading">
                          Waypoint {index + 1}
                          <button
                            type="button"
                            onClick={() =>
                              updateShot({
                                cameraWaypoints: shot.cameraWaypoints?.filter(
                                  (_, i) => i !== index,
                                ),
                              })
                            }
                          >
                            Remove
                          </button>
                        </div>
                        <div className="field-grid">
                          {(["x", "z", "height", "rotation"] as const).map(
                            (key) => (
                              <label key={key}>
                                <span>
                                  {key === "rotation"
                                    ? "Yaw °"
                                    : key.toUpperCase()}
                                </span>
                                <input
                                  type="number"
                                  step={key === "rotation" ? 1 : 0.1}
                                  value={point[key]}
                                  onChange={(event) =>
                                    updateShot({
                                      cameraWaypoints:
                                        shot.cameraWaypoints?.map((entry, i) =>
                                          i === index
                                            ? {
                                                ...entry,
                                                [key]: Number(
                                                  event.target.value,
                                                ),
                                              }
                                            : entry,
                                        ),
                                    })
                                  }
                                />
                              </label>
                            ),
                          )}
                        </div>
                      </div>
                    ))}
                    <button
                      type="button"
                      className="waypoint-add"
                      onClick={() => {
                        const previous =
                          shot.cameraWaypoints?.at(-1) ?? cameraItem;
                        if (!previous || !shot.cameraEnd) return;
                        updateShot({
                          cameraWaypoints: [
                            ...(shot.cameraWaypoints ?? []),
                            {
                              x: (previous.x + shot.cameraEnd.x) / 2,
                              z: (previous.z + shot.cameraEnd.z) / 2,
                              height:
                                (previous.height + shot.cameraEnd.height) / 2,
                              rotation: previous.rotation,
                            },
                          ],
                        });
                      }}
                    >
                      <Plus size={14} /> Add waypoint
                    </button>
                    <div className="field-grid">
                      {(["x", "z", "height", "rotation"] as const).map(
                        (key) => (
                          <label key={key}>
                            <span>
                              End{" "}
                              {key === "height"
                                ? "height"
                                : key === "rotation"
                                  ? "yaw °"
                                  : key.toUpperCase()}
                            </span>
                            <input
                              type="number"
                              step={key === "rotation" ? 1 : 0.1}
                              value={shot.cameraEnd![key]}
                              onChange={(event) =>
                                updateShot({
                                  cameraEnd: {
                                    ...shot.cameraEnd!,
                                    [key]: Number(event.target.value),
                                  },
                                })
                              }
                            />
                          </label>
                        ),
                      )}
                    </div>
                  </>
                )}
              </div>
              {hasMotion && (
                <label>
                  Preview motion
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={Math.round(moveProgress * 100)}
                    onChange={(event) => {
                      setPlayingMove(false);
                      setMoveProgress(Number(event.target.value) / 100);
                    }}
                  />
                </label>
              )}
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
                    resetMove();
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
