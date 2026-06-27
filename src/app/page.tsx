'use client'
import dynamic from 'next/dynamic'
import Navbar from './components/Navbar'
import Sidebar from './components/Sidebar'
import Editor2D from './components/Editor2D'
import { useRoomStore } from './store'

const Scene3D = dynamic(() => import('./components/Scene3D'), { ssr: false })

export default function Home() {
  const { viewMode } = useRoomStore()

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <Navbar />
      <div className="flex flex-1 overflow-hidden">
        <main className="flex-1 overflow-hidden bg-surface">
          {viewMode === '2d' ? <Editor2D /> : <Scene3D />}
        </main>
        <Sidebar />
      </div>
    </div>
  )
}
