/** Normalize student submissions without accepting teacher-owned grades. */
export function cleanSubmission(jenis: string, entry: Record<string, unknown>) {
  const safe = { ...entry };
  for (const field of ['nilai', 'catatan', 'status', 'dinilaiPada']) delete safe[field];
  if (!String(safe.userId ?? '').trim()) throw new Error('Identitas siswa wajib diisi.');
  if (jenis === 'quiz') {
    const total = Number(safe.total), benar = Number(safe.benar);
    if (!Number.isInteger(total) || total < 1 || !Number.isInteger(benar) || benar < 0 || benar > total) {
      throw new Error('Jumlah jawaban quiz tidak valid.');
    }
    safe.nilai = Math.round(benar / total * 100);
    safe.status = 'Selesai';
  }
  return safe;
}