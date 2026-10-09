import assert from "node:assert/strict";
import test from "node:test";
import { jsPDF } from "jspdf";
import { renderDailyPlan } from "../src/dailyPlanPDF.ts";
import { sampleProject } from "../src/model.ts";

test("day plan PDF paginates a long schedule and includes scene departments", () => {
  const project = sampleProject();
  project.name = "Production Example";
  project.scriptScenes = Array.from({ length: 25 }, (_, index) => ({
    id: `script-${index + 1}`,
    sceneNumber: String(index + 1),
    title: `Location ${index + 1}`,
    intExt: "INT",
    timeOfDay: "DAY",
    pageEighths: 8,
    cast: ["Mara"],
    props: ["Letter"],
    wardrobe: ["Coat"],
    effects: ["Rain"],
    notes: "A short note about the action and blocking.",
  }));
  const day = {
    id: "day-1",
    date: "2026-10-08",
    unit: "Main unit",
    callTime: "07:00",
    scriptSceneIds: project.scriptScenes.map((scene) => scene.id),
  };
  const pdf = new jsPDF({ unit: "mm", format: "a4", compress: false });
  renderDailyPlan(pdf, project, day);
  const output = pdf.output();
  assert.ok(output.startsWith("%PDF-"));
  assert.ok(pdf.getNumberOfPages() > 1);
  assert.ok(output.includes("LOCATION 25"));
  assert.ok(output.includes("WARDROBE"));
  assert.ok(output.includes("07:00"));
});
