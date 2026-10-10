/**
 * /tutorial — Interactive onboarding tutorial.
 *
 * Placeholder. The real page will have:
 * - Step-by-step guide with example subjects
 * - Practice classification (gold-standard subjects)
 * - Explanations of bands, artifacts, what to look for
 *
 * See PRD §FR-4.1, ROADMAP P1-22.
 */
export default function TutorialPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-6 p-8">
      <h1 className="text-3xl font-bold">📚 Tutorial</h1>
      <p className="text-gray-400 max-w-md text-center">
        Learn to identify real objects versus artifacts in SPHEREx images.
      </p>
      <div className="text-gray-500">Tutorial content — see PRD §FR-4.1</div>
    </div>
  );
}
