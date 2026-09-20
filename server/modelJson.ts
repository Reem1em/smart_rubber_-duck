/** Parses a structured-output response body, defaulting to an empty object. */
export function parseModelJson(text: string | undefined): any {
  return JSON.parse(text || '{}');
}

/** Same, but tolerates a response wrapped in a markdown code fence. */
export function parseModelJsonWithFences(text: string | undefined): any {
  let responseText = (text || '{}').trim();
  if (responseText.startsWith('```')) {
    responseText = responseText.replace(/^```[a-zA-Z]*\n?/, '').replace(/```$/, '').trim();
  }
  return JSON.parse(responseText);
}
