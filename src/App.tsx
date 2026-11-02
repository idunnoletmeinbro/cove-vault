import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, uid, blankItem, exportAll, importData, STORES, STAGES, type Item, type Board, type Project, type Stage } from './db'

type Tab = 'library' | 'wishlist' | 'boards' | 'projects' | 'more'
const TABS: [Tab, string, string][] = [['library', '🥥', 'Stash'], ['wishlist', '⭐', 'Wishlist'], ['boards', '🌺', 'Boards'], ['projects', '🌴', 'Projects'], ['more', '🐚', 'More']]
const money = (n: number, c = 'USD') => { try { return new Intl.NumberFormat(undefined, { style: 'currency', currency: c }).format(n) } catch { return `${n} ${c}` } }
const splitTags = (s: string) => s.split(',').map(t => t.trim()).filter(Boolean)
const storeFromUrl = (u: string): Item['store'] => /booth\.pm/.test(u) ? 'Booth' : /gumroad/.test(u) ? 'Gumroad' : /jinxxy/.test(u) ? 'Jinxxy' : /payhip/.test(u) ? 'Payhip' : 'Other'

export default function App() {
  const [tab, setTab] = useState<Tab>('library')
  const [dark, setDark] = useState(() => localStorage.getItem('theme') === 'dark')
  useEffect(() => { document.documentElement.dataset.theme = dark ? 'dark' : 'light'; localStorage.setItem('theme', dark ? 'dark' : 'light') }, [dark])
  return <div className="app">
    <header className="top"><img src="./logo.png" alt="Coconut Cove Creations" className="logo" /><h1>Cove Vault</h1>
      <button className="ghost" onClick={() => setDark(!dark)} aria-label="toggle theme">{dark ? '🌞' : '🌙'}</button></header>
    <nav className="nav">{TABS.map(([t, i, l]) => <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}><span>{i}</span>{l}</button>)}</nav>
    <main>{tab === 'library' || tab === 'wishlist' ? <Items kind={tab} key={tab} /> : tab === 'boards' ? <Boards /> : tab === 'projects' ? <Projects /> : <More />}</main>
  </div>
}

function Empty({ icon, title, sub }: { icon: string; title: string; sub: string }) {
  return <div className="empty"><div className="bob">{icon}</div><h3>{title}</h3><p>{sub}</p></div>
}

/* ---------------- Library & Wishlist ---------------- */
function Items({ kind }: { kind: Item['kind'] }) {
  const all = useLiveQuery(() => db.items.where('kind').equals(kind).toArray(), [kind]) ?? []
  const [q, setQ] = useState(''); const [store, setStore] = useState(''); const [tag, setTag] = useState(''); const [sort, setSort] = useState('new')
  const [edit, setEdit] = useState<Item | null>(null)
  const tags = useMemo(() => [...new Set(all.flatMap(i => i.tags))].sort(), [all])
  const list = useMemo(() => all.filter(i => (!store || i.store === store) && (!tag || i.tags.includes(tag)) &&
    (!q || [i.title, i.creator, i.notes, ...i.tags, ...i.bases].join(' ').toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => sort === 'price' ? b.price - a.price : sort === 'az' ? a.title.localeCompare(b.title) : sort === 'prio' ? 'hml'.indexOf(a.priority?.[0] ?? 'l') - 'hml'.indexOf(b.priority?.[0] ?? 'l') : (b.date ?? '').localeCompare(a.date ?? '') || b.createdAt - a.createdAt), [all, q, store, tag, sort])
  const totals = useMemo(() => { const t: Record<string, Record<string, number>> = {}; all.forEach(i => { (t[i.store] ??= {})[i.currency] = ((t[i.store] ??= {})[i.currency] ?? 0) + (i.price || 0) }); return t }, [all])
  return <section>
    <div className="row head"><h2>{kind === 'library' ? 'My Coconut Stash' : 'Wishlist'}</h2><button className="primary" onClick={() => setEdit(blankItem(kind))}>+ Add</button></div>
    {kind === 'library' && all.length > 0 && <div className="totals">{Object.entries(totals).map(([s, c]) => <div key={s} className="chip big"><b>{s}</b>{Object.entries(c).map(([cur, n]) => <span key={cur}>{money(n, cur)}</span>)}</div>)}</div>}
    <div className="filters">
      <input placeholder="🔍 Search title, creator, base, tag…" value={q} onChange={e => setQ(e.target.value)} />
      <select value={store} onChange={e => setStore(e.target.value)}><option value="">All stores</option>{STORES.map(s => <option key={s}>{s}</option>)}</select>
      <select value={tag} onChange={e => setTag(e.target.value)}><option value="">All tags</option>{tags.map(s => <option key={s}>{s}</option>)}</select>
      <select value={sort} onChange={e => setSort(e.target.value)}><option value="new">Newest</option><option value="price">Price</option><option value="az">A–Z</option>{kind === 'wishlist' && <option value="prio">Priority</option>}</select>
    </div>
    {list.length === 0 ? (all.length ? <Empty icon="🐢" title="Nothing washed up here" sub="Try a different search or filter." /> :
      kind === 'library' ? <Empty icon="🥥" title="Your coconut stash is empty!" sub="Add your first Booth, Gumroad, Jinxxy or Payhip goodie — or import receipts in More." /> :
        <Empty icon="⭐" title="No wishes yet" sub="Save assets you’re eyeing and catch them on sale." />) :
      <div className="grid">{list.map(i => <Card key={i.id} i={i} onClick={() => setEdit(i)} />)}</div>}
    {edit && <ItemForm item={edit} close={() => setEdit(null)} />}
  </section>
}

function Card({ i, onClick }: { i: Item; onClick: () => void }) {
  const soon = i.saleEnds && (new Date(i.saleEnds).getTime() - Date.now()) < 3 * 864e5 && new Date(i.saleEnds).getTime() > Date.now()
  return <article className="card" onClick={onClick}>
    <div className="thumb">{i.thumb ? <img src={i.thumb} alt="" loading="lazy" /> : <span>🥥</span>}<em className={'store s-' + i.store}>{i.store}</em></div>
    <div className="body"><h4>{i.title || 'Untitled'}</h4><small>{i.creator}</small>
      <div className="row"><b>{money(i.price, i.currency)}</b>{i.kind === 'wishlist' && i.targetPrice ? <small>🎯 {money(i.targetPrice, i.currency)}</small> : null}</div>
      {soon && <span className="chip hot">⏰ Sale ends soon!</span>}
      {i.priority && i.kind === 'wishlist' && <span className={'chip p-' + i.priority}>{i.priority}</span>}
      <div className="tags">{i.bases.map(b => <span key={b} className="chip base">{b}</span>)}{i.tags.slice(0, 4).map(t => <span key={t} className="chip">#{t}</span>)}</div>
    </div></article>
}

async function fetchMeta(url: string): Promise<Partial<Item>> {
  const out: Partial<Item> = { url, store: storeFromUrl(url) }
  try {
    const html = await (await fetch(url)).text()
    const doc = new DOMParser().parseFromString(html, 'text/html')
    const m = (p: string) => doc.querySelector(`meta[property="${p}"],meta[name="${p}"]`)?.getAttribute('content') ?? undefined
    out.title = m('og:title') ?? doc.title; out.thumb = m('og:image')
    const price = m('product:price:amount') ?? m('og:price:amount'); if (price) out.price = parseFloat(price)
    const cur = m('product:price:currency') ?? m('og:price:currency'); if (cur) out.currency = cur
  } catch { /* CORS-blocked: keep URL + store only */ }
  return out
}

function ItemForm({ item, close }: { item: Item; close: () => void }) {
  const [f, setF] = useState<Item>(item); const [link, setLink] = useState(''); const [msg, setMsg] = useState('')
  const isNew = !item.title
  const set = (p: Partial<Item>) => setF(o => ({ ...o, ...p }))
  const save = async () => { await db.items.put(f); close() }
  const grab = async () => { setMsg('Fishing for details… 🎣'); const m = await fetchMeta(link); set(Object.fromEntries(Object.entries(m).filter(([, v]) => v !== undefined))); setMsg(m.title ? 'Got it! 🌺' : 'The store blocked peeking 🙈 — store + link saved, fill the rest by hand.') }
  const purchased = async () => { await db.items.put({ ...f, kind: 'library', date: new Date().toISOString().slice(0, 10) }); close() }
  return <div className="modal" onClick={close}><div className="sheet" onClick={e => e.stopPropagation()}>
    <h3>{isNew ? 'New' : 'Edit'} {f.kind === 'library' ? 'asset' : 'wish'}</h3>
    <div className="row"><input placeholder="Paste a product link to auto-fill" value={link} onChange={e => setLink(e.target.value)} /><button onClick={grab} disabled={!link}>Add by link</button></div>
    {msg && <small className="muted">{msg}</small>}
    <label>Title<input value={f.title} onChange={e => set({ title: e.target.value })} /></label>
    <div className="two"><label>Store<select value={f.store} onChange={e => set({ store: e.target.value as Item['store'] })}>{STORES.map(s => <option key={s}>{s}</option>)}</select></label>
      <label>Creator / shop<input value={f.creator ?? ''} onChange={e => set({ creator: e.target.value })} /></label></div>
    <div className="two"><label>Price<input type="number" step="0.01" value={f.price} onChange={e => set({ price: +e.target.value })} /></label>
      <label>Currency<input value={f.currency} onChange={e => set({ currency: e.target.value.toUpperCase() })} /></label></div>
    {f.kind === 'library' ? <label>Purchase date<input type="date" value={f.date ?? ''} onChange={e => set({ date: e.target.value })} /></label> :
      <div className="three"><label>Target price<input type="number" value={f.targetPrice ?? ''} onChange={e => set({ targetPrice: +e.target.value })} /></label>
        <label>Priority<select value={f.priority ?? 'med'} onChange={e => set({ priority: e.target.value as Item['priority'] })}><option>low</option><option>med</option><option>high</option></select></label>
        <label>Sale ends<input type="date" value={f.saleEnds ?? ''} onChange={e => set({ saleEnds: e.target.value })} /></label></div>}
    <label>Product URL<input value={f.url ?? ''} onChange={e => set({ url: e.target.value })} /></label>
    <label>Thumbnail URL<input value={f.thumb ?? ''} onChange={e => set({ thumb: e.target.value })} /></label>
    <label>Compatible bases (comma separated)<input defaultValue={f.bases.join(', ')} onBlur={e => set({ bases: splitTags(e.target.value) })} placeholder="Rusk, Manuka, Kikyo" /></label>
    <label>Tags<input defaultValue={f.tags.join(', ')} onBlur={e => set({ tags: splitTags(e.target.value) })} placeholder="outfit, hair, texture" /></label>
    <label>Installed in Unity projects<input defaultValue={f.unityProjects.join(', ')} onBlur={e => set({ unityProjects: splitTags(e.target.value) })} /></label>
    <fieldset><legend>License</legend>{(['edits', 'redistribution', 'commercial'] as const).map(k =>
      <label key={k} className="check"><input type="checkbox" checked={f.license[k]} onChange={e => set({ license: { ...f.license, [k]: e.target.checked } })} />{k === 'edits' ? 'Edits allowed' : k === 'redistribution' ? 'Redistribution' : 'Commercial use'}</label>)}</fieldset>
    <label>Notes<textarea value={f.notes ?? ''} onChange={e => set({ notes: e.target.value })} /></label>
    <div className="row actions">
      {!isNew && <button className="danger" onClick={async () => { if (confirm('Toss this into the sea?')) { await db.items.delete(f.id); close() } }}>Delete</button>}
      {f.kind === 'wishlist' && !isNew && <button onClick={purchased}>🥥 Mark purchased</button>}
      <span style={{ flex: 1 }} /><button className="ghost" onClick={close}>Cancel</button><button className="primary" onClick={save} disabled={!f.title}>Save</button></div>
  </div></div>
}

/* ---------------- Mood boards ---------------- */
function loadImg(src: string) { return new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.crossOrigin = 'anonymous'; i.onload = () => res(i); i.onerror = rej; i.src = src }) }
async function palette(src: string): Promise<string[]> {
  try {
    const img = await loadImg(src); const c = document.createElement('canvas'); c.width = c.height = 48
    const x = c.getContext('2d')!; x.drawImage(img, 0, 0, 48, 48); const d = x.getImageData(0, 0, 48, 48).data
    const buckets = new Map<string, [number, number, number, number]>()
    for (let p = 0; p < d.length; p += 4) { if (d[p + 3] < 128) continue; const k = `${d[p] >> 5},${d[p + 1] >> 5},${d[p + 2] >> 5}`; const b = buckets.get(k) ?? [0, 0, 0, 0]; b[0] += d[p]; b[1] += d[p + 1]; b[2] += d[p + 2]; b[3]++; buckets.set(k, b) }
    return [...buckets.values()].sort((a, b) => b[3] - a[3]).slice(0, 6).map(([r, g, b, n]) => '#' + [r, g, b].map(v => Math.round(v / n).toString(16).padStart(2, '0')).join(''))
  } catch { return [] } // cross-origin image without CORS: no palette
}
async function shrink(file: Blob): Promise<string> {
  const url = URL.createObjectURL(file); const img = await loadImg(url); const s = Math.min(1, 1200 / Math.max(img.width, img.height))
  const c = document.createElement('canvas'); c.width = img.width * s; c.height = img.height * s; c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url)
  return c.toDataURL('image/jpeg', .85)
}

function Boards() {
  const boards = useLiveQuery(() => db.boards.toArray()) ?? []; const [open, setOpen] = useState<string | null>(null)
  const b = boards.find(x => x.id === open)
  if (b) return <BoardView b={b} back={() => setOpen(null)} />
  const add = async () => { const n = prompt('Name your mood board 🌺'); if (n) { const id = uid(); await db.boards.add({ id, name: n, images: [], itemIds: [], createdAt: Date.now() }); setOpen(id) } }
  return <section><div className="row head"><h2>Mood Boards</h2><button className="primary" onClick={add}>+ Board</button></div>
    {boards.length === 0 ? <Empty icon="🌺" title="No mood boards yet" sub="Collect vibes, colors and references for your next avatar." /> :
      <div className="grid">{boards.map(x => <article key={x.id} className="card" onClick={() => setOpen(x.id)}>
        <div className="thumb collage">{x.images.slice(0, 4).map(i => <img key={i.id} src={i.src} alt="" />)}{!x.images.length && <span>🌺</span>}</div>
        <div className="body"><h4>{x.name}</h4><small>{x.images.length} images</small><div className="pal">{x.images.flatMap(i => i.palette.slice(0, 2)).slice(0, 8).map((c, k) => <i key={k} style={{ background: c }} />)}</div></div></article>)}</div>}
  </section>
}

function BoardView({ b, back }: { b: Board; back: () => void }) {
  const projects = useLiveQuery(() => db.projects.toArray()) ?? []; const items = useLiveQuery(() => db.items.toArray()) ?? []
  const [url, setUrl] = useState(''); const [drag, setDrag] = useState<number | null>(null)
  const upd = (p: Partial<Board>) => db.boards.update(b.id, p)
  const addSrc = async (src: string) => { const pal = await palette(src); const cur = await db.boards.get(b.id); await upd({ images: [...(cur?.images ?? []), { id: uid(), src, caption: '', palette: pal }] }) }
  const onFiles = async (fs: FileList | null) => { for (const f of Array.from(fs ?? [])) await addSrc(await shrink(f)) }
  useEffect(() => {
    const h = async (e: ClipboardEvent) => { for (const it of Array.from(e.clipboardData?.items ?? [])) if (it.type.startsWith('image/')) { const f = it.getAsFile(); if (f) await addSrc(await shrink(f)) } }
    window.addEventListener('paste', h); return () => window.removeEventListener('paste', h)
  })
  const move = (from: number, to: number) => { if (to < 0 || to >= b.images.length) return; const im = [...b.images]; const [x] = im.splice(from, 1); im.splice(to, 0, x); upd({ images: im }) }
  return <section>
    <div className="row head"><button className="ghost" onClick={back}>← Boards</button><h2 style={{ flex: 1 }}>{b.name}</h2>
      <button className="danger" onClick={async () => { if (confirm('Delete board?')) { await db.boards.delete(b.id); back() } }}>Delete</button></div>
    <div className="filters">
      <label className="btn primary">📷 Upload<input type="file" accept="image/*" multiple hidden onChange={e => onFiles(e.target.files)} /></label>
      <input placeholder="Paste image URL (or Ctrl/long-press paste an image)" value={url} onChange={e => setUrl(e.target.value)} />
      <button onClick={() => { if (url) { addSrc(url); setUrl('') } }}>Add</button>
      <select value={b.projectId ?? ''} onChange={e => upd({ projectId: e.target.value || undefined })}><option value="">No project</option>{projects.map(p => <option key={p.id} value={p.id}>🌴 {p.name}</option>)}</select>
      <select value="" onChange={e => e.target.value && upd({ itemIds: [...new Set([...b.itemIds, e.target.value])] })}><option value="">+ Link asset/wish</option>{items.map(i => <option key={i.id} value={i.id}>{i.kind === 'wishlist' ? '⭐' : '🥥'} {i.title}</option>)}</select>
    </div>
    {b.itemIds.length > 0 && <div className="tags">{b.itemIds.map(id => { const i = items.find(x => x.id === id); return i && <span key={id} className="chip">{i.title} <button className="x" onClick={() => upd({ itemIds: b.itemIds.filter(x => x !== id) })}>×</button></span> })}</div>}
    {b.images.length === 0 ? <Empty icon="🐚" title="This board is a blank beach" sub="Upload, paste a URL, or paste an image to start." /> :
      <div className="masonry">{b.images.map((im, k) => <figure key={im.id} draggable onDragStart={() => setDrag(k)} onDragOver={e => e.preventDefault()} onDrop={() => { if (drag !== null) move(drag, k); setDrag(null) }}>
        <img src={im.src} alt={im.caption} />
        <div className="pal">{im.palette.map(c => <i key={c} title={c} style={{ background: c }} onClick={() => navigator.clipboard?.writeText(c)} />)}</div>
        <input placeholder="caption…" defaultValue={im.caption} onBlur={e => upd({ images: b.images.map(x => x.id === im.id ? { ...x, caption: e.target.value } : x) })} />
        <div className="row"><button className="ghost" onClick={() => move(k, k - 1)}>◀</button><button className="ghost" onClick={() => move(k, k + 1)}>▶</button><span style={{ flex: 1 }} />
          <button className="ghost" onClick={() => upd({ images: b.images.filter(x => x.id !== im.id) })}>🗑</button></div></figure>)}</div>}
  </section>
}

/* ---------------- Projects ---------------- */
function Projects() {
  const projects = useLiveQuery(() => db.projects.toArray()) ?? []; const [open, setOpen] = useState<string | null>(null)
  const p = projects.find(x => x.id === open)
  if (p) return <ProjectView p={p} back={() => setOpen(null)} />
  const add = async () => { const n = prompt('Avatar project name 🌴'); if (n) { const id = uid(); await db.projects.add({ id, name: n, stage: 'Concept', tasks: [], itemIds: [], createdAt: Date.now() }); setOpen(id) } }
  return <section><div className="row head"><h2>Avatar Projects</h2><button className="primary" onClick={add}>+ Project</button></div>
    {projects.length === 0 ? <Empty icon="🌴" title="No projects on the island yet" sub="Plan an avatar from concept to upload." /> :
      <div className="kanban">{STAGES.map(s => <div key={s} className="col"><h4>{s}</h4>{projects.filter(x => x.stage === s).map(x =>
        <div key={x.id} className="mini" onClick={() => setOpen(x.id)}><b>{x.name}</b><small>{x.tasks.filter(t => t.done).length}/{x.tasks.length} tasks</small></div>)}</div>)}</div>}
  </section>
}

function ProjectView({ p, back }: { p: Project; back: () => void }) {
  const items = useLiveQuery(() => db.items.toArray()) ?? []; const boards = useLiveQuery(() => db.boards.toArray()) ?? []
  const [t, setT] = useState(''); const upd = (x: Partial<Project>) => db.projects.update(p.id, x)
  const linked = items.filter(i => p.itemIds.includes(i.id))
  const budget: Record<string, number> = {}; linked.forEach(i => budget[i.currency] = (budget[i.currency] ?? 0) + i.price)
  const moveTask = (id: string, d: number) => upd({ tasks: p.tasks.map(x => x.id === id ? { ...x, stage: STAGES[Math.max(0, Math.min(5, STAGES.indexOf(x.stage) + d))] } : x) })
  return <section>
    <div className="row head"><button className="ghost" onClick={back}>← Projects</button><h2 style={{ flex: 1 }}>{p.name}</h2>
      <button className="danger" onClick={async () => { if (confirm('Delete project?')) { await db.projects.delete(p.id); back() } }}>Delete</button></div>
    <div className="stages">{STAGES.map(s => <button key={s} className={p.stage === s ? 'on' : ''} onClick={() => upd({ stage: s })}>{s}</button>)}</div>
    <div className="two">
      <label>Base avatar<input defaultValue={p.base ?? ''} onBlur={e => upd({ base: e.target.value })} placeholder="e.g. Manuka" /></label>
      <label>Mood board<select value={p.boardId ?? ''} onChange={e => upd({ boardId: e.target.value || undefined })}><option value="">—</option>{boards.map(b => <option key={b.id} value={b.id}>🌺 {b.name}</option>)}</select></label></div>
    <div className="card pad"><h4>💰 Budget: {Object.entries(budget).map(([c, n]) => money(n, c)).join(' + ') || money(0)}</h4>
      <select value="" onChange={e => e.target.value && upd({ itemIds: [...new Set([...p.itemIds, e.target.value])] })}><option value="">+ Link asset or wish</option>{items.map(i => <option key={i.id} value={i.id}>{i.kind === 'wishlist' ? '⭐' : '🥥'} {i.title} ({money(i.price, i.currency)})</option>)}</select>
      <div className="tags">{linked.map(i => <span key={i.id} className="chip">{i.kind === 'wishlist' ? '⭐' : '🥥'} {i.title}{p.base && i.bases.length > 0 && !i.bases.some(b => b.toLowerCase() === p.base!.toLowerCase()) ? ' ⚠️ base?' : ''}<button className="x" onClick={() => upd({ itemIds: p.itemIds.filter(x => x !== i.id) })}>×</button></span>)}</div></div>
    <form className="row" onSubmit={e => { e.preventDefault(); if (t) { upd({ tasks: [...p.tasks, { id: uid(), text: t, stage: p.stage, done: false }] }); setT('') } }}>
      <input placeholder={`Add a task to ${p.stage}…`} value={t} onChange={e => setT(e.target.value)} /><button className="primary">Add</button></form>
    <div className="kanban">{STAGES.map((s: Stage) => <div key={s} className="col"><h4>{s}</h4>{p.tasks.filter(x => x.stage === s).map(x =>
      <div key={x.id} className={'mini' + (x.done ? ' done' : '')}><label className="check"><input type="checkbox" checked={x.done} onChange={e => upd({ tasks: p.tasks.map(y => y.id === x.id ? { ...y, done: e.target.checked } : y) })} />{x.text}</label>
        <div className="row"><button className="ghost" onClick={() => moveTask(x.id, -1)}>◀</button><button className="ghost" onClick={() => moveTask(x.id, 1)}>▶</button><span style={{ flex: 1 }} /><button className="ghost" onClick={() => upd({ tasks: p.tasks.filter(y => y.id !== x.id) })}>🗑</button></div></div>)}</div>)}</div>
    <label>Notes<textarea defaultValue={p.notes ?? ''} onBlur={e => upd({ notes: e.target.value })} /></label>
  </section>
}

/* ---------------- More: backup / import ---------------- */
function More() {
  const [msg, setMsg] = useState('')
  const doExport = async () => { const blob = new Blob([JSON.stringify(await exportAll(), null, 2)], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `cove-vault-backup-${new Date().toISOString().slice(0, 10)}.json`; a.click() }
  const doImport = async (f?: File) => { if (!f) return; try { const n = await importData(JSON.parse(await f.text())); setMsg(`Imported ${n} things! 🥥`) } catch (e) { setMsg('Hmm, that file didn’t look like Cove Vault JSON 🐢') } }
  return <section><h2>Backup & Import</h2>
    <div className="card pad"><h4>💾 Export backup</h4><p className="muted">Everything lives on this device. Export a JSON backup now and then!</p><button className="primary" onClick={doExport}>Export JSON</button></div>
    <div className="card pad"><h4>📥 Import JSON</h4><p className="muted">Restore a backup or load <code>receipts.json</code> from the Gmail receipt importer. Duplicates (same link) are skipped.</p>
      <label className="btn primary">Choose file<input type="file" accept="application/json,.json" hidden onChange={e => doImport(e.target.files?.[0])} /></label>
      {msg && <p>{msg}</p>}</div>
    <p className="muted center">Cove Vault · made for Coconut Cove Creations 🥥🌴</p></section>
}
