// WCAG contrast of the text pairs in theme.css, for the default tokens and every palette x light/dark.
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const css = readFileSync(new URL('./theme.css', import.meta.url), 'utf8')

type Vars = Record<string, string>
const blocks: { name: string; selector: string; vars: Vars }[] = []
for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
  const selector = m[1].replace(/\/\*[\s\S]*?\*\//g, '').trim()
  if (!selector.startsWith(':root')) continue
  const vars: Vars = {}
  for (const d of m[2].matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) vars[d[1]] = d[2].trim()
  blocks.push({ name: selector, selector, vars })
}

function parseColor(v: string): [number, number, number] | null {
  const hex = v.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i)
  if (hex) {
    let h = hex[1]
    if (h.length === 3) h = [...h].map((c) => c + c).join('')
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255) as [number, number, number]
  }
  const rgb = v.match(/^rgba?\(\s*(\d+)[ ,]+(\d+)[ ,]+(\d+)/i)
  if (rgb) return [Number(rgb[1]) / 255, Number(rgb[2]) / 255, Number(rgb[3]) / 255]
  const ok = v.match(/^oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)/i)
  if (ok) {
    const L = Number(ok[1]), C = Number(ok[2]), h = (Number(ok[3]) * Math.PI) / 180
    const a = C * Math.cos(h), b = C * Math.sin(h)
    const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
    const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
    const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
    const lin = [
      4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
      -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
      -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
    ]
    // already linear sRGB; convert to gamma so the shared luminance code below can linearise again
    return lin.map((x) => {
      const c = Math.min(1, Math.max(0, x))
      return c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055
    }) as [number, number, number]
  }
  return null
}
function luminance([r, g, b]: [number, number, number]): number {
  const f = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}
export function contrast(a: string, b: string): number {
  const ca = parseColor(a), cb = parseColor(b)
  if (!ca || !cb) throw new Error(`unparseable colour: ${a} / ${b}`)
  const [hi, lo] = [luminance(ca), luminance(cb)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

const PAIRS: [string, string][] = [
  ['--foreground', '--background'],
  ['--card-foreground', '--card'],
  ['--popover-foreground', '--popover'],
  ['--primary-foreground', '--primary'],
  ['--secondary-foreground', '--secondary'],
  ['--muted-foreground', '--background'],
  ['--accent-foreground', '--accent'],
]

// Known failures (measured by this test; palette values are owned by another project).
// Key: "<selector> <fg> on <bg>". Listed here so the suite stays green while the failure stays visible.
const KNOWN_FAILS = new Set<string>([])

describe('theme.css contrast (WCAG >= 4.5:1)', () => {
  it('finds the default blocks and 5 palettes x 2 modes', () => {
    const palettes = blocks.filter((b) => b.selector.includes('data-palette'))
    expect(palettes).toHaveLength(10)
    expect(blocks.length).toBe(12)
  })
  for (const block of blocks) {
    for (const [fg, bg] of PAIRS) {
      const key = `${block.selector} ${fg} on ${bg}`
      const run = KNOWN_FAILS.has(key) ? it.fails : it
      run(key, () => {
        const vars = { ...blocks[0].vars, ...block.vars }
        const f = vars[fg], b = vars[bg]
        expect(f, `${fg} resolves`).toBeDefined()
        expect(b, `${bg} resolves`).toBeDefined()
        expect(contrast(f, b)).toBeGreaterThanOrEqual(4.5)
      })
    }
  }
})
