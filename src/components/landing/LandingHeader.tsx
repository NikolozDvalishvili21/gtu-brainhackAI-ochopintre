import Link from 'next/link'
import Logo from '@/components/shared/Logo'

export default function LandingHeader() {
  return (
    <header className="border-b border-gray-200/80 bg-white">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Logo />
        <Link
          href="/studio"
          className="text-sm text-gray-600 transition-colors hover:text-brand"
        >
          სტუდიოში შესვლა
        </Link>
      </div>
    </header>
  )
}
