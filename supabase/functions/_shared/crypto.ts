// AES-256-GCM encryption for provider API keys.
// The master key comes from an Edge Function secret (KEY_ENCRYPTION_SECRET,
// 32 random bytes, base64), so a database leak alone doesn't expose any keys.
// Each ciphertext is bound to its row id (AAD), so it can't be copied to
// another row and still decrypt.
//
// Format: v1.<iv base64>.<ciphertext+tag base64>

const enc = new TextEncoder();
const dec = new TextDecoder();

const toB64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const fromB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function importMaster(masterB64: string) {
  let raw: ReturnType<typeof fromB64>;
  try {
    raw = fromB64(masterB64);
  } catch {
    throw new Error("KEY_ENCRYPTION_SECRET is not valid base64");
  }
  if (raw.length !== 32) {
    throw new Error("KEY_ENCRYPTION_SECRET must decode to exactly 32 bytes");
  }
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function encryptSecret(plain: string, masterB64: string, aad: string): Promise<string> {
  const key = await importMaster(masterB64);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: enc.encode(aad) }, key, enc.encode(plain)),
  );
  return `v1.${toB64(iv)}.${toB64(ct)}`;
}

export async function decryptSecret(token: string, masterB64: string, aad: string): Promise<string> {
  const [version, ivB64, ctB64] = token.split(".");
  if (version !== "v1" || !ivB64 || !ctB64) throw new Error("Unsupported ciphertext format");
  const key = await importMaster(masterB64);
  const pt = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromB64(ivB64), additionalData: enc.encode(aad) },
    key,
    fromB64(ctB64),
  );
  return dec.decode(pt);
}

export function last4(secret: string): string {
  return secret.slice(-4);
}
