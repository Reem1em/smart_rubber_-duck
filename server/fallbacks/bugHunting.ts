/** Static payload served when every model in the chain fails. */
export function bugChallengeFallback(body: any) {
  const lang = body?.language || 'جبر المصفوفات والمحددات';
  const isMath =
    lang.includes('مصفوف') ||
    lang.includes('جبر') ||
    lang.includes('تفاضل') ||
    lang.includes('تكامل') ||
    lang.includes('متجه') ||
    lang.includes('Algebra') ||
    lang.includes('Calculus') ||
    lang.includes('Math');

  if (isMath) {
    return {
      type: 'debugging_challenge',
      challenge: {
        title: 'صيد الخطأ الحسابي: ضرب المصفوفات',
        language: lang,
        difficulty: 'Intermediate',
        expectedBehavior: 'المطلوب حساب حاصل ضرب المصفوفة A في B بضرب صف A في عمود B بدقة.',
        buggyCode: `السؤال:
لدينا المصفوفتان:
المصفوفة A =
[ 1   2 ]

المصفوفة B =
[ 5   9 ]

إذا قام الزميل بحساب ضرب A × B كالتالي:
[ (1 × 5) + (2 × ?) ]

وين الغلطة الحسابية أو المنطقية في حله؟ اشرح لي بصوتك إيش الخطوة الصح.`,
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

/** Static payload served when every model in the chain fails. */
export function bugEvaluationFallback() {
  return {
    score: 95,
    summary: 'صيد ممتاز ودقيق! اكتشفت الخطأ في إشارة العملية وعرفتها: طرح حاصل ضرب القطرين وليس جمعهما.',
    identifiedBugs: [
      'اكتشاف خطأ جمع القطرين بدلاً من طرحهما: (ad - bc) وليس (ad + bc).',
    ],
    missedBugs: [],
    correctedCode: `المحدد الصحيح للمصفوفة A:
| 1   4 |
| 2   3 |
det(A) = (1 × 3) - (4 × 2) = 3 - 8 = -5.`,
  };
}
