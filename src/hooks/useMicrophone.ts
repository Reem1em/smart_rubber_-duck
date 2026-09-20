import { useState, useEffect, useRef, useCallback } from 'react';

export interface UseMicrophoneResult {
  isListening: boolean;
  transcript: string;
  startListening: (initialText?: string) => void;
  stopListening: () => void;
  resetTranscript: () => void;
  hasSupport: boolean;
  error: string | null;
}

export function useMicrophone(): UseMicrophoneResult {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [hasSupport, setHasSupport] = useState(false);

  const recognitionRef = useRef<any>(null);
  const shouldListenRef = useRef(false);
  const baseTranscriptRef = useRef('');
  const transcriptRef = useRef('');

  // Synchronize transcriptRef with current transcript
  useEffect(() => {
    transcriptRef.current = transcript;
  }, [transcript]);

  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      setHasSupport(true);
      const instance = new SpeechRecognition();

      // 1. Enable continuous listening so speech doesn't stop on brief pauses
      instance.continuous = true;

      // 2. Enable interim results for real-time live updates
      instance.interimResults = true;

      // 3. Set Arabic language explicitly
      instance.lang = 'ar-SA';

      // Accumulate and preserve text without deleting previous sentences
      instance.onresult = (event: any) => {
        let sessionTranscript = '';
        for (let i = 0; i < event.results.length; i++) {
          sessionTranscript += event.results[i][0].transcript;
        }

        const base = baseTranscriptRef.current;
        let combined = '';
        if (base) {
          const needsSpace =
            base.length > 0 &&
            !base.endsWith(' ') &&
            sessionTranscript.length > 0 &&
            !sessionTranscript.startsWith(' ');
          combined = base + (needsSpace ? ' ' : '') + sessionTranscript;
        } else {
          combined = sessionTranscript;
        }

        transcriptRef.current = combined;
        setTranscript(combined);
      };

      instance.onerror = (event: any) => {
        console.warn('Speech recognition warning:', event.error);
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          setError('تم رفض الوصول إلى الميكروفون في إعدادات المتصفح.');
          shouldListenRef.current = false;
          setIsListening(false);
        } else if (event.error === 'no-speech') {
          // Ignore no-speech error; onend will automatically restart
        } else {
          setError(`تنبيه التسجيل الصوتي: ${event.error}`);
        }
      };

      // 4. Auto-restart recognition on end if the user is still in listening mode
      instance.onend = () => {
        // Store accumulated transcript into base before restarting recognition
        baseTranscriptRef.current = transcriptRef.current;

        if (shouldListenRef.current) {
          try {
            instance.start();
          } catch (e) {
            setTimeout(() => {
              if (shouldListenRef.current) {
                try {
                  instance.start();
                } catch (err) {
                  console.warn('Auto-restart recognition retry failed:', err);
                }
              }
            }, 300);
          }
        } else {
          setIsListening(false);
        }
      };

      recognitionRef.current = instance;
    } else {
      setHasSupport(false);
    }

    return () => {
      if (recognitionRef.current) {
        shouldListenRef.current = false;
        try {
          recognitionRef.current.stop();
        } catch (e) {
          // ignore cleanup errors
        }
      }
    };
  }, []);

  const startListening = useCallback((initialText?: string) => {
    if (!recognitionRef.current) {
      setError('خاصية التعرف على الصوت غير مدعومة في هذا المتصفح.');
      return;
    }
    setError(null);
    shouldListenRef.current = true;
    setIsListening(true);

    if (typeof initialText === 'string') {
      baseTranscriptRef.current = initialText;
      transcriptRef.current = initialText;
      setTranscript(initialText);
    } else {
      baseTranscriptRef.current = transcriptRef.current;
    }

    try {
      recognitionRef.current.start();
    } catch (e: any) {
      console.warn('Start listening note:', e);
    }
  }, []);

  const stopListening = useCallback(() => {
    shouldListenRef.current = false;
    setIsListening(false);
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        console.error(e);
      }
    }
    baseTranscriptRef.current = transcriptRef.current;
  }, []);

  const resetTranscript = useCallback(() => {
    baseTranscriptRef.current = '';
    transcriptRef.current = '';
    setTranscript('');
  }, []);

  return {
    isListening,
    transcript,
    startListening,
    stopListening,
    resetTranscript,
    hasSupport,
    error,
  };
}

