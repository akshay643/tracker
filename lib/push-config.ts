// =============================================================================
// lib/push-config.ts — Web Push (VAPID) public key.
// Client-safe: this file only exposes the PUBLIC key, used by the browser to
// create a push subscription. The matching PRIVATE key lives server-side in the
// /api/push route and must never be shipped to the client.
//
// Override in production via env: NEXT_PUBLIC_VAPID_PUBLIC_KEY.
// =============================================================================

export const VAPID_PUBLIC_KEY =
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
  "BFsciSTvHmSyCV-R9viKNxZ_jCbUNOKPdX0FvsOtRI5UNu0g8VGX6dHn_NkXVW2P9PiRgpbVvrGDBko3G9IramM";
