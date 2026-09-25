import type { Express } from 'express';

import { handleHealth } from './health';
import { handleAnalyzeMaterial } from './analyzeMaterial';
import { handleDiagnose } from './diagnose';
import { handleSocraticEval } from './socraticEval';
import { handleGenerateQuiz } from './generateQuiz';
import { handleFinalDiagnosis } from './finalDiagnosis';
import { handleGenerateSlides } from './generateSlides';
import { handleParseSyllabus } from './courseRoadmap';
import { handleCourseChat } from './courseChat';
import { handleGenerateCodeLab } from './codeLab';
import { handleGenerateBugChallenge, handleEvaluateBugChallenge } from './bugHunting';
import { handleReviewProject } from './reviewProject';
import { handleGenerateDevChallenge, handleEvaluateDevSubmission } from './devLab';
import { handleAuthConfig, handleAuthMe, handleDevAuth, handleGoogleAuth, handleLogout } from './auth';
import { quotaGuard } from '../auth/quota';

/**
 * Mounts every Quakly API endpoint, including the legacy un-prefixed aliases.
 * Every LLM-backed route sits behind quotaGuard, which meters real token usage.
 */
export function registerRoutes(app: Express): void {
  // Healthcheck API
  app.get('/api/health', handleHealth);

  // 0. AUTH: Google Sign-In + session/quota lookup
  app.get('/api/auth/config', handleAuthConfig);
  app.post('/api/auth/google', handleGoogleAuth);
  app.post('/api/auth/dev', handleDevAuth);
  app.get('/api/auth/me', handleAuthMe);
  app.post('/api/auth/logout', handleLogout);

  // 1. Analyze Uploaded Material & Extract Academic Concepts
  app.post('/api/analyze-material', quotaGuard, handleAnalyzeMaterial);

  // 2. Diagnose Student Explanation & Calculate Confidence Gap
  app.post('/api/diagnose', quotaGuard, handleDiagnose);

  // 3. Evaluate Socratic Answer & Generate Transfer Challenge
  app.post('/api/socratic-eval', quotaGuard, handleSocraticEval);

  // 4. Generate Interactive Quiz Module (5-7 Questions Gradated)
  app.post('/api/generate-quiz', quotaGuard, handleGenerateQuiz);

  // 5. Final Diagnostic Evaluation & Mastery Report
  app.post('/api/final-diagnosis', quotaGuard, handleFinalDiagnosis);

  // 6. Generate Smart Slide Cards Presentation
  app.post('/api/generate-slides', quotaGuard, handleGenerateSlides);

  // 7. COURSE ROADMAP (خريطة المقرر): official syllabus -> week-by-week schedule
  app.post('/api/course-roadmap/parse-syllabus', quotaGuard, handleParseSyllabus);

  // 8. COURSE-ISOLATED AI TUTOR CHAT (اسأل كواكلي)
  app.post('/api/courses/:id/chat', quotaGuard, handleCourseChat);

  // 9. CODE LAB PROJECT GENERATOR
  app.post('/api/code-lab/generate', quotaGuard, handleGenerateCodeLab);
  app.post('/generate-code-lab', quotaGuard, handleGenerateCodeLab);

  // 10. BUG HUNTING LAB GENERATOR
  app.post('/api/bug-hunting/generate', quotaGuard, handleGenerateBugChallenge);
  app.post('/api/generate-bug-challenge', quotaGuard, handleGenerateBugChallenge);
  app.post('/generate-bug-challenge', quotaGuard, handleGenerateBugChallenge);

  // 11. BUG HUNTING EVALUATOR
  app.post('/api/bug-hunting/evaluate', quotaGuard, handleEvaluateBugChallenge);
  app.post('/api/evaluate-bug-challenge', quotaGuard, handleEvaluateBugChallenge);
  app.post('/evaluate-bug-challenge', quotaGuard, handleEvaluateBugChallenge);

  // 12. UNIFIED CODE LAB: dual-mode challenge generator + submission evaluator
  app.post('/api/code-lab/challenge', quotaGuard, handleGenerateDevChallenge);
  app.post('/api/code-lab/evaluate', quotaGuard, handleEvaluateDevSubmission);

  // 13. TASK 2: Practical Project Lab & Code Reviewer
  app.post('/api/review-project', quotaGuard, handleReviewProject);
  app.post('/review-project', quotaGuard, handleReviewProject);
}
