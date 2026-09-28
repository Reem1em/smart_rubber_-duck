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

/**
 * A single uploaded chapter / slide-deck / supplemental file inside a multi-file course.
 * Keyed by the SHA-256 of the file content so re-uploads are cache-hits.
 */
export interface CourseFile {
  /** SHA-256 of the file content — used as both cache key and dedup guard. */
  id: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  uploadedAt: number;
  /** Number of concepts extracted from this specific file. */
  conceptsCount: number;
  /** Status of extraction for this file. */
  status: 'processing' | 'ready' | 'error';
}

/** A course workspace cached locally in IndexedDB, keyed by content hash. */
export interface SavedCourse {
  id: string; // SHA-256 of the source document / pasted text
  title: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  concepts: Concept[];
  material: MaterialInput;
  createdAt: number;
  updatedAt: number;
  masteredConceptIds: string[];
  /** Concepts whose verbal explanation exposed a comprehension gap (🔴 ثغرة مرصودة). */
  gapConceptIds?: string[];
  /** Concepts already opened for explanation but not mastered yet (🟡 قيد التثبيت). */
  inProgressConceptIds?: string[];
  /** Cached "خريطة المقرر" so a syllabus is parsed exactly once. */
  roadmap?: CourseRoadmap;
  /** The exam the student is currently sprinting toward, with its day-by-day plan. */
  activeMilestonePlan?: ExamMilestonePlan;
  /** Google `sub` of the signed-in owner; absent for guest (local-only) courses. */
  ownerId?: string;
  /**
   * Multi-file chapter repository. Each entry tracks one uploaded file.
   * Absent on legacy single-file courses (treated as empty array).
   */
  files?: CourseFile[];
}

/** Signed-in student profile returned by POST /api/auth/google. */
export interface AuthUser {
  id: string;
  email: string;
  name: string;
  /** Google `given_name`; falls back to the first word of `name`. */
  firstName: string;
  avatar: string | null;
}

/** Daily AI token balance for the current caller. */
export interface QuotaInfo {
  limit: number;
  used: number;
  remaining: number;
  resetsAt?: string;
}

export interface WorkspaceExport {
  version: number;
  exportedAt: string;
  courses: SavedCourse[];
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

/* ---- Course Roadmap (خريطة المقرر) ---- */

/** Mode A parses an official syllabus; Mode B schedules the extracted concepts locally. */
export type RoadmapSource = 'syllabus' | 'auto';

/** Mastery badge shown on every roadmap concept chip. */
export type ConceptStatus = 'not-started' | 'in-progress' | 'gap' | 'mastered';

/** Which Quakly station today's sprint should open for a concept. */
export type SprintActivity = 'voice' | 'bugHunt';

export interface RoadmapConceptRef {
  /** Resolved id of the matching extracted concept, or null when the syllabus names an unextracted topic. */
  conceptId: string | null;
  name: string;
  /** Carries a major exam weight — surfaced with a priority flag. */
  highYield: boolean;
  activity: SprintActivity;
}

export interface RoadmapWeek {
  weekNumber: number;
  title: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  concepts: RoadmapConceptRef[];
  /** Consolidation week: no new material, only re-explaining flagged gaps. */
  isReviewWeek: boolean;
}

export type MilestoneKind = 'midterm' | 'final' | 'quiz' | 'project';

export interface RoadmapMilestone {
  id: string;
  title: string;
  kind: MilestoneKind;
  weekNumber: number;
  date: string; // YYYY-MM-DD
  /** Percentage of the final grade; 0 when the syllabus does not state one. */
  gradeWeight: number;
  coversWeeks: number[];
  highYield: boolean;
}

export interface CourseRoadmap {
  courseId: string;
  courseName: string;
  source: RoadmapSource;
  startDate: string; // YYYY-MM-DD of academic week 1
  totalWeeks: number;
  weeklyHours: number;
  weeks: RoadmapWeek[];
  milestones: RoadmapMilestone[];
  duckNote: string;
  createdAt: number;
}

/* ---- Exam & Quiz Milestone Planner ---- */

/** Verbal-explanation sessions the student commits to per day. */
export type MilestoneIntensity = 1 | 2;

/**
 * study  — new concepts to explain aloud.
 * rest   — spacing day: consolidate, no new material.
 * buffer — the reserved tail: "ماراثون صيد الأخطاء والمراجعة الشاملة".
 */
export type MilestoneDayKind = 'study' | 'rest' | 'buffer';

export interface MilestoneDayPlan {
  /** 1-based day of the sprint. */
  dayIndex: number;
  date: string; // YYYY-MM-DD
  kind: MilestoneDayKind;
  concepts: RoadmapConceptRef[];
}

export interface ExamMilestonePlan {
  id: string;
  title: string;
  kind: MilestoneKind;
  examDate: string; // YYYY-MM-DD
  /** Chapter/unit labels the exam covers, as shown in the picker. */
  chapters: string[];
  intensity: MilestoneIntensity;
  /** Every concept inside the selected coverage scope. */
  conceptIds: string[];
  days: MilestoneDayPlan[];
  /** Duck's comment on the resulting pace versus the requested intensity. */
  paceNote?: string;
  /** True when the exam date forces more sessions per day than the student asked for. */
  isOverloaded: boolean;
  createdAt: number;
}

/** Raw syllabus extraction returned by the AI pipeline, before local normalization. */
export interface ParsedSyllabus {
  courseName?: string;
  startDate?: string;
  totalWeeks?: number;
  weeks?: Array<{
    weekNumber?: number;
    title?: string;
    concepts?: string[];
    highYield?: boolean;
    isReviewWeek?: boolean;
  }>;
  milestones?: Array<{
    title?: string;
    kind?: string;
    weekNumber?: number;
    date?: string;
    gradeWeight?: number;
    coversWeeks?: number[];
  }>;
  duckNote?: string;
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

/* ---- Unified Code Lab (معمل البرمجة) dual-mode workspace ---- */

export type DevLabMode = 'builder' | 'bugHunter';
export type DevLabLevel = 'Beginner' | 'Intermediate' | 'Advanced';
export type DevMastery = 'needs-work' | 'competent' | 'mastered';

export interface DevChallenge {
  mode: DevLabMode;
  title: string;
  language: string;
  level: string;
  businessContext: string;
  requirements?: string[];
  sampleIO?: string[];
  edgeCases: string[];
  expectedBehavior?: string;
  /** Present in bugHunter mode only: the snippet carrying exactly one defect. */
  buggyCode?: string;
  bugCategory?: string;
  voicePrompt: string;
}

export interface DevEvaluation {
  score: number;
  verdict: string;
  whatWorked: string[];
  flaws: string[];
  edgeCaseResilience: string[];
  codeQuality: string[];
  improvedCode: string;
  mastery: DevMastery;
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
  | 'courses'
  | 'concepts'
  | 'teach'
  | 'diagnosis'
  | 'socratic'
  | 'transfer'
  | 'quiz'
  | 'final'
  | 'roadmap'
  | 'codeLab';

/* ---- Course-isolated AI tutor chat (اسأل كواكلي) ---- */

export interface CourseChatMessage {
  id: string;
  role: 'student' | 'duck';
  text: string;
  createdAt: number;
  /** Concept this turn is about, so the bubble can offer the voice hand-off. */
  conceptId?: string;
  conceptName?: string;
  /** True when the reply came from the offline fallback rather than the model. */
  degraded?: boolean;
}

/** One course's chat transcript, stored under its own IndexedDB key. */
export interface CourseChatThread {
  courseId: string;
  messages: CourseChatMessage[];
  updatedAt: number;
}

export interface ChatMessage {
  id: string;
  sender: 'duck' | 'student';
  text: string;
  timestamp: Date;
  audioUrl?: string;
}
