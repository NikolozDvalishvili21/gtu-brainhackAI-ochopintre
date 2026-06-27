'use client'

import { useAssistantChat } from '@/hooks/useAssistantChat'
import ChatPanel from './ChatPanel'
import MoodboardPanel from './MoodboardPanel'
import { saveBrief, saveSession } from '@/lib/assistant/session'

export default function AssistantWorkspace() {
  const { messages, moodboard, input, loading, matchingMaterials, setInput, handleSend } =
    useAssistantChat()

  function handleGoToStudio() {
    if (moodboard) {
      saveSession({ messages, moodboard })
      saveBrief(moodboard)
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
      <ChatPanel
        messages={messages}
        input={input}
        loading={loading}
        onInputChange={setInput}
        onSend={handleSend}
      />
      <MoodboardPanel
        moodboard={moodboard}
        loading={loading && !moodboard}
        matchingMaterials={matchingMaterials}
        onGoToStudio={handleGoToStudio}
      />
    </div>
  )
}
