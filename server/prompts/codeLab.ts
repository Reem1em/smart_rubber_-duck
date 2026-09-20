/** Generates three practice projects (Easy / Intermediate / Advanced). */
export function buildCodeLabPrompt({ lang, top }: { lang: string; top: string }): string {
  const prompt = `You are an expert AI mentor in Computer Engineering and Software Engineering.
Generate 3 COMPLETELY UNIQUE practice projects for language/topic: "${lang} - ${top}".
Tailor them strictly to three distinct difficulty levels:
1. Easy: Focuses on core syntax, fundamental logic, and basic concepts.
2. Intermediate: Combines multiple concepts, handles basic edge cases, and manages data structures.
3. Advanced: Focuses on clean architecture, performance optimization, edge-case management, or low-level systems integration.

Output JSON strictly following this schema:
{
  "type": "code_lab",
  "projects": [
    {
      "difficulty": "Easy",
      "title": "Project Title",
      "description": "Clear description of what the program should accomplish.",
      "keyRequirements": ["Requirement 1", "Requirement 2"]
    },
    {
      "difficulty": "Intermediate",
      "title": "Project Title",
      "description": "Clear description of what the program should accomplish.",
      "keyRequirements": ["Requirement 1", "Requirement 2"]
    },
    {
      "difficulty": "Advanced",
      "title": "Project Title",
      "description": "Clear description of what the program should accomplish.",
      "keyRequirements": ["Requirement 1", "Requirement 2"]
    }
  ]
}`;

  return prompt;
}
