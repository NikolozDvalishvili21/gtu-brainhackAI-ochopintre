'use client'
import { MaterialRef } from '../../lib/store/room-store'
import { ExternalLink, X } from 'lucide-react'

// მაღაზიის badge
const STORE: Record<string, { label: string; cls: string }> = {
  nova: { label: 'Nova', cls: 'bg-emerald-100 text-emerald-700' },
  domino: { label: 'Domino', cls: 'bg-sky-100 text-sky-700' },
}

function storeInfo(source?: string) {
  return (source && STORE[source]) || { label: source ?? '—', cls: 'bg-gray-100 text-gray-600' }
}

// ბრენდი სახელიდან — პირველი ლათინური სიტყვა(ები)
function brandFromName(name?: string): string | null {
  if (!name) return null
  const m = name.match(/[A-Za-z][A-Za-z&.-]{1,}(?:\s[A-Z][A-Za-z&.-]+)?/)
  if (!m) return null
  return m[0].charAt(0).toUpperCase() + m[0].slice(1)
}

function priceLabel(m: MaterialRef): string | null {
  if (m.price == null) return null
  const unit = m.unit === 'm2' ? ' / მ²' : m.unit === 'piece' ? ' / ც' : ''
  return `${m.price.toFixed(2)} ₾${unit}`
}

// ─── გრიდის ბარათი (browse) ──────────────────────────────────────────────────
export function MaterialTile({
  m, active, disabled, onClick,
}: {
  m: MaterialRef
  active: boolean
  disabled: boolean
  onClick: () => void
}) {
  const price = priceLabel(m)
  const store = storeInfo(m.source)
  return (
    <button
      type="button"
      title={m.name}
      disabled={disabled}
      onClick={onClick}
      className={`group flex flex-col rounded-xl border overflow-hidden text-left transition-all
        ${active ? 'border-brand ring-1 ring-brand shadow-md' : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'}
        ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <div className="relative aspect-square bg-gray-50">
        <img src={m.image} alt={m.name} loading="lazy"
          className="w-full h-full object-cover" />
        {price && (
          <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded-md bg-black/70 text-white text-[10px] font-semibold backdrop-blur-sm">
            {price}
          </span>
        )}
        {active && (
          <span className="absolute inset-0 flex items-center justify-center bg-brand/30 text-white text-base font-bold">✓</span>
        )}
      </div>
      <div className="p-1.5">
        <p className="text-[11px] leading-tight text-gray-700 line-clamp-2 min-h-[28px]">{m.name}</p>
        <span className={`mt-1 inline-block px-1.5 py-0.5 rounded text-[9px] font-semibold ${store.cls}`}>
          {store.label}
        </span>
      </div>
    </button>
  )
}

// ─── დეტალური ინფო-პანელი (applied) ──────────────────────────────────────────
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-gray-400">{label}</span>
      <span className="text-gray-700 font-medium text-right truncate">{children}</span>
    </div>
  )
}

export function MaterialDetail({ m, onClear }: { m: MaterialRef; onClear?: () => void }) {
  const price = priceLabel(m)
  const store = storeInfo(m.source)
  const brand = brandFromName(m.name)
  return (
    <div className="bg-white border border-brand/20 rounded-xl overflow-hidden shadow-sm">
      <div className="flex gap-3 p-3">
        <img src={m.image} alt={m.name}
          className="w-16 h-16 rounded-lg object-cover border border-gray-200 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-gray-800 line-clamp-3 leading-snug">{m.name}</p>
          {price && <p className="text-sm font-bold text-brand mt-1">{price}</p>}
        </div>
        {onClear && (
          <button onClick={onClear} title="გასუფთავება"
            className="self-start text-gray-300 hover:text-red-400 transition-colors">
            <X size={15} />
          </button>
        )}
      </div>

      <div className="px-3 pb-3 space-y-1 text-[11px] border-t border-gray-50 pt-2">
        <Row label="მაღაზია">
          <span className={`px-1.5 py-0.5 rounded font-semibold ${store.cls}`}>{store.label}</span>
        </Row>
        {brand && <Row label="ბრენდი">{brand}</Row>}
        {m.dimensions && <Row label="ზომა">{m.dimensions} სმ</Row>}
        {price && <Row label="ფასი">{price}</Row>}
        {m.url && (
          <a href={m.url} target="_blank" rel="noopener noreferrer"
            className="flex items-center justify-center gap-1 mt-1.5 py-1.5 rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-600 text-[11px] font-medium transition-colors">
            პროდუქტის ნახვა <ExternalLink size={11} />
          </a>
        )}
      </div>
    </div>
  )
}
