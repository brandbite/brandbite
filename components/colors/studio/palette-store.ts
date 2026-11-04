// -----------------------------------------------------------------------------
// @file: components/colors/studio/palette-store.ts
// @purpose: The two places saved palettes live, behind one interface: the browser
//           for guests and the account API for signed-in users. A failed write
//           always throws, so the UI can never report a save that didn't happen.
// -----------------------------------------------------------------------------

import { isStudioPalette, type StudioPalette } from "@/lib/colors";

export type PaletteStoreMode = "local" | "account";

export type PaletteStoreErrorKind =
  | "corrupt"
  | "storage"
  | "network"
  | "limit"
  | "not-found"
  | "invalid";

export class PaletteStoreError extends Error {
  constructor(
    public readonly kind: PaletteStoreErrorKind,
    message?: string,
  ) {
    super(message ?? kind);
    this.name = "PaletteStoreError";
  }
}

export interface PaletteStore {
  readonly mode: PaletteStoreMode;
  list(): Promise<StudioPalette[]>;
  /** Stored palettes may come back with new ids. */
  createMany(palettes: StudioPalette[]): Promise<StudioPalette[]>;
  update(palette: StudioPalette): Promise<StudioPalette>;
  remove(id: string): Promise<void>;
}

// -----------------------------------------------------------------------------
// Browser
// -----------------------------------------------------------------------------

const LOCAL_KEY = "brandbite.colorStudio.palettes.v1";
const LOCAL_VERSION = 1;

function readLocal(): StudioPalette[] {
  let text: string | null;
  try {
    text = window.localStorage.getItem(LOCAL_KEY);
  } catch {
    throw new PaletteStoreError("storage");
  }
  if (text === null) return [];

  try {
    const raw = JSON.parse(text);
    if (raw?.version !== LOCAL_VERSION || !Array.isArray(raw.palettes)) {
      throw new PaletteStoreError("corrupt");
    }
    if (!raw.palettes.every(isStudioPalette)) throw new PaletteStoreError("corrupt");
    return raw.palettes;
  } catch {
    throw new PaletteStoreError("corrupt");
  }
}

function writeLocal(palettes: StudioPalette[]): void {
  try {
    window.localStorage.setItem(LOCAL_KEY, JSON.stringify({ version: LOCAL_VERSION, palettes }));
  } catch {
    throw new PaletteStoreError("storage");
  }
}

/** Reading first means a corrupt store refuses writes instead of being overwritten. */
export const localPaletteStore: PaletteStore & { clear(): void } = {
  mode: "local",
  async list() {
    return readLocal();
  },
  async createMany(palettes) {
    writeLocal([...palettes, ...readLocal()]);
    return palettes;
  },
  async update(palette) {
    const current = readLocal();
    if (!current.some((p) => p.id === palette.id)) throw new PaletteStoreError("not-found");
    writeLocal(current.map((p) => (p.id === palette.id ? palette : p)));
    return palette;
  },
  async remove(id) {
    writeLocal(readLocal().filter((p) => p.id !== id));
  },
  /** Only for an explicit user action: moving to an account or resetting corrupt data. */
  clear() {
    try {
      window.localStorage.removeItem(LOCAL_KEY);
    } catch {
      throw new PaletteStoreError("storage");
    }
  },
};

/** Copies browser palettes to the account, clearing them only after that succeeds. */
export async function moveLocalPalettesToAccount(): Promise<StudioPalette[]> {
  const local = await localPaletteStore.list();
  if (local.length === 0) return [];
  const created = await accountPaletteStore.createMany(local);
  localPaletteStore.clear();
  return created;
}

// -----------------------------------------------------------------------------
// Account
// -----------------------------------------------------------------------------

const API = "/api/colors/palettes";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers: init?.body ? { "Content-Type": "application/json" } : undefined,
    });
  } catch {
    throw new PaletteStoreError("network");
  }
  const json = await res.json().catch(() => null);
  if (res.ok) return json as T;

  if (res.status === 404) throw new PaletteStoreError("not-found");
  if (json?.code === "LIMIT_REACHED") throw new PaletteStoreError("limit", json.error);
  if (res.status === 400) throw new PaletteStoreError("invalid", json?.error);
  throw new PaletteStoreError("network");
}

export const accountPaletteStore: PaletteStore = {
  mode: "account",
  async list() {
    return (await request<{ palettes: StudioPalette[] }>(API)).palettes;
  },
  async createMany(palettes) {
    const body = JSON.stringify({ palettes });
    return (await request<{ palettes: StudioPalette[] }>(API, { method: "POST", body })).palettes;
  },
  async update(palette) {
    const body = JSON.stringify({ palette });
    const url = `${API}/${encodeURIComponent(palette.id)}`;
    return (await request<{ palette: StudioPalette }>(url, { method: "PATCH", body })).palette;
  },
  async remove(id) {
    await request(`${API}/${encodeURIComponent(id)}`, { method: "DELETE" });
  },
};
