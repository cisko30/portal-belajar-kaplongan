import { createFileRoute } from "@tanstack/react-router";

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });

function safeEqual(a: string, b: string) {
  if (!b || a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < b.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["judul", "soal"],
  properties: {
    judul: { type: "string" },
    soal: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["q", "o", "a"],
        properties: {
          q: { type: "string" },
          o: { type: "array", items: { type: "string" } },
          a: { type: "integer" },
        },
      },
    },
  },
};

/** Admin/guru: generate a multiple-choice game pack from a topic via Lovable AI Gateway. */
export const Route = createFileRoute("/api/game/generate")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const given = request.headers.get("x-guru-passphrase") ?? "";
        const ok =
          safeEqual(given, process.env.GURU_UPLOAD_PASSPHRASE ?? "") ||
          safeEqual(given, process.env.ADMIN_PASSWORD ?? "");
        if (!ok) return json({ error: "Password admin / passphrase guru salah." }, 401);

        const apiKey = process.env.LOVABLE_API_KEY;
        if (!apiKey) return json({ error: "Layanan AI belum dikonfigurasi." }, 503);

        const body = (await request.json().catch(() => ({}))) as {
          topik?: string;
          kelas?: string;
          jumlah?: number;
          tingkat?: string;
        };
        const topik = String(body.topik ?? "").trim().slice(0, 2000);
        if (topik.length < 3) return json({ error: "Topik/materi wajib diisi." }, 400);
        const jumlah = Math.min(30, Math.max(5, Number(body.jumlah) || 10));
        const kelas = String(body.kelas ?? "").slice(0, 20);
        const tingkat = String(body.tingkat ?? "sedang").slice(0, 20);

        const prompt = `Buat paket soal game pilihan ganda berbahasa Indonesia untuk siswa ${kelas || "SMP/SMA"} (mapel Informatika/KKA).
Topik/materi: ${topik}
Jumlah soal: tepat ${jumlah}. Tingkat kesulitan: ${tingkat}.
Aturan: setiap soal punya tepat 4 opsi singkat (maks 12 kata), hanya satu benar; "a" = indeks jawaban benar (0-3), acak posisinya; soal jelas, akurat, menyenangkan, sesuai kurikulum Merdeka. "judul" = judul paket yang menarik.`;

        let res: Response;
        try {
          res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
            method: "POST",
            signal: request.signal,
            headers: {
              "Content-Type": "application/json",
              "Lovable-API-Key": apiKey,
              "X-Lovable-AIG-SDK": "fetch",
            },
            body: JSON.stringify({
              model: "openai/gpt-6-astra",
              input: prompt,
              stream: true,
              store: false,
              reasoning: { effort: "low", summary: "auto" },
              include: ["reasoning.encrypted_content"],
              text: { format: { type: "json_schema", name: "paket_soal", strict: true, schema: SCHEMA } },
            }),
          });
        } catch (e) {
          if (request.signal.aborted) return new Response(null, { status: 499 });
          throw e;
        }

        if (!res.ok || !res.body) {
          const t = await res.text().catch(() => "");
          console.error("AI gateway error", res.status, t);
          let msg = "Gagal membuat soal. Coba lagi nanti.";
          try {
            msg = JSON.parse(t)?.error?.message || JSON.parse(t)?.message || msg;
          } catch {}
          if (res.status === 402) msg = "Kredit AI habis. Tambahkan kredit di Settings → Plans & credits.";
          if (res.status === 429) msg = "Terlalu banyak permintaan, tunggu sebentar lalu coba lagi.";
          return json({ error: msg }, res.status);
        }

        // Consume the SSE stream server-side and collect output text.
        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let buf = "", text = "", failed = "";
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          let idx;
          while ((idx = buf.indexOf("\n\n")) >= 0) {
            const frame = buf.slice(0, idx);
            buf = buf.slice(idx + 2);
            for (const line of frame.split("\n")) {
              if (!line.startsWith("data:")) continue;
              const data = line.slice(5).trim();
              if (!data || data === "[DONE]") continue;
              try {
                const ev = JSON.parse(data);
                if (ev.type === "response.output_text.delta") text += ev.delta ?? "";
                if (ev.type === "response.refusal.delta") failed = "AI menolak permintaan ini.";
                if (ev.type === "error" || ev.type === "response.failed")
                  failed = ev.error?.message || ev.response?.error?.message || "AI gagal.";
              } catch {}
            }
          }
        }
        if (failed) return json({ error: failed }, 502);

        try {
          const out = JSON.parse(text) as { judul: string; soal: { q: string; o: string[]; a: number }[] };
          const soal = out.soal
            .filter((s) => s.q && Array.isArray(s.o) && s.o.length >= 2 && s.a >= 0 && s.a < s.o.length)
            .map((s) => ({ q: s.q, o: s.o.slice(0, 4), a: Math.min(s.a, 3) }));
          if (!soal.length) return json({ error: "AI tidak menghasilkan soal yang valid." }, 502);
          return json({ judul: out.judul, soal });
        } catch {
          return json({ error: "Jawaban AI tidak bisa dibaca. Coba lagi." }, 502);
        }
      },
    },
  },
});
