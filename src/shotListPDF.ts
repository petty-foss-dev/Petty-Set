import type { jsPDF } from "jspdf";
import { sensors } from "./cinematography.ts";
import type { SetScene, Shot } from "./model.ts";

const columns = [
  { title: "#", x: 12, width: 10 },
  { title: "SHOT", x: 23, width: 39 },
  { title: "SETUP", x: 64, width: 38 },
  { title: "STATUS", x: 104, width: 19 },
  { title: "CAMERA", x: 125, width: 31 },
  { title: "LENS", x: 158, width: 26 },
  { title: "FRAME", x: 186, width: 22 },
  { title: "DURATION", x: 210, width: 21 },
  { title: "NOTES", x: 233, width: 52 },
];

function fit(pdf: jsPDF, value: string, width: number) {
  let text = value;
  while (pdf.getTextWidth(text) > width && text.length > 1)
    text = `${text.slice(0, -2)}…`;
  return text;
}

export function renderShotListPDF(
  pdf: jsPDF,
  projectName: string,
  scene: SetScene,
  shots: Shot[],
  order: "story" | "shoot",
) {
  const rowsPerPage = 17;
  const pages = Math.max(1, Math.ceil(shots.length / rowsPerPage));
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
      `${scene.name}  /  ${order.toUpperCase()} ORDER  /  SHOT LIST`,
      12,
      21,
    );
    pdf.text(`${page + 1} / ${pages}`, 285, 16, { align: "right" });

    pdf.setFillColor(222, 211, 192);
    pdf.rect(12, 35, 273, 10, "F");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(7.5);
    pdf.setTextColor(66, 59, 50);
    for (const column of columns) pdf.text(column.title, column.x + 1, 41);

    shots
      .slice(page * rowsPerPage, (page + 1) * rowsPerPage)
      .forEach((shot, row) => {
        const camera = scene.items.find((item) => item.id === shot.cameraId);
        const values = [
          String(page * rowsPerPage + row + 1),
          shot.title,
          shot.setup || "—",
          shot.status ?? "planned",
          camera?.name ?? "—",
          `${camera?.focalLength ?? 35} mm / ${sensors[camera?.sensor ?? "super35"].label}`,
          shot.aspectRatio ?? "16:9",
          `${shot.duration}s`,
          shot.notes || "—",
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
    if (!shots.length) {
      pdf.setTextColor(106, 108, 101);
      pdf.setFontSize(10);
      pdf.text("No shots in this scene.", 15, 56);
    }
    pdf.setDrawColor(200, 196, 186);
    pdf.line(12, 199, 285, 199);
    pdf.setTextColor(106, 108, 101);
    pdf.setFontSize(7);
    pdf.text("PETTY: SET  ·  SHOT LIST", 12, 205);
    pdf.text(`${shots.length} shots`, 285, 205, { align: "right" });
  }
}
