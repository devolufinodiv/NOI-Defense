/**
 * Verifies that every inline <script> in the built index.html is allow-listed
 * by a sha256 in the netlify.toml Content-Security-Policy.
 *
 * Without this, editing the inline theme-boot script silently breaks it in
 * production: the browser blocks it, the page flashes the wrong theme, and
 * nothing fails locally because the dev server sends no CSP. A build-time check
 * turns that into a loud, immediate failure.
 */
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'

const html = readFileSync('dist/index.html', 'utf8')
const toml = readFileSync('netlify.toml', 'utf8')

const cspMatch = toml.match(/Content-Security-Policy = """([\s\S]*?)"""/)
if (!cspMatch) {
  console.error('✗ No Content-Security-Policy found in netlify.toml')
  process.exit(1)
}
const csp = cspMatch[1]

// Inline scripts only — anything with a src= is covered by 'self'.
const inline = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(
  (m) => m[1],
)

let failed = false
for (const body of inline) {
  const hash = `sha256-${createHash('sha256').update(body).digest('base64')}`
  if (csp.includes(hash)) {
    console.log(`✓ CSP allows inline script  ${hash}`)
  } else {
    failed = true
    console.error(
      `\n✗ Inline script in index.html is NOT allowed by the CSP.\n` +
        `  Add this to script-src in netlify.toml:\n\n    '${hash}'\n\n` +
        `  Script begins: ${body.trim().slice(0, 80).replace(/\s+/g, ' ')}…\n`,
    )
  }
}

if (failed) process.exit(1)
if (inline.length === 0) console.log('✓ No inline scripts to allow-list')
