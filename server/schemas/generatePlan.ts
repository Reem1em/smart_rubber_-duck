import { Type } from '@google/genai';

export const studyPlanSchema = {
  type: Type.OBJECT,
  properties: {
    type: { type: Type.STRING, enum: ['study_plan'] },
    courseName: { type: Type.STRING },
    dateWarning: { type: Type.STRING },
    examScheduleInput: {
      type: Type.OBJECT,
      properties: {
        userExamDates: { type: Type.STRING },
        dailyStudyHours: { type: Type.STRING },
      },
      required: ['userExamDates', 'dailyStudyHours'],
    },
    weeklyPlan: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          day: { type: Type.STRING },
          tasks: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                action: { type: Type.STRING },
                topic: { type: Type.STRING },
                durationMinutes: { type: Type.NUMBER },
              },
              required: ['action', 'topic', 'durationMinutes'],
            },
          },
          examMilestoneNotice: { type: Type.STRING },
        },
        required: ['day', 'tasks'],
      },
    },
  },
  required: ['type', 'courseName', 'examScheduleInput', 'weeklyPlan'],
};
