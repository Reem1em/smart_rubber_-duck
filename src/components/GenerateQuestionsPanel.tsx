import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  Sparkles,
  Upload,
  Check,
  BookOpen,
  AlertCircle,
  Target,
  Brain,
  Flame,
  Save,
  Play,
  ChevronLeft,
  ChevronRight,
  X,
  FileText,
  GraduationCap,
  RotateCcw,
  Loader2,
  ChevronDown,
  ChevronUp,
  Info,
  PlusCircle,
  MinusCircle,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

type GenStep = 'upload' | 'difficulty' | 'topics' | 'results';
type Difficulty = '100' | '80' | '120';
type QuestionSource = 'exam' | 'textbook' | 'synthesized';
type QuestionDifficulty = 'easy' | 'medium' | 'advanced';

interface MockCourse {
  id: string;
  title: string;
  chapter: string;
}

interface Topic {
  id: string;
  name: string;
  examPercent: number;
  mastery: number | null; // null = no history
  coverageQuality: 'good' | 'limited';
  included: boolean;
  questionCount: number;
  difficultyOverride?: Difficulty;
}

interface GeneratedQuestion {
  id: string;
  topicId: string;
  topicName: string;
  text: string;
  answer?: string;
  difficulty: QuestionDifficulty;
  source: QuestionSource;
  sourceLabel: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// MOCK DATA
// ─────────────────────────────────────────────────────────────────────────────

const MOCK_COURSES: MockCourse[] = [
  { id: 'bio', title: 'الأحياء الجزيئية', chapter: 'الفصل الثالث: التعبير الجيني' },
  { id: 'chem', title: 'الكيمياء العضوية', chapter: 'الفصل الثاني: التفاعلات العضوية' },
  { id: 'cs', title: 'مقدمة في البرمجة', chapter: 'الفصل الرابع: البرمجة كائنية التوجه' },
  { id: 'phys', title: 'الفيزياء الحيوية', chapter: 'الفصل الأول: الديناميكا الحرارية الحيوية' },
];

const MOCK_TOPICS_BY_COURSE: Record<string, Topic[]> = {
  bio: [
    { id: 'gene-expr', name: 'التعبير الجيني', examPercent: 30, mastery: 72, coverageQuality: 'good', included: true, questionCount: 6 },
    { id: 'mol-bio', name: 'البيولوجيا الجزيئية', examPercent: 25, mastery: 38, coverageQuality: 'good', included: true, questionCount: 5 },
    { id: 'cell-bio', name: 'علم الأحياء الخلوي', examPercent: 20, mastery: 55, coverageQuality: 'good', included: true, questionCount: 4 },
    { id: 'genetics', name: 'علم الوراثة', examPercent: 15, mastery: 80, coverageQuality: 'good', included: true, questionCount: 3 },
    { id: 'pharma', name: 'علم الأدوية الجزيئي', examPercent: 10, mastery: null, coverageQuality: 'limited', included: true, questionCount: 2 },
  ],
  chem: [
    { id: 'org-react', name: 'التفاعلات الكيميائية العضوية', examPercent: 35, mastery: 45, coverageQuality: 'good', included: true, questionCount: 7 },
    { id: 'org-chem', name: 'الكيمياء العضوية', examPercent: 30, mastery: 33, coverageQuality: 'good', included: true, questionCount: 6 },
    { id: 'stereo', name: 'الكيمياء الفراغية', examPercent: 20, mastery: 60, coverageQuality: 'limited', included: true, questionCount: 4 },
    { id: 'spectro', name: 'التحليل الطيفي', examPercent: 15, mastery: null, coverageQuality: 'limited', included: true, questionCount: 3 },
  ],
  cs: [
    { id: 'oop', name: 'برمجة الكائنات', examPercent: 35, mastery: 30, coverageQuality: 'good', included: true, questionCount: 7 },
    { id: 'algo', name: 'التشفير الخوارزمي', examPercent: 25, mastery: 28, coverageQuality: 'good', included: true, questionCount: 5 },
    { id: 'ds', name: 'هياكل البيانات', examPercent: 25, mastery: 65, coverageQuality: 'good', included: true, questionCount: 5 },
    { id: 'net', name: 'بروتوكولات الشبكات', examPercent: 15, mastery: null, coverageQuality: 'limited', included: true, questionCount: 3 },
  ],
  phys: [
    { id: 'thermo', name: 'الديناميكا الحرارية الحيوية', examPercent: 40, mastery: 70, coverageQuality: 'good', included: true, questionCount: 8 },
    { id: 'bioelec', name: 'الكهرباء الحيوية', examPercent: 30, mastery: 50, coverageQuality: 'good', included: true, questionCount: 6 },
    { id: 'biomech', name: 'الميكانيكا الحيوية', examPercent: 30, mastery: null, coverageQuality: 'limited', included: true, questionCount: 6 },
  ],
};

const WEAK_TOPICS: Record<string, string[]> = {
  bio: ['mol-bio', 'cell-bio', 'pharma'],
  chem: ['org-chem', 'org-react', 'stereo'],
  cs: ['oop', 'algo', 'net'],
  phys: ['bioelec', 'biomech', 'thermo'],
};

const MOCK_QUESTIONS: Record<string, GeneratedQuestion[]> = {
  bio: [
    {
      id: 'q1', topicId: 'gene-expr', topicName: 'التعبير الجيني',
      text: 'ما هي المراحل الرئيسية لعملية التعبير الجيني في الخلية حقيقية النواة؟',
      answer: 'تشمل المراحل: الاستنساخ (Transcription) حيث يُنسَخ الحمض النووي DNA إلى mRNA، ثم المعالجة ما بعد النسخ (Post-transcriptional processing) كإزالة الإنترونات وإضافة الغطاء والذيل، وأخيراً الترجمة (Translation) حيث يُترجم mRNA إلى بروتين بواسطة الريبوسومات.',
      difficulty: 'easy', source: 'exam', sourceLabel: 'من نموذجك',
    },
    {
      id: 'q2', topicId: 'mol-bio', topicName: 'البيولوجيا الجزيئية',
      text: 'تتكون الـ DNA من قواعد نيتروجينية — اشرح قاعدة التكامل بين الأزواج: A-T وG-C، وما أهمية روابط الهيدروجين (H-bonds) في استقرار الحلزون المزدوج؟',
      answer: 'الأدينين (A) يرتبط بالثايمين (T) بـ رابطتين هيدروجينيتين، والغوانين (G) يرتبط بالسيتوزين (C) بـ 3 روابط هيدروجينية. هذا التكامل الدقيق يضمن نسخاً أميناً للمعلومات الوراثية ويمنح الحلزون استقراراً حرارياً.',
      difficulty: 'medium', source: 'textbook', sourceLabel: 'من الكتاب — الفصل الثالث',
    },
    {
      id: 'q3', topicId: 'cell-bio', topicName: 'علم الأحياء الخلوي',
      text: 'ما هي الوظيفة الرئيسية للميتوكندريا في الخلية؟ وكيف تؤثر طفرات جينوم الميتوكندريا على إنتاج ATP؟',
      answer: 'الميتوكندريا هي "مصنع الطاقة" للخلية؛ تُنتج ATP عبر سلسلة نقل الإلكترونات والفسفرة التأكسدية. طفرات الجينوم الميتوكندري تُضعف بروتينات الوحدات الفرعية لسلسلة نقل الإلكترونات، مما يقلل كفاءة إنتاج ATP ويسبب أمراضاً وراثية ميتوكوندرية.',
      difficulty: 'medium', source: 'synthesized', sourceLabel: 'مولّد — داخل نطاق المقرر',
    },
    {
      id: 'q4', topicId: 'genetics', topicName: 'علم الوراثة',
      text: 'يعاني مريض من نقص إنزيم فينيل ألانين هيدروكسيلاز. باستخدام مبادئ الوراثة المندلية، حدد نمط توارث هذه الصفة واحسب احتمال إصابة ذريته إذا كان شريكه حاملاً للمرض.',
      answer: 'المرض وراثي جسمي متنحٍّ (Autosomal Recessive). إذا كان المريض (aa) والشريك حاملاً (Aa)، فنسبة الذرية المصابة 50% (Aa × aa → 50% Aa + 50% aa).',
      difficulty: 'advanced', source: 'exam', sourceLabel: 'من نموذجك',
    },
    {
      id: 'q5', topicId: 'mol-bio', topicName: 'البيولوجيا الجزيئية',
      text: 'حلّل آلية عمل تقنية CRISPR-Cas9 في تحرير الجينوم، وناقش الإشكاليات الأخلاقية المرتبطة باستخدامها في تعديل الخلايا الجرثومية البشرية.',
      answer: 'تعتمد CRISPR-Cas9 على إرشاد RNA (gRNA) يتوافق مع التسلسل المستهدف، ثم يقوم البروتين Cas9 بقطع الخيطين مزدوجي الحلزون. الإشكاليات الأخلاقية: التعديلات تنتقل للأجيال، خطر الاستخدام لتحسين الجنس البشري (Eugenics)، والتأثيرات خارج الهدف غير المقصودة.',
      difficulty: 'advanced', source: 'synthesized', sourceLabel: 'مولّد — داخل نطاق المقرر',
    },
    {
      id: 'q6', topicId: 'pharma', topicName: 'علم الأدوية الجزيئي',
      text: 'ما الفرق بين الدواء المثبط التنافسي والدواء المثبط غير التنافسي من حيث التأثير على ثابت ميكاليس (Km) وأقصى سرعة تفاعلية (Vmax)؟',
      answer: 'المثبط التنافسي: يرفع Km (تقل الألفة الظاهرية للركيزة) لكن Vmax لا يتغير. المثبط غير التنافسي: يُبقي Km ثابتاً لكنه يخفض Vmax.',
      difficulty: 'medium', source: 'textbook', sourceLabel: 'من الكتاب — الفصل الثالث',
    },
    {
      id: 'q7', topicId: 'gene-expr', topicName: 'التعبير الجيني',
      text: 'اشرح دور RNA البادئ (Promoter) في تنظيم التعبير الجيني، مع ذكر مثال على عامل نسخ (Transcription Factor) وآليته.',
      answer: 'البادئ هو تسلسل DNA يرتبط به إنزيم RNA بوليميراز ليبدأ الاستنساخ. مثال: عامل NF-κB يرتبط بمناطق بادئة محددة عند الاستجابة للإشارات الالتهابية، فيُنشّط جينات الاستجابة المناعية.',
      difficulty: 'medium', source: 'exam', sourceLabel: 'من نموذجك',
    },
  ],
  cs: [
    {
      id: 'q1', topicId: 'oop', topicName: 'برمجة الكائنات',
      text: 'ما هي مبادئ SOLID في تصميم البرمجيات الكائنية؟ اشرح مبدأ المسؤولية الواحدة (Single Responsibility Principle) مع مثال عملي.',
      answer: 'SOLID: مبدأ المسؤولية الواحدة، مبدأ المفتوح/المغلق، مبدأ Liskov للإحلال، مبدأ فصل الواجهات، مبدأ انعكاس الاعتماديات. مبدأ المسؤولية الواحدة: كل فئة يجب أن تمتلك سبباً وحيداً للتغيير. مثال: فئة User تدير بيانات المستخدم فقط، وفئة منفصلة UserRepository تدير حفظ البيانات.',
      difficulty: 'medium', source: 'exam', sourceLabel: 'من نموذجك',
    },
    {
      id: 'q2', topicId: 'algo', topicName: 'التشفير الخوارزمي',
      text: 'اشرح كيف تحافظ بروتوكولات الشبكة (مثل TLS/SSL) على أمان البيانات أثناء النقل، مع توضيح دور التشفير غير المتماثل (Asymmetric Encryption).',
      answer: 'TLS يستخدم مصافحة (Handshake) بالتشفير غير المتماثل لتبادل المفاتيح الجلسية بأمان، ثم يتحول للتشفير المتماثل للسرعة. المفتاح العام للخادم (من الشهادة الرقمية) يشفر الرسالة، والمفتاح الخاص يفك التشفير.',
      difficulty: 'medium', source: 'textbook', sourceLabel: 'من الكتاب — الفصل الرابع',
    },
    {
      id: 'q3', topicId: 'ds', topicName: 'هياكل البيانات',
      text: 'قارن بين خوارزميتي الفرز Quick Sort و Merge Sort من حيث: التعقيد الزمني في أسوأ حالة، واستخدام الذاكرة، وملاءمة كل منهما للبيانات الكبيرة.',
      answer: 'Quick Sort: أسوأ حالة O(n²) عند الاختيار السيئ للمحور، ذاكرة O(log n). Merge Sort: دائماً O(n log n)، ذاكرة O(n) لكنه مستقر (Stable). للبيانات الكبيرة: Merge Sort أكثر موثوقية في الأداء.',
      difficulty: 'medium', source: 'exam', sourceLabel: 'من نموذجك',
    },
    {
      id: 'q4', topicId: 'oop', topicName: 'برمجة الكائنات',
      text: 'طوّر نظام حجز مختبر جامعي باستخدام نمط التصميم Observer Pattern. اشرح كيف تُخطر الطلاب المشتركين عند توفر جهاز جديد، مع رسم مخطط UML مبسّط.',
      answer: 'الواجهة Observer تحوي دالة update(). الفئة Lab (Subject) تحتفظ بقائمة المراقبين. عند إضافة جهاز، يُستدعى notifyAll() الذي يُنادي update() لكل طالب مشترك. UML: Lab→[list of Students]→Student.update().',
      difficulty: 'advanced', source: 'synthesized', sourceLabel: 'مولّد — داخل نطاق المقرر',
    },
    {
      id: 'q5', topicId: 'net', topicName: 'بروتوكولات الشبكات',
      text: 'ما الفرق بين بروتوكول TCP وUDP؟ ومتى يُفضَّل استخدام كل منهما في تطبيقات الشبكات؟',
      answer: 'TCP: موثوق، متسلسل، يضمن التسليم عبر آلية Acknowledgment. UDP: سريع، بدون اتصال مسبق، لا يضمن التسليم. TCP: تطبيقات البنك والبريد. UDP: بث الفيديو والألعاب حيث التأخير أشد ضرراً من فقدان الحزمة.',
      difficulty: 'easy', source: 'textbook', sourceLabel: 'من الكتاب — الفصل الرابع',
    },
    {
      id: 'q6', topicId: 'algo', topicName: 'التشفير الخوارزمي',
      text: 'تحليل تعقيد: إذا كانت خوارزمية تبحث في قائمة مرتبة بحجم n=1024 باستخدام Binary Search، كم خطوة مقارنة (comparisons) تحتاج في أسوأ حالة؟',
      answer: 'Binary Search: أسوأ حالة = log₂(n) = log₂(1024) = 10 مقارنات. كل خطوة تُنصّف المجال.',
      difficulty: 'easy', source: 'exam', sourceLabel: 'من نموذجك',
    },
  ],
  chem: [
    {
      id: 'q1', topicId: 'org-react', topicName: 'التفاعلات الكيميائية العضوية',
      text: 'اكتب معادلة تفاعل الإضافة الكهربية لـ HBr مع البروبين (CH₃-CH=CH₂)، وحدد المنتج الرئيسي مستخدماً قاعدة ماركوفنيكوف.',
      answer: 'CH₃-CH=CH₂ + HBr → CH₃-CHBr-CH₃ (2-بروموبروبان). وفق ماركوفنيكوف: الـ H يتصل بكربون غني بالهيدروجين والـ Br بكربون الكربوكاتيون الأكثر استقراراً.',
      difficulty: 'medium', source: 'exam', sourceLabel: 'من نموذجك',
    },
    {
      id: 'q2', topicId: 'org-chem', topicName: 'الكيمياء العضوية',
      text: 'حلّل حالة مريض يعاني من تسمم بالميثانول (CH₃OH). اقترح آلية علاجية مبنية على مبادئ الكيمياء العضوية الحيوية.',
      answer: 'الميثانول يُؤكسد إلى فورمالديهيد ثم حمض الفورميك (السامَّين) بواسطة إنزيم كحول ديهيدروجيناز. العلاج: إعطاء الإيثانول تنافسياً ليزاحم الميثانول على الإنزيم، أو Fomepizole كمثبط مباشر. مع غسيل الكلى لتسريع إخراج الميثانول.',
      difficulty: 'advanced', source: 'synthesized', sourceLabel: 'مولّد — داخل نطاق المقرر',
    },
    {
      id: 'q3', topicId: 'stereo', topicName: 'الكيمياء الفراغية',
      text: 'ما الفرق بين الأيزومرات المرآتية (Enantiomers) والديأيزومرات (Diastereomers)؟ أعطِ مثالاً لكل منهما.',
      answer: 'الأيزومرات المرآتية: صور مرآتية متطابقة لا تنطبق على بعضها (مثل L-ألانين وD-ألانين). الديأيزومرات: أيزومرات فراغية ليست صور مرآتية لبعضها (مثل ثريونين وألو-ثريونين).',
      difficulty: 'easy', source: 'textbook', sourceLabel: 'من الكتاب — الفصل الثاني',
    },
    {
      id: 'q4', topicId: 'spectro', topicName: 'التحليل الطيفي',
      text: 'في طيف الأشعة تحت الحمراء (IR)، ما الذروة الطيفية المميزة لمجموعة الكربونيل (C=O)، وكيف تُميّز بين ألدهيد وكيتون؟',
      answer: 'مجموعة C=O تظهر عند 1700-1750 cm⁻¹. الألدهيد: إشارتان C-H قوية عند ~2720 و2820 cm⁻¹. الكيتون: لا توجد هذه الإشارات. كلاهما يُظهر ذروة C=O قوية.',
      difficulty: 'medium', source: 'exam', sourceLabel: 'من نموذجك',
    },
  ],
  phys: [
    {
      id: 'q1', topicId: 'thermo', topicName: 'الديناميكا الحرارية الحيوية',
      text: 'احسب التغير في الطاقة الحرة لجيبس (ΔG) لتفاعل تحلل الـ ATP إذا كانت: ΔH = -20 kJ/mol، ΔS = +50 J/mol·K، T = 310 K (درجة حرارة الجسم).',
      answer: 'ΔG = ΔH - TΔS = -20,000 - (310 × 50) = -20,000 - 15,500 = -35,500 J/mol = -35.5 kJ/mol. القيمة السالبة تعني أن التفاعل تلقائي (Spontaneous) عند درجة حرارة الجسم.',
      difficulty: 'medium', source: 'exam', sourceLabel: 'من نموذجك',
    },
    {
      id: 'q2', topicId: 'bioelec', topicName: 'الكهرباء الحيوية',
      text: 'اشرح آلية جهد الفعل (Action Potential) في الخلية العصبية، محدداً دور قنوات صوديوم Na⁺ وبوتاسيوم K⁺ في كل مرحلة.',
      answer: 'الاستراحة: جهد -70mV. الاستقطاب: تفتح قنوات Na⁺ → دخول Na⁺ → ارتفاع الجهد إلى +40mV. إعادة الاستقطاب: غلق Na⁺ وفتح K⁺ → خروج K⁺ → عودة الجهد. فرط الاستقطاب: K⁺ يُفرط في الخروج مؤقتاً.',
      difficulty: 'medium', source: 'textbook', sourceLabel: 'من الكتاب — الفصل الأول',
    },
    {
      id: 'q3', topicId: 'biomech', topicName: 'الميكانيكا الحيوية',
      text: 'مريض خضع لجراحة الركبة. باستخدام مبادئ الميكانيكا الحيوية، ناقش كيف يؤثر وزن الجسم وزاوية ثني الركبة على قوة ضغط المفصل (Joint Contact Force).',
      answer: 'قوة ضغط المفصل = وزن الجسم × عامل هندسي بحسب زاوية الثني. عند 90° ثني، قد تبلغ قوة ضغط الركبة 4-6 أضعاف الوزن بسبب ازدياد ذراع العزم للجاذبية. الحد من الثني يُقلل الإجهاد على الغضروف.',
      difficulty: 'advanced', source: 'synthesized', sourceLabel: 'مولّد — داخل نطاق المقرر',
    },
    {
      id: 'q4', topicId: 'thermo', topicName: 'الديناميكا الحرارية الحيوية',
      text: 'ما القانون الثاني للديناميكا الحرارية، وكيف يُفسّر لماذا لا يمكن للكائنات الحية الوصول إلى كفاءة 100% في تحويل الطاقة الكيميائية إلى عمل ميكانيكي؟',
      answer: 'القانون الثاني: في أي تحويل طاقة، تزداد الإنتروبيا الكلية للنظام والمحيط. الخلايا الحية تُولّد حرارة (مضيّعات) كجزء لا يمكن تفاديه من التفاعلات البيوكيميائية. الكفاءة الحيوية الفعلية لعضلة الإنسان ≈ 25-30%.',
      difficulty: 'medium', source: 'exam', sourceLabel: 'من نموذجك',
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const getMasteryColor = (mastery: number | null) => {
  if (mastery === null) return 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400';
  if (mastery < 40) return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
  if (mastery < 70) return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
  return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
};

const getDifficultyColor = (d: QuestionDifficulty) => {
  if (d === 'easy') return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
  if (d === 'medium') return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
  return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400';
};

const getDifficultyLabel = (d: QuestionDifficulty) => {
  if (d === 'easy') return 'سهل';
  if (d === 'medium') return 'متوسط';
  return 'متقدم';
};

const getSourceColor = (s: QuestionSource) => {
  if (s === 'exam') return 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 border-indigo-200 dark:border-indigo-700';
  if (s === 'textbook') return 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400 border-teal-200 dark:border-teal-700';
  return 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400 border-violet-200 dark:border-violet-700';
};

// Palette colors for bar chart segments
const TOPIC_COLORS = [
  '#6366f1', '#14b8a6', '#f97316', '#ec4899', '#8b5cf6', '#22c55e', '#f59e0b', '#06b6d4',
];

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

// ── Toast ──
interface ToastProps {
  message: string;
  action?: { label: string; onClick: () => void };
  onClose: () => void;
}
const Toast: React.FC<ToastProps> = ({ message, action, onClose }) => {
  useEffect(() => {
    const t = setTimeout(onClose, 5000);
    return () => clearTimeout(t);
  }, [onClose]);
  return (
    <div
      role="status"
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 px-4 py-3 rounded-xl shadow-2xl text-sm font-bold border border-slate-700 dark:border-slate-300"
      style={{ animation: 'slideUpFade 0.3s ease' }}
    >
      <CheckCircle2 className="w-4 h-4 text-emerald-400 dark:text-emerald-600 shrink-0" />
      <span>{message}</span>
      {action && (
        <button
          onClick={action.onClick}
          className="underline underline-offset-2 hover:opacity-75 transition-opacity cursor-pointer shrink-0"
        >
          {action.label}
        </button>
      )}
      <button onClick={onClose} aria-label="إغلاق" className="opacity-60 hover:opacity-100 cursor-pointer shrink-0">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};

// ── Stepper ──
interface StepperProps {
  current: GenStep;
  completedSteps: GenStep[];
}
const STEPS: { key: GenStep; label: string }[] = [
  { key: 'upload', label: 'الرفع' },
  { key: 'difficulty', label: 'المستوى' },
  { key: 'topics', label: 'المواضيع' },
  { key: 'results', label: 'الأسئلة' },
];
const Stepper: React.FC<StepperProps> = ({ current, completedSteps }) => {
  const currentIdx = STEPS.findIndex((s) => s.key === current);
  return (
    <div className="flex items-center justify-center gap-0 w-full" role="list" aria-label="خطوات توليد الأسئلة">
      {STEPS.map((step, idx) => {
        const isCompleted = completedSteps.includes(step.key);
        const isActive = step.key === current;
        const isFuture = idx > currentIdx;
        return (
          <React.Fragment key={step.key}>
            <div className="flex flex-col items-center gap-1.5 min-w-0" role="listitem">
              <div
                className={`
                  relative w-10 h-10 rounded-full flex items-center justify-center text-sm font-black transition-all duration-300
                  ${isCompleted ? 'bg-teal-500 text-white shadow-teal-200 dark:shadow-teal-900' : ''}
                  ${isActive ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-300/60 dark:shadow-indigo-900/60 scale-110' : ''}
                  ${isFuture ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-600' : ''}
                `}
                style={isActive ? { boxShadow: '0 0 0 4px rgba(99,102,241,0.25)' } : undefined}
                aria-current={isActive ? 'step' : undefined}
              >
                {isCompleted ? <Check className="w-4.5 h-4.5" /> : <span>{idx + 1}</span>}
              </div>
              <span
                className={`text-[11px] font-bold transition-colors duration-200 ${
                  isActive ? 'text-indigo-600 dark:text-indigo-400' :
                  isCompleted ? 'text-teal-600 dark:text-teal-400' :
                  'text-slate-400 dark:text-slate-600'
                }`}
              >
                {step.label}
              </span>
            </div>
            {idx < STEPS.length - 1 && (
              <div
                className={`flex-1 h-0.5 mx-1 mb-5 rounded-full transition-all duration-300 ${
                  idx < currentIdx ? 'bg-teal-400' : 'bg-slate-200 dark:bg-slate-700'
                }`}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

// ── Course Context Chip ──
interface CourseContextChipProps {
  course: MockCourse;
}
const CourseContextChip: React.FC<CourseContextChipProps> = ({ course }) => (
  <div className="flex items-center gap-2 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded-full px-3 py-1.5 text-xs font-bold text-indigo-700 dark:text-indigo-300 w-fit max-w-full overflow-hidden">
    <BookOpen className="w-3.5 h-3.5 shrink-0" />
    <span className="truncate">📘 {course.title} — {course.chapter}</span>
  </div>
);

// ── Source Chip ──
interface SourceChipProps {
  source: QuestionSource;
  label: string;
}
const SourceChip: React.FC<SourceChipProps> = ({ source, label }) => (
  <span
    className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${getSourceColor(source)}`}
  >
    <FileText className="w-2.5 h-2.5" />
    {label}
  </span>
);

// ── Stacked Bar Chart ──
interface StackedBarChartProps {
  topics: Topic[];
}
const StackedBarChart: React.FC<StackedBarChartProps> = ({ topics }) => {
  const [animated, setAnimated] = useState(false);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null);
  const total = topics.reduce((s, t) => s + t.examPercent, 0) || 100;

  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 100);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="w-full">
      {/* Bar */}
      <div className="relative w-full h-8 rounded-full overflow-hidden flex bg-slate-100 dark:bg-slate-800">
        {topics.map((topic, idx) => {
          const width = (topic.examPercent / total) * 100;
          return (
            <div
              key={topic.id}
              className="h-full cursor-pointer transition-all duration-600 ease-out hover:brightness-90"
              style={{
                width: animated ? `${width}%` : '0%',
                backgroundColor: TOPIC_COLORS[idx % TOPIC_COLORS.length],
                transition: 'width 0.6s ease-out',
              }}
              onMouseEnter={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                setTooltip({ x: rect.left + rect.width / 2, y: rect.top - 8, text: `${topic.name}: ${topic.examPercent}%` });
              }}
              onMouseLeave={() => setTooltip(null)}
            />
          );
        })}
      </div>
      {/* Tooltip */}
      {tooltip && (
        <div
          className="fixed z-50 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-bold px-2.5 py-1 rounded-lg shadow-lg pointer-events-none -translate-x-1/2 -translate-y-full"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          {tooltip.text}
        </div>
      )}
      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3">
        {topics.map((topic, idx) => (
          <div key={topic.id} className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: TOPIC_COLORS[idx % TOPIC_COLORS.length] }} />
            <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">{topic.name}</span>
            <span className="text-xs text-slate-400 dark:text-slate-600 font-bold">{topic.examPercent}%</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ── Topic Row ──
interface TopicRowProps {
  topic: Topic;
  onChange: (updated: Topic) => void;
}
const TopicRow: React.FC<TopicRowProps> = ({ topic, onChange }) => {
  const masteryClass = getMasteryColor(topic.mastery);
  return (
    <div
      className={`flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-xl border transition-all duration-200 ${
        topic.included
          ? 'bg-white dark:bg-slate-800/60 border-slate-200 dark:border-slate-700'
          : 'bg-slate-50 dark:bg-slate-900/40 border-slate-100 dark:border-slate-800 opacity-60'
      }`}
    >
      {/* Checkbox */}
      <input
        type="checkbox"
        id={`topic-${topic.id}`}
        checked={topic.included}
        onChange={(e) => onChange({ ...topic, included: e.target.checked })}
        className="w-4 h-4 accent-indigo-600 shrink-0 cursor-pointer mt-0.5"
        aria-label={`تضمين موضوع ${topic.name}`}
      />
      {/* Name & badges */}
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <label htmlFor={`topic-${topic.id}`} className="text-sm font-bold text-slate-800 dark:text-slate-100 cursor-pointer">
            {topic.name}
          </label>
          {topic.coverageQuality === 'limited' && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border border-amber-200 dark:border-amber-700">
              <AlertCircle className="w-2.5 h-2.5" />
              تغطية محدودة
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-bold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-full border border-indigo-100 dark:border-indigo-800">
            نسبة في النموذج: {topic.examPercent}%
          </span>
          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${masteryClass}`}>
            {topic.mastery === null ? (
              <span className="flex items-center gap-1">
                <Info className="w-2.5 h-2.5" />
                غير متاح
              </span>
            ) : `مستوى إتقانك: ${topic.mastery}%`}
          </span>
        </div>
        {topic.coverageQuality === 'limited' && (
          <p className="text-[10px] text-amber-600 dark:text-amber-500 mt-1">
            تغطية الكتاب محدودة — قد تكون الأسئلة عامة
          </p>
        )}
      </div>
      {/* Question count stepper */}
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-xs text-slate-500 dark:text-slate-400 font-medium hidden sm:inline">عدد الأسئلة</span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onChange({ ...topic, questionCount: Math.max(1, topic.questionCount - 1) })}
            disabled={!topic.included || topic.questionCount <= 1}
            className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 flex items-center justify-center disabled:opacity-40 transition-colors cursor-pointer"
            aria-label="تقليل"
          >
            <MinusCircle className="w-3.5 h-3.5 text-slate-500" />
          </button>
          <span className="w-7 text-center text-sm font-black text-slate-800 dark:text-slate-100">
            {topic.questionCount}
          </span>
          <button
            onClick={() => onChange({ ...topic, questionCount: Math.min(20, topic.questionCount + 1) })}
            disabled={!topic.included || topic.questionCount >= 20}
            className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 flex items-center justify-center disabled:opacity-40 transition-colors cursor-pointer"
            aria-label="زيادة"
          >
            <PlusCircle className="w-3.5 h-3.5 text-slate-500" />
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Question Card ──
interface QuestionCardProps {
  question: GeneratedQuestion;
  index: number;
}
const QuestionCard: React.FC<QuestionCardProps> = ({ question, index }) => {
  const [showAnswer, setShowAnswer] = useState(false);
  return (
    <div className="bg-white dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow duration-200">
      {/* Header row */}
      <div className="flex flex-wrap items-start gap-2 mb-3">
        <span className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 text-xs font-black flex items-center justify-center shrink-0">
          {index + 1}
        </span>
        <div className="flex flex-wrap gap-1.5 mr-auto">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${getDifficultyColor(question.difficulty)}`}>
            {getDifficultyLabel(question.difficulty)}
          </span>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400">
            {question.topicName}
          </span>
          <SourceChip source={question.source} label={question.sourceLabel} />
        </div>
      </div>
      {/* Question text */}
      <p
        className="text-sm font-medium text-slate-800 dark:text-slate-100 leading-relaxed mb-3"
        dangerouslySetInnerHTML={{
          __html: question.text
            .replace(/([₀-₉]+)/g, '<sub>$1</sub>')
            .replace(/CH₃/g, 'CH<sub>3</sub>')
            .replace(/CH₂/g, 'CH<sub>2</sub>')
            .replace(/Na⁺/g, 'Na<sup>+</sup>')
            .replace(/K⁺/g, 'K<sup>+</sup>')
            .replace(/H₂/g, 'H<sub>2</sub>')
            .replace(/CO₂/g, 'CO<sub>2</sub>'),
        }}
      />
      {/* Toggle answer */}
      <button
        onClick={() => setShowAnswer((v) => !v)}
        className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-200 transition-colors cursor-pointer"
        aria-expanded={showAnswer}
      >
        {showAnswer ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
        {showAnswer ? 'إخفاء الإجابة' : 'إظهار الإجابة'}
      </button>
      {showAnswer && question.answer && (
        <div className="mt-2 p-3 bg-teal-50 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-800 rounded-xl text-xs text-teal-800 dark:text-teal-200 leading-relaxed font-medium">
          {question.answer}
        </div>
      )}
    </div>
  );
};

// ── Difficulty Card ──
interface DifficultyCardProps {
  level: Difficulty;
  selected: boolean;
  onSelect: () => void;
  courseName: string;
}
const DIFF_CONFIG = {
  '100': {
    icon: Target,
    label: 'مطابق 100%',
    desc: 'نفس النموذج بصياغة مختلفة',
    count: '~20 سؤال',
    types: 'اختيار متعدد + مقالي قصير',
    bloom: 'تذكّر / فهم',
    sample: 'ما هي الوظيفة الرئيسية للميتوكندريا في الخلية؟',
    color: 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30',
    activeColor: 'ring-2 ring-emerald-500',
    badgeColor: 'bg-emerald-500',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    labelColor: 'text-emerald-700 dark:text-emerald-300',
  },
  '80': {
    icon: Brain,
    label: 'فهم المفاهيم 80%',
    desc: 'يركز على فهم المفاهيم الأساسية',
    count: '~18 سؤال',
    types: 'تحليلي + حالات دراسية',
    bloom: 'تطبيق / تحليل',
    sample: 'اشرح كيف تحافظ بروتوكولات الشبكة على أمان البيانات',
    color: 'border-blue-500 bg-blue-50 dark:bg-blue-950/30',
    activeColor: 'ring-2 ring-blue-500',
    badgeColor: 'bg-blue-500',
    iconColor: 'text-blue-600 dark:text-blue-400',
    labelColor: 'text-blue-700 dark:text-blue-300',
  },
  '120': {
    icon: Flame,
    label: 'تحدّي 120%',
    desc: 'أسئلة أصعب وسيناريوهات متقدمة',
    count: '~15 سؤال',
    types: 'سيناريوهات سريرية + تقييم',
    bloom: 'تقييم / إبداع',
    sample: 'حلّل حالة مريض يعاني من نقص الإنزيمات واقترح خطة علاجية',
    color: 'border-orange-500 bg-orange-50 dark:bg-orange-950/30',
    activeColor: 'ring-2 ring-orange-500',
    badgeColor: 'bg-orange-500',
    iconColor: 'text-orange-600 dark:text-orange-400',
    labelColor: 'text-orange-700 dark:text-orange-300',
  },
};
const DifficultyCard: React.FC<DifficultyCardProps> = ({ level, selected, onSelect }) => {
  const [showSample, setShowSample] = useState(false);
  const cfg = DIFF_CONFIG[level];
  const Icon = cfg.icon;
  return (
    <button
      onClick={onSelect}
      aria-pressed={selected}
      className={`
        relative text-right flex flex-col gap-3 p-4 rounded-2xl border-2 transition-all duration-200 cursor-pointer w-full
        hover:scale-[1.02] hover:shadow-lg
        ${selected ? `${cfg.color} ${cfg.activeColor} scale-[1.02] shadow-lg` : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/60 hover:border-slate-300'}
      `}
    >
      {/* Badge */}
      {selected && (
        <div className={`absolute top-3 left-3 w-5 h-5 rounded-full ${cfg.badgeColor} flex items-center justify-center`}>
          <Check className="w-3 h-3 text-white" />
        </div>
      )}
      <div className="flex items-center gap-2">
        <Icon className={`w-5 h-5 ${cfg.iconColor} shrink-0`} />
        <span className={`font-black text-sm ${selected ? cfg.labelColor : 'text-slate-800 dark:text-slate-100'}`}>
          {cfg.label}
        </span>
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{cfg.desc}</p>
      <div className="flex flex-col gap-1">
        <span className="text-xs font-bold text-slate-600 dark:text-slate-300">{cfg.count}</span>
        <span className="text-[11px] text-slate-400 dark:text-slate-500">{cfg.types}</span>
        <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">مستوى بلوم: {cfg.bloom}</span>
      </div>
      {/* Sample tooltip */}
      <div
        className="mt-1"
        onMouseEnter={() => setShowSample(true)}
        onMouseLeave={() => setShowSample(false)}
        onClick={(e) => { e.stopPropagation(); setShowSample((v) => !v); }}
      >
        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
          <Info className="w-2.5 h-2.5" />
          مثال على سؤال
        </span>
        {showSample && (
          <div className="mt-1 p-2 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs rounded-lg leading-relaxed">
            {cfg.sample}
          </div>
        )}
      </div>
    </button>
  );
};

// ── Save Exam Modal ──
interface SaveExamModalProps {
  questionCount: number;
  course: MockCourse;
  onClose: () => void;
  onSave: (name: string) => void;
}
const SaveExamModal: React.FC<SaveExamModalProps> = ({ questionCount, course, onClose, onSave }) => {
  const [name, setName] = useState('');
  const [nameError, setNameError] = useState('');
  const overlayRef = useRef<HTMLDivElement>(null);

  const handleSave = () => {
    if (!name.trim()) {
      setNameError('يرجى إدخال اسم الاختبار');
      return;
    }
    setNameError('');
    onSave(name.trim());
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="save-modal-title"
    >
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 id="save-modal-title" className="text-base font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Save className="w-4 h-4 text-indigo-500" />
            حفظ كاختبار
          </h2>
          <button onClick={onClose} aria-label="إغلاق" className="w-7 h-7 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center cursor-pointer transition-colors">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <label htmlFor="exam-name" className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">
              اسم الاختبار <span className="text-red-500">*</span>
            </label>
            <input
              id="exam-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="مثال: اختبار الفصل الثالث — التعبير الجيني"
              className={`w-full px-3 py-2.5 rounded-xl border text-sm font-medium bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all ${
                nameError ? 'border-red-400' : 'border-slate-200 dark:border-slate-700'
              }`}
              autoFocus
            />
            {nameError && <p className="text-xs text-red-500 font-bold mt-1">{nameError}</p>}
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">المادة</label>
            <div className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-medium bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400">
              {course.title}
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">عدد الأسئلة</label>
            <div className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-bold bg-slate-50 dark:bg-slate-800/50 text-slate-800 dark:text-slate-100">
              {questionCount} سؤال
            </div>
          </div>
        </div>
        <div className="flex gap-2 mt-5">
          <button
            onClick={handleSave}
            className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm px-4 py-2.5 rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-2"
          >
            <Save className="w-3.5 h-3.5" />
            حفظ
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            إلغاء
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Course Select Modal ──
interface CourseSelectModalProps {
  onSelect: (course: MockCourse) => void;
  onClose: () => void;
}
const CourseSelectModal: React.FC<CourseSelectModalProps> = ({ onSelect, onClose }) => {
  const [selected, setSelected] = useState<MockCourse | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="course-select-title"
    >
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 id="course-select-title" className="text-base font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <GraduationCap className="w-4 h-4 text-indigo-500" />
            اختر المادة أولاً
          </h2>
          <button onClick={onClose} aria-label="إغلاق" className="w-7 h-7 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center cursor-pointer transition-colors">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
          لتوليد أسئلة مخصصة ومرتبطة بمقررك، يرجى اختيار المادة أولاً.
        </p>
        <div className="space-y-2 mb-5">
          {MOCK_COURSES.map((course) => (
            <button
              key={course.id}
              onClick={() => setSelected(course)}
              aria-pressed={selected?.id === course.id}
              className={`w-full text-right px-3 py-2.5 rounded-xl border text-sm font-bold transition-all cursor-pointer ${
                selected?.id === course.id
                  ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300'
                  : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50'
              }`}
            >
              <div>{course.title}</div>
              <div className="text-[11px] font-medium opacity-60 mt-0.5">{course.chapter}</div>
            </button>
          ))}
        </div>
        <button
          disabled={!selected}
          onClick={() => selected && onSelect(selected)}
          className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 dark:disabled:bg-slate-700 disabled:text-slate-400 disabled:cursor-not-allowed text-white font-bold text-sm px-4 py-2.5 rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-2"
        >
          <Sparkles className="w-3.5 h-3.5" />
          متابعة
        </button>
      </div>
    </div>
  );
};

// ── Reset Confirm Modal ──
interface ResetConfirmModalProps {
  onConfirm: () => void;
  onClose: () => void;
}
const ResetConfirmModal: React.FC<ResetConfirmModalProps> = ({ onConfirm, onClose }) => (
  <div
    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
    role="dialog" aria-modal="true"
  >
    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-xs p-5">
      <h2 className="font-black text-sm text-slate-800 dark:text-slate-100 mb-2">بدء من جديد؟</h2>
      <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">سيتم مسح جميع البيانات المحددة والعودة إلى الخطوة الأولى.</p>
      <div className="flex gap-2">
        <button onClick={onConfirm} className="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold text-sm px-3 py-2 rounded-xl transition-colors cursor-pointer">
          نعم، ابدأ من جديد
        </button>
        <button onClick={onClose} className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-colors">
          إلغاء
        </button>
      </div>
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PANEL
// ─────────────────────────────────────────────────────────────────────────────

interface GenerateQuestionsPanelProps {
  /** If provided (from My Courses), skip the course-select modal */
  preselectedCourse?: MockCourse;
}

export const GenerateQuestionsPanel: React.FC<GenerateQuestionsPanelProps> = ({ preselectedCourse }) => {
  // ── Core flow state ──
  const [currentStep, setCurrentStep] = useState<GenStep>('upload');
  const [completedSteps, setCompletedSteps] = useState<GenStep[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<MockCourse | null>(preselectedCourse ?? null);

  // ── Modals ──
  const [showCourseModal, setShowCourseModal] = useState(!preselectedCourse);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);

  // ── Toast ──
  const [toast, setToast] = useState<{ message: string; action?: { label: string; onClick: () => void } } | null>(null);

  // ── Step 1: Upload ──
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [pasteMode, setPasteMode] = useState(false);
  const [pastedText, setPastedText] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisSubSteps, setAnalysisSubSteps] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Step 2: Difficulty ──
  const [selectedDifficulty, setSelectedDifficulty] = useState<Difficulty | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  // ── Step 3: Topics ──
  const [topics, setTopics] = useState<Topic[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  // ── Step 4: Results ──
  const [questions, setQuestions] = useState<GeneratedQuestion[]>([]);
  const [activeTopicFilter, setActiveTopicFilter] = useState<string>('all');

  // ── Derived ──
  const includedTopics = topics.filter((t) => t.included);
  const filteredQuestions = activeTopicFilter === 'all'
    ? questions
    : questions.filter((q) => q.topicId === activeTopicFilter);

  const weakTopicIds = selectedCourse ? (WEAK_TOPICS[selectedCourse.id] ?? []) : [];

  // ── Helpers ──
  const completeStep = (step: GenStep) => {
    setCompletedSteps((prev) => (prev.includes(step) ? prev : [...prev, step]));
  };

  const goToStep = (step: GenStep) => {
    setCurrentStep(step);
  };

  const resetAll = () => {
    setCurrentStep('upload');
    setCompletedSteps([]);
    setSelectedCourse(null);
    setUploadedFile(null);
    setUploadProgress(0);
    setPasteMode(false);
    setPastedText('');
    setIsAnalyzing(false);
    setAnalysisSubSteps([]);
    setSelectedDifficulty(null);
    setTopics([]);
    setQuestions([]);
    setActiveTopicFilter('all');
    setShowCourseModal(true);
    setShowResetModal(false);
  };

  // Initialize topics when course is selected
  useEffect(() => {
    if (selectedCourse) {
      setTopics((MOCK_TOPICS_BY_COURSE[selectedCourse.id] ?? []).map((t) => ({ ...t })));
    }
  }, [selectedCourse]);

  // ── Upload handlers ──
  const simulateUpload = (file: File) => {
    setUploadedFile(file);
    setUploadProgress(0);
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 25 + 10;
      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);
      }
      setUploadProgress(Math.min(progress, 100));
    }, 150);
  };

  const handleFileDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) simulateUpload(file);
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) simulateUpload(file);
  };

  const handleAnalyze = () => {
    setIsAnalyzing(true);
    setAnalysisSubSteps([]);
    const subSteps = ['استخراج النص...', 'تصنيف المواضيع...', 'تحليل الأنماط...'];
    let i = 0;
    const interval = setInterval(() => {
      if (i < subSteps.length) {
        setAnalysisSubSteps((prev) => [...prev, subSteps[i] + ' ✓']);
        i++;
      } else {
        clearInterval(interval);
        setTimeout(() => {
          setIsAnalyzing(false);
          completeStep('upload');
          goToStep('difficulty');
        }, 400);
      }
    }, 600);
  };

  // ── Generate questions ──
  const handleGenerate = () => {
    setIsGenerating(true);
    setTimeout(() => {
      const courseQuestions = selectedCourse ? (MOCK_QUESTIONS[selectedCourse.id] ?? []) : [];
      setQuestions(courseQuestions);
      setIsGenerating(false);
      completeStep('topics');
      goToStep('results');
      setActiveTopicFilter('all');
    }, 1500);
  };

  // ── Focus weak topics ──
  const handleFocusWeak = () => {
    setTopics((prev) =>
      prev.map((t) => ({
        ...t,
        included: true,
        questionCount: weakTopicIds.includes(t.id) ? Math.min(20, t.questionCount + 3) : t.questionCount,
      }))
    );
  };

  // ── Save exam ──
  const handleSaveExam = (name: string) => {
    setShowSaveModal(false);
    setToast({
      message: `تم حفظ الاختبار "${name}" بنجاح`,
      action: { label: 'اذهب إلى الاختبار', onClick: () => setToast(null) },
    });
  };

  const canAnalyze = uploadedFile !== null || pastedText.trim().length > 20;

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ── Modals ── */}
      {showCourseModal && !selectedCourse && (
        <CourseSelectModal
          onSelect={(course) => { setSelectedCourse(course); setShowCourseModal(false); }}
          onClose={() => setShowCourseModal(false)}
        />
      )}
      {showSaveModal && selectedCourse && (
        <SaveExamModal
          questionCount={questions.length}
          course={selectedCourse}
          onClose={() => setShowSaveModal(false)}
          onSave={handleSaveExam}
        />
      )}
      {showResetModal && (
        <ResetConfirmModal onConfirm={resetAll} onClose={() => setShowResetModal(false)} />
      )}

      {/* ── Toast ── */}
      {toast && (
        <Toast message={toast.message} action={toast.action} onClose={() => setToast(null)} />
      )}

      {/* ── Animation style ── */}
      <style>{`
        @keyframes slideUpFade {
          from { opacity: 0; transform: translateX(-50%) translateY(12px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .gen-spinner { animation: spin 0.8s linear infinite; }
      `}</style>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 flex flex-col gap-6">

        {/* ── Page Header ── */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-indigo-500" />
              ولّد أسئلة من نموذج
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              ارفع نموذج اختبار أو واجب وسنولّد لك أسئلة مخصصة مرتبطة بمقررك
            </p>
          </div>
          <button
            onClick={() => setShowResetModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer shrink-0"
            title="بدء من جديد"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">بدء من جديد</span>
          </button>
        </div>

        {/* ── Stepper ── */}
        <div className="bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 shadow-sm">
          <Stepper current={currentStep} completedSteps={completedSteps} />
        </div>

        {/* ── Context Chip ── */}
        {selectedCourse && (
          <CourseContextChip course={selectedCourse} />
        )}

        {/* ═══════════════════════════════════════════════════════════════
            STEP 1: UPLOAD
        ═══════════════════════════════════════════════════════════════ */}
        {currentStep === 'upload' && (
          <div className="flex flex-col gap-4">
            {/* Format badges */}
            <div className="flex flex-wrap gap-2">
              {['PDF', 'DOCX', 'صور', 'نص ملصوق'].map((fmt) => (
                <span key={fmt} className="text-xs font-bold px-2.5 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-800">
                  {fmt}
                </span>
              ))}
            </div>

            {/* Drop zone */}
            {!pasteMode && (
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleFileDrop}
                onClick={() => !uploadedFile && fileInputRef.current?.click()}
                className={`
                  relative border-2 border-dashed rounded-2xl p-8 text-center transition-all duration-200 cursor-pointer
                  ${isDragging ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30 scale-[1.01]' : 'border-slate-300 dark:border-slate-600 hover:border-indigo-400 hover:bg-slate-50 dark:hover:bg-slate-800/40 bg-white dark:bg-slate-800/30'}
                `}
                role="button"
                aria-label="منطقة رفع الملفات"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter') fileInputRef.current?.click(); }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept=".pdf,.docx,.doc,.png,.jpg,.jpeg"
                  onChange={handleFileInput}
                  aria-label="اختيار ملف"
                />
                {!uploadedFile ? (
                  <>
                    <div className="w-14 h-14 bg-indigo-100 dark:bg-indigo-950/50 rounded-2xl flex items-center justify-center mx-auto mb-3">
                      <Upload className="w-7 h-7 text-indigo-500" />
                    </div>
                    <p className="font-bold text-slate-700 dark:text-slate-200 text-sm mb-1">
                      اسحب ملفك هنا أو اختر ملفك
                    </p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 max-w-xs mx-auto leading-relaxed">
                      ارفع نموذج اختبار أو واجب سابق، وسنقوم بتحليله وتوليد أسئلة مخصصة لك.
                    </p>
                  </>
                ) : (
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-12 h-12 bg-teal-100 dark:bg-teal-950/40 rounded-xl flex items-center justify-center">
                      <FileText className="w-6 h-6 text-teal-500" />
                    </div>
                    <div>
                      <p className="font-bold text-slate-800 dark:text-slate-100 text-sm">{uploadedFile.name}</p>
                      <p className="text-xs text-slate-400">{(uploadedFile.size / 1024).toFixed(1)} KB</p>
                    </div>
                    {/* Progress bar */}
                    <div className="w-full max-w-xs bg-slate-100 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
                      <div
                        className="h-full bg-teal-500 rounded-full transition-all duration-200"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                    {uploadProgress < 100 ? (
                      <span className="text-xs text-slate-400 font-medium">جاري الرفع... {Math.round(uploadProgress)}%</span>
                    ) : (
                      <span className="text-xs text-teal-600 font-bold flex items-center gap-1">
                        <Check className="w-3 h-3" /> تم الرفع بنجاح
                      </span>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); setUploadedFile(null); setUploadProgress(0); }}
                      className="text-xs text-red-500 hover:text-red-700 font-bold cursor-pointer"
                    >
                      إزالة الملف
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Paste mode toggle */}
            {!uploadedFile && (
              <button
                onClick={() => setPasteMode((v) => !v)}
                className="text-sm font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-200 transition-colors cursor-pointer self-center"
              >
                {pasteMode ? '↑ رفع ملف بدلاً من ذلك' : '📋 لصق نص بدلاً من ذلك'}
              </button>
            )}

            {pasteMode && !uploadedFile && (
              <textarea
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                placeholder="الصق محتوى النموذج أو الاختبار هنا..."
                className="w-full min-h-[160px] px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none transition-all"
                aria-label="لصق النص"
              />
            )}

            {/* Analyze CTA */}
            {isAnalyzing ? (
              <div className="flex flex-col items-center gap-3 bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 rounded-2xl p-5">
                <div className="flex items-center gap-2.5">
                  <Loader2 className="w-5 h-5 text-indigo-500 gen-spinner" />
                  <span className="text-sm font-bold text-indigo-700 dark:text-indigo-300">
                    جاري استخراج الأسئلة وتصنيف المواضيع...
                  </span>
                </div>
                <div className="flex flex-col gap-1 items-center">
                  {analysisSubSteps.map((s, i) => (
                    <span key={i} className="text-xs font-medium text-indigo-500 dark:text-indigo-400">{s}</span>
                  ))}
                </div>
              </div>
            ) : (
              <button
                disabled={!canAnalyze}
                onClick={handleAnalyze}
                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 dark:disabled:bg-slate-700 disabled:text-slate-400 disabled:cursor-not-allowed text-white font-black text-sm px-5 py-3 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 shadow-sm hover:shadow-md"
              >
                <Sparkles className="w-4 h-4" />
                تحليل النموذج
              </button>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════
            STEP 2: DIFFICULTY
        ═══════════════════════════════════════════════════════════════ */}
        {currentStep === 'difficulty' && (
          <div className="flex flex-col gap-5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {(['100', '80', '120'] as Difficulty[]).map((level) => (
                <DifficultyCard
                  key={level}
                  level={level}
                  selected={selectedDifficulty === level}
                  onSelect={() => setSelectedDifficulty(level)}
                  courseName={selectedCourse?.title ?? ''}
                />
              ))}
            </div>

            {/* Advanced settings */}
            <div className="bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden">
              <button
                onClick={() => setAdvancedOpen((v) => !v)}
                className="w-full flex items-center justify-between px-4 py-3 text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors cursor-pointer"
                aria-expanded={advancedOpen}
              >
                <span>إعدادات متقدمة</span>
                {advancedOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
              </button>
              {advancedOpen && (
                <div className="px-4 pb-4 border-t border-slate-100 dark:border-slate-700 pt-3">
                  <p className="text-xs text-slate-400 dark:text-slate-500 mb-3">
                    اترك الإعداد الافتراضي لاستخدام المستوى المختار لكل المواضيع.
                  </p>
                  <div className="space-y-3">
                    {topics.map((topic) => (
                      <div key={topic.id} className="flex items-center gap-3">
                        <span className="text-xs font-medium text-slate-600 dark:text-slate-400 flex-1 truncate">{topic.name}</span>
                        <select
                          value={topic.difficultyOverride ?? ''}
                          onChange={(e) => {
                            const val = e.target.value as Difficulty | '';
                            setTopics((prev) =>
                              prev.map((t) =>
                                t.id === topic.id ? { ...t, difficultyOverride: val || undefined } : t
                              )
                            );
                          }}
                          className="text-xs font-bold px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                          aria-label={`مستوى ${topic.name}`}
                        >
                          <option value="">— افتراضي —</option>
                          <option value="100">مطابق 100%</option>
                          <option value="80">فهم 80%</option>
                          <option value="120">تحدّي 120%</option>
                        </select>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Navigation */}
            <div className="flex items-center justify-between gap-3">
              <button
                onClick={() => goToStep('upload')}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
                رجوع
              </button>
              <button
                disabled={!selectedDifficulty}
                onClick={() => { completeStep('difficulty'); goToStep('topics'); }}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 dark:disabled:bg-slate-700 disabled:text-slate-400 disabled:cursor-not-allowed text-white font-bold text-sm transition-all cursor-pointer"
              >
                التالي
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════
            STEP 3: TOPICS & ANALYSIS
        ═══════════════════════════════════════════════════════════════ */}
        {currentStep === 'topics' && (
          <div className="flex flex-col gap-5">
            <h2 className="text-base font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-orange-500" />
              خريطة نقاط الضعف
            </h2>

            {/* Weak points callout */}
            {weakTopicIds.length > 0 && (
              <div className="bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
                <div>
                  <p className="text-sm font-black text-orange-700 dark:text-orange-300 mb-1">
                    ⚠️ أكثر 3 نقاط ضعف لديك:
                  </p>
                  <p className="text-xs text-orange-600 dark:text-orange-400 leading-relaxed">
                    {topics.filter((t) => weakTopicIds.includes(t.id)).map((t) => t.name).join('، ')}
                  </p>
                </div>
                <button
                  onClick={handleFocusWeak}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs transition-colors cursor-pointer shrink-0 self-start sm:self-auto"
                >
                  <Target className="w-3.5 h-3.5" />
                  ركّز عليها
                </button>
              </div>
            )}

            {/* Bar chart */}
            <div className="bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl p-4">
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-3">توزيع المواضيع في النموذج</p>
              <StackedBarChart topics={topics} />
            </div>

            {/* Topic rows */}
            <div className="flex flex-col gap-2">
              {topics.map((topic) => (
                <TopicRow
                  key={topic.id}
                  topic={topic}
                  onChange={(updated) => setTopics((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))}
                />
              ))}
            </div>

            {/* Generate CTA */}
            {isGenerating ? (
              <div className="flex flex-col items-center gap-2 bg-teal-50 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-800 rounded-2xl p-4">
                <div className="flex items-center gap-2.5">
                  <Loader2 className="w-5 h-5 text-teal-500 gen-spinner" />
                  <span className="text-sm font-bold text-teal-700 dark:text-teal-300">
                    جاري توليد الأسئلة بناءً على نموذجك وكتاب المقرر...
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-3">
                <button
                  onClick={() => goToStep('difficulty')}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                  رجوع
                </button>
                <button
                  disabled={includedTopics.length === 0}
                  onClick={handleGenerate}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 dark:disabled:bg-slate-700 disabled:text-slate-400 disabled:cursor-not-allowed text-white font-bold text-sm transition-all cursor-pointer shadow-sm hover:shadow-md"
                >
                  <Sparkles className="w-4 h-4" />
                  ولّد الأسئلة
                </button>
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════
            STEP 4: RESULTS
        ═══════════════════════════════════════════════════════════════ */}
        {currentStep === 'results' && (
          <div className="flex flex-col gap-5">
            {/* Topic filter tabs */}
            <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="تصفية حسب الموضوع">
              {[{ id: 'all', name: 'الكل' }, ...includedTopics].map((t) => (
                <button
                  key={t.id}
                  role="tab"
                  aria-selected={activeTopicFilter === t.id}
                  onClick={() => setActiveTopicFilter(t.id)}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold border transition-all cursor-pointer ${
                    activeTopicFilter === t.id
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-indigo-400'
                  }`}
                >
                  {'name' in t ? t.name : t.id === 'all' ? 'الكل' : t.id}
                </button>
              ))}
            </div>

            {/* Questions */}
            <div className="flex flex-col gap-3" role="list" aria-label="الأسئلة المولّدة">
              {filteredQuestions.length === 0 ? (
                <div className="text-center py-8 text-slate-400 dark:text-slate-600 text-sm font-medium">
                  لا توجد أسئلة لهذا الموضوع
                </div>
              ) : (
                filteredQuestions.map((q, i) => (
                  <div key={q.id} role="listitem">
                    <QuestionCard question={q} index={i} />
                  </div>
                ))
              )}
            </div>

            {/* Sticky footer summary */}
            <div className="sticky bottom-4 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200 dark:border-slate-700 rounded-2xl p-3 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-700 dark:text-slate-200">
                  تم التوليد بناءً على نموذجك (مستوى {selectedDifficulty === '100' ? '100%' : selectedDifficulty === '80' ? '80%' : '120%'}) + تركيز على المواضيع المختارة
                </p>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                  جميع الأسئلة داخل نطاق المقرر — المصدر: {selectedCourse?.title} | {selectedCourse?.chapter}
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => setShowSaveModal(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  احفظ كاختبار
                </button>
                <button
                  onClick={() => setToast({ message: 'جاري تحميل جلسة التدريب...' })}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all cursor-pointer shadow-sm"
                >
                  <Play className="w-3.5 h-3.5" />
                  ابدأ التدريب
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default GenerateQuestionsPanel;
