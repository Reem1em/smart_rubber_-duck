import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { DuckState } from '../types';
import {
  HelpCircle,
  Sparkles,
  Brain,
  Search,
  Volume2,
  Lightbulb,
  GraduationCap,
  RotateCw,
} from 'lucide-react';

interface DuckCharacterProps {
  state: DuckState;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  message?: string;
  isSpeaking?: boolean;
  className?: string;
}

export const DuckCharacter: React.FC<DuckCharacterProps> = ({
  state,
  size = 'lg',
  message,
  isSpeaking = false,
  className = '',
}) => {

  // Dimensions based on size
  const sizeMap = {
    sm: { width: 100, height: 100, container: 'w-28 h-28' },
    md: { width: 160, height: 160, container: 'w-44 h-44' },
    lg: { width: 220, height: 220, container: 'w-60 h-60' },
    xl: { width: 280, height: 280, container: 'w-80 h-80' },
  };

  const currentSize = sizeMap[size];

  // Animation variants according to duck state
  const getDuckVariants = () => {
    switch (state) {
      case 'listening':
        return {
          animate: {
            y: [0, -4, 0, -4, 0],
            rotate: [-2, 3, -2, 3, -2],
            transition: { repeat: Infinity, duration: 2, ease: 'easeInOut' },
          },
        };
      case 'thinking':
        return {
          animate: {
            rotate: [0, 6, 0, -6, 0],
            scale: [1, 1.02, 1],
            transition: { repeat: Infinity, duration: 3, ease: 'easeInOut' },
          },
        };
      case 'quizzical':
        return {
          animate: {
            rotate: [5, 8, 5],
            y: [0, -6, 0],
            transition: { repeat: Infinity, duration: 2.5, ease: 'easeInOut' },
          },
        };
      case 'surprised':
        return {
          animate: {
            scale: [1, 1.12, 1.05],
            y: [0, -12, 0],
            transition: { duration: 0.5, ease: 'easeOut' },
          },
        };
      case 'encouraging':
        return {
          animate: {
            y: [0, -8, 0],
            scale: [1, 1.04, 1],
            transition: { repeat: Infinity, duration: 1.8, ease: 'easeInOut' },
          },
        };
      case 'proud':
        return {
          animate: {
            y: [0, -10, 0],
            rotate: [-3, 3, -3],
            scale: [1, 1.06, 1],
            transition: { repeat: Infinity, duration: 2, ease: 'easeInOut' },
          },
        };
      case 'diagnostic':
        return {
          animate: {
            x: [-3, 3, -3],
            rotate: [-1, 1, -1],
            transition: { repeat: Infinity, duration: 1.5, ease: 'easeInOut' },
          },
        };
      case 'idle':
      default:
        return {
          animate: {
            y: [0, -6, 0],
            transition: { repeat: Infinity, duration: 3.2, ease: 'easeInOut' },
          },
        };
    }
  };

  const getStatusBadge = () => {
    switch (state) {
      case 'listening':
        return { label: 'تصغي البطة بتركيز وإصغاء...', color: 'bg-amber-100 text-amber-900 border-amber-300', icon: Volume2 };
      case 'thinking':
        return { label: 'تحلل البطة الشرح والبيان...', color: 'bg-indigo-100 text-indigo-900 border-indigo-300', icon: Brain };
      case 'quizzical':
        return { label: 'تتأمل البطة دقيقةً غامضة...', color: 'bg-purple-100 text-purple-900 border-purple-300', icon: HelpCircle };
      case 'surprised':
        return { label: 'يا للعجب! اكتُشفت ثغرة فهم!', color: 'bg-rose-100 text-rose-900 border-rose-300', icon: Sparkles };
      case 'encouraging':
        return { label: 'مسار مبارك! تسبر البطة العُمق...', color: 'bg-emerald-100 text-emerald-900 border-emerald-300', icon: Lightbulb };
      case 'proud':
        return { label: 'تم إتقان المفهوم ببراعة!', color: 'bg-amber-200 text-amber-950 border-amber-400', icon: GraduationCap };
      case 'diagnostic':
        return { label: 'تقيس البطة فجوة الثقة واليقين...', color: 'bg-blue-100 text-blue-900 border-blue-300', icon: Search };
      case 'idle':
      default:
        return { label: 'البطة جاهزة للإصغاء والتعلم', color: 'bg-slate-100 text-slate-800 border-slate-200', icon: Sparkles };
    }
  };

  const badge = getStatusBadge();
  const BadgeIcon = badge.icon;

  return (
    <div className={`relative flex flex-col items-center justify-center ${className}`}>
      {/* Speech / Thought Bubble */}
      <AnimatePresence>
        {message && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.9 }}
            className="mb-3 max-w-sm px-4 py-3 bg-white border border-amber-200 shadow-lg rounded-2xl text-slate-800 text-sm font-medium relative text-center z-10"
          >
            <p className="leading-snug">{message}</p>
            {/* Bubble Tail */}
            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-white border-r border-b border-amber-200 rotate-45"></div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Duck Character Stage */}
      <div className="relative p-2 flex flex-col items-center justify-center">
        <div className="relative flex flex-col items-center justify-center">
          {/* Floating Indicators / Accessories around Duck */}
          <div className="relative">
            {/* State Particles / Waves */}
            {state === 'listening' && (
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 flex items-center space-x-1 z-0">
                <motion.div
                  animate={{ height: [6, 18, 6] }}
                  transition={{ repeat: Infinity, duration: 0.8 }}
                  className="w-1 bg-amber-500 rounded-full"
                />
                <motion.div
                  animate={{ height: [12, 24, 12] }}
                  transition={{ repeat: Infinity, duration: 0.6, delay: 0.1 }}
                  className="w-1 bg-amber-600 rounded-full"
                />
                <motion.div
                  animate={{ height: [8, 20, 8] }}
                  transition={{ repeat: Infinity, duration: 0.7, delay: 0.2 }}
                  className="w-1 bg-amber-500 rounded-full"
                />
              </div>
            )}

            {state === 'quizzical' && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: [1, 1.2, 1], rotate: [0, 10, -10, 0] }}
                transition={{ repeat: Infinity, duration: 2 }}
                className="absolute -top-6 -right-2 text-purple-600 z-10 bg-purple-100 p-2 rounded-full border border-purple-300 shadow-sm"
              >
                <HelpCircle className="w-6 h-6" />
              </motion.div>
            )}

            {state === 'thinking' && (
              <motion.div
                animate={{ opacity: [0.4, 1, 0.4], y: [-2, -8, -2] }}
                transition={{ repeat: Infinity, duration: 2 }}
                className="absolute -top-7 -right-3 text-indigo-600 z-10 bg-indigo-100 p-2 rounded-full border border-indigo-200 shadow-sm"
              >
                <Brain className="w-6 h-6" />
              </motion.div>
            )}

            {state === 'proud' && (
              <motion.div
                initial={{ scale: 0, y: 10 }}
                animate={{ scale: 1, y: 0 }}
                className="absolute -top-8 left-1/2 -translate-x-1/2 z-20"
              >
                <GraduationCap className="w-10 h-10 text-amber-700 drop-shadow-md" />
              </motion.div>
            )}

            {/* Central Duck SVG Illustration */}
            <motion.div
              variants={getDuckVariants()}
              animate="animate"
              className={`relative ${currentSize.container} flex items-center justify-center cursor-pointer select-none`}
            >
              {/* Subtle 3D Depth Shadow */}
              <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-3/4 h-5 bg-amber-300/60 rounded-full blur-md -z-10" />

              {/* SVG Rubber Duck */}
              <svg
                width={currentSize.width}
                height={currentSize.height}
                viewBox="0 0 200 200"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="drop-shadow-lg transition-all duration-300"
              >
                {/* Duck Body */}
                <path
                  d="M30 130C30 100 55 80 85 80C95 80 115 85 125 90C140 70 170 70 180 85C190 100 185 130 160 150C135 170 60 170 30 130Z"
                  fill="#FBBF24"
                  stroke="#D97706"
                  strokeWidth="4"
                />
                {/* Duck Tail */}
                <path
                  d="M35 125C20 115 15 100 25 95C35 90 45 105 45 115Z"
                  fill="#F59E0B"
                  stroke="#D97706"
                  strokeWidth="3"
                />

                {/* Wing */}
                <motion.path
                  animate={
                    state === 'proud' || state === 'encouraging'
                      ? { rotate: [-5, 10, -5] }
                      : { rotate: [0, 3, 0] }
                  }
                  transition={{ repeat: Infinity, duration: 1.5 }}
                  style={{ transformOrigin: '80px 125px' }}
                  d="M70 120C70 110 95 105 115 115C125 120 120 140 100 140C80 140 70 130 70 120Z"
                  fill="#F59E0B"
                  stroke="#D97706"
                  strokeWidth="3"
                />

                {/* Duck Head */}
                <circle
                  cx="135"
                  cy="65"
                  r="38"
                  fill="#FBBF24"
                  stroke="#D97706"
                  strokeWidth="4"
                />

                {/* Detective Monocle for 'diagnostic' state */}
                {state === 'diagnostic' && (
                  <g>
                    <circle cx="148" cy="58" r="14" fill="none" stroke="#2563EB" strokeWidth="3" />
                    <line x1="158" y1="68" x2="170" y2="80" stroke="#2563EB" strokeWidth="4" strokeLinecap="round" />
                  </g>
                )}

                {/* Duck Eye Expressions */}
                {state === 'surprised' ? (
                  // Wide Surprised Eye
                  <g>
                    <circle cx="146" cy="56" r="8" fill="white" stroke="#1E293B" strokeWidth="2" />
                    <circle cx="146" cy="56" r="3" fill="#1E293B" />
                  </g>
                ) : state === 'thinking' || state === 'quizzical' ? (
                  // Squinting / Inquisitive Eye
                  <g>
                    <path d="M140 54 Q146 48 152 54" stroke="#1E293B" strokeWidth="4" strokeLinecap="round" fill="none" />
                  </g>
                ) : state === 'proud' || state === 'encouraging' ? (
                  // Happy Arc Eye
                  <g>
                    <path d="M140 58 Q146 50 152 58" stroke="#1E293B" strokeWidth="4" strokeLinecap="round" fill="none" />
                  </g>
                ) : (
                  // Normal Friendly Eye
                  <g>
                    <circle cx="146" cy="56" r="6" fill="#1E293B" />
                    <circle cx="148" cy="54" r="2" fill="white" />
                  </g>
                )}

                {/* Eyebrow */}
                {state === 'quizzical' ? (
                  <path d="M138 44 L152 48" stroke="#1E293B" strokeWidth="3" strokeLinecap="round" />
                ) : state === 'surprised' ? (
                  <path d="M140 42 Q146 38 152 42" stroke="#1E293B" strokeWidth="3" fill="none" />
                ) : null}

                {/* Beak / Bill */}
                <motion.path
                  animate={
                    isSpeaking || state === 'listening'
                      ? { scaleY: [1, 1.2, 1] }
                      : { scaleY: 1 }
                  }
                  transition={{ repeat: Infinity, duration: 0.3 }}
                  style={{ transformOrigin: '160px 68px' }}
                  d="M155 60 C175 58 190 65 185 73 C175 80 155 76 155 68 Z"
                  fill="#F97316"
                  stroke="#C2410C"
                  strokeWidth="3"
                />

                {/* Cheek blush */}
                <circle cx="128" cy="70" r="6" fill="#F87171" opacity="0.4" />
              </svg>
            </motion.div>
          </div>
        </div>
      </div>

      {/* State Badge */}
      <div className="mt-3 flex items-center justify-center">
        <div
          className={`inline-flex items-center space-x-1.5 px-3 py-1 rounded-full border text-xs font-semibold shadow-xs ${badge.color}`}
        >
          <BadgeIcon className="w-3.5 h-3.5" />
          <span>{badge.label}</span>
        </div>
      </div>
    </div>
  );
};
