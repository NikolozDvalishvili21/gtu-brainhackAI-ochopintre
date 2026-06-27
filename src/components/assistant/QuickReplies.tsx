'use client'

type QuickRepliesProps = {
  replies: string[]
  onSelect: (reply: string) => void
  disabled?: boolean
}

export default function QuickReplies({ replies, onSelect, disabled }: QuickRepliesProps) {
  if (replies.length === 0) return null

  return (
    <div className="flex flex-wrap gap-2 px-3 pb-2">
      {replies.map((reply) => (
        <button
          key={reply}
          type="button"
          onClick={() => onSelect(reply)}
          disabled={disabled}
          className="border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-700 transition-colors hover:border-brand hover:text-brand disabled:opacity-50"
        >
          {reply}
        </button>
      ))}
    </div>
  )
}
