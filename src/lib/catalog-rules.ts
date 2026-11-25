/** Reject stale whole-catalog writes rather than silently erasing saved question packs. */
export function assertCatalogRevision(current: string | undefined, expected: string | null) {
  if ((current ?? null) !== expected) {
    throw new Error('Katalog sudah diperbarui. Muat ulang sebelum menyimpan agar soal yang tersimpan tidak tertimpa.');
  }
}