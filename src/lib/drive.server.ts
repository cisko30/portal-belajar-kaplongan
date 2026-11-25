/**
 * Google Drive helper (server-only).
 * Talks to Drive v3 through the Lovable connector gateway using the
 * teacher's linked Google account. Never import this from browser code.
 */

const GATEWAY = "https://connector-gateway.lovable.dev/google_drive";
export const ROOT_FOLDER_NAME = "Portal Belajar - Materi";
const CATALOG_FILE_NAME = "Portal Belajar - Katalog.json";

function creds() {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const connKey = process.env.GOOGLE_DRIVE_API_KEY;
  if (!lovableKey || !connKey) {
    throw new Error(
      "Google Drive belum tersambung. Hubungkan konektor Google Drive terlebih dahulu.",
    );
  }
  return {
    Authorization: `Bearer ${lovableKey}`,
    "X-Connection-Api-Key": connKey,
  };
}

async function driveFetch(path: string, init: RequestInit = {}) {
  const res = await fetch(`${GATEWAY}${path}`, {
    ...init,
    headers: { ...creds(), ...(init.headers as Record<string, string>) },
  });
  if (!res.ok) {
    const body = await res.text();
    console.error(`Drive request failed [${res.status}] ${path}: ${body}`);
    throw new Error(`Google Drive error [${res.status}]: ${body}`);
  }
  return res;
}

export async function isConfigured() {
  return Boolean(process.env.LOVABLE_API_KEY && process.env.GOOGLE_DRIVE_API_KEY);
}

/** Find (or create) the shared materials folder in the teacher's Drive. */
export async function ensureFolder(): Promise<string> {
  const q = encodeURIComponent(
    `name='${ROOT_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
  );
  const found = await driveFetch(`/drive/v3/files?q=${q}&fields=files(id,name)&pageSize=1`);
  const list = (await found.json()) as { files?: Array<{ id: string }> };
  if (list.files?.length) return list.files[0].id;

  const created = await driveFetch(`/drive/v3/files?fields=id`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: ROOT_FOLDER_NAME,
      mimeType: "application/vnd.google-apps.folder",
    }),
  });
  const folder = (await created.json()) as { id: string };
  return folder.id;
}

export type UploadedFile = {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  viewLink: string;
  downloadLink: string;
  previewLink: string;
};

/** Upload a file to the shared folder and make it readable by anyone with the link. */
export async function uploadFile(
  file: File,
  subject: string,
): Promise<UploadedFile> {
  const folderId = await ensureFolder();
  const mimeType = file.type || "application/octet-stream";

  const boundary = `pb${crypto.randomUUID().replace(/-/g, "")}`;
  const metadata = JSON.stringify({
    name: file.name,
    parents: [folderId],
    description: subject ? `Materi kelas: ${subject}` : undefined,
  });

  const enc = new TextEncoder();
  const head = enc.encode(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n` +
      `--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`,
  );
  const tail = enc.encode(`\r\n--${boundary}--\r\n`);
  const bytes = new Uint8Array(await file.arrayBuffer());

  const body = new Uint8Array(head.length + bytes.length + tail.length);
  body.set(head, 0);
  body.set(bytes, head.length);
  body.set(tail, head.length + bytes.length);

  const res = await driveFetch(
    `/upload/drive/v3/files?uploadType=multipart&fields=id,name,size,mimeType`,
    {
      method: "POST",
      headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
      body,
    },
  );
  const created = (await res.json()) as {
    id: string;
    name: string;
    size?: string;
    mimeType: string;
  };

  // Anyone with the link can read — students open materials without a Google login.
  await driveFetch(`/drive/v3/files/${created.id}/permissions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role: "reader", type: "anyone" }),
  });

  return {
    id: created.id,
    name: created.name,
    size: Number(created.size ?? file.size),
    mimeType: created.mimeType,
    viewLink: `https://drive.google.com/file/d/${created.id}/view`,
    downloadLink: `https://drive.google.com/uc?export=download&id=${created.id}`,
    previewLink: `https://drive.google.com/file/d/${created.id}/preview`,
  };
}

export async function deleteFile(fileId: string) {
  await driveFetch(`/drive/v3/files/${encodeURIComponent(fileId)}`, {
    method: "DELETE",
  });
}

/**
 * Read a file's raw bytes back from Drive. Used to serve HTML materials from
 * our own origin, because Drive itself cannot render an .html file inline.
 */
export async function getFileContent(fileId: string): Promise<{
  name: string;
  mimeType: string;
  bytes: ArrayBuffer;
}> {
  const id = encodeURIComponent(fileId);
  const metaRes = await driveFetch(`/drive/v3/files/${id}?fields=name,mimeType,size`);
  const meta = (await metaRes.json()) as { name: string; mimeType: string };
  const mediaRes = await driveFetch(`/drive/v3/files/${id}?alt=media`);
  return { name: meta.name, mimeType: meta.mimeType, bytes: await mediaRes.arrayBuffer() };
}

export type SharedCatalog = {
  materi: unknown[];
  tugas: unknown[];
  lkpd: unknown[];
  quiz: unknown[];
  pengumuman: unknown[];
  updatedAt?: string;
};

const ACTIVITY_FILE_NAME = "Portal Belajar - Aktivitas.json";

async function findFileByName(name: string): Promise<string | null> {
  const folderId = await ensureFolder();
  const q = encodeURIComponent(`name='${name}' and '${folderId}' in parents and trashed=false`);
  const found = await driveFetch(`/drive/v3/files?q=${q}&fields=files(id)&pageSize=1`);
  const list = (await found.json()) as { files?: Array<{ id: string }> };
  return list.files?.[0]?.id ?? null;
}

async function writeJsonFile(name: string, value: unknown): Promise<void> {
  const folderId = await ensureFolder();
  const currentId = await findFileByName(name);
  const bytes = new TextEncoder().encode(JSON.stringify(value));

  if (currentId) {
    await driveFetch(
      `/upload/drive/v3/files/${encodeURIComponent(currentId)}?uploadType=media`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json; charset=UTF-8" },
        body: bytes,
      },
    );
    return;
  }

  const boundary = `pb${crypto.randomUUID().replace(/-/g, "")}`;
  const enc = new TextEncoder();
  const metadata = JSON.stringify({ name, parents: [folderId] });
  const head = enc.encode(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n` +
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`,
  );
  const tail = enc.encode(`\r\n--${boundary}--\r\n`);
  const body = new Uint8Array(head.length + bytes.length + tail.length);
  body.set(head, 0);
  body.set(bytes, head.length);
  body.set(tail, head.length + bytes.length);
  await driveFetch(`/upload/drive/v3/files?uploadType=multipart&fields=id`, {
    method: "POST",
    headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
    body,
  });
}

async function readJsonFile<T>(name: string, fallback: T): Promise<T> {
  const id = await findFileByName(name);
  if (!id) return fallback;
  const media = await driveFetch(`/drive/v3/files/${encodeURIComponent(id)}?alt=media`);
  try {
    return (await media.json()) as T;
  } catch {
    return fallback;
  }
}

const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

/** Public learning metadata only; student submissions and grades never enter this file. */
export async function readSharedCatalog(): Promise<SharedCatalog> {
  const parsed = await readJsonFile<Partial<SharedCatalog>>(CATALOG_FILE_NAME, {});
  return {
    materi: arr(parsed.materi),
    tugas: arr(parsed.tugas),
    lkpd: arr(parsed.lkpd),
    quiz: arr(parsed.quiz),
    pengumuman: arr(parsed.pengumuman),
    updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : undefined,
  };
}

export async function writeSharedCatalog(catalog: Partial<SharedCatalog>, expectedRevision?: string | null): Promise<SharedCatalog> {
  if (expectedRevision !== undefined) {
    const { assertCatalogRevision } = await import('./catalog-rules');
    const current = await readSharedCatalog();
    assertCatalogRevision(current.updatedAt, expectedRevision);
  }
  const clean: SharedCatalog = {
    materi: arr(catalog.materi),
    tugas: arr(catalog.tugas),
    lkpd: arr(catalog.lkpd),
    quiz: arr(catalog.quiz),
    pengumuman: arr(catalog.pengumuman),
    updatedAt: new Date().toISOString(),
  };
  await writeJsonFile(CATALOG_FILE_NAME, clean);
  return clean;
}

/**
 * Student-facing activity: submissions, quiz results and attendance recap.
 * Students may append their own entries; only the teacher (passphrase) can
 * overwrite the whole document when grading.
 */
export type Activity = {
  tugas: Record<string, unknown[]>;
  lkpd: Record<string, unknown[]>;
  quiz: Record<string, unknown[]>;
  absensi: Record<string, unknown>;
  updatedAt?: string;
};

const rec = (v: unknown): Record<string, unknown[]> => {
  const out: Record<string, unknown[]> = {};
  if (v && typeof v === "object") {
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      if (Array.isArray(val)) out[k] = val;
    }
  }
  return out;
};

export async function readActivity(): Promise<Activity> {
  const parsed = await readJsonFile<Partial<Activity>>(ACTIVITY_FILE_NAME, {});
  return {
    tugas: rec(parsed.tugas),
    lkpd: rec(parsed.lkpd),
    quiz: rec(parsed.quiz),
    absensi:
      parsed.absensi && typeof parsed.absensi === "object"
        ? (parsed.absensi as Record<string, unknown>)
        : {},
    updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : undefined,
  };
}

export async function writeActivity(next: Partial<Activity>): Promise<Activity> {
  const clean: Activity = {
    tugas: rec(next.tugas),
    lkpd: rec(next.lkpd),
    quiz: rec(next.quiz),
    absensi:
      next.absensi && typeof next.absensi === "object"
        ? (next.absensi as Record<string, unknown>)
        : {},
    updatedAt: new Date().toISOString(),
  };
  await writeJsonFile(ACTIVITY_FILE_NAME, clean);
  return clean;
}

/** Append one student submission without exposing the teacher passphrase. */
export async function appendSubmission(
  jenis: "tugas" | "lkpd" | "quiz",
  itemKey: string,
  entry: Record<string, unknown>,
): Promise<Activity> {
  const current = await readActivity();
  const bucket = current[jenis];
  const list = Array.isArray(bucket[itemKey]) ? bucket[itemKey] : [];
  const userId = String(entry["userId"] ?? "");
  const idx = list.findIndex(
    (s) => s && typeof s === "object" && String((s as Record<string, unknown>)["userId"]) === userId &&
      (userId !== 'me' || ((s as Record<string, unknown>)["nama"] === entry["nama"] && (s as Record<string, unknown>)["kelas"] === entry["kelas"])),
  );
  // Re-submissions replace the previous attempt instead of piling up.
  if (idx >= 0) list[idx] = entry;
  else list.push(entry);
  bucket[itemKey] = list;
  return writeActivity(current);
}


/* ─────────────── Akun siswa ───────────────
 * Satu file JSON di Drive berisi daftar akun siswa yang dibuat guru.
 * Password tidak pernah disimpan polos: PBKDF2-SHA256 + salt acak per akun.
 */
const ACCOUNTS_FILE_NAME = "Portal Belajar - Akun Siswa.json";

export type StudentAccount = {
  nis: string;
  nama: string;
  kelas: string;
  salt: string;
  hash: string;
  dibuat: string;
  terakhirMasuk?: string;
};

export type PublicAccount = Omit<StudentAccount, "salt" | "hash">;

const toHex = (buf: ArrayBuffer) =>
  Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

export async function hashPassword(password: string, salt: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    // Runtime edge membatasi PBKDF2 maksimal 100.000 iterasi.
    { name: "PBKDF2", salt: enc.encode(salt), iterations: 100_000, hash: "SHA-256" },
    key,
    256,
  );
  return toHex(bits);
}

const sanitize = (a: StudentAccount): PublicAccount => ({
  nis: a.nis,
  nama: a.nama,
  kelas: a.kelas,
  dibuat: a.dibuat,
  terakhirMasuk: a.terakhirMasuk,
});

export async function readAccounts(): Promise<StudentAccount[]> {
  const parsed = await readJsonFile<{ accounts?: StudentAccount[] }>(ACCOUNTS_FILE_NAME, {});
  return Array.isArray(parsed.accounts) ? parsed.accounts : [];
}

export async function listAccounts(): Promise<PublicAccount[]> {
  return (await readAccounts()).map(sanitize);
}

async function saveAccounts(list: StudentAccount[]) {
  await writeJsonFile(ACCOUNTS_FILE_NAME, {
    accounts: list,
    updatedAt: new Date().toISOString(),
  });
}

export async function upsertAccount(input: {
  nis: string;
  nama: string;
  kelas: string;
  password?: string;
}): Promise<PublicAccount[]> {
  const list = await readAccounts();
  const idx = list.findIndex((a) => a.nis === input.nis);
  if (idx < 0 && !input.password) throw new Error("Password wajib diisi untuk akun baru.");

  const base: StudentAccount =
    idx >= 0
      ? { ...list[idx], nama: input.nama, kelas: input.kelas }
      : {
          nis: input.nis,
          nama: input.nama,
          kelas: input.kelas,
          salt: "",
          hash: "",
          dibuat: new Date().toISOString(),
        };

  if (input.password) {
    base.salt = toHex(crypto.getRandomValues(new Uint8Array(16)).buffer);
    base.hash = await hashPassword(input.password, base.salt);
  }

  if (idx >= 0) list[idx] = base;
  else list.push(base);
  await saveAccounts(list);
  return list.map(sanitize);
}

export async function bulkUpsertAccounts(
  inputs: Array<{ nis: string; nama: string; kelas: string; password?: string }>,
): Promise<PublicAccount[]> {
  const list = await readAccounts();
  for (const input of inputs) {
    const idx = list.findIndex((a) => a.nis === input.nis);
    if (idx < 0 && !input.password) continue;

    const account: StudentAccount =
      idx >= 0
        ? { ...list[idx], nama: input.nama, kelas: input.kelas }
        : {
            nis: input.nis,
            nama: input.nama,
            kelas: input.kelas,
            salt: "",
            hash: "",
            dibuat: new Date().toISOString(),
          };

    if (input.password) {
      account.salt = toHex(crypto.getRandomValues(new Uint8Array(16)).buffer);
      account.hash = await hashPassword(input.password, account.salt);
    }
    if (idx >= 0) list[idx] = account;
    else list.push(account);
  }
  await saveAccounts(list);
  return list.map(sanitize);
}

export async function deleteAccount(nis: string): Promise<PublicAccount[]> {
  const list = (await readAccounts()).filter((a) => a.nis !== nis);
  await saveAccounts(list);
  return list.map(sanitize);
}

export async function verifyLogin(
  nis: string,
  password: string,
): Promise<PublicAccount | null> {
  const list = await readAccounts();
  const found = list.find((a) => a.nis === nis);
  if (!found) return null;
  const candidate = await hashPassword(password, found.salt);
  if (candidate.length !== found.hash.length) return null;
  let diff = 0;
  for (let i = 0; i < candidate.length; i++) diff |= candidate.charCodeAt(i) ^ found.hash.charCodeAt(i);
  if (diff !== 0) return null;
  found.terakhirMasuk = new Date().toISOString();
  await saveAccounts(list);
  return sanitize(found);
}

/** Wipe every stored document: catalog, activity and student accounts. */
export async function resetAllData(): Promise<{ ok: true }> {
  await writeSharedCatalog({});
  await writeActivity({});
  await saveAccounts([]);
  return { ok: true };
}
