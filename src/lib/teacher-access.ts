/** Only configured staff credentials grant staff access; client roles are not trusted. */
export function hasTeacherAccess(given: string, teacher: string, admin: string): boolean {
  const equal = (expected: string) => {
    if (!expected || given.length !== expected.length) return false;
    let diff = 0;
    for (let i = 0; i < expected.length; i++) diff |= given.charCodeAt(i) ^ expected.charCodeAt(i);
    return diff === 0;
  };
  return equal(teacher) || equal(admin);
}