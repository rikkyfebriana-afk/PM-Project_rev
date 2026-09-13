import 'server-only';

import { compare, hash } from 'bcryptjs';

const BCRYPT_ROUNDS = 12;

export function hashPassword(password: string) {
  return hash(password, BCRYPT_ROUNDS);
}

export function verifyPassword(password: string, passwordHash: string) {
  return compare(password, passwordHash);
}
