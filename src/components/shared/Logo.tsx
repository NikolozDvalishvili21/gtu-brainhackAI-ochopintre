import Link from 'next/link'
import { Box } from 'lucide-react'

type LogoProps = {
  href?: string
  className?: string
}

export default function Logo({ href = '/', className = '' }: LogoProps) {
  const inner = (
    <>
      <div className="flex h-7 w-7 items-center justify-center rounded-md bg-brand">
        <Box size={14} className="text-white" />
      </div>
      <span className="text-sm font-semibold">Interior AI</span>
    </>
  )

  if (href) {
    return (
      <Link href={href} className={`flex items-center gap-2 ${className}`}>
        {inner}
      </Link>
    )
  }

  return <div className={`flex items-center gap-2 ${className}`}>{inner}</div>
}
