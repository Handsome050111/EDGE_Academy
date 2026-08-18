import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../services/api';

const QuizModal = ({ moduleId, onClose, onComplete }) => {
  const { t } = useTranslation();
  const [attemptId, setAttemptId] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  useEffect(() => {
    const startQuiz = async () => {
      try {
        setLoading(true);
        setError('');
        const response = await api.post(`/modules/${moduleId}/quiz/start`);
        setAttemptId(response.data.attempt_id);
        setQuestions(response.data.questions || []);
      } catch (err) {
        setError(err.message || err.response?.data?.error?.message || 'Failed to start quiz');
      } finally {
        setLoading(false);
      }
    };

    if (moduleId) {
      startQuiz();
    }
  }, [moduleId]);

  const handleOptionSelect = (questionId, optionKey) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: optionKey,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!attemptId) return;

    try {
      setSubmitting(true);
      setError('');

      const formattedAnswers = Object.entries(answers).map(([qId, key]) => ({
        question_id: qId,
        selected_option: key,
        response_time_ms: 1000, // mock response time
      }));

      const response = await api.post(`/attempts/${attemptId}/submit`, {
        answers: formattedAnswers,
      });

      setResult(response.data);
      if (response.data.passed) {
        onComplete?.();
      }
    } catch (err) {
      setError(err.message || err.response?.data?.error?.message || 'Failed to submit attempt');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="rounded-xl bg-white p-6 shadow-xl">
          <p className="text-gray-600">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">{t('quizModal.title')}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl font-bold cursor-pointer" aria-label={t('common.close')}>
            &times;
          </button>
        </div>

        {error ? (
          <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">
            {error}
          </div>
        ) : null}

        {result ? (
          <div className="space-y-4">
            <div className={`rounded-xl p-4 ${result.passed ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
              <h3 className="text-lg font-bold">{result.passed ? t('quizModal.passed') : t('quizModal.failed')}</h3>
              <p className="text-sm mt-1">{t('quizModal.score', { score: result.score_percent, threshold: result.passing_score_percent || 80 })}</p>
              {!result.passed && (
                <p className="text-xs mt-1 text-red-600">{t('quizModal.retakeNotice')}</p>
              )}
            </div>

            <div className="space-y-3">
              <h4 className="font-semibold text-gray-900">{t('quizModal.reviewAnswers')}</h4>
              {result.responses?.map((res, i) => (
                <div key={res.question_id || i} className={`rounded-lg border p-3 ${res.was_correct ? 'border-green-200 bg-green-50/50' : 'border-red-200 bg-red-50/50'}`}>
                  <p className="text-sm font-medium text-gray-900">{t('quizModal.question')} {i + 1}</p>
                  <p className="text-xs text-gray-600 mt-0.5">{t('quizModal.yourChoice')}: {res.selected_option} | {t('quizModal.correct')}: {res.correct_option}</p>
                  {res.explanation ? (
                    <p className="mt-1 text-xs text-gray-500">{res.explanation}</p>
                  ) : null}
                </div>
              ))}
            </div>

            <button
              onClick={onClose}
              className="w-full rounded-lg bg-[#08306B] py-2 text-white font-semibold cursor-pointer hover:bg-[#062452] transition"
            >
              {t('common.close')}
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {questions.map((q, qIndex) => (
              <div key={q.id} className="rounded-xl border border-gray-200 p-4">
                <p className="mb-3 font-medium text-gray-900">
                  {qIndex + 1}. {q.question_text}
                </p>
                <div className="space-y-2">
                  {q.options?.map((opt) => (
                    <label
                      key={opt.key}
                      className={`flex items-center gap-3 rounded-lg border p-3 text-sm cursor-pointer transition ${
                        answers[q.id] === opt.key ? 'border-[#08306B] bg-blue-50/30' : 'border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name={`question-${q.id}`}
                        value={opt.key}
                        checked={answers[q.id] === opt.key}
                        onChange={() => handleOptionSelect(q.id, opt.key)}
                        className="text-[#08306B] focus:ring-[#08306B]"
                      />
                      <span>
                        <strong className="mr-1">{opt.key}.</strong> {opt.text}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            ))}

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 cursor-pointer"
              >
                {t('common.cancel')}
              </button>
              <button
                type="submit"
                disabled={submitting || Object.keys(answers).length < questions.length}
                className="rounded-lg bg-[#08306B] px-4 py-2 text-sm font-semibold text-white hover:bg-[#062452] disabled:opacity-50 cursor-pointer"
              >
                {submitting ? t('quizModal.submitting') : t('quizModal.submitQuiz')}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default QuizModal;
