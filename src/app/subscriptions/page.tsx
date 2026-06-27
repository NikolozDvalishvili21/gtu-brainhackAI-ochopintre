import SubscriptionsHeader from '@/components/subscriptions/SubscriptionsHeader'
import PlanCards from '@/components/subscriptions/PlanCards'
import LandingFooter from '@/components/landing/LandingFooter'

export const metadata = {
  title: 'გეგმები | Interior AI Studio',
  description: 'აირჩიე უფასო ან Pro გეგმა Interior AI-სთვის',
}

export default function SubscriptionsPage() {
  return (
    <div className="min-h-dvh bg-surface text-gray-900">
      <SubscriptionsHeader />
      <section className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
          <p className="text-sm font-medium text-brand">გამოწერა</p>
          <h1 className="mt-2 font-display text-3xl text-gray-900 sm:text-4xl">
            აირჩიე შენი გეგმა
          </h1>
          <p className="mt-4 max-w-xl text-gray-600">
            დაიწყე უფასოდ ან გადადი Pro-ზე სრული ფუნქციონალისთვის.
          </p>
        </div>
      </section>
      <section className="py-12 sm:py-16">
        <PlanCards />
      </section>
      <LandingFooter />
    </div>
  )
}
