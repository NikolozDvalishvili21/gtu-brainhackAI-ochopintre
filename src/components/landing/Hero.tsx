import Image from 'next/image'
import Link from 'next/link'

export default function Hero() {
  return (
    <section className="border-b border-gray-200/60">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-2 lg:items-center lg:gap-14 lg:py-20">
        <div className="order-2 lg:order-1">
          <p className="mb-3 text-sm font-medium text-brand">ოთახის დაგეგმვა</p>
          <h1 className="font-display text-3xl leading-tight text-gray-900 sm:text-4xl lg:text-[2.65rem] lg:leading-[1.15]">
            შენი ოთახი - ჯერ გეგმაზე, შემდეგ 3D-ში
          </h1>
          <p className="mt-5 max-w-md text-base leading-relaxed text-gray-600">
            Interior AI გეხმარება ოთახის ზომების შეყვანაში, სამგანზომილებრივ ხედში ნახვასა და
            ინტერიერის მარტივ გაფორმებაში. არაფერი რთული - ზომა, გადასვლა, გაფორმება.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              href="/studio"
              className="inline-flex items-center justify-center bg-brand px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-dark"
            >
              2D დაგეგმვა
            </Link>
            <Link
              href="/studio"
              className="inline-flex items-center justify-center border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-800 transition-colors hover:border-gray-400 hover:bg-gray-50"
            >
              სტუდიოში ნახვა
            </Link>
            <Link
              href="/assistant"
              className="inline-flex items-center justify-center border border-brand bg-white px-5 py-2.5 text-sm font-medium text-brand transition-colors hover:bg-brand/5"
            >
              AI ასისტენტი
            </Link>
          </div>
        </div>

        <div className="order-1 lg:order-2">
          <div className="relative aspect-[4/3] w-full overflow-hidden border border-gray-200 bg-white sm:aspect-[5/4]">
            <Image
              src="/Hero.webp"
              alt="ინტერიერის დაგეგმვის ინტერფეისი"
              fill
              priority
              className="object-cover object-center"
              sizes="(max-width: 1024px) 100vw, 50vw"
            />
          </div>
        </div>
      </div>
    </section>
  )
}
