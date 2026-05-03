/**
 * auth.mock.js — Mock authentication service for BridgeBooks.
 *
 * This module simulates backend auth so the frontend can be developed
 * and tested before the real API is available.
 *
 * Accepted credentials (for development):
 *   Email:    admin@bridgebooks.co.za
 *   Password: bridge2026
 *
 * Returns the same shape as the real /auth/login endpoint:
 *   { token: string, user: { id, name, email, role } }
 */

const MOCK_DELAY_MS = 600

// Hardcoded dev credentials
const MOCK_USERS = [
  {
    id: '1',
    name: 'Admin User',
    email: 'admin@bridgebooks.co.za',
    password: 'bridge2026',
    role: 'admin',
  },
  {
    id: '2',
    name: 'Staff Member',
    email: 'staff@bridgebooks.co.za',
    password: 'staff2026',
    role: 'staff',
  },
]

/**
 * Simulate a login request.
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{ token: string, user: object }>}
 */
export async function mockLogin(email, password) {
  // Simulate network latency
  await new Promise((resolve) => setTimeout(resolve, MOCK_DELAY_MS))

  const normalised = email.trim().toLowerCase()
  const found = MOCK_USERS.find(
    (u) => u.email === normalised && u.password === password
  )

  if (!found) {
    throw new Error('Invalid email or password.')
  }

  // Build a fake JWT (not cryptographically valid — just for the frontend)
  const fakePayload = btoa(
    JSON.stringify({ sub: found.id, email: found.email, role: found.role })
  )
  const fakeToken = `mock.${fakePayload}.signature`

  // Return the same shape the real API would
  const { password: _pw, ...userWithoutPassword } = found
  return {
    token: fakeToken,
    user: userWithoutPassword,
  }
}
