import React from 'react';
import { AppStateProvider, useAppState } from './context/AppStateContext';
import { AuthProvider } from './context/AuthContext';
import { AccountMenu } from './components/AccountMenu';
import { UploadPanel } from './components/UploadPanel';
import { MyCoursesPanel } from './components/MyCoursesPanel';
import { ConceptsPanel } from './components/ConceptsPanel';
import { TeachDuckPanel } from './components/TeachDuckPanel';
import { SocraticQuestionPanel } from './components/SocraticQuestionPanel';
import { TransferChallengePanel } from './components/TransferChallengePanel';
import { QuizPanel } from './components/QuizPanel';
import { FinalDiagnosisPanel } from './components/FinalDiagnosisPanel';
import { CourseRoadmapPanel } from './components/CourseRoadmapPanel';
import { CodeLabPanel } from './components/CodeLabPanel';
import { RateLimitModal } from './components/RateLimitModal';
import { CourseChatDrawer } from './components/CourseChatDrawer';
import { ThemeToggleCornerButton } from './components/ThemeToggleCornerButton';
import {
  RotateCcw,
  Map as MapIcon,
  MessageCircle,
  Code2,
  Library,
  Sun,
  Moon,
} from 'lucide-react';

function AppContent() {
  const {
    step,
    setStep,
    courses,
    theme,
    toggleTheme,
    resetAll,
    rateLimitModalOpen,
    closeRateLimitModal,
    activeCourse,
    openCourseChat,
  } = useAppState();

  const getStepNumber = (s: string) => {
    switch (s) {
      case 'upload':
        return 1;
      case 'concepts':
        return 2;
      case 'teach':
        return 3;
      case 'diagnosis':
      case 'socratic':
        return 4;
      case 'transfer':
        return 5;
      case 'quiz':
        return 6;
      case 'final':
        return 7;
      default:
        return 1;
    }
  };

  const currentStepNum = getStepNumber(step);

  return (
    <div
      dir="rtl"
      className="min-h-screen bg-gradient-to-b from-amber-50/60 via-slate-50 to-amber-50/40 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 text-slate-900 dark:text-slate-100 font-sans antialiased selection:bg-amber-200 dark:selection:bg-amber-800 selection:text-amber-900 dark:selection:text-amber-100 flex flex-col justify-between transition-colors duration-200 font-arabic"
    >
      <RateLimitModal isOpen={rateLimitModalOpen} onClose={closeRateLimitModal} />

      <CourseChatDrawer />

      {/* Floating Corner Theme Toggle Button */}
      <ThemeToggleCornerButton />

      {/* Top Navbar */}
      <header className="sticky top-0 z-30 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-amber-200/60 dark:border-slate-800 shadow-xs w-full">
        <div className="w-full px-4 sm:px-6 lg:px-8 py-2.5 flex items-center justify-between gap-4">
          {/* Logo & App Name (Far Right in RTL) */}
          <div
            onClick={resetAll}
            className="flex items-center gap-2.5 sm:gap-3 cursor-pointer group select-none shrink-0"
          >
            <div className="w-10 h-10 bg-amber-100 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-700/60 rounded-xl flex items-center justify-center p-1 shadow-xs group-hover:scale-105 transition-transform overflow-hidden shrink-0">
              <img
                src="/quakly-duck.svg"
                alt="كواكلي (Quakly)"
                className="w-full h-full object-contain"
                style={{ transform: 'scaleX(-1)' }}
                referrerPolicy="no-referrer"
              />
            </div>
            <div>
              <h1 className="font-black text-base sm:text-lg text-slate-900 dark:text-slate-100 leading-tight">
                كواكلي (Quakly)
              </h1>
              <p className="text-[11px] font-bold text-amber-900 dark:text-amber-400 hidden sm:block">
                اشرح بصوتك • اكتشف ثغراتك • اختبر فهمك
              </p>
            </div>
          </div>

          {/* Action Tools (Far Left in RTL) */}
          <div className="flex items-center gap-2 shrink-0 ms-auto">
            <button
              onClick={() => setStep('courses')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                step === 'courses'
                  ? 'bg-amber-500 text-white border-amber-600 shadow-xs'
                  : 'bg-amber-50 dark:bg-slate-800 text-amber-900 dark:text-amber-300 border-amber-200 dark:border-slate-700 hover:bg-amber-100 dark:hover:bg-slate-750'
              }`}
            >
              <Library className="w-3.5 h-3.5" />
              <span className="hidden md:inline">موادي</span>
              {courses.length > 0 && (
                <span className="px-1.5 rounded-full bg-amber-200 text-amber-950 text-[10px] font-black">
                  {courses.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setStep('roadmap')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                step === 'roadmap'
                  ? 'bg-amber-500 text-white border-amber-600 shadow-xs'
                  : 'bg-amber-50 dark:bg-slate-800 text-amber-900 dark:text-amber-300 border-amber-200 dark:border-slate-700 hover:bg-amber-100 dark:hover:bg-slate-750'
              }`}
            >
              <MapIcon className="w-3.5 h-3.5" />
              <span className="hidden md:inline">خريطة المقرر</span>
            </button>

            {activeCourse && (
              <button
                onClick={() => openCourseChat()}
                title={`اسأل كواكلي عن مادة ${activeCourse.title}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer bg-amber-50 dark:bg-slate-800 text-amber-900 dark:text-amber-300 border-amber-200 dark:border-slate-700 hover:bg-amber-100 dark:hover:bg-slate-750"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span className="hidden md:inline">اسأل كواكلي</span>
              </button>
            )}

            <button
              onClick={() => setStep('codeLab')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                step === 'codeLab'
                  ? 'bg-amber-500 text-white border-amber-600 shadow-xs'
                  : 'bg-amber-50 dark:bg-slate-800 text-amber-900 dark:text-amber-300 border-amber-200 dark:border-slate-700 hover:bg-amber-100 dark:hover:bg-slate-750'
              }`}
            >
              <Code2 className="w-3.5 h-3.5" />
              <span className="hidden md:inline">معمل البرمجة</span>
            </button>

            {/* Corner / Header Day & Night Switcher */}
            <button
              id="header-theme-toggle"
              onClick={toggleTheme}
              title={theme === 'dark' ? 'التحويل إلى الوضع النهاري' : 'التحويل إلى الوضع الليلي'}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                theme === 'dark'
                  ? 'bg-amber-500/15 text-amber-300 border-amber-500/40 hover:bg-amber-500/25'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {theme === 'dark' ? (
                <>
                  <Sun className="w-3.5 h-3.5 text-amber-400" />
                  <span className="hidden sm:inline">الوضع النهاري</span>
                </>
              ) : (
                <>
                  <Moon className="w-3.5 h-3.5 text-indigo-600" />
                  <span className="hidden sm:inline">الوضع الليلي</span>
                </>
              )}
            </button>

            <AccountMenu />

            {step !== 'upload' && (
              <button
                onClick={resetAll}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:text-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                <span className="hidden sm:inline">البدء من جديد</span>
              </button>
            )}
          </div>
        </div>

        {/* Learning Loop Stepper Indicator */}
        <div className="bg-amber-100/50 dark:bg-slate-900/60 border-t border-amber-200/50 dark:border-slate-800 py-2.5">
          <div className="max-w-4xl mx-auto px-4 flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300 overflow-x-auto gap-2">
            <div
              className={`flex items-center gap-1.5 shrink-0 ${
                currentStepNum >= 1 ? 'text-amber-950 dark:text-amber-300 font-black' : 'opacity-40'
              }`}
            >
              <span className="w-5 h-5 rounded-full bg-amber-400 text-slate-900 flex items-center justify-center text-[10px] font-black">
                1
              </span>
              <span>رفع المستند</span>
            </div>

            <span className="text-amber-400">‹</span>

            <div
              className={`flex items-center gap-1.5 shrink-0 ${
                currentStepNum >= 2 ? 'text-amber-950 dark:text-amber-300 font-black' : 'opacity-40'
              }`}
            >
              <span className="w-5 h-5 rounded-full bg-amber-400 text-slate-900 flex items-center justify-center text-[10px] font-black">
                2
              </span>
              <span>اختر المفهوم</span>
            </div>

            <span className="text-amber-400">‹</span>

            <div
              className={`flex items-center gap-1.5 shrink-0 ${
                currentStepNum >= 3 ? 'text-amber-950 dark:text-amber-300 font-black' : 'opacity-40'
              }`}
            >
              <span className="w-5 h-5 rounded-full bg-amber-400 text-slate-900 flex items-center justify-center text-[10px] font-black">
                3
              </span>
              <span>شرح المفهوم</span>
            </div>

            <span className="text-amber-400">‹</span>

            <div
              className={`flex items-center gap-1.5 shrink-0 ${
                currentStepNum >= 4 ? 'text-amber-950 dark:text-amber-300 font-black' : 'opacity-40'
              }`}
            >
              <span className="w-5 h-5 rounded-full bg-amber-400 text-slate-900 flex items-center justify-center text-[10px] font-black">
                4
              </span>
              <span> جلسة البطّة</span>
            </div>

            <span className="text-amber-400">‹</span>

            <div
              className={`flex items-center gap-1.5 shrink-0 ${
                currentStepNum >= 5 ? 'text-amber-950 dark:text-amber-300 font-black' : 'opacity-40'
              }`}
            >
              <span className="w-5 h-5 rounded-full bg-amber-400 text-slate-900 flex items-center justify-center text-[10px] font-black">
                5
              </span>
              <span>تحدي نقل المعرفة</span>
            </div>

            <span className="text-amber-400">‹</span>

            <div
              className={`flex items-center gap-1.5 shrink-0 ${
                currentStepNum >= 6 ? 'text-amber-950 dark:text-amber-300 font-black' : 'opacity-40'
              }`}
            >
              <span className="w-5 h-5 rounded-full bg-amber-400 text-slate-900 flex items-center justify-center text-[10px] font-black">
                6
              </span>
              <span>اختبار قصير</span>
            </div>

            <span className="text-amber-400">‹</span>

            <div
              className={`flex items-center gap-1.5 shrink-0 ${
                currentStepNum >= 7 ? 'text-amber-950 dark:text-amber-300 font-black' : 'opacity-40'
              }`}
            >
              <span className="w-5 h-5 rounded-full bg-amber-400 text-slate-900 flex items-center justify-center text-[10px] font-black">
                7
              </span>
              <span>التقييم النهائي</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Learning Flow Panel Stage */}
      <main className="flex-1 py-6">
        {step === 'upload' && <UploadPanel />}
        {step === 'courses' && <MyCoursesPanel />}
        {step === 'concepts' && <ConceptsPanel />}
        {step === 'teach' && <TeachDuckPanel />}
        {(step === 'diagnosis' || step === 'socratic') && <SocraticQuestionPanel />}
        {step === 'transfer' && <TransferChallengePanel />}
        {step === 'quiz' && <QuizPanel />}
        {step === 'final' && <FinalDiagnosisPanel />}
        {step === 'roadmap' && <CourseRoadmapPanel />}
        {step === 'codeLab' && <CodeLabPanel />}
      </main>

      {/* Footer */}
      <footer className="py-4 border-t border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/60 text-center text-xs font-bold text-slate-600 dark:text-slate-400">
        <p>
          منصة كواكلي (Quakly)
        </p>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppStateProvider>
        <AppContent />
      </AppStateProvider>
    </AuthProvider>
  );
}
