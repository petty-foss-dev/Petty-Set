import type { jsPDF } from "jspdf";
import { sensors } from "./cinematography.ts";
import { wallEndpoints, wallOpenings } from "./model.ts";
import type { SceneItem, SetScene, Shot } from "./model.ts";
import { resolveLightingPlan } from "./lightingPlans.ts";
import { floorplanSVG } from "./floorplan.ts";

const ink = [44, 48, 47] as const;
const muted = [106, 108, 101] as const;
const amber = [177, 108, 53] as const;

const xml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&apos;",
      })[char]!,
  );

export function shootDaySVG(projectName: string, scene: SetScene, shot: Shot) {
  const resolved = resolveLightingPlan(scene, shot);
  const items = resolved.items.map((item) =>
    item.kind === "actor"
      ? { ...item, ...shot.actorMarks?.[item.id] }
      : item.kind === "camera" && item.id !== shot.cameraId
        ? { ...item, hidden: true }
        : item,
  );
  const planScene = { ...resolved, items };
  const plan = floorplanSVG(planScene);
  const content = plan.match(/viewBox="0 0 (\d+) (\d+)"[^>]*>([\s\S]*)<\/svg>/);
  const lights = items.filter((item) => item.kind === "light" && !item.hidden);
  const actors = items.filter((item) => item.kind === "actor" && !item.hidden);
  const sources = items.filter((item) => item.kind === "power" && !item.hidden);
  const camera = items.find((item) => item.id === shot.cameraId);
  const walls = items.filter((item) => item.kind === "wall" && !item.hidden);
  const wallPoints = walls.flatMap(wallEndpoints);
  const minX = Math.min(...wallPoints.map((point) => point.x)) - 1;
  const minZ = Math.min(...wallPoints.map((point) => point.z)) - 1;
  const cables = lights
    .map((light) => {
      const source = sources.find((item) => item.id === light.powerSourceId);
      return source
        ? `<line x1="${((source.x - minX) * 70).toFixed(1)}" y1="${((source.z - minZ) * 70 + 70).toFixed(1)}" x2="${((light.x - minX) * 70).toFixed(1)}" y2="${((light.z - minZ) * 70 + 70).toFixed(1)}" stroke="#af916f" stroke-width="2" stroke-dasharray="6 4"/>`
        : "";
    })
    .join("");
  const planImage = content
    ? `<svg x="44" y="179" width="1032" height="827" viewBox="0 0 ${content[1]} ${content[2]}">${content[3]}${cables}</svg>`
    : `<text x="100" y="530" fill="#77716a" font-size="30">No drawn walls in this scene</text>`;
  const text = (value: string, x: number, y: number, size = 20) =>
    `<text x="${x}" y="${y}" fill="#302f2b" font-size="${size}">${xml(value.slice(0, 42))}</text>`;
  const section = (value: string, y: number) =>
    `<text x="1120" y="${y}" fill="#a46233" font-size="20" font-weight="700" letter-spacing="2">${xml(value)}</text>`;
  const lightingPlan = shot.lightingPlans?.find(
    (plan) => plan.id === shot.activeLightingPlanId,
  );
  const rows: string[] = [
    section("CAMERA & FRAME", 200),
    text(camera?.name ?? "No camera", 1120, 239, 25),
    text(
      `${camera?.focalLength ?? 35} mm · f/${camera?.aperture ?? 2.8} · ${sensors[camera?.sensor ?? "super35"].label}`,
      1120,
      273,
    ),
    text(
      `Focus ${camera?.focusDistance ?? 3} m · ${shot.aspectRatio ?? "16:9"} · ${shot.duration}s`,
      1120,
      305,
    ),
    section("SHOT & SETUP", 371),
    text(
      `${shot.setup || "No setup"} · ${shot.status ?? "planned"}${lightingPlan ? ` · ${lightingPlan.name}` : ""}`,
      1120,
      407,
    ),
    text(shot.notes || "No shot notes", 1120, 440, 18),
    section(`ACTOR MARKS (${actors.length})`, 514),
    ...actors
      .slice(0, 6)
      .map((actor, index) =>
        text(
          `A${index + 1}  ${actor.name}  (${actor.x.toFixed(1)}, ${actor.z.toFixed(1)})`,
          1120,
          548 + index * 30,
          18,
        ),
      ),
    section(`LIGHTS (${lights.length})`, 757),
    ...lights
      .slice(0, 5)
      .map((light, index) =>
        text(
          `L${index + 1}  ${light.name} · ${light.lumens ?? (light.intensity ?? 2) * 600} lm · ${light.powerWatts ?? 150} W`,
          1120,
          790 + index * 30,
          18,
        ),
      ),
    section("POWER", 977),
    ...sources.slice(0, 3).map((source, index) => {
      const watts = lights
        .filter((light) => light.powerSourceId === source.id)
        .reduce((sum, light) => sum + (light.powerWatts ?? 150), 0);
      return text(
        `${source.name}: ${watts} / ${source.capacityWatts ?? 1800} W`,
        1120,
        1010 + index * 28,
        18,
      );
    }),
    ...(!sources.length
      ? [text("No distribution source", 1120, 1010, 18)]
      : []),
  ];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1131" viewBox="0 0 1600 1131"><rect width="1600" height="1131" fill="#f9f6ef"/><rect width="1600" height="145" fill="#222524"/><g font-family="Arial,sans-serif"><text x="44" y="67" fill="white" font-size="40" font-weight="700">${xml(projectName.slice(0, 80))}</text><text x="44" y="113" fill="white" font-size="23">${xml(`${scene.name} / ${shot.title}`.slice(0, 110))}</text><rect x="44" y="179" width="1032" height="827" rx="8" fill="#fffdf8" stroke="#cdc9be" stroke-width="2"/>${planImage}${rows.join("")}<line x1="44" y1="1080" x2="1555" y2="1080" stroke="#c8c4ba"/><text x="44" y="1110" fill="#6a6c65" font-size="18">PETTY: SET · VISUAL SHOOT PLAN</text><text x="1555" y="1110" fill="#6a6c65" font-size="16" text-anchor="end">Confirm measurements, rigging and electrical loads on location.</text></g></svg>`;
}

function label(pdf: jsPDF, value: string, x: number, y: number, width: number) {
  let text = value;
  while (pdf.getTextWidth(text) > width && text.length > 1)
    text = `${text.slice(0, -2)}…`;
  pdf.text(text, x, y);
}

function heading(pdf: jsPDF, value: string, x: number, y: number) {
  pdf.setTextColor(...amber);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8);
  pdf.text(value.toUpperCase(), x, y);
  pdf.setTextColor(...ink);
  pdf.setFont("helvetica", "normal");
}

export function renderShootDaySheet(
  pdf: jsPDF,
  projectName: string,
  scene: SetScene,
  shot: Shot,
  index: number,
  total: number,
) {
  const resolved = resolveLightingPlan(scene, shot);
  const visible = resolved.items.filter((item) => !item.hidden);
  const walls = visible.filter((item) => item.kind === "wall");
  const actors = visible.filter((item) => item.kind === "actor");
  const lights = visible.filter((item) => item.kind === "light");
  const sources = visible.filter((item) => item.kind === "power");
  const camera = visible.find((item) => item.id === shot.cameraId);
  const actorMarks = actors.map((item) => ({
    ...item,
    ...shot.actorMarks?.[item.id],
  }));

  pdf.setFillColor(249, 246, 239);
  pdf.rect(0, 0, 297, 210, "F");
  pdf.setFillColor(34, 37, 36);
  pdf.rect(0, 0, 297, 26, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(15);
  label(pdf, projectName || "Untitled film", 12, 12, 170);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  label(pdf, `${scene.name}  /  ${shot.title}`, 12, 21, 220);
  pdf.text(`${index + 1} / ${total}`, 285, 16, { align: "right" });

  const plan = { x: 12, y: 35, width: 180, height: 143 };
  pdf.setFillColor(255, 253, 248);
  pdf.setDrawColor(205, 201, 190);
  pdf.setLineWidth(0.3);
  pdf.roundedRect(plan.x, plan.y, plan.width, plan.height, 1.5, 1.5, "FD");
  const points = [
    ...walls.flatMap(wallEndpoints),
    ...[...actorMarks, ...lights, ...sources, ...(camera ? [camera] : [])].map(
      (item) => ({ x: item.x, z: item.z }),
    ),
  ];
  const minX = Math.min(0, ...points.map((point) => point.x)) - 1;
  const maxX = Math.max(0, ...points.map((point) => point.x)) + 1;
  const minZ = Math.min(0, ...points.map((point) => point.z)) - 1;
  const maxZ = Math.max(0, ...points.map((point) => point.z)) + 1;
  const scale = Math.min(
    (plan.width - 14) / (maxX - minX),
    (plan.height - 16) / (maxZ - minZ),
  );
  const offsetX = plan.x + (plan.width - (maxX - minX) * scale) / 2;
  const offsetY = plan.y + (plan.height - (maxZ - minZ) * scale) / 2;
  const x = (value: number) => offsetX + (value - minX) * scale;
  const y = (value: number) => offsetY + (value - minZ) * scale;

  pdf.setDrawColor(235, 232, 225);
  pdf.setLineWidth(0.15);
  for (let meter = Math.ceil(minX); meter <= maxX; meter++)
    pdf.line(x(meter), y(minZ), x(meter), y(maxZ));
  for (let meter = Math.ceil(minZ); meter <= maxZ; meter++)
    pdf.line(x(minX), y(meter), x(maxX), y(meter));

  pdf.setDrawColor(170, 143, 111);
  pdf.setLineWidth(0.35);
  for (const light of lights) {
    const source = sources.find((item) => item.id === light.powerSourceId);
    if (source) pdf.line(x(source.x), y(source.z), x(light.x), y(light.z));
  }

  for (const wall of walls) {
    const [start, end] = wallEndpoints(wall);
    pdf.setDrawColor(...ink);
    pdf.setLineWidth(Math.max(1.1, wall.depth * scale));
    pdf.line(x(start.x), y(start.z), x(end.x), y(end.z));
    for (const opening of wallOpenings(wall)) {
      const fraction = 0.5 + opening.offset / wall.width;
      const half = opening.width / (2 * wall.width);
      const at = (part: number) => ({
        x: start.x + (end.x - start.x) * part,
        z: start.z + (end.z - start.z) * part,
      });
      const a = at(fraction - half);
      const b = at(fraction + half);
      pdf.setDrawColor(255, 253, 248);
      pdf.setLineWidth(Math.max(1.5, wall.depth * scale + 0.5));
      pdf.line(x(a.x), y(a.z), x(b.x), y(b.z));
      if (opening.type === "window") {
        pdf.setDrawColor(79, 139, 156);
        pdf.setLineWidth(0.8);
        pdf.line(x(a.x), y(a.z), x(b.x), y(b.z));
      }
    }
  }

  const marker = (
    item: SceneItem,
    text: string,
    fill: readonly [number, number, number],
  ) => {
    pdf.setFillColor(...fill);
    pdf.circle(x(item.x), y(item.z), 3.1, "F");
    pdf.setTextColor(255, 255, 255);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(6);
    pdf.text(text, x(item.x), y(item.z) + 1.9, { align: "center" });
  };
  sources.forEach((item, number) =>
    marker(item, `P${number + 1}`, [105, 87, 145]),
  );
  lights.forEach((item, number) =>
    marker(item, `L${number + 1}`, [208, 139, 47]),
  );
  actorMarks.forEach((item, number) =>
    marker(item, `A${number + 1}`, [171, 103, 62]),
  );
  if (camera) {
    marker(camera, "C", [47, 82, 89]);
    const angle = (camera.rotation * Math.PI) / 180;
    pdf.setDrawColor(47, 82, 89);
    pdf.setLineWidth(0.7);
    pdf.line(
      x(camera.x),
      y(camera.z),
      x(camera.x - Math.sin(angle) * 0.7),
      y(camera.z - Math.cos(angle) * 0.7),
    );
  }

  pdf.setTextColor(...muted);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7);
  pdf.text(
    "C Camera     A Actor mark     L Light     P Power     1 square = 1 m",
    14,
    185,
  );

  const sideX = 202;
  const sideWidth = 83;
  heading(pdf, "Camera & frame", sideX, 39);
  pdf.setFontSize(9);
  label(pdf, camera?.name ?? "No camera", sideX, 46, sideWidth);
  pdf.setFontSize(8);
  label(
    pdf,
    `${camera?.focalLength ?? 35} mm  ·  f/${camera?.aperture ?? 2.8}  ·  ${sensors[camera?.sensor ?? "super35"].label}`,
    sideX,
    52,
    sideWidth,
  );
  label(
    pdf,
    `Focus ${camera?.focusDistance ?? 3} m  ·  ${shot.aspectRatio ?? "16:9"}  ·  ${shot.duration}s`,
    sideX,
    58,
    sideWidth,
  );

  heading(pdf, "Shot & setup", sideX, 69);
  pdf.setFontSize(8);
  const lightingPlan = shot.lightingPlans?.find(
    (plan) => plan.id === shot.activeLightingPlanId,
  );
  label(
    pdf,
    `${shot.setup || "No setup"}  ·  ${shot.status ?? "planned"}${lightingPlan ? `  ·  ${lightingPlan.name}` : ""}`,
    sideX,
    76,
    sideWidth,
  );
  const notes = pdf.splitTextToSize(shot.notes || "No shot notes", sideWidth);
  pdf.text(notes.slice(0, 3), sideX, 82);

  heading(pdf, `Actor marks (${actorMarks.length})`, sideX, 105);
  pdf.setFontSize(7.5);
  actorMarks
    .slice(0, 4)
    .forEach((actor, number) =>
      label(
        pdf,
        `A${number + 1}  ${actor.name}  (${actor.x.toFixed(1)}, ${actor.z.toFixed(1)})`,
        sideX,
        111 + number * 5,
        sideWidth,
      ),
    );
  if (actorMarks.length > 4)
    pdf.text(`+${actorMarks.length - 4} more actors on plan`, sideX, 132);

  heading(pdf, `Lights (${lights.length})`, sideX, 140);
  pdf.setFontSize(7.5);
  lights.slice(0, 5).forEach((light, number) => {
    const source = sources.findIndex((item) => item.id === light.powerSourceId);
    label(
      pdf,
      `L${number + 1}  ${light.name}  ${light.lumens ?? (light.intensity ?? 2) * 600} lm  ${light.powerWatts ?? 150} W  ${source < 0 ? "—" : `P${source + 1}`}`,
      sideX,
      146 + number * 5,
      sideWidth,
    );
  });
  if (lights.length > 5)
    pdf.text(`+${lights.length - 5} more fixtures on plan`, sideX, 173);

  heading(pdf, "Power", sideX, 182);
  pdf.setFontSize(7.5);
  sources.slice(0, 3).forEach((source, number) => {
    const watts = lights
      .filter((light) => light.powerSourceId === source.id)
      .reduce((sum, light) => sum + (light.powerWatts ?? 150), 0);
    label(
      pdf,
      `P${number + 1}  ${source.name}: ${watts} / ${source.capacityWatts ?? 1800} W`,
      sideX,
      188 + number * 5,
      sideWidth,
    );
  });
  if (!sources.length) pdf.text("No distribution source", sideX, 188);

  pdf.setDrawColor(200, 196, 186);
  pdf.setLineWidth(0.2);
  pdf.line(12, 199, 285, 199);
  pdf.setTextColor(...muted);
  pdf.setFontSize(7);
  pdf.text("PETTY: SET  ·  VISUAL SHOOT PLAN", 12, 205);
  pdf.text(
    "Confirm measurements, rigging and electrical loads on location.",
    285,
    205,
    { align: "right" },
  );
}
