import type { jsPDF } from "jspdf";
import type { SetScene, Shot } from "./model.ts";
import { fixtureLumens } from "./lighting.ts";
import { resolveLightingPlan } from "./lightingPlans.ts";

const columns = [
  { title: "#", x: 12, width: 10 },
  { title: "FIXTURE", x: 23, width: 45 },
  { title: "TYPE", x: 70, width: 25 },
  { title: "OUTPUT", x: 97, width: 27 },
  { title: "BEAM / TILT", x: 126, width: 30 },
  { title: "DRAW", x: 158, width: 22 },
  { title: "SOURCE", x: 182, width: 38 },
  { title: "CABLE", x: 222, width: 22 },
  { title: "POSITION (m)", x: 246, width: 39 },
];

function fit(pdf: jsPDF, value: string, width: number) {
  let text = value;
  while (pdf.getTextWidth(text) > width && text.length > 1)
    text = `${text.slice(0, -2)}…`;
  return text;
}

export function renderEquipmentPDF(
  pdf: jsPDF,
  projectName: string,
  scene: SetScene,
  shot: Shot,
) {
  const resolved = resolveLightingPlan(scene, shot);
  const lights = resolved.items.filter(
    (item) => item.kind === "light" && !item.hidden,
  );
  const sources = resolved.items.filter(
    (item) => item.kind === "power" && !item.hidden,
  );
  const rowsPerPage = 13;
  const pages = Math.max(
    1,
    Math.ceil(lights.length / rowsPerPage),
    Math.ceil(sources.length / 4),
  );
  const plan = shot.lightingPlans?.find(
    (entry) => entry.id === shot.activeLightingPlanId,
  );
  for (let page = 0; page < pages; page++) {
    if (page) pdf.addPage();
    pdf.setFillColor(249, 246, 239);
    pdf.rect(0, 0, 297, 210, "F");
    pdf.setFillColor(34, 37, 36);
    pdf.rect(0, 0, 297, 26, "F");
    pdf.setTextColor(255, 255, 255);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(14);
    pdf.text(fit(pdf, projectName, 180), 12, 12);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.text(
      fit(
        pdf,
        `${scene.name} / ${shot.title} / ${plan?.name ?? "Base"} / EQUIPMENT & POWER`,
        260,
      ),
      12,
      21,
    );
    pdf.text(`${page + 1} / ${pages}`, 285, 16, { align: "right" });

    pdf.setFillColor(222, 211, 192);
    pdf.rect(12, 35, 273, 10, "F");
    pdf.setTextColor(66, 59, 50);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(7.5);
    columns.forEach((column) => pdf.text(column.title, column.x + 1, 41));
    lights
      .slice(page * rowsPerPage, (page + 1) * rowsPerPage)
      .forEach((light, row) => {
        const source = sources.find((item) => item.id === light.powerSourceId);
        const cable = source
          ? Math.hypot(light.x - source.x, light.z - source.z)
          : null;
        const values = [
          String(page * rowsPerPage + row + 1),
          light.name,
          light.lightType ?? "softbox",
          `${Math.round(fixtureLumens(light))} lm`,
          light.lightType === "practical"
            ? "Omni"
            : `${light.spread ?? 45}° / ${light.tilt ?? 45}°`,
          `${light.powerWatts ?? 150} W`,
          source?.name ?? "Unassigned",
          cable === null ? "—" : `${cable.toFixed(1)} m`,
          `${light.x.toFixed(1)}, ${light.z.toFixed(1)}`,
        ];
        const top = 45 + row * 8.5;
        if (row % 2 === 0) {
          pdf.setFillColor(255, 253, 248);
          pdf.rect(12, top, 273, 8.5, "F");
        }
        pdf.setTextColor(44, 48, 47);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(7.5);
        values.forEach((value, index) => {
          const column = columns[index];
          pdf.text(fit(pdf, value, column.width - 2), column.x + 1, top + 5.2);
        });
      });
    if (!lights.length) {
      pdf.setTextColor(106, 108, 101);
      pdf.setFontSize(10);
      pdf.text("No active fixtures in this plan.", 15, 56);
    }
    const totalWatts = lights.reduce(
      (sum, light) => sum + (light.powerWatts ?? 150),
      0,
    );
    pdf.setTextColor(177, 108, 53);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8);
    pdf.text(`TOTAL LOAD  ${totalWatts} W`, 12, 167);
    pdf.text("DISTRIBUTION", 105, 167);
    pdf.setTextColor(44, 48, 47);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7.5);
    sources.slice(page * 4, (page + 1) * 4).forEach((source, index) => {
      const watts = lights
        .filter((light) => light.powerSourceId === source.id)
        .reduce((sum, light) => sum + (light.powerWatts ?? 150), 0);
      const capacity = source.capacityWatts ?? 1800;
      pdf.text(
        fit(
          pdf,
          `${source.name}: ${watts} / ${capacity} W${watts > capacity ? "  OVER CAPACITY" : ""}`,
          175,
        ),
        105,
        175 + index * 5,
      );
    });
    if (!sources.length) pdf.text("No distribution source", 105, 175);
    pdf.setDrawColor(200, 196, 186);
    pdf.line(12, 199, 285, 199);
    pdf.setTextColor(106, 108, 101);
    pdf.setFontSize(7);
    pdf.text("PETTY: SET  ·  EQUIPMENT & POWER", 12, 205);
    pdf.text("Verify rigging and electrical loads on location.", 285, 205, {
      align: "right",
    });
  }
}
