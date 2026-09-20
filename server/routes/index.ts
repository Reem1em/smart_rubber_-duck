import type { Express } from 'express';

import { handleHealth } from './health';
import { handleAnalyzeMaterial } from './analyzeMaterial';
import { handleDiagnose } from './diagnose';
import { handleSocraticEval } from './socraticEval';
import { handleGenerateQuiz } from './generateQuiz';
import { handleFinalDiagnosis } from './finalDiagnosis';
import { handleGenerateSlides } from './generateSlides';
import { handleGeneratePlan } from './generatePlan';
import { handleGenerateCodeLab } from './codeLab';
import { handleGenerateBugChallenge, handleEvaluateBugChallenge } from './bugHunting';
import { handleReviewProject } from './reviewProject';

/** Mounts every Quakly API endpoint, including the legacy un-prefixed aliases. */
export function registerRoutes(app: Express): void {
  // Healthcheck API
  app.get('/api/health', handleHealth);

  // 1. Analyze Uploaded Material & Extract Academic Concepts
  app.post('/api/analyze-material', handleAnalyzeMaterial);

  // 2. Diagnose Student Explanation & Calculate Confidence Gap
  app.post('/api/diagnose', handleDiagnose);

  // 3. Evaluate Socratic Answer & Generate Transfer Challenge
  app.post('/api/socratic-eval', handleSocraticEval);

  // 4. Generate Interactive Quiz Module (5-7 Questions Gradated)
  app.post('/api/generate-quiz', handleGenerateQuiz);

  // 5. Final Diagnostic Evaluation & Mastery Report
  app.post('/api/final-diagnosis', handleFinalDiagnosis);

  // 6. Generate Smart Slide Cards Presentation
  app.post('/api/generate-slides', handleGenerateSlides);

  // 7. FEATURE 3: DOCUMENT-DRIVEN STRICT STUDY PLANNER
  app.post('/api/generate-plan', handleGeneratePlan);
  app.post('/generate-plan', handleGeneratePlan);

  // 8. CODE LAB PROJECT GENERATOR
  app.post('/api/code-lab/generate', handleGenerateCodeLab);
  app.post('/generate-code-lab', handleGenerateCodeLab);

  // 9. BUG HUNTING LAB GENERATOR
  app.post('/api/bug-hunting/generate', handleGenerateBugChallenge);
  app.post('/api/generate-bug-challenge', handleGenerateBugChallenge);
  app.post('/generate-bug-challenge', handleGenerateBugChallenge);

  // 10. BUG HUNTING EVALUATOR
  app.post('/api/bug-hunting/evaluate', handleEvaluateBugChallenge);
  app.post('/api/evaluate-bug-challenge', handleEvaluateBugChallenge);
  app.post('/evaluate-bug-challenge', handleEvaluateBugChallenge);

  // 11. TASK 2: Practical Project Lab & Code Reviewer
  app.post('/api/review-project', handleReviewProject);
  app.post('/review-project', handleReviewProject);
}
