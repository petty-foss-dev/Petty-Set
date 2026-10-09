import type { jsPDF } from "jspdf";
import type { Project, ScriptScene, ShootDay } from "./model.ts";

const pageWidth = 210;
const left = 16;
const right = 194;
const contentWidth = right - left;

function formattedPages(eighths: number): string {
  const whole = Math.floor(eighths / 8);
  const remainder = eighths % 8;
  return remainder
    ? `${whole ? `${whole} ` : ""}${remainder}/8`
    : String(whole);
}

export function renderDailyPlan(
  pdf: jsPDF,
  project: Project,
  day: ShootDay,
): void {
  const scenes = new Map(
    (project.scriptScenes ?? []).map((scene) => [scene.id, scene]),
  );
  const sets = new Map(project.scenes.map((set) => [set.id, set.name]));
  const assigned = day.scriptSceneIds
    .map((sceneId) => scenes.get(sceneId))
    .filter((scene): scene is ScriptScene => !!scene);
  const pageTotal = assigned.reduce((sum, scene) => sum + scene.pageEighths, 0);
  const cast = [...new Set(assigned.flatMap((scene) => scene.cast))].sort();
  let y = 0;

  const startPage = () => {
    pdf.setFillColor(28, 30, 29);
    pdf.rect(0, 0, pageWidth, 28, "F");
    pdf.setTextColor(255, 255, 255);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(17);
    pdf.text(project.name, left, 13);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.text("SHOOT DAY PLAN · DRAFT", right, 13, { align: "right" });
    pdf.setFontSize(10);
    pdf.text(`${day.date} · ${day.unit}`, left, 22);
    pdf.text(`Call ${day.callTime || "TBD"}`, right, 22, { align: "right" });
    y = 38;
  };

  const ensureSpace = (height: number) => {
    if (y + height <= 270) return;
    pdf.addPage();
    startPage();
  };

  const lines = (value: string, width = contentWidth) =>
    pdf.splitTextToSize(value || "—", width) as string[];

  const paragraph = (label: string, value: string) => {
    const labelWidth = 25;
    pdf.setFontSize(9);
    pdf.setFont("helvetica", "normal");
    const wrapped = lines(value, contentWidth - labelWidth);
    for (let offset = 0; offset < wrapped.length;) {
      ensureSpace(8);
      const available = Math.max(1, Math.floor((270 - y) / 4.2));
      const chunk = wrapped.slice(offset, offset + available);
      pdf.setTextColor(100, 102, 96);
      pdf.setFont("helvetica", "bold");
      pdf.text(label.toUpperCase(), left, y);
      pdf.setTextColor(35, 38, 36);
      pdf.setFont("helvetica", "normal");
      pdf.text(chunk, left + labelWidth, y);
      y += Math.max(6, chunk.length * 4.2 + 2);
      offset += chunk.length;
    }
  };

  const section = (title: string) => {
    ensureSpace(18);
    pdf.setDrawColor(201, 202, 195);
    pdf.line(left, y, right, y);
    y += 6;
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    pdf.setTextColor(156, 91, 43);
    pdf.text(title.toUpperCase(), left, y);
    y += 6;
  };

  startPage();
  section("Day overview");
  paragraph(
    "Scenes",
    `${assigned.length} · ${formattedPages(pageTotal)} pages`,
  );
  paragraph("Cast", cast.join(", ") || "None assigned");
  if (day.notes) paragraph("Day notes", day.notes);

  if (!assigned.length) {
    section("Scene plan");
    paragraph("Status", "No script scenes are assigned to this shoot day.");
  }
  assigned.forEach((scene, index) => {
    section(`${index + 1}. Scene ${scene.sceneNumber} · ${scene.title}`);
    paragraph(
      "Location",
      `${scene.intExt} · ${scene.timeOfDay} · ${scene.setSceneId ? sets.get(scene.setSceneId) || "Set missing" : "Set unassigned"}`,
    );
    paragraph("Pages", formattedPages(scene.pageEighths));
    if (scene.synopsis) paragraph("Synopsis", scene.synopsis);
    if (scene.cast.length) paragraph("Cast", scene.cast.join(", "));
    if (scene.props.length) paragraph("Props", scene.props.join(", "));
    if (scene.wardrobe.length) paragraph("Wardrobe", scene.wardrobe.join(", "));
    if (scene.effects.length) paragraph("Effects", scene.effects.join(", "));
    if (scene.notes) paragraph("Notes", scene.notes);
  });

  const pages = pdf.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    pdf.setPage(page);
    pdf.setDrawColor(201, 202, 195);
    pdf.line(left, 281, right, 281);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(111, 113, 107);
    pdf.text(`Petty: Set · ${day.date} · ${day.unit}`, left, 287);
    pdf.text(`${page} / ${pages}`, right, 287, { align: "right" });
  }
}
