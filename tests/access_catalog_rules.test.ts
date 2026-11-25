import { expect, test } from 'bun:test';
import { hasTeacherAccess } from '../src/lib/teacher-access';
import { assertCatalogRevision } from '../src/lib/catalog-rules';

test('student credentials cannot grant teacher access', () => {
  expect(hasTeacherAccess('password-siswa', 'khusus-guru', 'khusus-admin')).toBe(false);
  expect(hasTeacherAccess('', '', '')).toBe(false);
  expect(hasTeacherAccess('khusus-guru', 'khusus-guru', 'khusus-admin')).toBe(true);
  expect(hasTeacherAccess('khusus-admin', 'khusus-guru', 'khusus-admin')).toBe(true);
});

test('permanent saved question packs cannot be erased by a stale catalog', () => {
  expect(() => assertCatalogRevision('saved-game-revision', 'old-revision')).toThrow();
  expect(() => assertCatalogRevision('saved-game-revision', null)).toThrow();
  expect(() => assertCatalogRevision('saved-game-revision', 'saved-game-revision')).not.toThrow();
  expect(() => assertCatalogRevision(undefined, null)).not.toThrow();
});