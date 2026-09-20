import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Coffee, X, Clock } from 'lucide-react';
import { RATE_LIMIT_MESSAGE } from '../utils/rateLimit';

interface RateLimitModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RateLimitModal: React.FC<RateLimitModalProps> = ({ isOpen, onClose }) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="relative w-full max-w-md bg-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-amber-200/80 text-center space-y-5 overflow-hidden"
          >
            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-4 left-4 p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors"
              title="إغلاق"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Decorative Header Icon */}
            <div className="flex justify-center">
              <div className="relative">
                <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center text-amber-600 shadow-inner">
                  <Coffee className="w-10 h-10 animate-bounce" />
                </div>
                <div className="absolute -bottom-1 -right-1 p-1.5 bg-amber-500 text-white rounded-full shadow-md">
                  <Clock className="w-4 h-4" />
                </div>
              </div>
            </div>

            {/* Modal Title */}
            <div className="space-y-1">
              <h3 className="text-xl font-extrabold text-slate-900">
                استراحة محارب قصيرة! ☕
              </h3>
              <p className="text-xs font-bold text-amber-700 bg-amber-50 py-1 px-3 rounded-full inline-block border border-amber-200">
                تنبيه حد الاستخدام (API Rate Limit)
              </p>
            </div>

            {/* Exact Required Message */}
            <div className="p-4 bg-amber-50/70 border border-amber-200/80 rounded-2xl text-slate-800 text-sm sm:text-base font-bold leading-relaxed shadow-2xs">
              {RATE_LIMIT_MESSAGE}
            </div>

            {/* Action Button */}
            <button
              onClick={onClose}
              className="w-full py-3.5 px-6 rounded-xl font-extrabold text-white bg-amber-500 hover:bg-amber-600 active:scale-[0.99] transition-all shadow-md shadow-amber-500/20"
            >
              حسناً، فهمت
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
