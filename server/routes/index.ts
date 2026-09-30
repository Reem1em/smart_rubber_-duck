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
import { handleGenerateDevChallenge, handleEvaluateDevSubmission, handleEvaluateCustomLab } from './devLab';
import { handleAuthConfig, handleAuthMe, handleDevAuth, handleGoogleAuth, handleLogout } from './auth';
import { quotaGuard } from '../auth/quota';
import { apiResponseWatchdog, safe } from '../httpSafety';

/**
 * Mounts every Quakly API endpoint, including the legacy un-prefixed aliases.
 * Every LLM-backed route sits behind quotaGuard, which meters real token usage.
 * Every handler is wrapped in safe() so an async throw becomes a JSON error, not a crash.
 */
export function registerRoutes(app: Express): void {
  // Every /api request is guaranteed a JSON response, even if a handler stalls
  app.use(
    ['/api', '/generate-code-lab', '/generate-bug-challenge', '/evaluate-bug-challenge', '/review-project'],
    apiResponseWatchdog
  );

  // Healthcheck API
  app.get('/api/health', safe(handleHealth));

  // 0. AUTH: Google Sign-In + session/quota lookup
  app.get('/api/auth/config', safe(handleAuthConfig));
  app.post('/api/auth/google', safe(handleGoogleAuth));
  app.post('/api/auth/dev', safe(handleDevAuth));
  app.get('/api/auth/me', safe(handleAuthMe));
  app.post('/api/auth/logout', safe(handleLogout));

  // 1. Analyze Uploaded Material & Extract Academic Concepts
  app.post('/api/analyze-material', safe(quotaGuard), safe(handleAnalyzeMaterial));

  // 2. Diagnose Student Explanation & Calculate Confidence Gap
  app.post('/api/diagnose', safe(quotaGuard), safe(handleDiagnose));

  // 3. Evaluate Socratic Answer & Generate Transfer Challenge
  app.post('/api/socratic-eval', safe(quotaGuard), safe(handleSocraticEval));

  // 4. Generate Interactive Quiz Module (5-7 Questions Gradated)
  app.post('/api/generate-quiz', safe(quotaGuard), safe(handleGenerateQuiz));

  // 5. Final Diagnostic Evaluation & Mastery Report
  app.post('/api/final-diagnosis', safe(quotaGuard), safe(handleFinalDiagnosis));

  // 6. Generate Smart Slide Cards Presentation
  app.post('/api/generate-slides', safe(quotaGuard), safe(handleGenerateSlides));

  // 7. COURSE ROADMAP (خريطة المقرر): official syllabus -> week-by-week schedule
  app.post('/api/course-roadmap/parse-syllabus', safe(quotaGuard), safe(handleParseSyllabus));

  // 8. COURSE-ISOLATED AI TUTOR CHAT (اسأل كواكلي)
  app.post('/api/courses/:id/chat', safe(quotaGuard), safe(handleCourseChat));

  // 9. CODE LAB PROJECT GENERATOR
  app.post('/api/code-lab/generate', safe(quotaGuard), safe(handleGenerateCodeLab));
  app.post('/generate-code-lab', safe(quotaGuard), safe(handleGenerateCodeLab));

  // 10. BUG HUNTING LAB GENERATOR
  app.post('/api/bug-hunting/generate', safe(quotaGuard), safe(handleGenerateBugChallenge));
  app.post('/api/generate-bug-challenge', safe(quotaGuard), safe(handleGenerateBugChallenge));
  app.post('/generate-bug-challenge', safe(quotaGuard), safe(handleGenerateBugChallenge));

  // 11. BUG HUNTING EVALUATOR
  app.post('/api/bug-hunting/evaluate', safe(quotaGuard), safe(handleEvaluateBugChallenge));
  app.post('/api/evaluate-bug-challenge', safe(quotaGuard), safe(handleEvaluateBugChallenge));
  app.post('/evaluate-bug-challenge', safe(quotaGuard), safe(handleEvaluateBugChallenge));

  // 12. UNIFIED CODE LAB: dual-mode challenge generator + submission evaluator
  app.post('/api/code-lab/challenge', safe(quotaGuard), safe(handleGenerateDevChallenge));
  app.post('/api/code-lab/evaluate', safe(quotaGuard), safe(handleEvaluateDevSubmission));
  app.post('/api/code-lab/custom-evaluate', safe(quotaGuard), safe(handleEvaluateCustomLab));

  // 13. TASK 2: Practical Project Lab & Code Reviewer
  app.post('/api/review-project', safe(quotaGuard), safe(handleReviewProject));
  app.post('/review-project', safe(quotaGuard), safe(handleReviewProject));

  // Unknown API paths answer JSON instead of falling through to the SPA's index.html
  app.use('/api', (_req, res) => res.status(404).json({ error: 'المسار المطلوب غير موجود.' }));
}
