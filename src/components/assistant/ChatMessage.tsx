import type { ChatMessage as ChatMessageType } from '@/lib/assistant/types'

type ChatMessageProps = {
  message: ChatMessageType
}

export default function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user'

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] px-4 py-2.5 text-sm leading-relaxed ${
          isUser
            ? 'bg-brand text-white'
            : 'border border-gray-200 bg-white text-gray-800'
        }`}
      >
        {message.content}
      </div>
    </div>
  )
}
