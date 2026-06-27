import Logo from '@/components/shared/Logo'
import SiteNav from '@/components/shared/SiteNav'

export default function SubscriptionsHeader() {
  return (
    <header className="shrink-0 border-b border-gray-200/80 bg-white">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Logo />
        <SiteNav active="subscriptions" />
      </div>
    </header>
  )
}
