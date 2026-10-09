import type { Project, SetScene, Shot } from "./model.ts";

const databaseName = "petty-set-images";
const storeName = "images";
const prefix = "pettyset-image:";

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(storeName);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const database = await openDatabase();
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = database.transaction(storeName, mode);
      const request = operation(transaction.objectStore(storeName));
      transaction.oncomplete = () => resolve(request.result);
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally {
    database.close();
  }
}

async function keyFor(image: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(image),
  );
  return (
    prefix +
    Array.from(new Uint8Array(digest), (byte) =>
      byte.toString(16).padStart(2, "0"),
    ).join("")
  );
}

async function storeImage(image: string): Promise<string> {
  if (!image.startsWith("data:image/")) return image;
  const key = await keyFor(image);
  await withStore("readwrite", (store) => store.put(image, key));
  return key;
}

async function restoreImage(image: string): Promise<string> {
  if (!image.startsWith(prefix)) return image;
  const stored = await withStore<string | undefined>("readonly", (store) =>
    store.get(image),
  );
  if (!stored) throw new Error("A stored project image is missing");
  return stored;
}

async function mapProjectImages(
  project: Project,
  transform: (image: string) => Promise<string>,
): Promise<Project> {
  const scenes: SetScene[] = [];
  for (const scene of project.scenes) {
    const shots: Shot[] = [];
    for (const shot of scene.shots) {
      shots.push({
        ...shot,
        frame: shot.frame ? await transform(shot.frame) : shot.frame,
        reference: shot.reference
          ? {
              ...shot.reference,
              image: await transform(shot.reference.image),
            }
          : undefined,
      });
    }
    scenes.push({
      ...scene,
      floorplan: scene.floorplan
        ? await transform(scene.floorplan)
        : scene.floorplan,
      shots,
    });
  }
  return { ...project, scenes };
}

export function storeProjectImages(project: Project): Promise<Project> {
  return mapProjectImages(project, storeImage);
}

export function restoreProjectImages(project: Project): Promise<Project> {
  return mapProjectImages(project, restoreImage);
}
