import { motion } from 'framer-motion';
import { Building2, LogOut, Moon, Shield, Sun, Truck, Wrench } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';

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
  return (
    <div
      className="min-h-screen p-5 md:p-8 bg-[radial-gradient(1200px_700px_at_15%_20%,rgba(59,130,246,0.14),transparent_55%),radial-gradient(1000px_600px_at_85%_35%,rgba(16,185,129,0.16),transparent_55%)]"
      dir="rtl"
    >
      <div className="max-w-6xl mx-auto">
        <div className="flex items-start justify-between gap-3 mb-8">
          <div className="space-y-2">
            <p className="text-sm font-bold text-muted-foreground">أهلاً بك</p>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight">
              الواجهة الرئيسية للسستم
            </h1>
            <p className="text-sm text-muted-foreground">{profileName}</p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={onToggleDark}
              aria-label="تبديل الوضع الليلي"
              className="bg-[hsl(var(--card))]/70 backdrop-blur-2xl"
            >
              {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </Button>

            <Button
              variant="destructive"
              onClick={onSignOut}
              disabled={signingOut}
              className="font-black"
            >
              <LogOut className="w-4 h-4" />
              تسجيل الخروج
            </Button>
          </div>
        </div>

        <div className={`grid grid-cols-1 ${isGateGuard ? 'lg:grid-cols-1' : 'lg:grid-cols-2'} gap-5`}>
          {isGateGuard ? (
            <motion.div whileHover={{ y: -4 }} whileTap={{ scale: 0.99 }}>
              <Card className="overflow-hidden bg-[hsl(var(--card))]/70 backdrop-blur-2xl">
                <div className="h-1.5 bg-pink-500" />
                <CardHeader>
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-pink-600/10 border border-pink-500/20">
                    <Shield className="w-6 h-6 text-pink-500" />
                  </div>
                  <CardTitle>بوابة الحارس الموحدة</CardTitle>
                  <CardDescription className="leading-7">
                    واجهة واحدة فقط تشمل طلبات قسم التجهيز وقسم التركيب مع تمييز واضح لمصدر كل طلب.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button onClick={onSelectGate} className="w-full font-black">
                    دخول بوابة الحارس
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          ) : (
            <>
              <motion.div whileHover={{ y: -4 }} whileTap={{ scale: 0.99 }}>
                <Card className="overflow-hidden bg-[hsl(var(--card))]/70 backdrop-blur-2xl">
                  <div className="h-1.5 bg-blue-500" />
                  <CardHeader>
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-blue-600/10 border border-blue-500/20">
                      <Truck className="w-6 h-6 text-blue-500" />
                    </div>
                    <CardTitle>قسم التجهيز</CardTitle>
                    <CardDescription className="leading-7">
                      النظام الحالي الكامل كما هو، بكل المحتويات والواجهات والخصائص الموجودة حالياً.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button onClick={onSelectTajhiz} className="w-full font-black">
                      دخول قسم التجهيز
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div whileHover={{ y: -4 }} whileTap={{ scale: 0.99 }}>
                <Card className="overflow-hidden bg-[hsl(var(--card))]/70 backdrop-blur-2xl">
                  <div className="h-1.5 bg-emerald-500" />
                  <CardHeader>
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-emerald-600/10 border border-emerald-500/20">
                      <Wrench className="w-6 h-6 text-emerald-500" />
                    </div>
                    <CardTitle>قسم التركيب</CardTitle>
                    <CardDescription className="leading-7">
                      واجهة القسم الجديد المخصص لإضافات التركيب، مع بنية بيانات مفصولة وجاهزة للتوسعة.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button onClick={onSelectInstallation} className="w-full font-black">
                      دخول قسم التركيب
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            </>
          )}
        </div>

        <div className="mt-8 flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <Building2 className="w-3.5 h-3.5" />
          <span>واجهة اختيار الأقسام</span>
        </div>
      </div>
    </div>
  );
}
