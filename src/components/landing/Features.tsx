import Link from 'next/link'
import { LANDING_STEPS } from '@/lib/constants/landing'

export default function Features() {
  return (
    <section className="bg-white">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
        <div className="max-w-xl">
          <h2 className="font-display text-2xl text-gray-900 sm:text-3xl">რას აკეთებს ეს საიტი</h2>
          <p className="mt-3 leading-relaxed text-gray-600">
            სამი ნაბიჯი - ზომებიდან მზა ხედამდე. ყველაფერი ბრაუზერში მუშაობს, ჩამოტვირთვის გარეშე.
          </p>
        </div>

        <ol className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
          {LANDING_STEPS.map((step) => (
            <li key={step.num} className="border-t border-gray-200 pt-6">
              <span className="text-xs font-medium tracking-wider text-brand">{step.num}</span>
              <h3 className="mt-2 text-lg font-medium text-gray-900">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-gray-600">{step.text}</p>
            </li>
          ))}
        </ol>

        <div className="mt-12 border border-gray-200 bg-surface px-5 py-6 sm:flex sm:items-center sm:justify-between sm:px-6">
          <p className="text-sm text-gray-700">
            მზად ხარ დაგეგმვისთვის? სტუდიოში ჯერ ზომებს დააყენებ, შემდეგ 3D-ში გადახვალ.
          </p>
          <Link
            href="/studio"
            className="mt-4 inline-flex shrink-0 items-center justify-center bg-brand px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-dark sm:mt-0"
          >
            დაწყება
          </Link>
        </div>
      </div>
    </section>
  )
}
