/** Guards the backend/frontend shipping mirror: the two modules must stay
 * byte-identical because each service deploys independently.
 * Run: node scripts/check-shipping.cjs */
const fs = require('fs')
const path = require('path')

const backend = path.resolve(__dirname, '..', 'lib', 'shipping.ts')
const frontend = path.resolve(__dirname, '..', '..', 'frontend', 'src', 'lib', 'shipping.ts')

const a = fs.readFileSync(backend, 'utf8')
const b = fs.readFileSync(frontend, 'utf8')

if (a === b) {
  console.log('✓ backend/lib/shipping.ts and frontend/src/lib/shipping.ts are identical')
  process.exit(0)
}
console.error('✗ shipping mirror drift detected — copy one file over the other:')
const [la, lb] = [a.split('\n'), b.split('\n')]
for (let i = 0; i < Math.max(la.length, lb.length); i++) {
  if (la[i] !== lb[i]) {
    console.error(`  line ${i + 1}:\n    backend : ${la[i] ?? '<none>'}\n    frontend: ${lb[i] ?? '<none>'}`)
    break
  }
}
process.exit(1)
