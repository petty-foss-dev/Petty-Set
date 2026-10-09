import type { Project, SceneItem } from "./model";

const databaseName = "petty-set-assets";
const storeName = "models";
export const maxAssetBytes = 50_000_000;

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(storeName);
    };
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

export async function saveAsset(bytes: ArrayBuffer): Promise<string> {
  if (bytes.byteLength > maxAssetBytes) throw new Error("Asset is too large");
  const key = crypto.randomUUID();
  await withStore("readwrite", (store) => store.put(bytes, key));
  return key;
}

export function loadAsset(key: string): Promise<ArrayBuffer | undefined> {
  return withStore<ArrayBuffer | undefined>("readonly", (store) =>
    store.get(key),
  );
}

async function dataUri(bytes: ArrayBuffer): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(new Blob([bytes], { type: "model/gltf-binary" }));
  });
}

async function mapItems(
  project: Project,
  transform: (item: SceneItem) => Promise<SceneItem>,
): Promise<Project> {
  const scenes = [];
  for (const scene of project.scenes) {
    const items = [];
    for (const item of scene.items) items.push(await transform(item));
    scenes.push({ ...scene, items });
  }
  return { ...project, scenes };
}

export function portableProject(project: Project): Promise<Project> {
  return mapItems(project, async (item) => {
    if (item.kind !== "asset" || !item.assetRef) return item;
    const bytes = await loadAsset(item.assetRef);
    if (!bytes) throw new Error(`Missing local model: ${item.name}`);
    const backup = { ...item, assetData: await dataUri(bytes) };
    delete backup.assetRef;
    return backup;
  });
}

export function localProject(project: Project): Promise<Project> {
  return mapItems(project, async (item) => {
    if (item.kind === "asset" && item.assetRef) {
      if (!(await loadAsset(item.assetRef)))
        throw new Error(`Missing local model: ${item.name}`);
      return item;
    }
    if (item.kind !== "asset" || !item.assetData) return item;
    const bytes = await fetch(item.assetData).then((response) =>
      response.arrayBuffer(),
    );
    const local = { ...item, assetRef: await saveAsset(bytes) };
    delete local.assetData;
    return local;
  });
}
