import { createFileRoute } from "@tanstack/react-router";
import { cleanSubmission } from "@/lib/submission-rules";
import { hasTeacherAccess } from "@/lib/teacher-access";

const MAX_BYTES = 100 * 1024 * 1024; // 100 MB
/** Types the raw proxy may render inline; everything else must be downloaded. */
const RENDERABLE = ["text/html", "application/xhtml+xml"];
const ALLOWED = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "text/csv",
  "text/html",
  "application/xhtml+xml",
  "application/zip",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "video/mp4",
];

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Teacher passphrase or admin password unlocks teacher-only writes. */
function authorize(request: Request): Response | null {
  const expected = process.env.GURU_UPLOAD_PASSPHRASE ?? "";
  const admin = process.env.ADMIN_PASSWORD ?? "";
  if (!expected && !admin) {
    return json(
      {
        error:
          "Upload Drive belum diaktifkan: passphrase guru belum diatur di pengaturan proyek.",
      },
      503,
    );
  }
  const given = request.headers.get("x-guru-passphrase") ?? "";
  if (hasTeacherAccess(given, expected, admin)) return null;
  return json({ error: "Passphrase guru / password admin salah." }, 401);
}

export const Route = createFileRoute("/api/drive/materials")({
  server: {
    handlers: {
      // Status probe, plus the raw proxy that renders HTML materials inline.
      GET: async ({ request }) => {
        const params = new URL(request.url).searchParams;
        const rawId = params.get("fileId");

        if (params.get("teacher-session") === "1") {
          return authorize(request) ?? json({ ok: true });
        }

        if (params.get("catalog") === "1") {
          try {
            const { readSharedCatalog } = await import("@/lib/drive.server");
            return json(await readSharedCatalog());
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            console.error("Drive catalog fetch failed:", message);
            return json({ error: message }, 502);
          }
        }

        if (params.get("activity") === "1") {
          try {
            const { readActivity } = await import("@/lib/drive.server");
            return json(await readActivity());
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            console.error("Drive activity fetch failed:", message);
            return json({ error: message }, 502);
          }
        }


        if (rawId) {
          if (!/^[A-Za-z0-9_-]{10,80}$/.test(rawId)) {
            return json({ error: "ID file tidak valid." }, 400);
          }
          const wantsDownload = params.get("download") === "1";
          try {
            const { getFileContent } = await import("@/lib/drive.server");
            const doc = await getFileContent(rawId);
            if (!RENDERABLE.includes(doc.mimeType)) {
              return json({ error: `Tipe ${doc.mimeType} tidak bisa disajikan inline.` }, 415);
            }
            // Students can grab the untouched .html source; Drive's own download
            // link needs a Google session, this one does not.
            const safeName = (doc.name || "materi.html").replace(/["\\\r\n]/g, "_");
            return new Response(doc.bytes, {
              headers: {
                "Content-Type": wantsDownload
                  ? "application/octet-stream"
                  : "text/html; charset=utf-8",
                "X-Content-Type-Options": "nosniff",
                ...(wantsDownload
                  ? { "Content-Disposition": `attachment; filename="${safeName}"` }
                  : {}),
                // `sandbox` drops the document into a unique origin, so teacher-
                // uploaded HTML can never touch this app's storage or session.
                "Content-Security-Policy": "sandbox allow-scripts allow-popups",
                "Cache-Control": "private, max-age=300",
              },
            });
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            console.error("Drive raw fetch failed:", message);
            return json({ error: message }, 502);
          }
        }

        // Daftar akun siswa (tanpa hash password) — hanya untuk guru.
        if (params.get("accounts") === "1") {
          const denied = authorize(request);
          if (denied) return denied;
          try {
            const { listAccounts } = await import("@/lib/drive.server");
            return json({ accounts: await listAccounts() });
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            console.error("Drive accounts fetch failed:", message);
            return json({ error: message }, 502);
          }
        }

        const ready = Boolean(
          process.env.LOVABLE_API_KEY && process.env.GOOGLE_DRIVE_API_KEY,
        );
        return json({
          ready,
          passphraseRequired: Boolean(process.env.GURU_UPLOAD_PASSPHRASE),
          maxBytes: MAX_BYTES,
        });
      },


      POST: async ({ request }) => {
        const params = new URL(request.url).searchParams;

        if (params.get("teacher-login") === "1") {
          const body = await request.json().catch(() => ({})) as { password?: string };
          const given = String(body.password ?? "");
          if (!hasTeacherAccess(given, process.env.GURU_UPLOAD_PASSPHRASE ?? "", process.env.ADMIN_PASSWORD ?? "")) {
            return json({ error: "Akun siswa tidak dapat masuk sebagai guru. Gunakan password khusus guru." }, 401);
          }
          return json({ ok: true });
        }

        // Student submissions: appended without the teacher passphrase, but the
        // payload shape is validated and only these three buckets are writable.
        if (params.get("submit") === "1") {
          try {
            const payload = (await request.json()) as {
              jenis?: string;
              itemKey?: string;
              entry?: Record<string, unknown>;
            };
            const jenis = payload.jenis;
            if (jenis !== "tugas" && jenis !== "lkpd" && jenis !== "quiz") {
              return json({ error: "Jenis pengumpulan tidak dikenal." }, 400);
            }
            const itemKey = String(payload.itemKey ?? "");
            if (!/^[A-Za-z0-9_.:-]{1,80}$/.test(itemKey)) {
              return json({ error: "Item tidak valid." }, 400);
            }
            const entry = payload.entry;
            if (!entry || typeof entry !== "object") {
              return json({ error: "Isi pengumpulan tidak valid." }, 400);
            }
            if (JSON.stringify(entry).length > 2_000_000) {
              return json({ error: "Lampiran terlalu besar (maks ±1.5MB)." }, 413);
            }
            // Grades are teacher-only; strip them from anything a student sends.
            let safe: Record<string, unknown>;
            try { safe = cleanSubmission(jenis, entry); }
            catch (err) { return json({ error: err instanceof Error ? err.message : 'Pengumpulan tidak valid.' }, 400); }
            const { appendSubmission } = await import("@/lib/drive.server");
            return json(await appendSubmission(jenis, itemKey, safe));
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            console.error("Drive submission failed:", message);
            return json({ error: message }, 502);
          }
        }

        // Login siswa — publik, memakai NIS + password akun buatan guru.
        if (params.get("login") === "1") {
          try {
            const body = (await request.json()) as { nis?: string; password?: string };
            const nis = String(body.nis ?? "").trim();
            const password = String(body.password ?? "");
            if (!nis || !password) {
              return json({ error: "NIS dan password wajib diisi." }, 400);
            }
            const { verifyLogin } = await import("@/lib/drive.server");
            const account = await verifyLogin(nis, password);
            if (!account) return json({ error: "NIS atau password salah." }, 401);
            return json({ ok: true, account });
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            console.error("Student login failed:", message);
            return json({ error: message }, 502);
          }
        }

        // Login admin — publik, memakai password khusus yang diatur di
        // pengaturan proyek (ADMIN_PASSWORD). Dibandingkan timing-safe.
        if (params.get("admin-login") === "1") {
          const expected = process.env.ADMIN_PASSWORD;
          if (!expected) {
            return json(
              { error: "Password admin belum diatur di pengaturan proyek." },
              503,
            );
          }
          const body = (await request.json().catch(() => ({}))) as {
            password?: string;
          };
          const given = String(body.password ?? "");
          const { createHash, timingSafeEqual } = await import("node:crypto");
          const a = createHash("sha256").update(given, "utf8").digest();
          const b = createHash("sha256").update(expected, "utf8").digest();
          if (!timingSafeEqual(a, b)) {
            return json({ error: "Password admin salah." }, 401);
          }
          return json({ ok: true });
        }

        const denied = authorize(request);
        if (denied) return denied;

        // Kosongkan seluruh data (katalog, aktivitas, akun siswa).
        if (params.get("reset") === "1") {
          try {
            const { resetAllData } = await import("@/lib/drive.server");
            return json(await resetAllData());
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            console.error("Drive reset failed:", message);
            return json({ error: message }, 502);
          }
        }


        // Kelola akun siswa (guru): simpan/hapus satu akun, atau impor massal.
        if (params.get("accounts") === "1") {
          try {
            const body = (await request.json()) as {
              action?: string;
              nis?: string;
              nama?: string;
              kelas?: string;
              password?: string;
              accounts?: Array<{ nis: string; nama: string; kelas: string; password?: string }>;
            };
            const mod = await import("@/lib/drive.server");
            const validNis = (v: string) => /^[A-Za-z0-9._-]{3,30}$/.test(v);

            if (body.action === "delete") {
              const nis = String(body.nis ?? "").trim();
              if (!validNis(nis)) return json({ error: "NIS tidak valid." }, 400);
              return json({ accounts: await mod.deleteAccount(nis) });
            }

            if (body.action === "bulk") {
              const rows = Array.isArray(body.accounts) ? body.accounts.slice(0, 500) : [];
              const validRows = rows.flatMap((row) => {
                const nis = String(row.nis ?? "").trim();
                if (!validNis(nis)) return [];
                return [{
                  nis,
                  nama: String(row.nama ?? "").slice(0, 80),
                  kelas: String(row.kelas ?? "").slice(0, 20),
                  password: row.password ? String(row.password) : undefined,
                }];
              });
              if (!validRows.length) return json({ error: "Tidak ada akun valid untuk diimpor." }, 400);
              return json({ accounts: await mod.bulkUpsertAccounts(validRows) });
            }

            const nis = String(body.nis ?? "").trim();
            if (!validNis(nis)) return json({ error: "NIS tidak valid." }, 400);
            const password = body.password ? String(body.password) : undefined;
            if (password && password.length < 4) {
              return json({ error: "Password minimal 4 karakter." }, 400);
            }
            return json({
              accounts: await mod.upsertAccount({
                nis,
                nama: String(body.nama ?? "").slice(0, 80),
                kelas: String(body.kelas ?? "").slice(0, 20),
                password,
              }),
            });
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            console.error("Drive accounts update failed:", message);
            return json({ error: message }, 502);
          }
        }



        if (params.get("catalog") === "1") {
          try {
            const payload = (await request.json()) as Record<string, unknown>;
            if (!Array.isArray(payload["materi"]) || !Array.isArray(payload["tugas"])) {
              return json({ error: "Format katalog tidak valid." }, 400);
            }
            const { writeSharedCatalog } = await import("@/lib/drive.server");
            return json(
              await writeSharedCatalog({
                materi: payload["materi"] as unknown[],
                tugas: payload["tugas"] as unknown[],
                lkpd: (payload["lkpd"] as unknown[]) ?? [],
                quiz: (payload["quiz"] as unknown[]) ?? [],
                pengumuman: (payload["pengumuman"] as unknown[]) ?? [],
              }, typeof payload.updatedAt === "string" ? payload.updatedAt : null),
            );
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            console.error("Drive catalog update failed:", message);
            return json({ error: message }, message.startsWith("Katalog sudah diperbarui.") ? 409 : 502);
          }
        }

        // Teacher writes the whole activity document (grading, attendance recap).
        if (params.get("activity") === "1") {
          try {
            const payload = (await request.json()) as Record<string, unknown>;
            const { writeActivity } = await import("@/lib/drive.server");
            return json(
              await writeActivity({
                tugas: payload["tugas"] as never,
                lkpd: payload["lkpd"] as never,
                quiz: payload["quiz"] as never,
                absensi: payload["absensi"] as never,
              }),
            );
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            console.error("Drive activity update failed:", message);
            return json({ error: message }, 502);
          }
        }


        let form: FormData;
        try {
          form = await request.formData();
        } catch {
          return json({ error: "Body bukan multipart/form-data." }, 400);
        }

        const file = form.get("file");
        if (!(file instanceof File) || file.size === 0) {
          return json({ error: "File tidak ditemukan." }, 400);
        }
        if (file.size > MAX_BYTES) {
          return json(
            { error: `File terlalu besar (maks ${MAX_BYTES / 1048576} MB).` },
            413,
          );
        }
        const mime = file.type || "application/octet-stream";
        if (!ALLOWED.includes(mime)) {
          return json({ error: `Tipe file tidak diizinkan: ${mime}` }, 415);
        }

        const subject = String(form.get("kelas") ?? "").slice(0, 60);

        try {
          const { uploadFile } = await import("@/lib/drive.server");
          const uploaded = await uploadFile(file, subject);
          return json(uploaded);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.error("Drive upload failed:", message);
          return json({ error: message }, 502);
        }
      },

      DELETE: async ({ request }) => {
        const denied = authorize(request);
        if (denied) return denied;

        const id = new URL(request.url).searchParams.get("id");
        if (!id || !/^[A-Za-z0-9_-]{10,80}$/.test(id)) {
          return json({ error: "ID file tidak valid." }, 400);
        }
        try {
          const { deleteFile } = await import("@/lib/drive.server");
          await deleteFile(id);
          return json({ ok: true });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.error("Drive delete failed:", message);
          return json({ error: message }, 502);
        }
      },
    },
  },
});
