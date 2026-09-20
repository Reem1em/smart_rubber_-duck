import { Concept, MaterialInput } from '../../types';
import { fetchWithTimeout } from '../../utils/fetchWithTimeout';

export async function analyzeMaterial(material: MaterialInput): Promise<Concept[]> {
  const response = await fetchWithTimeout(
    '/api/analyze-material',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        textContent: material.rawText,
        base64Data: material.base64Data,
        mimeType: material.mimeType,
        fileName: material.fileName,
      }),
    },
    180000 // 3 minutes timeout for thorough full-span traversal of multi-page documents
  );

  if (!response.ok) {
    let errorMsg = 'تعذر استخراج المنهج الأكاديمي من المستند.';
    try {
      const errData = await response.json();
      if (errData?.error) {
        errorMsg = errData.error;
      }
    } catch {
      // ignore
    }
    throw new Error(errorMsg);
  }

  const data = await response.json();
  if (data.concepts && Array.isArray(data.concepts) && data.concepts.length > 0) {
    return data.concepts.map((c: any) => ({
      ...c,
      difficulty:
        c.difficulty === 'متوسط' || c.difficulty === 'intermediate'
          ? 'intermediate'
          : c.difficulty === 'متقدم' || c.difficulty === 'advanced'
          ? 'advanced'
          : 'basic',
    }));
  }

  throw new Error('لم يتمكن محرك التحليل من استخراج مفاهيم صالحة من المستند.');
}

