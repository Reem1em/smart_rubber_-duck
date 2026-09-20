/**
 * Utility for parsing and validating exam and schedule dates in Arabic and English.
 * Detects whether dates entered in the study discipline plan are in the past (old/inaccurate).
 */

const ARABIC_MONTHS_MAP: Record<string, number> = {
  يناير: 0,
  'كانون الثاني': 0,
  فبراير: 1,
  شباط: 1,
  مارس: 2,
  آذار: 2,
  اذار: 2,
  أبريل: 3,
  ابريل: 3,
  نيسان: 3,
  مايو: 4,
  أيار: 4,
  ايار: 4,
  يونيو: 5,
  حزيران: 5,
  يوليو: 6,
  تموز: 6,
  أغسطس: 7,
  اغسطس: 7,
  آب: 7,
  اب: 7,
  سبتمبر: 8,
  أيلول: 8,
  ايلول: 8,
  أكتوبر: 9,
  اكتوبر: 9,
  'تشرين الأول': 9,
  'تشرين الاول': 9,
  نوفمبر: 10,
  'تشرين الثاني': 10,
  ديسمبر: 11,
  'كانون الأول': 11,
  'كانون الاول': 11,
};

export interface DateValidationResult {
  isPast: boolean;
  warningMessage: string | null;
  detectedDateText?: string;
  detectedDate?: Date;
}

/**
 * Normalizes Arabic numerals (٠-٩) to standard digits (0-9)
 */
export function normalizeArabicNumbers(str: string): string {
  return str.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 1632));
}

/**
 * Validates whether an exam date or text containing exam dates is in the past.
 */
export function validateExamDates(
  textInput: string,
  explicitDateInput?: string
): DateValidationResult {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // 1. Check explicit date input (e.g. from <input type="date">)
  if (explicitDateInput && explicitDateInput.trim()) {
    const parsedExplicit = new Date(explicitDateInput.trim() + 'T00:00:00');
    if (!isNaN(parsedExplicit.getTime())) {
      parsedExplicit.setHours(0, 0, 0, 0);
      if (parsedExplicit < today) {
        return {
          isPast: true,
          detectedDateText: explicitDateInput,
          detectedDate: parsedExplicit,
          warningMessage: `التاريخ المحدد (${explicitDateInput}) قديم ومنقضٍ وغير دقيق! لا يمكن إعداد خطة انضباط دراسي لموعد قد مضى، يرجى اختيار تاريخ مستقبلي.`,
        };
      }
    }
  }

  if (!textInput || !textInput.trim()) {
    return { isPast: false, warningMessage: null };
  }

  const normalized = normalizeArabicNumbers(textInput);

  // 2. Check for explicit past keywords
  const pastKeywords = [
    'أمس',
    'امس',
    'البارحة',
    'الاسبوع الماضي',
    'الأسبوع الماضي',
    'الشهر الماضي',
    'العام الماضي',
    'السنة الماضية',
    'العام السابق',
    'منذ أسبوع',
    'منذ شهر',
  ];
  for (const kw of pastKeywords) {
    if (normalized.includes(kw)) {
      return {
        isPast: true,
        detectedDateText: kw,
        warningMessage: `التعبير المدخل ("${kw}") يشير إلى تاريخ ماضٍ وغير دقيق. خطة الانضباط الدراسي تتطلب تحديد موعد اختبار قادم في المستقبل.`,
      };
    }
  }

  // 3. Check for standard numeric dates (YYYY-MM-DD or YYYY/MM/DD or DD-MM-YYYY or DD/MM/YYYY)
  const isoPattern = /\b(20\d{2})[-/.](0?[1-9]|1[0-2])[-/.](0?[1-9]|[12]\d|3[01])\b/g;
  let isoMatch: RegExpExecArray | null;
  while ((isoMatch = isoPattern.exec(normalized)) !== null) {
    const year = parseInt(isoMatch[1], 10);
    const month = parseInt(isoMatch[2], 10) - 1;
    const day = parseInt(isoMatch[3], 10);
    const dateObj = new Date(year, month, day);
    dateObj.setHours(0, 0, 0, 0);

    if (dateObj < today) {
      const formattedStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      return {
        isPast: true,
        detectedDateText: formattedStr,
        detectedDate: dateObj,
        warningMessage: `التاريخ المدخل (${formattedStr}) قديم ومنقضٍ وغير دقيق! يرجى إدخال تاريخ مستقبلي للاختبار لتوليد خطة انضباط واقعية.`,
      };
    }
  }

  // DD/MM/YYYY or DD-MM-YYYY pattern
  const dmyPattern = /\b(0?[1-9]|[12]\d|3[01])[-/.](0?[1-9]|1[0-2])[-/.](20\d{2})\b/g;
  let dmyMatch: RegExpExecArray | null;
  while ((dmyMatch = dmyPattern.exec(normalized)) !== null) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10) - 1;
    const year = parseInt(dmyMatch[3], 10);
    const dateObj = new Date(year, month, day);
    dateObj.setHours(0, 0, 0, 0);

    if (dateObj < today) {
      const formattedStr = `${day}/${month + 1}/${year}`;
      return {
        isPast: true,
        detectedDateText: formattedStr,
        detectedDate: dateObj,
        warningMessage: `التاريخ المدخل (${formattedStr}) قديم ومنقضٍ وغير دقيق! يرجى إدخال تاريخ مستقبلي للاختبارات.`,
      };
    }
  }

  // 4. Check for Arabic month dates: e.g. "25 أغسطس 2026" or "10 مايو 2024" or "15 سبتمبر"
  const monthNames = Object.keys(ARABIC_MONTHS_MAP).join('|');
  const arabicDatePattern = new RegExp(
    `\\b(0?[1-9]|[12]\\d|3[01])\\s+(?:من\\s+)?(${monthNames})(?:\\s+(20\\d{2}))?\\b`,
    'gi'
  );

  let arMatch: RegExpExecArray | null;
  while ((arMatch = arabicDatePattern.exec(normalized)) !== null) {
    const day = parseInt(arMatch[1], 10);
    const monthName = arMatch[2].trim();
    const monthIndex = ARABIC_MONTHS_MAP[monthName];
    const year = arMatch[3] ? parseInt(arMatch[3], 10) : today.getFullYear();

    if (monthIndex !== undefined) {
      const dateObj = new Date(year, monthIndex, day);
      dateObj.setHours(0, 0, 0, 0);

      if (dateObj < today) {
        const fullArabicMatch = arMatch[0];
        return {
          isPast: true,
          detectedDateText: fullArabicMatch,
          detectedDate: dateObj,
          warningMessage: `التاريخ المدخل ("${fullArabicMatch}") تاريخ قديم ومنقضٍ وغير دقيق! لا يمكن وضع جدول مذاكرة لامتحان قد مضى. يرجى تحديد تاريخ قادم.`,
        };
      }
    }
  }

  // 5. Check for standalone past years: e.g. 2020, 2021, 2022, 2023, 2024, 2025
  const currentYear = today.getFullYear();
  const pastYearPattern = /\b(20[0-2][0-9])\b/g;
  let yearMatch: RegExpExecArray | null;
  while ((yearMatch = pastYearPattern.exec(normalized)) !== null) {
    const y = parseInt(yearMatch[1], 10);
    if (y < currentYear) {
      return {
        isPast: true,
        detectedDateText: String(y),
        warningMessage: `السنة المدخلة (${y}) سنة ماضية وغير دقيقة. يرجى تحديد تاريخ في العام الحالي أو القادم.`,
      };
    }
  }

  return {
    isPast: false,
    warningMessage: null,
  };
}

/**
 * Returns a nicely formatted future date string in Arabic and ISO.
 */
export function getFutureDate(daysFromNow: number): { iso: string; arabic: string } {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);

  const iso = d.toISOString().split('T')[0];

  const arabicMonths = [
    'يناير',
    'فبراير',
    'مارس',
    'أبريل',
    'مايو',
    'يونيو',
    'يوليو',
    'أغسطس',
    'سبتمبر',
    'أكتوبر',
    'نوفمبر',
    'ديسمبر',
  ];

  const arabic = `${d.getDate()} ${arabicMonths[d.getMonth()]} ${d.getFullYear()}`;
  return { iso, arabic };
}
