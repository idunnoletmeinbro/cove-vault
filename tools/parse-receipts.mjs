// Gmail receipt -> Cove Vault import converter.
// Step 1 (agent, read-only): run these Gmail connector searches (user-Gmail.search_emails, includeSpamTrash) and
//   read_email each hit, saving [{id, from, subject, date, body}] to tools/raw-receipts.json:
//   Booth:   from:(booth.pm OR pixiv.net)   | "booth"  | "pixiv"
//   Gumroad: from:gumroad.com              | "gumroad"
//   Jinxxy:  from:jinxxy.com               | "jinxxy"
//   Payhip:  from:payhip.com               | "payhip"
// Step 2: node tools/parse-receipts.mjs tools/raw-receipts.json import/receipts.json
// Then in the app: More -> Import JSON -> receipts.json
import fs from 'node:fs'
const [, , inFile = 'tools/raw-receipts.json', outFile = 'import/receipts.json'] = process.argv
const raw = fs.existsSync(inFile) ? JSON.parse(fs.readFileSync(inFile, 'utf8')) : []
const store = m => /booth|pixiv/i.test(m.from) ? 'Booth' : /gumroad/i.test(m.from) ? 'Gumroad' : /jinxxy/i.test(m.from) ? 'Jinxxy' : /payhip/i.test(m.from) ? 'Payhip' : null
const isReceipt = m => /(receipt|order|purchase|bought|thank you for|ご注文|購入)/i.test(m.subject + m.body) && !/(you made a sale|new sale|payout)/i.test(m.subject)
const linkRe = { Booth: /https:\/\/[\w.-]*booth\.pm\/[\w/-]*items\/\d+/, Gumroad: /https:\/\/[\w.-]*gumroad\.com\/l\/[\w-]+/, Jinxxy: /https:\/\/jinxxy\.com\/[\w-]+\/[\w-]+/, Payhip: /https:\/\/payhip\.com\/b\/\w+/ }
const items = []; const counts = { Booth: 0, Gumroad: 0, Jinxxy: 0, Payhip: 0 }
for (const m of raw) {
  const s = store(m); if (!s || !isReceipt(m)) continue
  const pm = m.body.match(/(?:([$€£¥])\s?([\d,]+(?:\.\d{2})?))|(?:([\d,]+)\s?(?:円|JPY))/)
  const sym = pm?.[1]; const price = pm ? parseFloat((pm[2] ?? pm[3]).replace(/,/g, '')) : 0
  const currency = pm?.[3] || sym === '¥' ? 'JPY' : sym === '€' ? 'EUR' : sym === '£' ? 'GBP' : 'USD'
  const title = (m.body.match(/(?:item|product|商品名)\s*[:：]\s*(.+)/i)?.[1] ?? m.subject.replace(/^(re:|fwd:|your )?(receipt|order|purchase)( for| from)?[:\s-]*/i, '')).trim().slice(0, 140)
  items.push({ id: 'gmail-' + m.id, kind: 'library', title, store: s, price, currency, date: new Date(m.date).toISOString().slice(0, 10),
    url: m.body.match(linkRe[s])?.[0], tags: ['gmail-import'], notes: `Imported from Gmail receipt: "${m.subject}"`,
    license: { edits: false, redistribution: false, commercial: false }, bases: [], unityProjects: [], createdAt: Date.now() })
  counts[s]++
}
fs.mkdirSync('import', { recursive: true })
fs.writeFileSync(outFile, JSON.stringify({ app: 'cove-vault', version: 1, exportedAt: new Date().toISOString(), source: 'gmail-receipts', counts, items }, null, 2))
console.log(counts, '->', outFile)
