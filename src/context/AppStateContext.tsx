import React, { createContext, useContext, useState } from 'react';
import {
  AppStep,
  Concept,
  CourseRoadmap,
  ExamMilestonePlan,
  SavedCourse,
  DiagnosisResult,
  DuckState,
  FinalDiagnosisResult,
  MaterialInput,
  QuizQuestion,
  QuizResult,
  SocraticEvaluation,
  TransferChallenge,
  WorkspaceExport,
} from '../types';
import * as courseStore from '../services/courseStore';
import { useAuth } from './AuthContext';

interface AppState {
  step: AppStep;
  setStep: (step: AppStep) => void;
  material: MaterialInput | null;
  setMaterial: (material: MaterialInput | null) => void;
  isAnalyzing: boolean;
  setIsAnalyzing: (isAnalyzing: boolean) => void;
  concepts: Concept[];
  setConcepts: (concepts: Concept[]) => void;
  selectedConcept: Concept | null;
  setSelectedConcept: (concept: Concept | null) => void;
  studentExplanation: string;
  setStudentExplanation: (text: string) => void;
  confidenceLevel: number;
  setConfidenceLevel: (level: number) => void;
  duckState: DuckState;
  setDuckState: (state: DuckState) => void;
  diagnosis: DiagnosisResult | null;
  setDiagnosis: (diagnosis: DiagnosisResult | null) => void;
  socraticAnswer: string;
  setSocraticAnswer: (ans: string) => void;
  socraticEvaluation: SocraticEvaluation | null;
  setSocraticEvaluation: (evalRes: SocraticEvaluation | null) => void;
  transferChallenge: TransferChallenge | null;
  setTransferChallenge: (challenge: TransferChallenge | null) => void;
  transferAnswer: string;
  setTransferAnswer: (ans: string) => void;
  quizQuestions: QuizQuestion[];
  setQuizQuestions: (questions: QuizQuestion[]) => void;
  quizResult: QuizResult | null;
  setQuizResult: (res: QuizResult | null) => void;
  finalDiagnosis: FinalDiagnosisResult | null;
  setFinalDiagnosis: (finalDiag: FinalDiagnosisResult | null) => void;
  isRtl: boolean;
  setIsRtl: (rtl: boolean) => void;
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
  toggleTheme: () => void;
  error: string | null;
  setError: (err: string | null) => void;
  rateLimitModalOpen: boolean;
  showRateLimitModal: () => void;
  closeRateLimitModal: () => void;
  resetAll: () => void;
  retryConcept: () => void;

  /* ---- Local-first "My Courses" (موادي) workspace ---- */
  courses: SavedCourse[];
  activeCourseId: string | null;
  isCoursesLoading: boolean;
  refreshCourses: () => Promise<void>;
  /** Persists a freshly analyzed material as a cached course and activates it. */
  saveCourse: (id: string, material: MaterialInput, concepts: Concept[]) => Promise<void>;
  /** Loads a cached course into the canvas with zero AI calls. */
  openCourse: (course: SavedCourse) => void;
  removeCourse: (id: string) => Promise<void>;
  markActiveConceptMastered: (conceptId: string) => Promise<void>;
  /** Flags a comprehension gap so "خريطة المقرر" slots the concept into the review bucket. */
  markActiveConceptGap: (conceptId: string) => Promise<void>;
  /** Marks a concept as picked up but not settled yet (🟡 قيد التثبيت). */
  markActiveConceptInProgress: (conceptId: string) => Promise<void>;
  exportWorkspace: () => Promise<WorkspaceExport>;
  importWorkspace: (payload: unknown) => Promise<number>;

  /* ---- Course Roadmap (خريطة المقرر) ---- */
  /** The active course, resolved from the local workspace. */
  activeCourse: SavedCourse | null;
  /** Caches a freshly built roadmap on the active course. */
  saveActiveRoadmap: (roadmap: CourseRoadmap) => Promise<void>;
  /** Drops the cached roadmap so the setup wizard can run again. */
  resetActiveRoadmap: () => Promise<void>;
  /** Opens a concept's voice-explanation session straight from the roadmap. */
  startConceptSession: (conceptId: string) => void;
  /** Stores the exam sprint the student is currently training for. */
  saveActiveMilestonePlan: (plan: ExamMilestonePlan) => Promise<void>;
  /** Drops the active exam sprint. */
  clearActiveMilestonePlan: () => Promise<void>;

  /* ---- Course-isolated tutor chat (اسأل كواكلي) ---- */
  isChatOpen: boolean;
  /** Concept the chat should explain; null for a free-form question. */
  chatConcept: Concept | null;
  /** Set once by a "اشرحه لي" tap; the drawer consumes it and sends it automatically. */
  pendingChatPrompt: string | null;
  consumePendingChatPrompt: () => void;
  /** Opens the drawer, optionally seeded with a concept explanation request. */
  openCourseChat: (concept?: Concept | null) => void;
  closeCourseChat: () => void;
}

const AppStateContext = createContext<AppState | undefined>(undefined);

export const AppStateProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [step, setStep] = useState<AppStep>('upload');
  const [material, setMaterial] = useState<MaterialInput | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [selectedConcept, setSelectedConcept] = useState<Concept | null>(null);
  const [studentExplanation, setStudentExplanation] = useState('');
  const [confidenceLevel, setConfidenceLevel] = useState(70);
  const [duckState, setDuckState] = useState<DuckState>('idle');
  const [diagnosis, setDiagnosis] = useState<DiagnosisResult | null>(null);
  const [socraticAnswer, setSocraticAnswer] = useState('');
  const [socraticEvaluation, setSocraticEvaluation] = useState<SocraticEvaluation | null>(null);
  const [transferChallenge, setTransferChallenge] = useState<TransferChallenge | null>(null);
  const [transferAnswer, setTransferAnswer] = useState('');
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [quizResult, setQuizResult] = useState<QuizResult | null>(null);
  const [finalDiagnosis, setFinalDiagnosis] = useState<FinalDiagnosisResult | null>(null);
  const [isRtl, setIsRtl] = useState(true);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('rubber_duck_theme');
      if (saved === 'dark' || saved === 'light') return saved;
    }
    // Default to light mode; the toggle lets users switch to dark at any time.
    return 'light';
  });
  const [error, setError] = useState<string | null>(null);
  const [rateLimitModalOpen, setRateLimitModalOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatConcept, setChatConcept] = useState<Concept | null>(null);
  const [pendingChatPrompt, setPendingChatPrompt] = useState<string | null>(null);
  const [courses, setCourses] = useState<SavedCourse[]>([]);
  const [activeCourseId, setActiveCourseId] = useState<string | null>(null);
  const [isCoursesLoading, setIsCoursesLoading] = useState(true);
  const { status: authStatus, user } = useAuth();
  /** Owner stamped on saved courses; null keeps them as guest (local-only) courses. */
  const ownerId = user?.id ?? null;

  React.useEffect(() => {
    if (typeof document !== 'undefined') {
      const root = document.documentElement;
      if (theme === 'dark') {
        root.classList.add('dark');
        root.style.colorScheme = 'dark';
      } else {
        root.classList.remove('dark');
        root.style.colorScheme = 'light';
      }
      try {
        localStorage.setItem('rubber_duck_theme', theme);
      } catch {
        // ignore localStorage access issues
      }
    }
  }, [theme]);

  const refreshCourses = React.useCallback(async () => {
    try {
      setCourses(await courseStore.listCourses(ownerId));
    } catch (err) {
      console.warn('تعذر قراءة مساحة المواد المحلية:', err);
    } finally {
      setIsCoursesLoading(false);
    }
  }, [ownerId]);

  React.useEffect(() => {
    // Wait for the session check so a signed-in student never sees a guest-only list flash by.
    if (authStatus === 'loading') return;
    void (async () => {
      if (ownerId) {
        try {
          await courseStore.claimUnownedCourses(ownerId);
        } catch (err) {
          console.warn('تعذر ربط المواد المحلية بحسابك:', err);
        }
      }
      await refreshCourses();
    })();
  }, [authStatus, ownerId, refreshCourses]);

  const saveCourse = async (id: string, mat: MaterialInput, extracted: Concept[]) => {
    try {
      await courseStore.upsertCourseFromMaterial(id, mat, extracted, ownerId);
      setActiveCourseId(id);
      await refreshCourses();
    } catch (err) {
      console.warn('تعذر حفظ المادة محلياً:', err);
    }
  };

  const openCourse = (course: SavedCourse) => {
    setActiveCourseId(course.id);
    setMaterial(course.material);
    setConcepts(course.concepts);
    setSelectedConcept(null);
    setStudentExplanation('');
    setConfidenceLevel(70);
    setDiagnosis(null);
    setSocraticAnswer('');
    setSocraticEvaluation(null);
    setTransferChallenge(null);
    setTransferAnswer('');
    setQuizQuestions([]);
    setQuizResult(null);
    setFinalDiagnosis(null);
    setError(null);
    setDuckState('encouraging');
    setStep('concepts');
  };

  const removeCourse = async (id: string) => {
    await courseStore.deleteCourse(id);
    if (activeCourseId === id) setActiveCourseId(null);
    await refreshCourses();
  };

  const markActiveConceptMastered = async (conceptId: string) => {
    if (!activeCourseId || !conceptId) return;
    try {
      await courseStore.markConceptMastered(activeCourseId, conceptId);
      await refreshCourses();
    } catch (err) {
      console.warn('تعذر تحديث تقدم المادة:', err);
    }
  };

  const markActiveConceptGap = async (conceptId: string) => {
    if (!activeCourseId || !conceptId) return;
    try {
      await courseStore.markConceptGap(activeCourseId, conceptId);
      await refreshCourses();
    } catch (err) {
      console.warn('تعذر تسجيل الثغرة في خريطة المقرر:', err);
    }
  };

  const markActiveConceptInProgress = async (conceptId: string) => {
    if (!activeCourseId || !conceptId) return;
    try {
      await courseStore.markConceptInProgress(activeCourseId, conceptId);
      await refreshCourses();
    } catch (err) {
      console.warn('تعذر تحديث حالة المفهوم:', err);
    }
  };

  const activeCourse = React.useMemo(
    () => courses.find((course) => course.id === activeCourseId) ?? null,
    [courses, activeCourseId]
  );

  const saveActiveRoadmap = async (roadmap: CourseRoadmap) => {
    if (!activeCourseId) return;
    await courseStore.saveRoadmap(activeCourseId, roadmap);
    await refreshCourses();
  };

  const resetActiveRoadmap = async () => {
    if (!activeCourseId) return;
    await courseStore.clearRoadmap(activeCourseId);
    await refreshCourses();
  };

  const saveActiveMilestonePlan = async (plan: ExamMilestonePlan) => {
    if (!activeCourseId) return;
    await courseStore.saveMilestonePlan(activeCourseId, plan);
    await refreshCourses();
  };

  const clearActiveMilestonePlan = async () => {
    if (!activeCourseId) return;
    await courseStore.clearMilestonePlan(activeCourseId);
    await refreshCourses();
  };

  const openCourseChat = (concept?: Concept | null) => {
    setChatConcept(concept ?? null);
    setPendingChatPrompt(
      concept ? `اشرح لي مفهوم ${concept.name} ببساطة وبأمثلة عملية` : null
    );
    setIsChatOpen(true);
  };

  const closeCourseChat = () => {
    setIsChatOpen(false);
    setPendingChatPrompt(null);
  };

  const consumePendingChatPrompt = () => setPendingChatPrompt(null);

  /** Jumps from a roadmap card straight into the voice-explanation loop for one concept. */
  const startConceptSession = (conceptId: string) => {
    const pool = concepts.length > 0 ? concepts : activeCourse?.concepts ?? [];
    const concept = pool.find((c) => c.id === conceptId);
    if (!concept) return;

    if (concepts.length === 0 && activeCourse) {
      setConcepts(activeCourse.concepts);
      setMaterial(activeCourse.material);
    }

    setSelectedConcept(concept);
    setStudentExplanation('');
    setConfidenceLevel(70);
    setDiagnosis(null);
    setSocraticAnswer('');
    setSocraticEvaluation(null);
    setTransferChallenge(null);
    setTransferAnswer('');
    setQuizQuestions([]);
    setQuizResult(null);
    setFinalDiagnosis(null);
    setError(null);
    setDuckState('listening');
    void markActiveConceptInProgress(conceptId);
    setIsChatOpen(false);
    setStep('teach');
  };

  const exportWorkspace = () => courseStore.exportWorkspace(ownerId);

  const importWorkspace = async (payload: unknown) => {
    const count = await courseStore.importWorkspace(payload, ownerId);
    await refreshCourses();
    return count;
  };

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  const showRateLimitModal = () => {
    setIsAnalyzing(false);
    setRateLimitModalOpen(true);
  };

  const closeRateLimitModal = () => {
    setRateLimitModalOpen(false);
  };

  const resetAll = () => {
    setStep('upload');
    setMaterial(null);
    setIsAnalyzing(false);
    setConcepts([]);
    setSelectedConcept(null);
    setStudentExplanation('');
    setConfidenceLevel(70);
    setDuckState('idle');
    setDiagnosis(null);
    setSocraticAnswer('');
    setSocraticEvaluation(null);
    setTransferChallenge(null);
    setTransferAnswer('');
    setQuizQuestions([]);
    setQuizResult(null);
    setFinalDiagnosis(null);
    setError(null);
    setRateLimitModalOpen(false);
    setActiveCourseId(null);
  };

  const retryConcept = () => {
    setStep('concepts');
    setStudentExplanation('');
    setConfidenceLevel(70);
    setDuckState('idle');
    setDiagnosis(null);
    setSocraticAnswer('');
    setSocraticEvaluation(null);
    setTransferChallenge(null);
    setTransferAnswer('');
    setQuizQuestions([]);
    setQuizResult(null);
    setFinalDiagnosis(null);
    setError(null);
    setRateLimitModalOpen(false);
  };

  return (
    <AppStateContext.Provider
      value={{
        step,
        setStep,
        material,
        setMaterial,
        isAnalyzing,
        setIsAnalyzing,
        concepts,
        setConcepts,
        selectedConcept,
        setSelectedConcept,
        studentExplanation,
        setStudentExplanation,
        confidenceLevel,
        setConfidenceLevel,
        duckState,
        setDuckState,
        diagnosis,
        setDiagnosis,
        socraticAnswer,
        setSocraticAnswer,
        socraticEvaluation,
        setSocraticEvaluation,
        transferChallenge,
        setTransferChallenge,
        transferAnswer,
        setTransferAnswer,
        quizQuestions,
        setQuizQuestions,
        quizResult,
        setQuizResult,
        finalDiagnosis,
        setFinalDiagnosis,
        isRtl,
        setIsRtl,
        theme,
        setTheme,
        toggleTheme,
        error,
        setError,
        rateLimitModalOpen,
        showRateLimitModal,
        closeRateLimitModal,
        resetAll,
        retryConcept,
        courses,
        activeCourseId,
        isCoursesLoading,
        refreshCourses,
        saveCourse,
        openCourse,
        removeCourse,
        markActiveConceptMastered,
        markActiveConceptGap,
        markActiveConceptInProgress,
        exportWorkspace,
        importWorkspace,
        activeCourse,
        saveActiveRoadmap,
        resetActiveRoadmap,
        startConceptSession,
        saveActiveMilestonePlan,
        clearActiveMilestonePlan,
        isChatOpen,
        chatConcept,
        pendingChatPrompt,
        consumePendingChatPrompt,
        openCourseChat,
        closeCourseChat,
      }}
    >
      {children}
    </AppStateContext.Provider>
  );
};

export const useAppState = () => {
  const context = useContext(AppStateContext);
  if (!context) {
    throw new Error('useAppState must be used within an AppStateProvider');
  }
  return context;
};
