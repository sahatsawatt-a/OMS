/** Random, unguessable token (128 bits, base64url). Works on plain http too, unlike randomUUID. */
export function randomToken(bytes = 16): string {
  const buf = crypto.getRandomValues(new Uint8Array(bytes))
  return btoa(String.fromCharCode(...buf)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export const shortId = () => randomToken(6)
