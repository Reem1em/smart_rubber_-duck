import { isStemTopic } from '../stem';

/** Static payload served when every model in the chain fails. */
export function bugChallengeFallback(body: any) {
  const lang = body?.language || 'جبر المصفوفات والمحددات';

  if (isStemTopic(lang)) {
    return {
      type: 'debugging_challenge',
      challenge: {
        title: 'صيد الخطأ الحسابي: محدد مصفوفة 2×2',
        language: lang,
        difficulty: 'Intermediate',
        expectedBehavior: 'المطلوب حساب محدد المصفوفة بطرح حاصل ضرب القطر الثانوي من حاصل ضرب القطر الرئيسي.',
        buggyCode: `المصفوفة A:

$$A = \\begin{bmatrix} 1 & 4 \\\\ 2 & 3 \\end{bmatrix}$$

خطوة كواكلي:

$$\\det(A) = (1 \\times 3) + (4 \\times 2) = 11$$

وين الغلطة في خطوتي؟ اشرح لي بصوتك إيش الخطوة الصح وليه.`,
        totalBugsCount: 1,
      },
    };
  }

  return {
    type: 'debugging_challenge',
    challenge: {
      title: 'تحدي صيد الثغرات: حساب متوسط درجات الطالب والبحث الثنائي',
      language: lang,
      difficulty: 'Intermediate',
      expectedBehavior: 'المطلوب حساب متوسط الدرجات للمجموعة بشكل صحيح وتجنب قسمة صفر أو الأخطاء المنطقية في التكرار (Off-by-one).',
      buggyCode: `public class BuggyStats {
    public static double getAverage(int[] scores) {
        int sum = 0;
        for (int i = 0; i <= scores.length; i++) { // Bug 1: ArrayIndexOutOfBounds
            sum += scores[i];
        }
        return sum / scores.length; // Bug 2: Integer division & potential Divide-by-zero
    }

    public static int binarySearch(int[] arr, int target) {
        int low = 0, high = arr.length; // Bug 3: Off-by-one high bound
        while (low <= high) {
            int mid = (low + high) / 2; // Bug 4: Potential integer overflow
            if (arr[mid] == target) return mid;
            if (arr[mid] < target) low = mid; // Bug 5: Infinite loop
            else high = mid;
        }
        return -1;
    }
}`,
      totalBugsCount: 4,
    },
  };
}

/** Unrated: no score or invented bug findings for a submission the judge never saw. */
export function bugEvaluationFallback() {
  return {
    score: null,
    summary: 'كواك! السيرفرات زحمة فما قدرت أقيّم صيدك الحين — إجابتك محفوظة، جرّب مرة ثانية بعد شوي.',
    identifiedBugs: [],
    missedBugs: [],
    correctedCode: '',
  };
}
