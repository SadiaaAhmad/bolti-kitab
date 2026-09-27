/**
 * Bolti Kitab — RSA Key Generation Script
 *
 * Generates a 2048-bit RSA keypair (PKCS#8 private / SPKI public) and:
 *   1. Writes both keys to backend/.env as JWT_PRIVATE_KEY and JWT_PUBLIC_KEY.
 *   2. Never prints the private key to the console.
 *   3. Preserves all other existing .env entries.
 *
 * Usage (from backend/ directory):
 *   npx tsx scripts/generate-keys.ts
 *
 * SECURITY:
 *   - backend/.env is git-ignored — keys are never committed.
 *   - This script will OVERWRITE existing JWT_PRIVATE_KEY and JWT_PUBLIC_KEY
 *     values in backend/.env. All other .env entries are preserved.
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const ENV_FILE = path.resolve(process.cwd(), '.env');

function generateRsaKeyPair(): { privateKey: string; publicKey: string } {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding:  { type: 'spki',  format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  return { privateKey, publicKey };
}

// Serialize PEM for .env storage: replace newlines with \n literal
function pemToEnvValue(pem: string): string {
  return pem.replace(/\r?\n/g, '\\n');
}

function updateEnvFile(filePath: string, updates: Record<string, string>): void {
  let content = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';

  for (const [key, value] of Object.entries(updates)) {
    // Replace existing key=... line or append
    const regex = new RegExp(`^${key}=.*$`, 'm');
    if (regex.test(content)) {
      content = content.replace(regex, `${key}=${value}`);
    } else {
      content = content.trimEnd() + `\n${key}=${value}\n`;
    }
  }

  fs.writeFileSync(filePath, content, 'utf8');
}

function main(): void {
  console.log('[generate-keys] Generating 2048-bit RSA keypair for RS256 JWT...');

  const { privateKey, publicKey } = generateRsaKeyPair();

  updateEnvFile(ENV_FILE, {
    JWT_PRIVATE_KEY: pemToEnvValue(privateKey),
    JWT_PUBLIC_KEY:  pemToEnvValue(publicKey),
    JWT_EXPIRES_IN:  '30d',
    JWT_ISSUER:      'bolti-kitab',
    JWT_AUDIENCE:    'bolti-kitab-client',
  });

  console.log('[generate-keys] ✅ Keys written to backend/.env');
  console.log('[generate-keys] Public key fingerprint (SHA-256):');

  // Safe to log: fingerprint of the PUBLIC key only
  const pubKeyObj = crypto.createPublicKey(publicKey);
  const fingerprint = crypto
    .createHash('sha256')
    .update(pubKeyObj.export({ type: 'spki', format: 'der' }))
    .digest('hex');
  console.log(`[generate-keys]   ${fingerprint}`);

  console.log('[generate-keys] ⚠️  Private key has been written to backend/.env only.');
  console.log('[generate-keys]    Ensure backend/.env is git-ignored (it is by default).');
  console.log('[generate-keys]    NEVER share or commit the private key.');
}

main();
