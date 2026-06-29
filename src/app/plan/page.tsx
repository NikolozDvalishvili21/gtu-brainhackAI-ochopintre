import dynamic from 'next/dynamic'

const PlanEditor2D = dynamic(() => import('@/components/studio/PlanEditor2D'), { ssr: false })

export default function PlanPage() {
  return <PlanEditor2D />
}
