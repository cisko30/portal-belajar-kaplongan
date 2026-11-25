import { expect, test } from 'bun:test';
import { cleanSubmission } from '../src/lib/submission-rules';

test('quiz results preserve a calculated score for admin recap', () => {
  expect(cleanSubmission('quiz', { userId: '001', benar: 20, total: 25, nilai: 100 }).nilai).toBe(80);
});
test('students cannot assign their own task grade', () => {
  expect(cleanSubmission('tugas', { userId: '001', nilai: 100, status: 'Selesai' })).toEqual({ userId: '001' });
});
test('invalid quiz answer counts are rejected', () => {
  expect(() => cleanSubmission('quiz', { userId: '001', benar: 26, total: 25 })).toThrow();
});