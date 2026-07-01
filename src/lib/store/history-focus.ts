// გაზიარებული „ფოკუსი" — ბოლო რომელი store შეიცვალა (unified Ctrl+Z-სთვის).
// plan-store (გეომეტრია) და room-store (ავეჯი) ცალკე history-ებია; ეს ეუბნება
// undo/redo-ს რომელი უნდა დააბრუნოს პირველ რიგში.
export const historyFocus: { store: 'plan' | 'furn' } = { store: 'plan' }
