import { sha256 } from '@noble/hashes/sha2.js'
import { hmac } from '@noble/hashes/hmac.js'
import { bytesToHex } from '@noble/hashes/utils.js'

/**
 * Create HMAC-SHA256 signature for request audit trail
 * Used to verify request integrity in logs
 */
export function createRequestSignature(
  payload: Record<string, unknown>,
  secret: string
): string {
  const message = JSON.stringify(payload, Object.keys(payload).sort())
  const messageBytes = new TextEncoder().encode(message)
  const secretBytes = new TextEncoder().encode(secret)
  const signature = hmac(sha256, secretBytes, messageBytes)
  return bytesToHex(signature)
}

/**
 * Verify request signature matches payload
 * Constant-time comparison to prevent timing attacks
 */
export function verifyRequestSignature(
  payload: Record<string, unknown>,
  signature: string,
  secret: string
): boolean {
  try {
    const expected = createRequestSignature(payload, secret)

    // Constant-time comparison
    if (expected.length !== signature.length) return false

    let result = 0
    for (let i = 0; i < expected.length; i++) {
      result |= expected.charCodeAt(i) ^ signature.charCodeAt(i)
    }
    return result === 0
  } catch {
    return false
  }
}

/**
 * Hash prompt for audit log (no secret needed)
 * Returns 0x-prefixed hash for consistency with tx hashes
 */
export function hashPrompt(prompt: string): `0x${string}` {
  const promptBytes = new TextEncoder().encode(prompt)
  const hash = sha256(promptBytes)
  return `0x${bytesToHex(hash)}`
}

