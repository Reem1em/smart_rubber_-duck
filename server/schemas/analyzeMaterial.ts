import { Type } from '@google/genai';

export const analyzeMaterialSchema = {
  type: Type.OBJECT,
  properties: {
    modules: {
      type: Type.ARRAY,
      description: 'قائمة شاملة وتفصيلية لكل الفصول أو الأسابيع أو الأقسام الرئيسية في المستند من الصفحة الأولى حتى الأخيرة دون استثناء أو تلخيص',
      items: {
        type: Type.OBJECT,
        properties: {
          title: {
            type: Type.STRING,
            description: 'اسم وعنوان الوحدة أو الفصل أو الأسبوع كما ورد بالملف تماماً'
          },
          concepts: {
            type: Type.ARRAY,
            description: '3 إلى 5 مفاهيم جوهرية دقيقة وتطبيقية تابعة لهذه الوحدة حصراً',
            items: {
              type: Type.OBJECT,
              properties: {
                name: {
                  type: Type.STRING,
                  description: 'اسم المفهوم العلمي أو التطبيقي الدقيق'
                },
                coreFocus: {
                  type: Type.STRING,
                  description: 'شرح تطبيقي موجز في سطر واحد لما يجب أن يشرحه الطالب صوتياً'
                },
                summary: {
                  type: Type.STRING,
                  description: 'ملخص علمي دقيق في سطرين يوضح المفهوم وقوانينه وتطبيقاته'
                },
                keyPrinciples: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: '2 إلى 3 قوانين أو مبادئ أو قواعد تقنية ترتبط بهذا المفهوم'
                },
                difficulty: {
                  type: Type.STRING,
                  description: 'بسيط | متوسط | متقدم'
                }
              },
              required: ['name', 'coreFocus', 'summary']
            }
          }
        },
        required: ['title', 'concepts']
      }
    }
  },
  required: ['modules']
};
