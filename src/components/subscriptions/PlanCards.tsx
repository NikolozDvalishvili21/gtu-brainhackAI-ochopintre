import Link from 'next/link'
import { SUBSCRIPTION_PLANS } from '@/lib/constants/subscriptions'

export default function PlanCards() {
  return (
    <div className="mx-auto grid max-w-4xl gap-6 px-4 sm:grid-cols-2 sm:px-6">
      {SUBSCRIPTION_PLANS.map((plan) => (
        <article
          key={plan.id}
          className={`relative border bg-white p-6 sm:p-8 ${
            plan.highlighted ? 'border-brand' : 'border-gray-200'
          }`}
        >
          {plan.highlighted && (
            <span className="absolute -top-3 left-6 bg-brand px-2 py-0.5 text-xs font-medium text-white">
              რეკომენდებული
            </span>
          )}
          <h3 className="font-display text-xl text-gray-900">{plan.name}</h3>
          <p className="mt-2">
            <span className="text-3xl font-semibold text-gray-900">{plan.price}</span>
            <span className="ml-1 text-sm text-gray-500">/ {plan.period}</span>
          </p>
          <p className="mt-3 text-sm leading-relaxed text-gray-600">{plan.description}</p>
          <ul className="mt-6 space-y-2">
            {plan.features.map((feature) => (
              <li key={feature} className="flex items-start gap-2 text-sm text-gray-700">
                <span className="mt-0.5 text-brand">✓</span>
                {feature}
              </li>
            ))}
          </ul>
          <Link
            href={plan.ctaHref}
            className={`mt-8 inline-flex w-full items-center justify-center px-5 py-2.5 text-sm font-medium transition-colors ${
              plan.highlighted
                ? 'bg-brand text-white hover:bg-brand-dark'
                : 'border border-gray-300 bg-white text-gray-800 hover:border-gray-400 hover:bg-gray-50'
            }`}
          >
            {plan.cta}
          </Link>
        </article>
      ))}
    </div>
  )
}
