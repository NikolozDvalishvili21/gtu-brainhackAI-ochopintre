import LandingHeader from '@/components/landing/LandingHeader'
import Hero from '@/components/landing/Hero'
import Features from '@/components/landing/Features'
import LandingFooter from '@/components/landing/LandingFooter'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-surface text-gray-900">
      <LandingHeader />
      <Hero />
      <Features />
      <LandingFooter />
    </div>
  )
}
