/** Feature 3: document-driven strict study planner prompt. */
export function buildStudyPlanPrompt({ todayStr, docText, examDatesInput, targetExamDate, hoursInput, extraNotes }: {
  todayStr: string;
  docText: string;
  examDatesInput: string;
  targetExamDate?: string;
  hoursInput: string | number;
  extraNotes?: string;
}): string {
  const prompt = `You are an expert AI mentor and backend engine specialized in helping computer engineering and software engineering students develop strong practical and analytical skills.
You power FEATURE 3: DOCUMENT-DRIVEN STRICT STUDY PLANNER.

Today's Real Date: ${todayStr}

Context Provided:
- Attached Course Document / Syllabus Text: "${docText}"
- User Specified Exam Dates: "${examDatesInput || targetExamDate || 'مواعيد امتحانات قادمة'}"
- User Daily Available Study Hours: "${hoursInput}"
- Additional Notes: "${extraNotes || 'بدون'}"

Instructions:
1. DOCUMENT ANALYSIS: Automatically extract course name, chapter titles, core topics, and required assignments ONLY from the attached file text.
2. STRICT ADHERENCE TO SOURCE MATERIAL: Do NOT hallucinate, infer, or add outside topics or concepts that are not explicitly present in the provided document text.
3. EXAM DATES & CHRONOLOGICAL REALISM:
   - Ensure all schedule dates are in the present and future starting from today (${todayStr}) leading up to the exam date.
   - If user input references any past dates, add an explicit warning in "dateWarning" and "examMilestoneNotice".
   - Allocate higher study intensity and review sessions immediately preceding the input exam dates.

Return raw JSON strictly following this schema:
{
  "type": "study_plan",
  "courseName": "Extracted automatically from attached document",
  "examScheduleInput": {
    "userExamDates": "${examDatesInput || targetExamDate}",
    "dailyStudyHours": "${hoursInput}"
  },
  "weeklyPlan": [
    {
      "day": "Day of the week / Date (strictly >= ${todayStr})",
      "tasks": [
        {
          "action": "Review / Practice / Solve Assignment",
          "topic": "Exact topic extracted strictly from attached document",
          "durationMinutes": 60
        }
      ],
      "examMilestoneNotice": "Specific warning/countdown for upcoming exam date entered by user"
    }
  ]
}`;

  return prompt;
}
