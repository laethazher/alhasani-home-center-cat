import { motion, useReducedMotion } from 'framer-motion';
import { Building2, LogOut, Moon, Shield, Sun, Truck, Wrench } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { HomeCenterShowcase, CityMarquee } from '../components/landing/HomeCenterShowcase';
import { cn } from '../lib/utils';

interface SystemHomeProps {
  profileName: string;
  isDarkMode: boolean;
  isGateGuard?: boolean;
  onToggleDark: () => void;
  onSelectTajhiz: () => void;
  onSelectInstallation: () => void;
  onSelectGate?: () => void;
  onSignOut: () => void;
  signingOut?: boolean;
}

const TILE_BG = {
  tajhiz:
    'https://images.unsplash.com/photo-1519003722824-cd8abd566faa?w=1000&q=80&auto=format&fit=crop',
  installation:
    'https://images.unsplash.com/photo-1504917595217-d4dc5ebe6122?w=1000&q=80&auto=format&fit=crop',
  gate:
    'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1000&q=80&auto=format&fit=crop',
} as const;

function DepartmentTile({
  title,
  description,
  accentClass,
  icon: Icon,
  imageUrl,
  onClick,
  reduceMotion,
}: {
  title: string;
  description: string;
  accentClass: string;
  icon: typeof Truck;
  imageUrl: string;
  onClick: () => void;
  reduceMotion: boolean | null;
}) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: reduceMotion ? 0 : 20 },
        show: { opacity: 1, y: 0 },
      }}
      whileHover={reduceMotion ? undefined : { y: -6 }}
      whileTap={reduceMotion ? undefined : { scale: 0.992 }}
      transition={{ type: 'spring', stiffness: 320, damping: 26 }}
    >
      <Card
        className={cn(
          'overflow-hidden border-0 shadow-xl bg-[hsl(var(--card))]/80 backdrop-blur-xl cursor-pointer group h-full',
          'ring-1 ring-black/5 dark:ring-white/10',
        )}
        onClick={onClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onClick();
          }
        }}
      >
        <div className="relative h-44 sm:h-48 overflow-hidden">
          <div
            className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-105"
            style={{ backgroundImage: `url(${imageUrl})` }}
          />
          <div
            className={cn(
              'absolute inset-0 opacity-90 mix-blend-multiply dark:mix-blend-soft-light',
              accentClass,
            )}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent" />
          <div className="absolute bottom-4 right-5 left-5 flex items-end justify-between gap-3">
            <div>
              <p className="text-[10px] font-black tracking-[0.28em] uppercase text-white/70 mb-1">
                Department
              </p>
              <CardTitle className="text-xl sm:text-2xl text-white font-black border-0 p-0 shadow-none">
                {title}
              </CardTitle>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur-md border border-white/25 flex items-center justify-center flex-shrink-0">
              <Icon className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>
        <CardHeader className="pb-2 pt-4">
          <CardDescription className="text-sm leading-relaxed text-muted-foreground">
            {description}
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0 pb-5">
          <div
            className={cn(
              'w-full flex items-center justify-center py-2.5 rounded-xl text-sm font-black',
              'bg-secondary text-secondary-foreground border border-border/60',
            )}
          >
            متابعة الدخول
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default function SystemHome({
  profileName,
  isDarkMode,
  isGateGuard = false,
  onToggleDark,
  onSelectTajhiz,
  onSelectInstallation,
  onSelectGate,
  onSignOut,
  signingOut = false,
}: SystemHomeProps) {
  const reduceMotion = useReducedMotion();

  const listVariants = {
    hidden: {},
    show: {
      transition: { staggerChildren: reduceMotion ? 0 : 0.11, delayChildren: reduceMotion ? 0 : 0.06 },
    },
  };

  return (
    <div
      className="min-h-screen min-h-[100dvh] flex flex-col bg-[radial-gradient(1200px_700px_at_15%_20%,rgba(59,130,246,0.12),transparent_55%),radial-gradient(1000px_600px_at_85%_35%,rgba(16,185,129,0.12),transparent_55%)]"
      dir="rtl"
    >
      <div className="relative h-[100dvh] min-h-[100dvh] w-full shrink-0 overflow-hidden">
        <HomeCenterShowcase variant="home-hero" dark={isDarkMode} className="h-full w-full" />
      </div>

      <div className="flex-1 w-full p-5 md:p-8 pb-10">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="space-y-2 text-center sm:text-right">
            <p className="text-xs font-black tracking-[0.35em] text-muted-foreground uppercase">
              أهلاً بك
            </p>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight">الواجهة الرئيسية للنظام</h1>
            <p className="text-sm font-semibold text-muted-foreground">{profileName}</p>
          </div>

          <div className="flex items-center justify-center sm:justify-end gap-2 flex-wrap">
            <Button
              variant="outline"
              size="icon"
              onClick={onToggleDark}
              aria-label="تبديل الوضع الليلي"
              className="bg-[hsl(var(--card))]/70 backdrop-blur-2xl"
            >
              {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </Button>

            <Button variant="destructive" onClick={onSignOut} disabled={signingOut} className="font-black">
              <LogOut className="w-4 h-4" />
              تسجيل الخروج
            </Button>
          </div>
        </div>

        <div className="text-center py-1 space-y-1">
          <p className="text-[10px] md:text-xs font-black tracking-[0.45em] text-muted-foreground">
            اختر القسم
          </p>
          <h2 className="text-base md:text-lg font-black tracking-[0.22em] text-foreground/90">
            مسارات التشغيل
          </h2>
        </div>

        <motion.div
          className={cn(
            'grid gap-5',
            isGateGuard ? 'grid-cols-1 max-w-xl mx-auto' : 'grid-cols-1 lg:grid-cols-2',
          )}
          variants={listVariants}
          initial="hidden"
          animate="show"
        >
          {isGateGuard ? (
            <DepartmentTile
              title="بوابة الحارس الموحدة"
              description="واجهة واحدة تشمل طلبات قسم التجهيز وقسم التركيب مع تمييز واضح لمصدر كل طلب."
              accentClass="bg-gradient-to-br from-pink-600 via-rose-700 to-purple-900"
              icon={Shield}
              imageUrl={TILE_BG.gate}
              onClick={() => onSelectGate?.()}
              reduceMotion={reduceMotion}
            />
          ) : (
            <>
              <DepartmentTile
                title="قسم التجهيز"
                description="النظام الكامل للتجهيز: لوحة التحكم، المركبات، الصيانة، الحضور، التقارير، والمزيد."
                accentClass="bg-gradient-to-br from-blue-600 via-blue-700 to-slate-900"
                icon={Truck}
                imageUrl={TILE_BG.tajhiz}
                onClick={onSelectTajhiz}
                reduceMotion={reduceMotion}
              />
              <DepartmentTile
                title="قسم التركيب"
                description="واجهة التركيب مع بيانات مفصولة وجاهزة للتوسعة، بنفس معايير التشغيل والصيانة."
                accentClass="bg-gradient-to-br from-emerald-600 via-teal-700 to-slate-900"
                icon={Wrench}
                imageUrl={TILE_BG.installation}
                onClick={onSelectInstallation}
                reduceMotion={reduceMotion}
              />
            </>
          )}
        </motion.div>

        <motion.div
          initial={reduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: reduceMotion ? 0 : 0.35 }}
          className="flex items-center justify-center gap-2 text-xs text-muted-foreground pt-4"
        >
          <Building2 className="w-3.5 h-3.5" />
          <span>Alhasani Home Center Logistics · واجهة اختيار الأقسام</span>
        </motion.div>
      </div>
      </div>
      <CityMarquee dark={isDarkMode} />
    </div>
  );
}
