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
  /**
   * Extracted slide text, one entry per source file (primary material + each chapter).
   * Absent on courses created before slide extraction existed.
   */
  slideSources?: SlideSource[];
}

/** One retrievable piece of a slide. Long slides become several parts; nothing is dropped. */
export interface SlideChunk {
  /** `${sourceId}#s${slideIndex}p${part}` — unique within the course. */
  id: string;
  /** Page/slide number in the file (1-based). */
  slideIndex: number;
  /** 1-based part within the slide. */
  part: number;
  /** Total parts for this slide; siblings share `slideIndex`. */
  partCount: number;
  /** Slide title as printed (repeated on every part). */
  heading: string;
  /** Near-verbatim slide text for this part. */
  text: string;
  /** Text rendering of readable labels / tables / diagram relations (part 1 only). */
  visual?: string;
  /** Bilingual key terms (original language + Arabic), shared by all parts. */
  keywords: string[];
  /** Linked concept ids (validated against the course), shared by all parts. */
  conceptIds: string[];
  /** The model flagged unreadable content on this slide. */
  incomplete?: boolean;
}

export type SlideSourceStatus = 'ready' | 'partial' | 'failed' | 'unsupported';

export interface SlideSource {
  /** CourseFile.id, or the course id for the primary material. */
  sourceId: string;
  fileName: string;
  /** 'partial' when any slide is incomplete or the document was not fully transcribed. */
  status: SlideSourceStatus;
  chunks: SlideChunk[];
  /** Slides actually transcribed. */
  slideCount: number;
  /** Slides with unreadable parts. */
  incompleteSlides: number[];
  /** Set when transcription stopped before the end of the document. */
  truncatedAfterSlide?: number;
  extractedAt: number;
  /** Student-safe Arabic reason for partial / failed / unsupported. */
  error?: string;
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
  /** `null` = unrated: grading was skipped because the evaluator was unavailable. */
  understandingScore: number | null; // 0 - 100
  gapScore: number | null; // Difference
  gapType: ConfidenceGapType | null;
  gapDescription: string;
  identifiedFlaws: string[];
  strengths: string[];
  socraticQuestion: string;
  socraticHint?: string;
}

export interface SocraticEvaluation {
  socraticAnswer: string;
  reasoningQualityScore: number | null; // 0 - 100, null = unrated
  improvedUnderstanding: boolean;
  duckReaction: string;
  /** "أين أصبت": points the student articulated correctly. */
  correctPoints: string[];
  /** "أين أخطأت / الفجوات المفاهيمية": missing or flawed logic. */
  conceptualGaps: string[];
}

/**
 * Sent with every concept-session AI call so the server confines the model to one course
 * and never mixes subjects (e.g. matrices inside a programming course).
 */
export interface CourseScope {
  courseId: string;
  courseTitle: string;
  conceptNames: string[];
}

export interface TransferChallenge {
  scenario: string;
  task: string;
  hints: string[];
}

export interface FinalDiagnosisResult {
  masteryScore: number | null; // 0 - 100, null = unrated
  gapResolved: boolean;
  duckVerdict: string;
  duckMood: DuckState;
  detailedAnalysis: {
    initialConfidence: number;
    initialUnderstanding: number | null;
    finalMastery: number | null;
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
  /** One short sentence per option: why that option is correct or incorrect (same order as `options`). */
  optionNotes?: string[];
}

export interface QuizResult {
  score: number;
  totalQuestions: number;
  userAnswers: number[];
}

/**
 * Instant multiple-choice feedback, computed on the client with no model call:
 * the verdict follows `correctAnswerIndex`; the explanation is 1–2 sentences.
 */
export interface QuizAnswerEvaluation {
  status: 'correct' | 'incorrect';
  explanation: string;
}

/** One turn in the per-question discussion thread. */
export interface QuizDiscussionMessage {
  id: string;
  role: 'student' | 'tutor';
  text: string;
  timestamp: number;
}

/**
 * Lifecycle state for a single quiz question.
 * - ready_for_answer   : question shown, waiting for selection
 * - feedback_available : instant verdict shown; student reads feedback
 * - discussion_active  : student is typing a follow-up
 * - ready_for_next     : student explicitly ready to advance
 */
export type QuizQuestionState =
  | 'ready_for_answer'
  | 'feedback_available'
  | 'discussion_active'
  | 'ready_for_next';

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
  score: number | null; // 0-100, null = unrated
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

export type DevLabMode = 'builder' | 'bugHunter' | 'customLab';
export type DevLabLevel = 'Beginner' | 'Intermediate' | 'Advanced';
export type DevMastery = 'needs-work' | 'competent' | 'mastered';

/* ---- Custom Lab Assignment (مسألة من الملزمة / كود مخصص) ---- */

export interface CustomLabTestCase {
  input: string;
  expectedOutput: string;
}

export interface CustomLabTestResult {
  testIndex: number;
  input: string;
  expectedOutput: string;
  actualOutput: string;
  passed: boolean;
}

export interface CustomLabEvaluation {
  testResults: CustomLabTestResult[];
  allPassed: boolean;
  /** Set when the judge was unreachable and the server served its static fallback. */
  unverified?: boolean;
  rootCauseAnalysis: string;
  constraintNotes: string[];
  hint: string;
  edgeCaseChallenge: string;
}

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
  /** `null` = unrated: grading was skipped because the evaluator was unavailable. */
  score: number | null;
  verdict: string;
  whatWorked: string[];
  flaws: string[];
  edgeCaseResilience: string[];
  codeQuality: string[];
  improvedCode: string;
  mastery: DevMastery | null;
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
  score: number | null; // null = unrated
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
