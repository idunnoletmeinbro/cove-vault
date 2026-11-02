import Dexie, { type Table } from 'dexie'
export const STORES = ['Booth', 'Gumroad', 'Jinxxy', 'Payhip', 'Other'] as const
export const STAGES = ['Concept', 'Sculpt', 'Texture', 'Rig', 'Optimize', 'Upload'] as const
export type Store = typeof STORES[number]
export type Stage = typeof STAGES[number]
export interface Item {
  id: string; kind: 'library' | 'wishlist'; title: string; store: Store; price: number; currency: string
  date?: string; url?: string; thumb?: string; creator?: string; tags: string[]; notes?: string
  license: { edits: boolean; redistribution: boolean; commercial: boolean }
  bases: string[]; unityProjects: string[]
  targetPrice?: number; priority?: 'low' | 'med' | 'high'; saleEnds?: string; createdAt: number
}
export interface BoardImage { id: string; src: string; caption: string; palette: string[] }
export interface Board { id: string; name: string; projectId?: string; images: BoardImage[]; itemIds: string[]; createdAt: number }
export interface Task { id: string; text: string; stage: Stage; done: boolean }
export interface Project { id: string; name: string; base?: string; notes?: string; stage: Stage; tasks: Task[]; itemIds: string[]; boardId?: string; createdAt: number }
class VaultDB extends Dexie {
  items!: Table<Item, string>; boards!: Table<Board, string>; projects!: Table<Project, string>
  constructor() { super('cove-vault'); this.version(1).stores({ items: 'id, kind, store, createdAt', boards: 'id, projectId', projects: 'id' }) }
}
export const db = new VaultDB()
export const uid = () => crypto.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36)
export const blankItem = (kind: Item['kind']): Item => ({ id: uid(), kind, title: '', store: 'Booth', price: 0, currency: 'USD', tags: [], license: { edits: false, redistribution: false, commercial: false }, bases: [], unityProjects: [], createdAt: Date.now() })

export interface Backup { app: 'cove-vault'; version: 1; exportedAt: string; items: Item[]; boards: Board[]; projects: Project[] }
export async function exportAll(): Promise<Backup> {
  return { app: 'cove-vault', version: 1, exportedAt: new Date().toISOString(), items: await db.items.toArray(), boards: await db.boards.toArray(), projects: await db.projects.toArray() }
}
/** Merge-import. Accepts a full backup or {items:[...]} (e.g. tools/receipts.json). Items de-duped by id, then by url+kind. */
export async function importData(data: any): Promise<number> {
  const items: Item[] = (data.items ?? (Array.isArray(data) ? data : [])).map((r: any) => ({ ...blankItem(r.kind ?? 'library'), ...r, id: r.id ?? uid(), tags: r.tags ?? [], bases: r.bases ?? [], unityProjects: r.unityProjects ?? [] }))
  const existing = await db.items.toArray(); const urls = new Set(existing.map(e => e.kind + (e.url ?? '')).filter(u => u.length > 8))
  const byId = new Map(existing.map(e => [e.id, e]))
  // Items whose id already exists: refresh store-sourced fields (price/currency/url/notes, add tags), keep the user's own edits.
  const updates = items.filter(i => byId.has(i.id)).map(i => { const e = byId.get(i.id)!; return { ...e, price: i.price ?? e.price, currency: i.currency ?? e.currency, url: i.url ?? e.url, notes: i.notes ?? e.notes, tags: Array.from(new Set([...(e.tags ?? []), ...(i.tags ?? [])])) } })
  const fresh = items.filter(i => !byId.has(i.id) && !(i.url && urls.has(i.kind + i.url)))
  await db.transaction('rw', db.items, db.boards, db.projects, async () => {
    await db.items.bulkPut([...fresh, ...updates])
    if (data.boards) await db.boards.bulkPut(data.boards)
    if (data.projects) await db.projects.bulkPut(data.projects)
  })
  return fresh.length + updates.length + (data.boards?.length ?? 0) + (data.projects?.length ?? 0)
}
