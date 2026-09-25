import React, { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { useAppState } from '../context/AppStateContext';
import { Concept } from '../types';
import { DuckCharacter } from './DuckCharacter';
import { MathView } from './MathView';
import {
  BookOpen,
  FileUp,
  Sparkles,
  ArrowLeft,
  Layers,
  ListOrdered,
  Copy,
  Check,
  Clock,
  Mic,
  MessageCircle,
  FolderGit2,
} from 'lucide-react';

export const ConceptsPanel: React.FC = () => {
  const {
    concepts,
    setSelectedConcept,
    setStep,
    setDuckState,
    material,
    markActiveConceptInProgress,
    openCourseChat,
  } = useAppState();
  const [selectedChapterFilter, setSelectedChapterFilter] = useState<string>('all');
  const [copiedBreakdown, setCopiedBreakdown] = useState(false);
  const [showBreakdownText, setShowBreakdownText] = useState(false);

  const handleSelectConcept = (concept: Concept) => {
    setSelectedConcept(concept);
    setDuckState('listening');
    // Opening a concept turns its roadmap badge 🟡 قيد التثبيت until the duck is convinced.
    void markActiveConceptInProgress(concept.id);
    setStep('teach');
  };

  // Group concepts by chapter or unit
  const groupedConcepts = useMemo(() => {
    const groups: { [key: string]: Concept[] } = {};
    concepts.forEach((concept) => {
      const chapter = concept.chapterOrUnit?.trim() || '[الوحدة التعليمية المستهدفة]';
      if (!groups[chapter]) {
        groups[chapter] = [];
      }
      groups[chapter].push(concept);
    });
    return groups;
  }, [concepts]);

  const chapterKeys = useMemo(() => Object.keys(groupedConcepts), [groupedConcepts]);
  const isMultiChapter = chapterKeys.length > 1;
  const isFullCourse = isMultiChapter || concepts.length >= 8;

  // Build the structured breakdown text following the requested format:
  // ## [اسم الوحدة / الأسبوع الأول]
  // * مفهوم 1: [اسم المفهوم] - [وصف مختصر للمفهوم في سطر واحد]
  // * مفهوم 2: [اسم المفهوم] - [وصف مختصر للمفهوم في سطر واحد]
  const structuredBreakdownText = useMemo(() => {
    return chapterKeys
      .map((chapter) => {
        const cleanChapter = chapter.replace(/^[#\-\s*]+/, '').trim();
        const header = cleanChapter.startsWith('[') ? `## ${cleanChapter}` : `## [${cleanChapter}]`;
        const items = groupedConcepts[chapter]
          .map((c, idx) => {
            const desc = c.coreFocus || c.summary.split('.')[0] || 'المفهوم التأسيسي المحوري';
            return `* مفهوم ${idx + 1}: [${c.name}] - [${desc}]`;
          })
          .join('\n');
        return `${header}\n${items}`;
      })
      .join('\n\n');
  }, [chapterKeys, groupedConcepts]);

  const handleCopyBreakdown = () => {
    navigator.clipboard.writeText(structuredBreakdownText);
    setCopiedBreakdown(true);
    setTimeout(() => setCopiedBreakdown(false), 2500);
  };

  const filteredChapters = useMemo(() => {
    if (selectedChapterFilter === 'all') {
      return chapterKeys;
    }
    return chapterKeys.filter((ch) => ch === selectedChapterFilter);
  }, [chapterKeys, selectedChapterFilter]);

  const getDifficultyBadge = (difficulty: string) => {
    switch (difficulty) {
      case 'basic':
      case 'بسيط':
        return { label: 'تأسيسي', badge: 'bg-emerald-100 text-emerald-900 border-emerald-300' };
      case 'intermediate':
      case 'متوسط':
        return { label: 'متوسط', badge: 'bg-amber-100 text-amber-900 border-amber-300' };
      case 'advanced':
      case 'متقدم':
      default:
        return { label: 'عميق ومتقدم', badge: 'bg-rose-100 text-rose-900 border-rose-300' };
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold border border-amber-300 bg-amber-50 text-amber-900">
          <Layers className="w-3.5 h-3.5 text-amber-700" />
          <span>
            {isFullCourse
              ? `نطاق التحليل: مقرر دراسي شامل (${chapterKeys.length} فصول • ${concepts.length} مفهوماً مركزاً)`
              : `نطاق التحليل: فصل / محاضرة متخصصة (${concepts.length} مفاهيم جوهرية للتفسير الصوتي)`}
          </span>
        </div>

        <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          اختر المفهوم الذي ترغب في شرحه بصوتك لكواكلي
        </h2>
        <p className="text-slate-600 text-sm sm:text-base max-w-xl mx-auto">
          المستخلصة من مستند:{' '}
          <span className="font-bold text-slate-800">{material?.fileName || 'المستند الدراسي'}</span>.
          كل مفهوم مُعد خصيصاً لجلسة شرح صوتي مركزة تستغرق من 2 إلى 3 دقائق.
        </p>
      </div>

      {/* Rubber Duck Avatar */}
      <div className="flex justify-center py-1">
        <DuckCharacter
          state="encouraging"
          message={
            isFullCourse
              ? `كواك! قمت بتفكيك المقرر الشامل إلى ${chapterKeys.length} فصول متكاملة تضم ${concepts.length} مفهوماً تفصيلياً. اختر أي مفهوم ترغب في شرحه لي!`
              : `كواك! استخرجت لك ${concepts.length} مفاهيم جوهرية وعميقة. اختر المفهوم الذي ستبدأ به جلستك الصوتية!`
          }
        />
      </div>

      {/* Structured Roadmap / Syllabus Breakdown Card */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-amber-100 text-amber-800 rounded-lg">
              <ListOrdered className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                المخطط الهيكلي المعتمد للمفاهيم (Structured Course Breakdown)
              </h3>
              <p className="text-xs text-slate-500">
                موزع بدقة وفق الفصول والتركيز الجوهري (One-sentence core focus)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowBreakdownText(!showBreakdownText)}
              className="text-xs font-bold text-slate-700 hover:text-slate-900 bg-white border border-slate-200 hover:bg-slate-100 px-3 py-1.5 rounded-lg transition-colors"
            >
              {showBreakdownText ? 'إخفاء العرض النصي' : 'عرض الهيكلة النصية'}
            </button>
            <button
              onClick={handleCopyBreakdown}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-900 bg-amber-100 hover:bg-amber-200 px-3 py-1.5 rounded-lg transition-colors border border-amber-300"
            >
              {copiedBreakdown ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-700" />
                  <span className="text-emerald-800">تم النسخ!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-amber-800" />
                  <span>نسخ الهيكلة</span>
                </>
              )}
            </button>
          </div>
        </div>

        {showBreakdownText && (
          <div className="bg-white rounded-xl border border-slate-200 p-4 font-mono text-xs sm:text-sm text-slate-800 whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto">
            {structuredBreakdownText}
          </div>
        )}
      </div>

      {/* Chapter Tabs Filter (when multi-chapter) */}
      {isMultiChapter && (
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin">
          <button
            onClick={() => setSelectedChapterFilter('all')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors border ${
              selectedChapterFilter === 'all'
                ? 'bg-amber-500 text-white border-amber-600 shadow-xs'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            كافة الفصول ({concepts.length})
          </button>
          {chapterKeys.map((chapter) => (
            <button
              key={chapter}
              onClick={() => setSelectedChapterFilter(chapter)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors border ${
                selectedChapterFilter === chapter
                  ? 'bg-amber-500 text-white border-amber-600 shadow-xs'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {chapter} ({groupedConcepts[chapter].length})
            </button>
          ))}
        </div>
      )}

      {/* Grouped Concepts List */}
      <div className="space-y-8">
        {filteredChapters.map((chapter) => {
          const chapterConcepts = groupedConcepts[chapter];
          return (
            <div key={chapter} className="space-y-4">
              {/* Chapter Header */}
              <div className="flex items-center gap-2.5 pb-2 border-b border-amber-200/80">
                <FolderGit2 className="w-5 h-5 text-amber-600" />
                <h3 className="text-base sm:text-lg font-extrabold text-slate-900 tracking-tight">
                  {chapter.replace(/^[#\-\s*]+/, '')}
                </h3>
                <span className="text-xs bg-amber-100 text-amber-900 font-bold px-2.5 py-0.5 rounded-full border border-amber-200">
                  {chapterConcepts.length} مفاهيم
                </span>
              </div>

              {/* Concepts Grid for this chapter */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {chapterConcepts.map((concept, index) => {
                  const diffInfo = getDifficultyBadge(concept.difficulty);
                  return (
                    <motion.div
                      key={concept.id || index}
                      whileHover={{ scale: 1.01, y: -2 }}
                      onClick={() => handleSelectConcept(concept)}
                      className="bg-white p-5 rounded-2xl border border-amber-200/80 shadow-xs hover:shadow-md hover:border-amber-400 transition-all cursor-pointer flex flex-col justify-between space-y-4 relative group"
                    >
                      <div className="space-y-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-xs font-extrabold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-md border border-amber-200/80">
                            المفهوم 0{index + 1}
                          </span>
                          <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${diffInfo.badge}`}>
                            {diffInfo.label}
                          </span>
                        </div>

                        <h4 className="text-lg font-bold text-slate-900 group-hover:text-amber-700 transition-colors">
                          <MathView content={concept.name} asInline />
                        </h4>

                        {/* Core Focus Line (One-sentence core focus) */}
                        {concept.coreFocus && (
                          <div className="bg-amber-50/70 border border-amber-200/80 p-2.5 rounded-xl text-xs text-amber-950 font-medium">
                            <span className="font-extrabold text-amber-900 ml-1">
                              التركيز الجوهري:
                            </span>
                            <MathView content={concept.coreFocus} asInline />
                          </div>
                        )}

                        <p className="text-slate-600 text-xs sm:text-sm leading-relaxed">
                          <MathView content={concept.summary} asInline />
                        </p>
                      </div>

                      {/* Key Principles Pills */}
                      {concept.keyPrinciples && concept.keyPrinciples.length > 0 && (
                        <div className="space-y-1.5 pt-2 border-t border-slate-100">
                          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                            الأركان والقواعد المحورية:
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {concept.keyPrinciples.map((principle, pIdx) => (
                              <span
                                key={pIdx}
                                className="text-xs bg-slate-100 text-slate-800 px-2.5 py-1 rounded-md font-medium"
                              >
                                • <MathView content={principle} asInline />
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Action & Duration Footer */}
                      <div className="space-y-2 pt-3 border-t border-slate-100">
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-1 text-slate-500 font-medium">
                            <Clock className="w-3.5 h-3.5 text-amber-600" />
                            <span>2 - 3 دقائق شرح</span>
                          </div>

                          <div className="flex items-center gap-1.5 text-amber-800 font-bold group-hover:text-amber-600 transition-colors">
                            <Mic className="w-3.5 h-3.5 text-amber-600" />
                            <span>اشرح هذا المفهوم</span>
                            <div className="p-1 bg-amber-100 rounded-full group-hover:bg-amber-500 group-hover:text-white transition-all">
                              <ArrowLeft className="w-3 h-3" />
                            </div>
                          </div>
                        </div>

                        {/* Escape hatch: not ready to explain it yet? let the duck explain first. */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openCourseChat(concept);
                          }}
                          className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold bg-slate-50 hover:bg-amber-50 text-slate-700 hover:text-amber-900 border border-slate-200 hover:border-amber-300 transition-all cursor-pointer"
                        >
                          <MessageCircle className="w-3.5 h-3.5 text-amber-600" />
                          <span>ما فهمته؟ اشرحه لي</span>
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Option to reupload or add different material */}
      <div className="flex justify-center pt-4">
        <button
          onClick={() => setStep('upload')}
          className="inline-flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-slate-900 py-2 px-4 rounded-lg border border-slate-200 bg-white hover:bg-slate-50"
        >
          <FileUp className="w-4 h-4" />
          <span>رفع مستند أو مقرر آخر</span>
        </button>
      </div>
    </div>
  );
};
