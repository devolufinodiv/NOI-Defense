/**
 * Verifies that a production build has the environment it needs.
 *
 * src/config/env.ts deliberately never throws: the app must boot with an empty
 * .env so the style guide renders and local work does not require credentials.
 * That is right for a laptop and wrong for a deploy — without it, a Netlify
 * build with no Supabase variables succeeds and ships a site where scanning,
 * the trusted list, alerts and sign-in are all dead, with nothing in the build
 * log to say why.
 *
 * So the rule is split by where the build is running. On CI it is an error; on
 * a laptop it is a warning, because building without a backend is a legitimate
 * thing to do there.
 *
 * Values are read through Vite's own loader so a local .env.local counts,
 * exactly as it would during the build itself.
 */
import { loadEnv } from 'vite'

const REQUIRED = [
  {
    key: 'VITE_SUPABASE_URL',
    why: 'every scan, the trusted list, alerts and sign-in go through it',
    check: (value) => (/^https:\/\/.+/.test(value) ? null : 'must be an https URL'),
  },
  {
    key: 'VITE_SUPABASE_ANON_KEY',
    why: 'the browser cannot call the API without it',
    check: (value) => (value.length > 20 ? null : 'looks too short to be a real key'),
  },
]

const OPTIONAL = [
  { key: 'VITE_CHAIN_ID', why: 'the network a fresh session starts on (defaults to Base)' },
  { key: 'VITE_ALCHEMY_API_KEY', why: 'falls back to public RPCs, which rate-limit' },
]

// Netlify, GitHub Actions and most others set CI=true; Netlify also sets NETLIFY.
const isCI = process.env.CI === 'true' || process.env.NETLIFY === 'true'
const context = process.env.CONTEXT ?? 'local'
const env = loadEnv('production', process.cwd(), 'VITE_')

const problems = []
for (const { key, why, check } of REQUIRED) {
  const value = (env[key] ?? '').trim()
  if (!value) {
    problems.push(`${key} is missing — ${why}`)
    continue
  }
  const complaint = check(value)
  if (complaint) problems.push(`${key} ${complaint} — ${why}`)
}

const missingOptional = OPTIONAL.filter(({ key }) => !(env[key] ?? '').trim())

if (problems.length === 0) {
  console.log(`✓ Environment looks complete for a ${context} build`)
  for (const { key, why } of missingOptional) {
    console.log(`  · ${key} not set — ${why}`)
  }
  process.exit(0)
}

const heading = isCI
  ? `✗ Refusing to build for "${context}": the deploy would be missing its backend`
  : '⚠ Building without a backend — the app will run in its "not configured" state'

console[isCI ? 'error' : 'warn'](heading)
for (const problem of problems) console[isCI ? 'error' : 'warn'](`  · ${problem}`)

if (isCI) {
  console.error('')
  console.error('  Set these in Netlify under Site configuration → Environment variables,')
  console.error('  for the contexts you deploy (production, deploy previews, branch deploys).')
  process.exit(1)
}
