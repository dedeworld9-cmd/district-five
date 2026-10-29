import Link from 'next/link';
import { SITE } from '@/lib/site';
import { Arrow } from './icons';

// In-game photos supplied by HCSO. Each has an 800px and a large WebP.
export function Photo({ name, alt, w, h, sizes, className = '', style, priority }: { name: string; alt: string; w: number; h: number; sizes: string; className?: string; style?: React.CSSProperties; priority?: boolean }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={`/photos/${name}-lg.webp`} srcSet={`/photos/${name}-800.webp 800w, /photos/${name}-lg.webp ${w}w`} sizes={sizes}
      alt={alt} width={w} height={h} loading={priority ? 'eager' : 'lazy'} fetchPriority={priority ? 'high' : undefined} className={className} style={style} />
  );
}

// Closing call to action over the night photo, shared by the public pages.
export function JoinBanner({ href }: { href: string }) {
  return (
    <section aria-labelledby="cta" className="container-page pb-16 sm:pb-24">
      <div className="relative overflow-hidden rounded-3xl border border-brand/30">
        <Photo name="night-stop" w={1600} h={725} sizes="100vw" alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-[linear-gradient(100deg,rgb(9_32_21/0.97)_0%,rgb(9_32_21/0.9)_45%,rgb(9_32_21/0.55)_100%)]" aria-hidden="true" />
        <div className="relative flex flex-col items-start gap-6 px-5 py-10 sm:px-12 sm:py-16 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={SITE.logo} alt="" width={80} height={80} className="hidden h-20 w-20 shrink-0 sm:block" />
            <div>
              <h2 id="cta" className="h2 text-[clamp(1.6rem,1.3rem+1.3vw,2.25rem)]">Join the {SITE.name}</h2>
              <p className="mt-2 max-w-lg text-[15px] text-[#cfe3d6]">Deputy in Training is the first rank. Send a roster request and command will review it.</p>
            </div>
          </div>
          <Link href={href} className="btn btn-brand btn-lg h-12 w-full shrink-0 px-7 text-[15px] md:w-auto">Request to join <Arrow /></Link>
        </div>
      </div>
    </section>
  );
}

// Page header with a photo behind it, for the inner public pages.
export function PhotoIntro({ title, photo, alt, w = 1600, h, position = 'center', children }: { title: string; photo: string; alt: string; w?: number; h: number; position?: string; children?: React.ReactNode }) {
  return (
    <section className="relative -mt-[68px] overflow-hidden sm:-mt-[72px]">
      <Photo name={photo} w={w} h={h} priority sizes="100vw" alt={alt} className="absolute inset-0 h-full w-full object-cover" style={{ objectPosition: position }} />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgb(7_9_14/0.95)_0%,rgb(7_9_14/0.8)_45%,rgb(7_9_14/0.35)_100%)] max-md:bg-[linear-gradient(180deg,rgb(7_9_14/0.45)_0%,rgb(7_9_14/0.9)_70%)]" aria-hidden="true" />
      <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-bg to-transparent" aria-hidden="true" />
      <div className="container-page relative pt-32 pb-14 sm:pt-44 sm:pb-28">
        <h1 className="max-w-3xl text-[clamp(2.4rem,1.6rem+3.6vw,4.25rem)] leading-[1.03] font-bold tracking-[-0.03em]">{title}</h1>
        {children && <div className="mt-5 max-w-2xl text-[17px] leading-relaxed text-[#dfe4ec]">{children}</div>}
      </div>
    </section>
  );
}
