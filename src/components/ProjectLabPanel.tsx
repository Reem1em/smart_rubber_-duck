import React, { useState } from 'react';
import { motion } from 'motion/react';
import { useAppState } from '../context/AppStateContext';
import { reviewProject, generateCodeLab } from '../services/ai';
import { isRateLimitError } from '../utils/rateLimit';
import { ProjectReviewResponse, CodeLabProject } from '../types';
import { DuckCharacter } from './DuckCharacter';
import {
  Code2,
  Terminal,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Lightbulb,
  ArrowRight,
  Loader2,
  Copy,
  Check,
  Zap,
  Award,
  Layers,
  FolderGit2,
} from 'lucide-react';

export const ProjectLabPanel: React.FC = () => {
  const { setStep, setDuckState, showRateLimitModal } = useAppState();

  const [subjectName, setSubjectName] = useState('Java');
  const [studentLevel, setStudentLevel] = useState('متوسط');
  const [codeSnippet, setCodeSnippet] = useState(
    `public class StudentGradeManager {
    public static double calculateAverage(int[] scores) {
        int sum = 0;
        for (int i = 0; i < scores.length; i++) {
            sum += scores[i];
        }
        return sum / scores.length; // الحالات الحدية: قسمة على صفر إن كانت مصفوفة فارغة
    }
}`
  );
  const [projectRequest, setProjectRequest] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [isGeneratingProjects, setIsGeneratingProjects] = useState(false);
  const [generatedProjects, setGeneratedProjects] = useState<CodeLabProject[] | null>(null);
  const [reviewResult, setReviewResult] = useState<ProjectReviewResponse | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  const handleGenerate3Projects = async () => {
    if (isGeneratingProjects) return;
    setIsGeneratingProjects(true);
    setDuckState('thinking');
    try {
      const res = await generateCodeLab({ language: subjectName, topic: subjectName });
      setGeneratedProjects(res.projects);
      setDuckState('encouraging');
    } catch (err: any) {
      console.error('Error generating 3 code lab projects:', err);
      if (isRateLimitError(err)) {
        showRateLimitModal();
      }
      setDuckState('idle');
    } finally {
      setIsGeneratingProjects(false);
    }
  };

  const sampleTemplates = [
    {
      name: 'جافا - حساب المتوسط (Java)',
      subject: 'Java',
      code: `public class GradeCalculator {
    public static double getAverage(int[] marks) {
        int total = 0;
        for(int m : marks) {
            total += m;
        }
        return total / marks.length;
    }
}`,
    },
    {
      name: 'بايثون - قائمة مترابطة (Python Data Structure)',
      subject: 'Python / Data Structures',
      code: `class Node:
    def __init__(self, data):
        self.data = data
        self.next = None

class LinkedList:
    def __init__(self):
        self.head = None

    def append(self, data):
        new_node = Node(data)
        if not self.head:
            self.head = new_node
            return
        curr = self.head
        while curr.next:
            curr = curr.next
        curr.next = new_node`,
    },
    {
      name: 'C++ - معالجة مصفوفة ديناميكية',
      subject: 'C++',
      code: `#include <iostream>
using namespace std;

int findMax(int arr[], int size) {
    int maxVal = arr[0];
    for(int i = 1; i < size; i++) {
        if(arr[i] > maxVal) {
            maxVal = arr[i];
        }
    }
    return maxVal;
}`,
    },
  ];

  const handleReview = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isLoading) return;
    setIsLoading(true);
    setDuckState('thinking');

    try {
      const res = await reviewProject({
        subjectName,
        codeSnippet,
        projectRequest,
        studentLevel,
      });

      setReviewResult(res);
      setDuckState(res.score >= 80 ? 'proud' : 'encouraging');
    } catch (err: any) {
      console.error('Error reviewing project:', err);
      if (isRateLimitError(err)) {
        showRateLimitModal();
      }
      setDuckState('idle');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyCode = () => {
    if (!reviewResult?.improvedCodeSnippet) return;
    navigator.clipboard.writeText(reviewResult.improvedCodeSnippet);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header Bar */}
      <div className="bg-white p-5 rounded-2xl border border-amber-200/80 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setStep('upload')}
            className="p-2 rounded-xl bg-slate-100 hover:bg-amber-100 text-slate-700 hover:text-amber-900 transition-colors"
            title="العودة"
          >
            <ArrowRight className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-1.5 text-xs font-bold text-amber-800 uppercase tracking-wider">
              <Code2 className="w-4 h-4 text-amber-600" />
              <span>معمل البرمجة • معمل المشاريع ومراجعة الكود</span>
            </div>
            <h2 className="text-xl font-black text-slate-900">
              معمل المشاريع التطبيقية والتقييم البرمجي الهندسي
            </h2>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleGenerate3Projects}
            type="button"
            disabled={isGeneratingProjects}
            className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs transition-colors shadow-2xs inline-flex items-center gap-1.5"
          >
            {isGeneratingProjects ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <FolderGit2 className="w-3.5 h-3.5" />
            )}
            <span>توليد 3 مشاريع متدرجة ⚡</span>
          </button>
          {sampleTemplates.map((tmpl, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                setSubjectName(tmpl.subject);
                setCodeSnippet(tmpl.code);
              }}
              className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-amber-100 text-slate-800 font-bold text-xs transition-colors border border-slate-200"
            >
              {tmpl.name}
            </button>
          ))}
        </div>
      </div>

      {/* Main Form & Code Input */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-3xl border border-amber-200/80 p-6 shadow-md space-y-5">
          <form onSubmit={handleReview} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-slate-800 mb-1">
                  المادة / لغة البرمجة:
                </label>
                <select
                  value={subjectName}
                  onChange={(e) => setSubjectName(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 text-sm font-bold bg-white"
                >
                  <option value="Java">Java (جافا)</option>
                  <option value="Python">Python (بايثون)</option>
                  <option value="C++">C++ (سي بلس بلس)</option>
                  <option value="Data Structures">Data Structures (هياكل البيانات)</option>
                  <option value="Web Development">Web Development (تطوير الويب)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-800 mb-1">
                  مستوى الطالب الدراس:
                </label>
                <select
                  value={studentLevel}
                  onChange={(e) => setStudentLevel(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 text-sm font-bold bg-white"
                >
                  <option value="مبتدئ">مبتدئ (Beginner)</option>
                  <option value="متوسط">متوسط (Intermediate)</option>
                  <option value="متقدم">متقدم (Advanced)</option>
                </select>
              </div>
            </div>

            {/* Code Editor */}
            <div>
              <label className="block text-sm font-bold text-slate-800 mb-1.5 flex items-center justify-between">
                <span>أدخل الكود للمراجعة وتقييم الثغرات:</span>
                <span className="text-xs font-mono text-amber-800 font-bold">{subjectName} Code</span>
              </label>
              <textarea
                value={codeSnippet}
                onChange={(e) => setCodeSnippet(e.target.value)}
                rows={6}
                dir="ltr"
                placeholder="أدخل الشفرة البرمجية هنا..."
                className="w-full p-4 rounded-2xl bg-slate-900 text-amber-300 font-mono text-xs leading-relaxed border border-slate-800 focus:ring-2 focus:ring-amber-400 outline-hidden"
              />
            </div>

            {/* Project Challenge Option */}
            <div>
              <label className="block text-sm font-bold text-slate-800 mb-1">
                أو طلب سيناريو تحدٍ تطبيقي جديد (اختياري):
              </label>
              <input
                type="text"
                value={projectRequest}
                onChange={(e) => setProjectRequest(e.target.value)}
                placeholder="مثال: اطلب مشروعاً ينفذ نظام إدارة مكتبة باستخدام القوائم المترابطة..."
                className="w-full p-3 rounded-xl border border-slate-200 text-sm font-medium outline-hidden"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 px-5 rounded-2xl bg-amber-500 hover:bg-amber-600 active:scale-[0.99] text-white font-extrabold text-base shadow-md flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>جاري المراجعة وتقييم الشفرة البرمجية...</span>
                </>
              ) : (
                <>
                  <Terminal className="w-5 h-5" />
                  <span>تحليل المشروع ومراجعة الكود (/review-project)</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Side Duck Companion */}
        <div className="bg-gradient-to-b from-amber-100/60 to-white rounded-3xl border border-amber-200/80 p-6 flex flex-col items-center justify-center text-center shadow-sm">
          <DuckCharacter
            state={isLoading ? 'thinking' : reviewResult ? 'proud' : 'idle'}
            size="md"
            message={
              reviewResult
                ? `كواك! تم التقييم الهندي بنجاح بكسر الفجوة النظريّة والبرمجيّة!`
                : 'ضع شفرتك البرمجية وسأقوم بمراجعة الثغرات وتزويدك بأفضل الممارسات البرمجية!'
            }
          />
        </div>
      </div>

      {/* Generated 3 Code Lab Projects Display */}
      {generatedProjects && (
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-3xl border-2 border-amber-200 shadow-lg p-6 space-y-4"
        >
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <FolderGit2 className="w-5 h-5 text-amber-600" />
              <h3 className="text-lg font-extrabold text-slate-900">
                مشاريع تطبيقيّة متدرجة لمادة ({subjectName}):
              </h3>
            </div>
            <span className="text-xs font-bold text-amber-800 bg-amber-100 px-3 py-1 rounded-full">
              3 مستويات صعوبة (Easy / Intermediate / Advanced)
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {generatedProjects.map((proj, pIdx) => (
              <div
                key={pIdx}
                className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col justify-between space-y-3"
              >
                <div>
                  <span
                    className={`inline-block px-2.5 py-0.5 rounded-lg text-xs font-black uppercase mb-2 ${
                      proj.difficulty === 'Easy'
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        : proj.difficulty === 'Intermediate'
                        ? 'bg-amber-100 text-amber-900 border border-amber-300'
                        : 'bg-rose-100 text-rose-800 border border-rose-300'
                    }`}
                  >
                    {proj.difficulty}
                  </span>
                  <h4 className="text-sm font-extrabold text-slate-900 leading-snug">
                    {proj.title}
                  </h4>
                  <p className="text-xs font-medium text-slate-600 mt-1 leading-relaxed">
                    {proj.description}
                  </p>
                  <div className="mt-3 space-y-1">
                    <span className="text-[11px] font-bold text-slate-500 block">المتطلبات الأساسية:</span>
                    <ul className="text-xs text-slate-700 space-y-0.5">
                      {proj.keyRequirements.map((req, rIdx) => (
                        <li key={rIdx} className="flex items-start gap-1">
                          <span className="text-amber-500 font-bold">•</span>
                          <span>{req}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setProjectRequest(`${proj.title}: ${proj.description}`)}
                  className="w-full py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded-xl shadow-2xs transition-colors"
                >
                  اختيار هذا المشروع للتطبيق 🎯
                </button>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Review Results Display */}
      {reviewResult && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-3xl border-2 border-amber-200 shadow-xl p-6 sm:p-8 space-y-6"
        >
          {/* Top Score Gauge */}
          <div className="flex flex-wrap items-center justify-between gap-4 p-5 bg-slate-900 text-white rounded-2xl">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-amber-500 text-slate-950 font-black text-2xl flex items-center justify-center shadow-md">
                {reviewResult.score}%
              </div>
              <div>
                <span className="text-xs font-bold text-amber-400 uppercase tracking-wider block">
                  التقييم الهندسي للجودة البرمجية
                </span>
                <h3 className="text-lg font-bold text-white leading-snug">
                  {reviewResult.summary}
                </h3>
              </div>
            </div>

            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/10 rounded-xl text-amber-300 font-bold text-xs">
              <Award className="w-4 h-4 text-amber-400" />
              <span>مستوى الأداء: {reviewResult.score >= 80 ? 'ممتاز' : 'جيد جداً'}</span>
            </div>
          </div>

          {/* Strengths & Gaps */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200 space-y-2">
              <div className="flex items-center gap-2 text-emerald-900 font-black text-sm">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>نقاط القوة في الكود:</span>
              </div>
              <ul className="space-y-1 text-xs font-bold text-slate-800">
                {reviewResult.strengths.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-1.5">
                    <span className="text-emerald-600">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="p-4 rounded-2xl bg-rose-50/60 border border-rose-200 space-y-2">
              <div className="flex items-center gap-2 text-rose-900 font-black text-sm">
                <AlertTriangle className="w-4 h-4 text-rose-600" />
                <span>الثغرات والحالات الحدية (Edge Cases):</span>
              </div>
              <ul className="space-y-1 text-xs font-bold text-slate-800">
                {reviewResult.gaps.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-1.5">
                    <span className="text-rose-600">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Best Engineering Practices */}
          {reviewResult.bestPractices && reviewResult.bestPractices.length > 0 && (
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 space-y-2">
              <div className="flex items-center gap-2 text-amber-950 font-black text-sm">
                <Lightbulb className="w-5 h-5 text-amber-600" />
                <span>أفضل الممارسات الهندسيّة (Software Engineering Advice):</span>
              </div>
              <ul className="space-y-1 text-xs font-bold text-slate-800">
                {reviewResult.bestPractices.map((bp, idx) => (
                  <li key={idx} className="flex items-start gap-1.5">
                    <span className="text-amber-600">•</span>
                    <span>{bp}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Improved Refactored Code Snippet */}
          {reviewResult.improvedCodeSnippet && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-slate-900 font-black text-sm">
                  <Layers className="w-4 h-4 text-amber-600" />
                  <span>الكود المحسن والمصحيح بأسلوب محترف:</span>
                </div>

                <button
                  onClick={handleCopyCode}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-amber-100 text-slate-800 font-bold text-xs transition-colors"
                >
                  {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedCode ? 'تم نسخ الكود!' : 'نسخ الكود'}</span>
                </button>
              </div>

              <pre
                dir="ltr"
                className="p-4 rounded-2xl bg-slate-950 text-amber-300 font-mono text-xs leading-relaxed overflow-x-auto border border-slate-800"
              >
                <code>{reviewResult.improvedCodeSnippet}</code>
              </pre>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
};
