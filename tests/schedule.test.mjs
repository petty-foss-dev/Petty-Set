import assert from "node:assert/strict";
import test from "node:test";
import { castScheduleConflicts, shootScheduleCSV } from "../src/schedule.ts";

const project = () => ({
  version: 1,
  name: "Schedule test",
  scenes: [{ id: "set-1", name: "Hall", items: [], shots: [], shootOrder: [] }],
  scriptScenes: [
    {
      id: "scene-1",
      sceneNumber: "1",
      title: "Arrival",
      intExt: "INT",
      timeOfDay: "DAY",
      setSceneId: "set-1",
      pageEighths: 4,
      cast: ["Mara", "Eli"],
      props: [],
      wardrobe: [],
      effects: [],
    },
    {
      id: "scene-2",
      sceneNumber: "2",
      title: "Departure",
      intExt: "EXT",
      timeOfDay: "NIGHT",
      pageEighths: 3,
      cast: ["mara"],
      props: [],
      wardrobe: [],
      effects: [],
    },
    {
      id: "scene-3",
      sceneNumber: "3",
      title: "Quiet scene",
      intExt: "INT",
      timeOfDay: "NIGHT",
      pageEighths: 2,
      cast: [],
      props: [],
      wardrobe: [],
      effects: [],
    },
  ],
  shootDays: [
    {
      id: "day-1",
      date: "2026-10-12",
      unit: "Main",
      callTime: "07:00",
      scriptSceneIds: ["scene-1"],
      notes: 'Use "rain", if safe',
    },
    {
      id: "day-2",
      date: "2026-10-12",
      unit: "Second",
      scriptSceneIds: ["scene-2"],
    },
  ],
});

test("shoot schedule export includes each assignment and unscheduled scenes", () => {
  const csv = shootScheduleCSV(project());
  const rows = csv.trimEnd().split("\r\n");
  assert.equal(rows.length, 4);
  assert.match(
    rows[1],
    /2026-10-12,Main,07:00,1,Arrival,INT,DAY,Hall,4,Mara; Eli/,
  );
  assert.match(rows[1], /"Use ""rain"", if safe"/);
  assert.match(rows[2], /2026-10-12,Second,,2,Departure,EXT,NIGHT,,3,mara/);
  assert.match(rows[3], /^,Unscheduled,,3,Quiet scene/);
});

test("cast conflicts are limited to the same date across units", () => {
  const value = project();
  assert.deepEqual(castScheduleConflicts(value), [
    { date: "2026-10-12", castMember: "Mara", units: ["Main", "Second"] },
  ]);
  value.shootDays[1].date = "2026-10-13";
  assert.deepEqual(castScheduleConflicts(value), []);
});
