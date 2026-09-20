export type DuckState = 
  | 'idle'
  | 'listening'
  | 'thinking'
  | 'quizzical'
  | 'surprised'
  | 'encouraging'
  | 'proud'
  | 'diagnostic';

export type ConfidenceGapType = 'overconfident' | 'underconfident' | 'calibrated';

export interface Concept {
  id: string;
  name: string;
  summary: string;
  keyPrinciples: string[];
  difficulty: 'basic' | 'intermediate' | 'advanced';
  chapterOrUnit?: string;
  coreFocus?: string;
}

export interface MaterialInput {
  fileName: string;
  fileSize: number;
  fileType: string;
  rawText?: string;
  base64Data?: string;
  mimeType?: string;
}

export interface DiagnosisResult {
  statedConfidence: number; // 0 - 100
  understandingScore: number; // 0 - 100
  gapScore: number; // Difference
  gapType: ConfidenceGapType;
  gapDescription: string;
  identifiedFlaws: string[];
  strengths: string[];
  socraticQuestion: string;
  socraticHint?: string;
}

export interface SocraticEvaluation {
  socraticAnswer: string;
  reasoningQualityScore: number; // 0 - 100
  improvedUnderstanding: boolean;
  duckReaction: string;
}

export interface TransferChallenge {
  scenario: string;
  task: string;
  hints: string[];
}

export interface FinalDiagnosisResult {
  masteryScore: number; // 0 - 100
  gapResolved: boolean;
  duckVerdict: string;
  duckMood: DuckState;
  detailedAnalysis: {
    initialConfidence: number;
    initialUnderstanding: number;
    finalMastery: number;
    keyLearnings: string[];
    remainingGaps: string[];
  };
}

export interface QuizQuestion {
  id: number;
  question: string;
  options: string[];
  correctAnswerIndex: number;
  explanation: string;
  difficulty: string; // 'بسيط' | 'متوسط' | 'متقدم'
}

export interface QuizResult {
  score: number;
  totalQuestions: number;
  userAnswers: number[];
}

export interface SlideItem {
  slideNumber: number;
  title: string;
  bulletPoints: string[];
  duckTip: string;
}

export interface SlidePresentation {
  presentationTitle: string;
  slides: SlideItem[];
}

export interface PlannerTask {
  subject: string;
  action: string; // مذاكرة | مراجعة | تطبيق عملي
  topic: string;
  durationMinutes: number;
}

export interface PlannerDay {
  day: string; // e.g. الإثنين
  date?: string; // YYYY-MM-DD
  tasks: PlannerTask[];
  quizPrepNotice?: string;
  examMilestoneNotice?: string;
}

export interface TermPlanResponse {
  courseName?: string;
  weeklyPlan: PlannerDay[];
  studyTips?: string[];
  dateWarning?: string;
}

export interface ProjectReviewResponse {
  score: number; // 0-100
  summary: string;
  strengths: string[];
  gaps: string[];
  bestPractices: string[];
  improvedCodeSnippet: string;
}

export interface CodeLabProject {
  difficulty: 'Easy' | 'Intermediate' | 'Advanced';
  title: string;
  description: string;
  keyRequirements: string[];
}

export interface CodeLabResponse {
  type: 'code_lab';
  projects: CodeLabProject[];
}

export interface BugChallenge {
  title: string;
  language: string;
  difficulty: string;
  expectedBehavior: string;
  buggyCode: string;
  totalBugsCount: number;
}

export interface BugChallengeResponse {
  type: 'debugging_challenge';
  challenge: BugChallenge;
}

export interface BugEvaluationResponse {
  score: number;
  summary: string;
  identifiedBugs: string[];
  missedBugs: string[];
  correctedCode: string;
}

export type AppStep = 
  | 'upload'
  | 'concepts'
  | 'teach'
  | 'diagnosis'
  | 'socratic'
  | 'transfer'
  | 'quiz'
  | 'final'
  | 'planner'
  | 'projectLab'
  | 'bugLab';

export interface ChatMessage {
  id: string;
  sender: 'duck' | 'student';
  text: string;
  timestamp: Date;
  audioUrl?: string;
}
