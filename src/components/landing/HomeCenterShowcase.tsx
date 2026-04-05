import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../../lib/utils';

/** امتدادات مدعومة — أسماء الملفات للمسار فقط (مثلاً صورة هوم سنتر 1.jpg في `public/`) */
const HOME_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.webp', '.png'] as const;

/** شريحة: مسار الملف + العناوين المعروضة (ليست أسماء الملفات) */
const HOME_SLIDES = [
  {
    fileBase: 'صورة هوم سنتر 1',
    title: 'تجربة منزلية متكاملة',
    subtitle: 'لوجستيات وتشغيل بمعايير احترافية',
  },
  {
    fileBase: 'صورة هوم سنتر 2',
    title: 'جودة التشغيل',
    subtitle: 'منصة موحّدة لمركباتك ومعداتك',
  },
  {
    fileBase: 'صورة هوم سنتر 3',
    title: 'تنسيق الأقسام',
    subtitle: 'تجهيز · تركيب · بوابة — من مكان واحد',
  },
  {
    fileBase: 'صورة هوم سنتر 4',
    title: 'Complete Home Experience',
    subtitle: 'Alhasani Home Center Logistics',
  },
  {
    fileBase: 'صورة هوم سنتر 5',
    title: 'ثقة وتشغيل يومي',
    subtitle: 'إدارة المركبات والمعدات بثبات ووضوح',
  },
] as const;

function buildPublicSrc(base: string, ext: (typeof HOME_IMAGE_EXTENSIONS)[number]): string {
  return encodeURI(`/${base}${ext}`);
}

const MARQUEE_AR =
  'بغداد · كربلاء · النجف · الأنبار · أربيل · الكوت · الحلة · الأعظمية · بغداد · كربلاء · النجف · الأنبار · أربيل · الكوت · الحلة · الأعظمية';
const MARQUEE_EN =
  'Baghdad · Karbala · Najaf · Anbar · Erbil · Kut · Hillah · Adhamiyah · Baghdad · Karbala · Najaf · Anbar · Erbil · Kut · Hillah · Adhamiyah';

/**
 * شريحة الهيرو: طبقة خلفية من نفس الصورة (cover + blur) تملأ الإطار،
 * وطبقة أمامية حادة object-contain تعرض الصورة كاملة — بدون إطار أسود قاسٍ.
 * المعاينات المصغّرة تبقى object-contain داخل أزرارها.
 */
function ContainSlideImage({
  fileBase,
  dark,
}: {
  fileBase: string;
  dark: boolean;
}) {
  const [extIndex, setExtIndex] = useState(0);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    setExtIndex(0);
    setLoadFailed(false);
  }, [fileBase]);

  const src = buildPublicSrc(fileBase, HOME_IMAGE_EXTENSIONS[extIndex]);

  const handleError = () => {
    if (extIndex < HOME_IMAGE_EXTENSIONS.length - 1) {
      setExtIndex((i) => i + 1);
    } else {
      setLoadFailed(true);
    }
  };

  return (
    <div
      className={cn(
        'absolute inset-0 overflow-hidden',
        dark
          ? 'bg-gradient-to-b from-slate-900 via-stone-900 to-slate-950'
          : 'bg-gradient-to-b from-slate-200 via-stone-100 to-slate-200',
      )}
    >
      {!loadFailed ? (
        <>
          <img
            key={`slide-bg-${fileBase}-${extIndex}`}
            src={src}
            alt=""
            aria-hidden
            decoding="async"
            draggable={false}
            className={cn(
              'pointer-events-none absolute inset-0 h-full w-full object-cover object-center select-none',
              'scale-[1.14] blur-2xl opacity-[0.88] saturate-[1.08] dark:opacity-[0.82]',
              'motion-reduce:hidden',
            )}
          />
          <div className="absolute inset-0 z-[1] flex items-center justify-center p-2 sm:p-3 md:p-5">
            <img
              key={`slide-fg-${fileBase}-${extIndex}`}
              src={src}
              alt=""
              decoding="async"
              draggable={false}
              onError={handleError}
              className="max-h-full max-w-full object-contain object-center select-none drop-shadow-md"
            />
          </div>
        </>
      ) : (
        <div
          className="absolute inset-0"
          style={{
            background: dark
              ? 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 45%, #0c4a6e 100%)'
              : 'linear-gradient(135deg, #e0e7ff 0%, #dbeafe 50%, #ccfbf1 100%)',
          }}
        />
      )}
    </div>
  );
}

function SlideCaptionPanel({
  dark,
  title,
  subtitle,
  bottomClass,
}: {
  dark: boolean;
  title: string;
  subtitle: string;
  bottomClass: string;
}) {
  return (
    <div
      className={cn(
        'absolute right-4 sm:right-5 z-20 max-w-[min(92vw,320px)] rounded-2xl px-4 py-3 shadow-lg',
        bottomClass,
        'border backdrop-blur-md pointer-events-none text-right',
        dark
          ? 'border-white/20 bg-black/50 text-white'
          : 'border-stone-900/15 bg-white/60 text-stone-900',
      )}
      dir="rtl"
    >
      <p
        className={cn(
          'text-[10px] font-black tracking-[0.28em] mb-1.5 uppercase',
          dark ? 'text-white/70' : 'text-stone-600',
        )}
      >
        Alhasani Home Center
      </p>
      <h2
        className={cn(
          'text-base sm:text-lg md:text-xl font-black leading-snug',
          dark ? 'text-white drop-shadow-md' : 'text-stone-900',
        )}
      >
        {title}
      </h2>
      <p className={cn('mt-1.5 text-xs sm:text-sm font-semibold leading-relaxed', dark ? 'text-white/85' : 'text-stone-700')}>
        {subtitle}
      </p>
    </div>
  );
}

const AUTO_MS = 4200;

/** أقصر اتجاه على الدائرة (للمعاينات والنقاط) — يحدد اتجاه الحركة البصرية */
function carouselDirection(from: number, to: number, len: number): number {
  if (len <= 1 || from === to) return 1;
  const forward = (to - from + len) % len;
  return forward <= len / 2 ? 1 : -1;
}

function PremiumCarousel({
  dark,
  className,
  reserveFooterSpace,
}: {
  dark: boolean;
  className?: string;
  reserveFooterSpace?: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const indexRef = useRef(0);
  const slideCount = HOME_SLIDES.length;

  indexRef.current = index;

  const goPrev = useCallback(() => {
    setDirection(-1);
    setIndex((i) => (i - 1 + slideCount) % slideCount);
  }, [slideCount]);

  const goNext = useCallback(() => {
    setDirection(1);
    setIndex((i) => (i + 1) % slideCount);
  }, [slideCount]);

  const goToIndex = useCallback(
    (target: number) => {
      const current = indexRef.current;
      if (target === current) return;
      setDirection(carouselDirection(current, target, slideCount));
      setIndex(target);
    },
    [slideCount],
  );

  useEffect(() => {
    if (reduceMotion) return;
    const t = window.setInterval(() => {
      setDirection(1);
      setIndex((i) => (i + 1) % slideCount);
    }, AUTO_MS);
    return () => window.clearInterval(t);
  }, [reduceMotion, slideCount]);

  const slideVariants = useMemo(
    () => ({
      enter: (dir: number) =>
        reduceMotion
          ? { opacity: 0 }
          : {
              x: dir >= 0 ? '2.75%' : '-2.75%',
              opacity: 0,
              scale: 1.02,
            },
      center: {
        x: 0,
        opacity: 1,
        scale: 1,
      },
      exit: (dir: number) =>
        reduceMotion
          ? { opacity: 0 }
          : {
              x: dir >= 0 ? '-2.25%' : '2.25%',
              opacity: 0,
              scale: 0.988,
            },
    }),
    [reduceMotion],
  );

  const slideTransition = useMemo(
    () =>
      reduceMotion
        ? { duration: 0 }
        : {
            duration: 0.52,
            ease: [0.32, 0.72, 0, 1] as const,
          },
    [reduceMotion],
  );

  const slide = HOME_SLIDES[index];
  const fileKey = slide.fileBase;

  const captionBottom = reserveFooterSpace ? 'bottom-44 md:bottom-48' : 'bottom-36 sm:bottom-40';
  const dotsBottom = reserveFooterSpace ? 'bottom-24 md:bottom-28' : 'bottom-14 sm:bottom-16';
  const thumbsBottom = reserveFooterSpace ? 'bottom-32 md:bottom-36' : 'bottom-24 sm:bottom-28';

  return (
    <div
      className={cn(
        'relative h-full w-full min-h-full overflow-hidden',
        dark
          ? 'bg-gradient-to-b from-slate-900 via-stone-900 to-slate-950'
          : 'bg-gradient-to-b from-slate-200 via-stone-100 to-slate-200',
        className,
      )}
    >
      <AnimatePresence initial={false} custom={direction} mode="sync">
        <motion.div
          key={fileKey}
          custom={direction}
          variants={slideVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={slideTransition}
          className="absolute inset-0 will-change-[transform,opacity]"
        >
          <ContainSlideImage fileBase={slide.fileBase} dark={dark} />
        </motion.div>
      </AnimatePresence>

      {/* تظليل خفيف جداً في الأسفل فقط لقراءة النصوص */}
      <div
        className="absolute inset-x-0 bottom-0 h-[45%] z-[1] pointer-events-none bg-gradient-to-t from-black/55 via-black/15 to-transparent"
        aria-hidden
      />

      <SlideCaptionPanel
        dark={dark}
        title={slide.title}
        subtitle={slide.subtitle}
        bottomClass={captionBottom}
      />

      {/* أسهم — يسار الشاشة = السابق، يمين الشاشة = التالي */}
      <button
        type="button"
        onClick={goPrev}
        aria-label="الشريحة السابقة"
        className="pointer-events-auto absolute left-2 sm:left-4 top-1/2 z-30 flex h-11 w-11 sm:h-12 sm:w-12 -translate-y-1/2 items-center justify-center rounded-full border border-white/25 bg-black/45 text-white shadow-lg backdrop-blur-sm transition hover:bg-black/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
      >
        <ChevronLeft className="h-6 w-6" aria-hidden />
      </button>
      <button
        type="button"
        onClick={goNext}
        aria-label="الشريحة التالية"
        className="pointer-events-auto absolute right-2 sm:right-4 top-1/2 z-30 flex h-11 w-11 sm:h-12 sm:w-12 -translate-y-1/2 items-center justify-center rounded-full border border-white/25 bg-black/45 text-white shadow-lg backdrop-blur-sm transition hover:bg-black/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
      >
        <ChevronRight className="h-6 w-6" aria-hidden />
      </button>

      {/* معاينات — كل الصور ظاهرة */}
      <div
        className={cn(
          'absolute inset-x-0 z-[22] flex justify-center px-3 pointer-events-auto',
          thumbsBottom,
        )}
      >
        <div className="flex max-w-full gap-2 overflow-x-auto pb-1 [scrollbar-width:thin]">
          {HOME_SLIDES.map((s, i) => (
            <ThumbnailButton
              key={s.fileBase}
              fileBase={s.fileBase}
              active={i === index}
              onSelect={() => goToIndex(i)}
            />
          ))}
        </div>
      </div>

      <div
        className={cn(
          'absolute left-1/2 z-20 flex -translate-x-1/2 gap-2 pointer-events-auto',
          dotsBottom,
        )}
      >
        {HOME_SLIDES.map((_, i) => (
          <button
            key={i}
            type="button"
            aria-label={`شريحة ${i + 1}`}
            onClick={() => goToIndex(i)}
            className={cn(
              'h-1.5 rounded-full transition-all duration-300 ease-out',
              i === index
                ? 'w-9 bg-white shadow-[0_0_12px_rgba(255,255,255,0.4)]'
                : 'w-2.5 bg-white/45 hover:bg-white/70',
            )}
          />
        ))}
      </div>
    </div>
  );
}

function ThumbnailButton({
  fileBase,
  active,
  onSelect,
}: {
  fileBase: string;
  active: boolean;
  onSelect: () => void;
}) {
  const [extIndex, setExtIndex] = useState(0);
  const [broken, setBroken] = useState(false);
  const src = buildPublicSrc(fileBase, HOME_IMAGE_EXTENSIONS[extIndex]);

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={active ? 'true' : undefined}
      className={cn(
        'relative h-14 w-[4.5rem] sm:h-16 sm:w-24 flex-shrink-0 overflow-hidden rounded-lg border-2 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70',
        active ? 'border-white shadow-md ring-2 ring-white/30' : 'border-white/20 opacity-80 hover:opacity-100 hover:border-white/45',
      )}
    >
      {!broken ? (
        <img
          src={src}
          alt=""
          className="h-full w-full object-contain bg-stone-900"
          onError={() => {
            if (extIndex < HOME_IMAGE_EXTENSIONS.length - 1) setExtIndex((x) => x + 1);
            else setBroken(true);
          }}
        />
      ) : (
        <div className="h-full w-full bg-stone-800" />
      )}
    </button>
  );
}

export function CityMarquee({ dark, className }: { dark: boolean; className?: string }) {
  const reduceMotion = useReducedMotion();
  return (
    <div
      className={cn(
        'w-full overflow-hidden border-t border-b shrink-0',
        dark ? 'border-white/[0.07] bg-black/35 backdrop-blur-md' : 'border-stone-200/90 bg-stone-100/85 backdrop-blur-md',
        className,
      )}
      dir="ltr"
    >
      <div className="py-3 md:py-3.5 space-y-2">
        <motion.div
          className="flex gap-12 md:gap-16 whitespace-nowrap text-xs md:text-sm font-bold tracking-wide"
          style={{ color: dark ? 'rgba(248,250,252,0.82)' : 'rgba(51,65,85,0.95)' }}
          animate={reduceMotion ? undefined : { x: ['0%', '-50%'] }}
          transition={reduceMotion ? undefined : { duration: 72, repeat: Infinity, ease: 'linear' }}
        >
          <span>{MARQUEE_AR}</span>
          <span aria-hidden>{MARQUEE_AR}</span>
        </motion.div>
        <motion.div
          className="flex gap-12 md:gap-16 whitespace-nowrap text-[10px] md:text-xs font-semibold tracking-[0.2em] uppercase"
          style={{ color: dark ? 'rgba(148,163,184,0.72)' : 'rgba(100,116,139,0.88)' }}
          animate={reduceMotion ? undefined : { x: ['-50%', '0%'] }}
          transition={reduceMotion ? undefined : { duration: 88, repeat: Infinity, ease: 'linear' }}
        >
          <span>{MARQUEE_EN}</span>
          <span aria-hidden>{MARQUEE_EN}</span>
        </motion.div>
      </div>
    </div>
  );
}

export type ShowcaseVariant = 'login-bg' | 'home-hero';

export function HomeCenterShowcase({
  dark,
  variant,
  className,
}: {
  dark: boolean;
  /** يُبقى للتمييز بين السياقات؛ حركة التبديل بين الشرائح موحّدة مع تسجيل الدخول والواجهة الرئيسية */
  variant: ShowcaseVariant;
  className?: string;
}) {
  return (
    <div
      className={cn('relative h-full w-full overflow-hidden', className)}
      data-showcase-variant={variant}
    >
      <PremiumCarousel dark={dark} reserveFooterSpace />
    </div>
  );
}

export { PremiumCarousel, HOME_SLIDES };
