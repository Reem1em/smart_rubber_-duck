/** Static payload served when every model in the chain fails. */
export function codeLabFallback() {
  return {
    type: 'code_lab',
    projects: [
      {
        difficulty: 'Easy',
        title: 'محلل درجات الطلاب وحساب التقدير (Student Grade Analyzer)',
        description: 'برنامج يستقبل قائمة درجات ويحسب المتوسط، أعلى درجة، وأقل درجة مع التحقق من مدخلات الأرقام.',
        keyRequirements: ['قراءة المصفوفات والتكرار', 'التحقق من المدخلات السالبة أو الفارغة', 'طباعة تقرير مبسط'],
      },
      {
        difficulty: 'Intermediate',
        title: 'نظام إدارة مهام الذاكرة المؤقتة (LRU Cache Simulator)',
        description: 'بناء نظام محاكاة لـ LRU Cache باستعمال القوائم المترابطة المزدوجة وقواميس الهاش.',
        keyRequirements: ['ربط Doubly LinkedList مع HashMap', 'إدارة حجم الكاش الأقصى', 'معالجة الحالات الحدية للذاكرة'],
      },
      {
        difficulty: 'Advanced',
        title: 'محرك جدولة العمليات الموازي (Thread-Safe Task Scheduler)',
        description: 'تطوير مكتبة جدولة مهام متزامنة تدعم الأولويات والعمل الموازي الخالي من Deadlocks.',
        keyRequirements: ['استخدام المزامنة والتزامن Safe Concurrency', 'منع السباق والتزامن Deadlock-Free', 'قياس الأداء بدقة عالية'],
      },
    ],
  };
}
