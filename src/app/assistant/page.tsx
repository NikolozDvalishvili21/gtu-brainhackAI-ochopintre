import AssistantHeader from '@/components/assistant/AssistantHeader'
import AssistantWorkspace from '@/components/assistant/AssistantWorkspace'

export const metadata = {
  title: 'AI ასისტენტი | Interior AI Studio',
  description: 'აღწერე ოთახი და მიიღე AI moodboard',
}

export default function AssistantPage() {
  return (
    <div className="flex h-dvh flex-col bg-surface">
      <AssistantHeader />
      <AssistantWorkspace />
    </div>
  )
}
