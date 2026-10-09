import test from "node:test";
import assert from "node:assert/strict";
import "fake-indexeddb/auto";
import {
  activateFilm,
  createFilm,
  deleteFilm,
  flushFilm,
  openFilmLibrary,
  renameFilm,
  saveFilm,
} from "../src/filmStore.ts";
import { makeItem, sampleProject } from "../src/model.ts";

const values = new Map();
globalThis.localStorage = {
  getItem: (key) => values.get(key) ?? null,
  setItem: (key, value) => values.set(key, value),
  removeItem: (key) => values.delete(key),
};

function clearLibrary() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase("petty-set-library");
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("Library database is blocked"));
  });
}

test("legacy migration preserves the project and asset references", async () => {
  await clearLibrary();
  const legacy = sampleProject();
  legacy.name = "Legacy Film";
  const model = makeItem("asset", 1);
  model.assetRef = "123e4567-e89b-42d3-a456-426614174000";
  legacy.scenes[0].items.push(model);
  const raw = JSON.stringify(legacy);
  localStorage.setItem("petty-set-project", raw);

  const first = await openFilmLibrary();
  assert.equal(first.project.name, "Legacy Film");
  assert.equal(first.project.scenes[0].items.at(-1).assetRef, model.assetRef);
  assert.equal(first.films.length, 1);
  assert.equal(localStorage.getItem("petty-set-project"), raw);
  const reopened = await openFilmLibrary();
  assert.equal(reopened.id, first.id);
  assert.equal(reopened.films.length, 1);
});

test("films save independently and the latest queued edit wins", async () => {
  await clearLibrary();
  localStorage.removeItem("petty-set-project");
  const first = await openFilmLibrary();
  const second = await createFilm({ ...sampleProject(), name: "Second Film" });
  const early = { ...second.project, name: "Early" };
  const latest = { ...second.project, name: "Latest" };
  await Promise.all([saveFilm(second.id, early), saveFilm(second.id, latest)]);
  await flushFilm(second.id);
  assert.equal((await openFilmLibrary()).project.name, "Latest");

  const renamed = await renameFilm(first.id, "Original Renamed");
  assert.equal(renamed.name, "Original Renamed");
  const original = await activateFilm(first.id);
  assert.equal(original.project.name, "Original Renamed");
  assert.equal(original.films.length, 2);
  assert.equal((await activateFilm(second.id)).project.name, "Latest");

  const remaining = await deleteFilm(second.id);
  assert.equal(remaining.id, first.id);
  assert.equal(remaining.films.length, 1);
  await assert.rejects(deleteFilm(first.id), /last film/);
});

test("invalid legacy data remains available for manual recovery", async () => {
  await clearLibrary();
  localStorage.setItem("petty-set-project", "{broken");
  const session = await openFilmLibrary();
  assert.equal(session.project.name, sampleProject().name);
  assert.equal(localStorage.getItem("petty-set-project"), "{broken");
});
