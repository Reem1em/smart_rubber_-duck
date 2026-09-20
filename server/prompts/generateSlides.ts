/** Smart Slide Cards presentation prompt (4-6 slides). */
export function buildSlidesPrompt({ conceptName, conceptSummary, keyPrinciples, materialContext }: {
  conceptName: string;
  conceptSummary: string;
  keyPrinciples: any;
  materialContext?: string;
}): string {
  const prompt = `أنت المعلم الخبير والبطة المطاطية التعلمية.
قم بإعداد عرض تقديمي تفاعلي عالي الجودة ومميز يتكون من 4 إلى 6 شرائح تعليمية (Smart Slide Cards) لمفهوم: "${conceptName}".
ملخص المفهوم: "${conceptSummary}"
المبادئ الرئيسية: ${JSON.stringify(keyPrinciples)}
السياق التعليمي: "${(materialContext || '').slice(0, 1000)}"

يجب أن تعود المخرجات بـ JSON هيكلي مطابق للشكل التالي:
{
  "presentationTitle": "عنوان العرض التقديمي باللغة العربية",
  "slides": [
    {
      "slideNumber": 1,
      "title": "عنوان الشريحة",
      "bulletPoints": ["نقطة محورية 1", "نقطة محورية 2", "نقطة محورية 3"],
      "duckTip": "نصيحة ذكية من البطة المطاطية باللغة العربية"
    }
  ]
}`;

  return prompt;
}
