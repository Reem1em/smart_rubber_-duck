import React, { createContext, useContext, useState } from 'react';
import {
  AppStep,
  Concept,
  DiagnosisResult,
  DuckState,
  FinalDiagnosisResult,
  MaterialInput,
  QuizQuestion,
  QuizResult,
  SocraticEvaluation,
  TransferChallenge,
} from '../types';

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
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        return 'dark';
      }
    }
    return 'light';
  });
  const [error, setError] = useState<string | null>(null);
  const [rateLimitModalOpen, setRateLimitModalOpen] = useState(false);

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
