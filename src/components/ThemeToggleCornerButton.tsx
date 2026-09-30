import React from 'react';
import { useAppState } from '../context/AppStateContext';
import { Sun, Moon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const ThemeToggleCornerButton: React.FC = () => {
  const { theme, toggleTheme, isRtl } = useAppState();
  const isDark = theme === 'dark';

  return (
    <div
      id="theme-toggle-corner-container"
      className={`fixed bottom-6 ${isRtl ? 'left-6' : 'right-6'} z-50 hidden md:flex items-center gap-2 group select-none`}
    >
      <motion.button
        id="theme-toggle-corner-btn"
        onClick={toggleTheme}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.92 }}
        aria-label={isDark ? 'التحويل إلى الوضع النهاري' : 'التحويل إلى الوضع الليلي'}
        title={isDark ? 'الوضع النهاري (Day Mode)' : 'الوضع الليلي (Night Mode)'}
        className={`relative flex items-center gap-2.5 px-4 py-3 rounded-full shadow-xl border backdrop-blur-md transition-all cursor-pointer ${
          isDark
            ? 'bg-slate-900/90 text-amber-300 border-amber-500/40 hover:border-amber-400 hover:shadow-amber-500/20 shadow-slate-950/50'
            : 'bg-white/95 text-slate-800 border-amber-300/80 hover:border-amber-500 hover:shadow-amber-500/25 shadow-slate-400/20'
        }`}
      >
        {/* Icon with smooth flip/rotate transition */}
        <div className="relative w-6 h-6 flex items-center justify-center">
          <AnimatePresence mode="wait" initial={false}>
            {isDark ? (
              <motion.div
                key="sun"
                initial={{ rotate: -90, scale: 0.2, opacity: 0 }}
                animate={{ rotate: 0, scale: 1, opacity: 1 }}
                exit={{ rotate: 90, scale: 0.2, opacity: 0 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
                className="absolute text-amber-400"
              >
                <Sun className="w-6 h-6 stroke-[2.2]" />
              </motion.div>
            ) : (
              <motion.div
                key="moon"
                initial={{ rotate: 90, scale: 0.2, opacity: 0 }}
                animate={{ rotate: 0, scale: 1, opacity: 1 }}
                exit={{ rotate: -90, scale: 0.2, opacity: 0 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
                className="absolute text-indigo-600"
              >
                <Moon className="w-5 h-5 stroke-[2.2]" />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Text Label on the corner button */}
        <span className="text-xs font-black tracking-tight whitespace-nowrap">
          {isDark ? 'الوضع النهاري' : 'الوضع الليلي'}
        </span>

        {/* Small badge dot indicating state */}
        <span
          className={`w-2 h-2 rounded-full transition-colors ${
            isDark ? 'bg-amber-400 shadow-xs shadow-amber-400' : 'bg-indigo-500 shadow-xs shadow-indigo-400'
          }`}
        />
      </motion.button>
    </div>
  );
};
