import * as bcrypt from 'bcryptjs';

const SALT_ROUNDS = 10;

/**
 * Hashes a plain-text password using bcryptjs.
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Compares a plain-text password with a stored hash.
 * Supports standard bcrypt hashes ($2a$, $2b$, $2y$) and falls back to
 * direct string comparison for backward compatibility with legacy test users.
 */
export async function comparePassword(password: string, storedHash: string): Promise<boolean> {
  if (!password || !storedHash) {
    return false;
  }

  // Check if the stored string has standard bcrypt hash prefix
  const isBcrypt = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(storedHash);

  if (isBcrypt) {
    return bcrypt.compare(password, storedHash);
  }

  // Legacy fallback for plain-text passwords
  return password === storedHash;
}
