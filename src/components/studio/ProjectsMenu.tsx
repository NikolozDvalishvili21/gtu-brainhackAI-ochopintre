'use client'
// პროექტების dropdown — Navbar-ში (ორივე ხედში ჩანს).
// გადართვა / ახალი / შენახვა / გადარქმევა / წაშლა / JSON export-import.
import { useEffect, useRef, useState } from 'react'
import {
  listProjects, currentProjectId, currentProjectName, ensureCurrentProject,
  openProject, newProject, renameProject, deleteProject,
  exportJSON, importJSON, type ProjectMeta,
} from '@/lib/projects'
import { FolderOpen, Plus, Save, Pencil, Trash2, Download, Upload, ChevronDown, Check } from 'lucide-react'

function timeAgo(ts: number): string {
  const m = Math.floor((Date.now() - ts) / 60000)
  if (m < 1) return 'ახლახან'
  if (m < 60) return `${m} წთ წინ`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} სთ წინ`
  return `${Math.floor(h / 24)} დღის წინ`
}

export default function ProjectsMenu() {
  const [open, setOpen] = useState(false)
  const [projects, setProjects] = useState<ProjectMeta[]>([])
  const [curId, setCurId] = useState<string | null>(null)
  const [curName, setCurName] = useState('უსახელო პროექტი')
  const [savedFlash, setSavedFlash] = useState(false)
  // სახელის მოდალი: რომელ პროექტს არქმევს + საწყისი ტექსტი + შენახვის flash გვჭირდება თუ არა
  const [nameModal, setNameModal] = useState<{ id: string; value: string; flash?: boolean } | null>(null)
  const [confirmDel, setConfirmDel] = useState<string | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const nameInputRef = useRef<HTMLInputElement>(null)

  // მოდალის გახსნისას input-ზე ფოკუსი + ტექსტის მონიშვნა
  useEffect(() => {
    if (nameModal) setTimeout(() => { nameInputRef.current?.focus(); nameInputRef.current?.select() }, 30)
  }, [nameModal?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  function applyName() {
    if (!nameModal) return
    const v = nameModal.value.trim()
    if (v) renameProject(nameModal.id, v)
    if (nameModal.flash) { setSavedFlash(true); setTimeout(() => setSavedFlash(false), 1500) }
    setNameModal(null)
    refresh()
  }

  // მიმდინარე workspace ყოველთვის რეგისტრირდება სიაში — სია ცარიელი არასდროსაა
  const refresh = () => {
    ensureCurrentProject()
    setProjects(listProjects())
    setCurId(currentProjectId())
    setCurName(currentProjectName())
  }
  useEffect(refresh, [])

  // გარეთ კლიკზე დახურვა
  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) { setOpen(false); setConfirmDel(null) }
    }
    window.addEventListener('mousedown', close)
    return () => window.removeEventListener('mousedown', close)
  }, [open])

  function handleSave() {
    const meta = ensureCurrentProject() // snapshot slot-ში ჩაიწერა
    if (meta.name === 'უსახელო პროექტი') {
      setNameModal({ id: meta.id, value: 'ჩემი პროექტი', flash: true })
      return
    }
    refresh()
    setSavedFlash(true)
    setTimeout(() => setSavedFlash(false), 1500)
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        onClick={() => { refresh(); setOpen((o) => !o) }}
        className="flex max-w-48 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
      >
        <FolderOpen size={13} className="shrink-0 text-gray-400" />
        <span className="truncate">{curName}</span>
        <ChevronDown size={12} className="shrink-0 text-gray-400" />
      </button>

      {open && (
        <div
          style={{ backgroundColor: '#ffffff' }}
          className="absolute left-0 top-full z-[90] mt-2 w-80 rounded-xl border border-gray-200 p-2 shadow-2xl"
        >
          {/* actions — 2×2 ბადე */}
          <div className="grid grid-cols-2 gap-1 border-b border-gray-100 pb-2">
            <button onClick={() => { newProject(); refresh(); setOpen(false) }}
              className="flex items-center justify-center gap-1.5 rounded-lg border border-gray-100 px-2 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50">
              <Plus size={14} /> ახალი პროექტი
            </button>
            <button onClick={handleSave}
              className="flex items-center justify-center gap-1.5 rounded-lg border border-gray-100 px-2 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50">
              {savedFlash ? <Check size={14} className="text-green-600" /> : <Save size={14} />}
              {savedFlash ? 'შენახულია ✓' : 'შენახვა'}
            </button>
            <button onClick={() => { exportJSON() }}
              title="ჩამოტვირთე JSON ფაილად (გაზიარება/სარეზერვო)"
              className="flex items-center justify-center gap-1.5 rounded-lg border border-gray-100 px-2 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50">
              <Download size={14} /> JSON ექსპორტი
            </button>
            <button onClick={() => fileRef.current?.click()}
              title="JSON ფაილის იმპორტი"
              className="flex items-center justify-center gap-1.5 rounded-lg border border-gray-100 px-2 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50">
              <Upload size={14} /> იმპორტი
            </button>
          </div>

          {/* project list */}
          <div className="max-h-64 overflow-y-auto pt-1">
            {projects.length === 0 && (
              <p className="px-3 py-4 text-center text-xs text-gray-400">
                შენახული პროექტები არ არის.<br />„შენახვა" — მიმდინარეს დაამახსოვრებს.
              </p>
            )}
            {projects.map((p) => (
              <div key={p.id}
                className={`group flex items-center gap-2 rounded-lg px-2 py-1.5 ${p.id === curId ? 'bg-brand/10' : 'hover:bg-gray-50'}`}>
                <button onClick={() => { openProject(p.id); refresh(); setOpen(false) }}
                  className="flex min-w-0 flex-1 flex-col items-start">
                  <span className={`w-full truncate text-left text-xs font-medium ${p.id === curId ? 'text-brand' : 'text-gray-700'}`}>
                    {p.name}
                  </span>
                  <span className="text-[10px] text-gray-400">{timeAgo(p.updatedAt)}</span>
                </button>
                <button onClick={() => setNameModal({ id: p.id, value: p.name })}
                  title="გადარქმევა"
                  className="hidden rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-600 group-hover:block">
                  <Pencil size={12} />
                </button>
                {confirmDel === p.id ? (
                  <button onClick={() => { deleteProject(p.id); setConfirmDel(null); refresh() }}
                    className="rounded bg-red-500 px-1.5 py-0.5 text-[10px] font-medium text-white hover:bg-red-600">
                    დაადასტურე
                  </button>
                ) : (
                  <button onClick={() => setConfirmDel(p.id)}
                    title="წაშლა"
                    className="hidden rounded p-1 text-gray-400 hover:bg-red-100 hover:text-red-500 group-hover:block">
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* სახელის მოდალი */}
      {nameModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
          onMouseDown={(e) => { if (e.target === e.currentTarget) setNameModal(null) }}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl">
            <h3 className="mb-3 text-sm font-semibold text-gray-800">პროექტის სახელი</h3>
            <input
              ref={nameInputRef}
              value={nameModal.value}
              onChange={(e) => setNameModal({ ...nameModal, value: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); applyName() }
                if (e.key === 'Escape') setNameModal(null)
              }}
              placeholder="მაგ.: ჩემი მისაღები"
              className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setNameModal(null)}
                className="rounded-lg px-4 py-2 text-xs font-medium text-gray-500 hover:bg-gray-100">
                გაუქმება
              </button>
              <button onClick={applyName} disabled={!nameModal.value.trim()}
                className="rounded-lg bg-brand px-4 py-2 text-xs font-medium text-white hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-40">
                შენახვა
              </button>
            </div>
          </div>
        </div>
      )}

      <input ref={fileRef} type="file" accept="application/json,.json" className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (!f) return
          try {
            await importJSON(f)
            refresh()
            setOpen(false)
          } catch (err) {
            alert(err instanceof Error ? err.message : 'იმპორტი ვერ მოხერხდა')
          }
        }} />
    </div>
  )
}
