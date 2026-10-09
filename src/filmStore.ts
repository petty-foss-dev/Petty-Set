import { isProject, sampleProject } from "./model.ts";
import type { Project } from "./model.ts";

const databaseName = "petty-set-library";
const filmsStore = "films";
const indexStore = "index";
const metaStore = "meta";
const activeKey = "activeFilmId";
const legacyKey = "petty-set-project";

export interface FilmSummary {
  id: string;
  name: string;
  updatedAt: number;
}

export interface FilmSession {
  id: string;
  project: Project;
  films: FilmSummary[];
}

const pendingSaves = new Map<string, Promise<unknown>>();

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1);
    request.onupgradeneeded = () => {
      const database = request.result;
      database.createObjectStore(filmsStore);
      database.createObjectStore(indexStore);
      database.createObjectStore(metaStore);
    };
    request.onsuccess = () => {
      request.result.onversionchange = () => request.result.close();
      resolve(request.result);
    };
    request.onerror = () => reject(request.error);
    request.onblocked = () =>
      reject(new Error("Film library is open in another tab"));
  });
}

function transact<T>(
  stores: string[],
  mode: IDBTransactionMode,
  operation: (
    transaction: IDBTransaction,
    result: (value: T) => void,
    fail: (error: Error) => void,
  ) => void,
): Promise<T> {
  return openDatabase().then(
    (database) =>
      new Promise<T>((resolve, reject) => {
        let value: T;
        let failure: Error | undefined;
        const transaction = database.transaction(stores, mode);
        transaction.oncomplete = () => {
          database.close();
          resolve(value);
        };
        transaction.onabort = () => {
          database.close();
          reject(
            failure ?? transaction.error ?? new Error("Film storage failed"),
          );
        };
        transaction.onerror = () => {
          failure ??= transaction.error ?? new Error("Film storage failed");
        };
        const fail = (error: Error) => {
          failure = error;
          transaction.abort();
        };
        try {
          operation(transaction, (result) => (value = result), fail);
        } catch (error) {
          fail(
            error instanceof Error ? error : new Error("Film storage failed"),
          );
        }
      }),
  );
}

function legacyProject(): Project {
  try {
    const raw = localStorage.getItem(legacyKey);
    if (raw) {
      const value: unknown = JSON.parse(raw);
      if (isProject(value)) return value;
    }
  } catch {
    // Keep unreadable legacy data untouched for recovery.
  }
  return sampleProject();
}

function sortedFilms(films: FilmSummary[]): FilmSummary[] {
  return films.sort(
    (a, b) => b.updatedAt - a.updatedAt || a.name.localeCompare(b.name),
  );
}

function readSession(): Promise<FilmSession> {
  return transact<FilmSession>(
    [filmsStore, indexStore, metaStore],
    "readonly",
    (transaction, result, fail) => {
      let films: FilmSummary[] | undefined;
      let activeId: string | undefined;
      let project: Project | undefined;
      const finish = () => {
        if (!films || !activeId || !project) return;
        result({ id: activeId, project, films: sortedFilms(films) });
      };
      const all = transaction.objectStore(indexStore).getAll();
      all.onsuccess = () => {
        films = all.result as FilmSummary[];
        finish();
      };
      const active = transaction.objectStore(metaStore).get(activeKey);
      active.onsuccess = () => {
        activeId = active.result as string | undefined;
        if (!activeId) {
          fail(new Error("No active film"));
          return;
        }
        const record = transaction.objectStore(filmsStore).get(activeId);
        record.onsuccess = () => {
          if (!isProject(record.result)) {
            fail(new Error("Active film is missing or invalid"));
            return;
          }
          project = record.result;
          finish();
        };
      };
    },
  );
}

export async function openFilmLibrary(): Promise<FilmSession> {
  await transact<void>(
    [filmsStore, indexStore, metaStore],
    "readwrite",
    (transaction) => {
      const meta = transaction.objectStore(metaStore);
      const active = meta.get(activeKey);
      active.onsuccess = () => {
        if (active.result) return;
        const project = legacyProject();
        const id = crypto.randomUUID();
        const summary: FilmSummary = {
          id,
          name: project.name,
          updatedAt: Date.now(),
        };
        transaction.objectStore(filmsStore).put(project, id);
        transaction.objectStore(indexStore).put(summary, id);
        meta.put(id, activeKey);
      };
    },
  );
  return readSession();
}

function queueFilm<T>(id: string, write: () => Promise<T>): Promise<T> {
  const prior = pendingSaves.get(id);
  const pending = (prior ?? Promise.resolve()).catch(() => {}).then(write);
  pendingSaves.set(id, pending);
  void pending.then(
    () => {
      if (pendingSaves.get(id) === pending) pendingSaves.delete(id);
    },
    () => {},
  );
  return pending;
}

export async function flushFilm(id: string): Promise<void> {
  await pendingSaves.get(id);
}

export async function flushAllFilms(): Promise<void> {
  await Promise.all(pendingSaves.values());
}

export function saveFilm(id: string, project: Project): Promise<FilmSummary> {
  if (!isProject(project)) return Promise.reject(new Error("Invalid film"));
  return queueFilm(id, () =>
    transact<FilmSummary>(
      [filmsStore, indexStore],
      "readwrite",
      (transaction, result, fail) => {
        const films = transaction.objectStore(filmsStore);
        const existing = films.get(id);
        existing.onsuccess = () => {
          if (!existing.result) {
            fail(new Error("Film no longer exists"));
            return;
          }
          const summary = { id, name: project.name, updatedAt: Date.now() };
          films.put(project, id);
          transaction.objectStore(indexStore).put(summary, id);
          result(summary);
        };
      },
    ),
  );
}

export async function createFilm(project: Project): Promise<FilmSession> {
  if (!isProject(project)) throw new Error("Invalid film");
  await flushAllFilms();
  const id = crypto.randomUUID();
  await transact<void>(
    [filmsStore, indexStore, metaStore],
    "readwrite",
    (transaction) => {
      transaction.objectStore(filmsStore).put(project, id);
      transaction.objectStore(indexStore).put(
        {
          id,
          name: project.name,
          updatedAt: Date.now(),
        } satisfies FilmSummary,
        id,
      );
      transaction.objectStore(metaStore).put(id, activeKey);
    },
  );
  return readSession();
}

export async function activateFilm(id: string): Promise<FilmSession> {
  await flushAllFilms();
  await transact<void>(
    [filmsStore, metaStore],
    "readwrite",
    (transaction, _result, fail) => {
      const record = transaction.objectStore(filmsStore).get(id);
      record.onsuccess = () => {
        if (!isProject(record.result)) {
          fail(new Error("Film is missing or invalid"));
          return;
        }
        transaction.objectStore(metaStore).put(id, activeKey);
      };
    },
  );
  return readSession();
}

export function renameFilm(id: string, name: string): Promise<FilmSummary> {
  const trimmed = name.trim();
  if (!trimmed) return Promise.reject(new Error("Film name cannot be empty"));
  return queueFilm(id, () =>
    transact<FilmSummary>(
      [filmsStore, indexStore],
      "readwrite",
      (transaction, result, fail) => {
        const films = transaction.objectStore(filmsStore);
        const existing = films.get(id);
        existing.onsuccess = () => {
          if (!isProject(existing.result)) {
            fail(new Error("Film is missing or invalid"));
            return;
          }
          const summary = { id, name: trimmed, updatedAt: Date.now() };
          films.put({ ...existing.result, name: trimmed }, id);
          transaction.objectStore(indexStore).put(summary, id);
          result(summary);
        };
      },
    ),
  );
}

export async function deleteFilm(id: string): Promise<FilmSession> {
  await flushAllFilms();
  await transact<void>(
    [filmsStore, indexStore, metaStore],
    "readwrite",
    (transaction, _result, fail) => {
      const index = transaction.objectStore(indexStore);
      const keys = index.getAllKeys();
      let activeId: string | undefined;
      let ids: string[] | undefined;
      const proceed = () => {
        if (!ids || !activeId) return;
        if (ids.length <= 1) {
          fail(new Error("Cannot delete the last film"));
          return;
        }
        if (!ids.includes(id)) {
          fail(new Error("Film does not exist"));
          return;
        }
        transaction.objectStore(filmsStore).delete(id);
        index.delete(id);
        if (activeId === id)
          transaction.objectStore(metaStore).put(
            ids.find((candidate) => candidate !== id)!,
            activeKey,
          );
      };
      keys.onsuccess = () => {
        ids = keys.result as string[];
        proceed();
      };
      const active = transaction.objectStore(metaStore).get(activeKey);
      active.onsuccess = () => {
        activeId = active.result as string | undefined;
        if (!activeId) {
          fail(new Error("No active film"));
          return;
        }
        proceed();
      };
    },
  );
  return readSession();
}
