// Browser-side base64 for Yjs state (Uint8Array.toBase64 isn't available everywhere yet).

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000; // avoid "too many arguments" on large boards
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
