/**
 * Deterministic Python execution for the Code Lab, in the student's own browser (Pyodide).
 *
 * The grader no longer "imagines" whether code works: it is run here and the real output,
 * exception and sample results are sent to the server as facts.
 *
 * Pyodide lives in a dedicated Web Worker so student code never touches the page (no DOM,
 * no app state, no auth tokens) and an infinite loop can be killed by terminating the worker.
 * Runs are serialized; a timed-out run tears the worker down and the next run starts fresh.
 */
import type { CodeExecutionReport, CustomLabTestCase, CustomLabTestRun, PythonRunResult, SampleCheck } from '../types';
import { isExecutionSuccess, parseSample, sampleMatches } from './execution/compare';

export { isPythonLanguage } from './execution/compare';

const PYODIDE_VERSION = '0.26.4';
const PYODIDE_INDEX_URL = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;

/** First load downloads ~10 MB (then browser-cached). */
const LOAD_TIMEOUT_MS = 60000;
/** Per run; anything longer is treated as an infinite loop. */
const RUN_TIMEOUT_MS = 5000;

export const PYTHON_RUNTIME_UNAVAILABLE = 'تعذر تشغيل بيئة بايثون في المتصفح. تأكد من اتصالك بالإنترنت وحاول مرة أخرى.';

/** Thrown when Pyodide itself cannot start (offline, CDN blocked); the code was never run. */
export class PythonRuntimeError extends Error {
  constructor(message = PYTHON_RUNTIME_UNAVAILABLE) {
    super(message);
    this.name = 'PythonRuntimeError';
  }
}

/**
 * Runs student code with stdin wired to `input()`, captures stdout, reports the exception
 * as "Line N: Type: message" (student lines only), then evaluates "expr => expected" samples
 * that contain a function call against the program's namespace. Sample-side prints are discarded so they don't pollute
 * the program output.
 */
const PYTHON_HARNESS = String.raw`
import ast, builtins, io, json, sys, traceback

_MAX_OUT = 10000

def _describe(exc):
    if isinstance(exc, SyntaxError):
        return f"Line {exc.lineno}: SyntaxError: {exc.msg}"
    message = "".join(traceback.format_exception_only(type(exc), exc)).strip()
    line = None
    for frame in traceback.extract_tb(exc.__traceback__):
        if frame.filename == "<student>":
            line = frame.lineno
    return f"Line {line}: {message}" if line else message

def __quackly_run(code, stdin, samples_json):
    samples = json.loads(samples_json)
    out = io.StringIO()
    feed = io.StringIO(stdin)

    def _input(prompt=""):
        out.write(str(prompt))
        line = feed.readline()
        if not line:
            raise EOFError("EOF when reading a line")
        return line[:-1] if line.endswith("\n") else line

    namespace = {"__name__": "__main__", "__builtins__": builtins, "input": _input}
    saved = (sys.stdout, sys.stderr, sys.stdin)
    sys.stdout, sys.stderr, sys.stdin = out, io.StringIO(), feed
    error = None
    checks = []
    try:
        try:
            exec(compile(code, "<student>", "exec"), namespace)
        except SystemExit:
            pass
        except BaseException as exc:
            error = _describe(exc)
        output = out.getvalue()
        if error is None:
            sys.stdout = io.StringIO()
            for sample in samples:
                try:
                    tree = ast.parse(sample["expression"], mode="eval")
                except SyntaxError:
                    continue  # prose, not an executable expression
                if not any(isinstance(node, ast.Call) for node in ast.walk(tree)):
                    continue  # "5 => 25" describes stdin I/O, not a call to check
                compiled = compile(tree, "<sample>", "eval")
                check = {"expression": sample["expression"], "expected": sample["expected"]}
                try:
                    value = eval(compiled, namespace)
                    check["str"] = str(value)
                    check["repr"] = repr(value)
                except BaseException as exc:
                    check["error"] = _describe(exc)
                checks.append(check)
    finally:
        sys.stdout, sys.stderr, sys.stdin = saved
    if len(output) > _MAX_OUT:
        output = output[:_MAX_OUT] + "\n...(truncated)"
    return json.dumps({"output": output, "error": error, "checks": checks})
`;

const WORKER_SOURCE = `
importScripts(${JSON.stringify(`${PYODIDE_INDEX_URL}pyodide.js`)});
const ready = loadPyodide({ indexURL: ${JSON.stringify(PYODIDE_INDEX_URL)} }).then((py) => {
  py.runPython(${JSON.stringify(PYTHON_HARNESS)});
  return py;
});
ready.then(
  () => postMessage({ type: 'ready' }),
  (err) => postMessage({ type: 'init-error', message: String(err && err.message || err) })
);
onmessage = async (event) => {
  const { id, code, stdin, samples } = event.data;
  const py = await ready;
  try {
    const run = py.globals.get('__quackly_run');
    const json = run(code, stdin, JSON.stringify(samples));
    run.destroy();
    postMessage({ type: 'result', id, raw: JSON.parse(json) });
  } catch (err) {
    postMessage({ type: 'result', id, raw: { output: '', error: String(err && err.message || err), checks: [] } });
  }
};
`;

interface RawCheck {
  expression: string;
  expected: string;
  str?: string;
  repr?: string;
  error?: string;
}

interface RawRun {
  output: string;
  error: string | null;
  checks: RawCheck[];
  timedOut?: boolean;
}

interface Runtime {
  worker: Worker;
  ready: Promise<void>;
  pending: Map<number, (raw: RawRun) => void>;
}

let runtime: Runtime | null = null;
let nextRunId = 0;
/** Serializes runs so a timeout only ever kills the run that caused it. */
let queue: Promise<unknown> = Promise.resolve();

function stopRuntime(): void {
  runtime?.worker.terminate();
  runtime = null;
}

function startRuntime(): Runtime {
  if (runtime) return runtime;

  const url = URL.createObjectURL(new Blob([WORKER_SOURCE], { type: 'text/javascript' }));
  const worker = new Worker(url);
  URL.revokeObjectURL(url);
  const pending = new Map<number, (raw: RawRun) => void>();

  const ready = new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new PythonRuntimeError()), LOAD_TIMEOUT_MS);
    worker.onmessage = (event: MessageEvent) => {
      const data = event.data;
      if (data?.type === 'ready') {
        clearTimeout(timer);
        resolve();
      } else if (data?.type === 'init-error') {
        clearTimeout(timer);
        console.error('Pyodide failed to load:', data.message);
        reject(new PythonRuntimeError());
      } else if (data?.type === 'result') {
        pending.get(data.id)?.(data.raw as RawRun);
        pending.delete(data.id);
      }
    };
    worker.onerror = (event) => {
      clearTimeout(timer);
      console.error('Pyodide worker error:', event.message);
      reject(new PythonRuntimeError());
    };
  });

  const started: Runtime = { worker, ready, pending };
  // A failed start must not poison later attempts.
  ready.catch(() => {
    if (runtime === started) stopRuntime();
  });
  runtime = started;
  return started;
}

/** One isolated run. Rejects only with PythonRuntimeError; code errors come back in the result. */
function runRaw(code: string, stdin: string, samples: Array<{ expression: string; expected: string }>): Promise<RawRun> {
  const job = queue.then(async (): Promise<RawRun> => {
    const rt = startRuntime();
    await rt.ready;
    const id = nextRunId++;
    return new Promise<RawRun>((resolve) => {
      const timer = setTimeout(() => {
        rt.pending.delete(id);
        stopRuntime(); // the only way to stop a runaway loop
        resolve({ output: '', error: null, checks: [], timedOut: true });
      }, RUN_TIMEOUT_MS);
      rt.pending.set(id, (raw) => {
        clearTimeout(timer);
        resolve(raw);
      });
      rt.worker.postMessage({ id, code, stdin, samples });
    });
  });
  queue = job.catch(() => undefined);
  return job;
}

const timeoutMessage = `Timeout: execution exceeded ${RUN_TIMEOUT_MS / 1000}s (possible infinite loop)`;

/** Loads the runtime ahead of time (e.g. when the Code Lab opens) so the first check is fast. */
export function preloadPython(): void {
  startRuntime().ready.catch(() => undefined);
}

/** Runs `code` once; `inputs` are fed line by line to input(). */
export async function executePython(code: string, inputs: string[] = []): Promise<PythonRunResult> {
  const raw = await runRaw(code, inputs.join('\n'), []);
  if (raw.timedOut) return { success: false, output: '', error: timeoutMessage, timedOut: true };
  return raw.error ? { success: false, output: raw.output, error: raw.error } : { success: true, output: raw.output };
}

/** Builder / Bug-Hunter: run the submission and check every executable "expr => expected" sample. */
export async function runSubmission(code: string, sampleIO: string[] = []): Promise<CodeExecutionReport> {
  const samples = sampleIO.map(parseSample).filter((s): s is { expression: string; expected: string } => s !== null);
  const raw = await runRaw(code, '', samples);

  const sampleChecks: SampleCheck[] = raw.checks.map((c) =>
    c.error !== undefined
      ? { expression: c.expression, expected: c.expected, actual: '', passed: false, error: c.error }
      : {
          expression: c.expression,
          expected: c.expected,
          actual: c.str ?? '',
          passed: sampleMatches(c.str ?? '', c.repr ?? '', c.expected),
        }
  );
  const report = {
    actualOutput: raw.output,
    consoleErrors: raw.timedOut ? timeoutMessage : raw.error ?? '',
    timedOut: !!raw.timedOut,
    sampleChecks,
  };
  return { ...report, executionSuccess: isExecutionSuccess(report, sampleChecks) };
}

/** Custom Lab: run the code once per test case with that case's input on stdin. */
export async function runTestCases(code: string, testCases: CustomLabTestCase[]): Promise<CustomLabTestRun[]> {
  const runs: CustomLabTestRun[] = [];
  for (const [testIndex, tc] of testCases.entries()) {
    const raw = await runRaw(code, tc.input, []);
    runs.push(
      raw.timedOut
        ? { testIndex, actualOutput: '', error: timeoutMessage, timedOut: true }
        : { testIndex, actualOutput: raw.output, ...(raw.error ? { error: raw.error } : {}) }
    );
  }
  return runs;
}
