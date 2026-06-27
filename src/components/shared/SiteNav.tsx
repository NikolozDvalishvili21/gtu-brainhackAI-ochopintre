import Link from 'next/link'

type SiteNavProps = {
  active?: 'assistant' | 'subscriptions' | 'studio'
}

const links = [
  { href: '/', label: 'მთავარი', key: 'home' as const, mobileHidden: true },
  { href: '/assistant', label: 'AI ასისტენტი', key: 'assistant' as const },
  { href: '/subscriptions', label: 'გეგმები', key: 'subscriptions' as const },
  { href: '/studio', label: 'სტუდიო', key: 'studio' as const },
]

export default function SiteNav({ active }: SiteNavProps) {
  return (
    <nav className="flex items-center gap-4 sm:gap-6">
      {links.map((link) => {
        const isActive = active === link.key
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={isActive ? 'page' : undefined}
            className={`text-sm transition-colors ${
              link.mobileHidden ? 'hidden sm:inline' : ''
            } ${
              isActive
                ? 'font-medium text-brand'
                : 'text-gray-600 hover:text-brand'
            }`}
          >
            {link.label}
          </Link>
        )
      })}
    </nav>
  )
}
