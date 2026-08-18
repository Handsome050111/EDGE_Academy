import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../../services/api';
import Pagination from '../../../components/Pagination';

const QuestionBankTab = ({ showNotification }) => {
  const { t } = useTranslation();

  // Core Data States
  const [modules, setModules] = useState([]);
  const [selectedModuleId, setSelectedModuleId] = useState('');
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Pagination (8 questions per page)
  const [questionsPage, setQuestionsPage] = useState(1);
  const QUESTIONS_PER_PAGE = 8;

  // Single Question Form State
  const [questionForm, setQuestionForm] = useState({
    question_text: '',
    option_a: '',
    option_b: '',
    option_c: '',
    option_d: '',
    correct_option: 'A',
    difficulty: 'medium',
    concept_tag: '',
    explanation: '',
  });

  // Edit Question Modal State
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState(null);
  const [editForm, setEditForm] = useState({
    question_text: '',
    option_a: '',
    option_b: '',
    option_c: '',
    option_d: '',
    correct_option: 'A',
    difficulty: 'medium',
    concept_tag: '',
    explanation: '',
  });

  // CSV Bulk Importer States
  const [csvFile, setCsvFile] = useState(null);
  const [csvSummary, setCsvSummary] = useState(null);
  const [csvErrors, setCsvErrors] = useState([]);

  useEffect(() => {
    loadModules();
  }, []);

  const loadModules = async () => {
    try {
      const res = await api.get('/modules');
      const mods = res.data || [];
      setModules(mods);
      if (mods.length > 0 && !selectedModuleId) {
        setSelectedModuleId(mods[0]._id);
      }
    } catch (err) {
      showNotification('error', 'Failed to load modules');
    }
  };

  useEffect(() => {
    if (selectedModuleId) {
      loadQuestions(selectedModuleId);
    } else {
      setQuestions([]);
    }
    setQuestionsPage(1);
  }, [selectedModuleId]);

  const loadQuestions = async (modId) => {
    setLoading(true);
    try {
      const res = await api.get(`/admin/modules/${modId}/questions`);
      setQuestions(res.data || []);
    } catch (err) {
      showNotification('error', 'Failed to load questions for module');
    } finally {
      setLoading(false);
    }
  };

  // Paginated Questions
  const paginatedQuestions = useMemo(() => {
    const start = (questionsPage - 1) * QUESTIONS_PER_PAGE;
    return questions.slice(start, start + QUESTIONS_PER_PAGE);
  }, [questions, questionsPage]);

  // Create Single Question Handler
  const handleCreateQuestion = async (e) => {
    e.preventDefault();
    if (!selectedModuleId) {
      showNotification('error', 'Please select a module first.');
      return;
    }

    if (!questionForm.question_text.trim() || !questionForm.option_a.trim() || !questionForm.option_b.trim()) {
      showNotification('error', 'Question text and options are required.');
      return;
    }

    setActionLoading(true);
    try {
      const res = await api.post(`/admin/modules/${selectedModuleId}/questions`, questionForm);
      setQuestions((prev) => [res.data, ...prev]);
      setQuestionForm({
        question_text: '',
        option_a: '',
        option_b: '',
        option_c: '',
        option_d: '',
        correct_option: 'A',
        difficulty: 'medium',
        concept_tag: '',
        explanation: '',
      });
      showNotification('success', 'MCQ Question created and added to question bank!');
    } catch (err) {
      showNotification('error', err.response?.data?.message || err.message || 'Failed to create question');
    } finally {
      setActionLoading(false);
    }
  };

  // Open Edit Modal
  const handleOpenEdit = (q) => {
    setEditingQuestion(q);
    setEditForm({
      question_text: q.question_text || q.questionText || '',
      option_a: q.option_a || '',
      option_b: q.option_b || '',
      option_c: q.option_c || '',
      option_d: q.option_d || '',
      correct_option: q.correct_option || 'A',
      difficulty: q.difficulty || 'medium',
      concept_tag: q.concept_tag || '',
      explanation: q.explanation || '',
    });
    setShowEditModal(true);
  };

  // Save Versioned Edit (deactivates old version, creates vN+1)
  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingQuestion) return;

    setActionLoading(true);
    try {
      const res = await api.put(`/admin/questions/${editingQuestion._id}`, editForm);
      const newVersion = res.data;
      showNotification('success', `Question updated to version v${newVersion.version || (editingQuestion.version + 1)}!`);
      setShowEditModal(false);
      loadQuestions(selectedModuleId);
    } catch (err) {
      showNotification('error', err.response?.data?.message || err.message || 'Failed to update question');
    } finally {
      setActionLoading(false);
    }
  };

  // Soft Delete Question
  const handleDeleteQuestion = async (q) => {
    if (!window.confirm(`Are you sure you want to delete this question?`)) return;

    setActionLoading(true);
    try {
      await api.delete(`/admin/questions/${q._id}`);
      setQuestions((prev) => prev.filter((item) => item._id !== q._id));
      showNotification('success', 'Question deleted successfully.');
    } catch (err) {
      showNotification('error', err.response?.data?.message || err.message || 'Failed to delete question');
    } finally {
      setActionLoading(false);
    }
  };

  // CSV Bulk Importer
  const handleCsvImport = async (e) => {
    e.preventDefault();
    if (!csvFile) {
      showNotification('error', 'Please select a CSV file to import.');
      return;
    }

    setActionLoading(true);
    setCsvErrors([]);
    setCsvSummary(null);

    try {
      const formData = new FormData();
      formData.append('file', csvFile);
      if (selectedModuleId) {
        formData.append('moduleId', selectedModuleId);
      }

      const res = await api.post('/admin/questions/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setCsvSummary(res.data);
      if (res.data.errors && res.data.errors.length > 0) {
        setCsvErrors(res.data.errors);
      }

      showNotification('success', `CSV Import finished: ${res.data.successCount} added, ${res.data.failedCount} failed.`);
      setCsvFile(null);
      if (selectedModuleId) {
        loadQuestions(selectedModuleId);
      }
    } catch (err) {
      showNotification('error', err.response?.data?.message || err.message || 'CSV Import failed');
    } finally {
      setActionLoading(false);
    }
  };

  // Sample CSV Template Downloader
  const handleDownloadSampleCsv = () => {
    const csvContent = 'question_text,option_a,option_b,option_c,option_d,correct_option,difficulty,concept_tag,explanation\n' +
      '"What is the maximum distance for CAT6 cabling?","100 meters","50 meters","200 meters","500 meters","A","easy","cable_types","Standard ethernet limit is 100 meters."\n' +
      '"Which connector is commonly used for Single Mode fiber?","LC connector","RJ11","VGA","BNC","A","medium","fiber_sfp","LC and SC are common fiber connector types."';

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'sample_questions_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getDifficultyBadge = (diff) => {
    switch (diff) {
      case 'easy':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'hard':
        return 'bg-rose-100 text-rose-800 border-rose-200';
      default:
        return 'bg-amber-100 text-amber-800 border-amber-200';
    }
  };

  return (
    <div className="space-y-8">
      {/* Header & Module Selector Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Question Bank & MCQ Engine</h2>
          <p className="text-xs text-slate-500 mt-0.5">Author single questions with immutable versioning or bulk import questions via CSV</p>
        </div>

        <div className="flex items-center gap-3">
          <label className="text-xs font-semibold text-slate-700 shrink-0">Working Module:</label>
          <select
            value={selectedModuleId}
            onChange={(e) => setSelectedModuleId(e.target.value)}
            className="px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:border-[#08306B] outline-none bg-white font-medium min-w-[220px]"
          >
            {modules.map((m) => (
              <option key={m._id} value={m._id}>
                {m.title} ({m.tier || 'L1_CORE'})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Two Column Layout: Single MCQ Form (Left) & CSV Importer (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Single MCQ Builder Form */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5">
          <h3 className="text-base font-bold text-slate-900">Single MCQ Builder</h3>

          <form onSubmit={handleCreateQuestion} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Question Prompt *</label>
              <textarea
                rows={2}
                required
                value={questionForm.question_text}
                onChange={(e) => setQuestionForm((prev) => ({ ...prev, question_text: e.target.value }))}
                placeholder="Type question prompt (supports technical terms & codes)..."
                className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:border-[#08306B] outline-none resize-none"
              />
            </div>

            {/* 4 Multiple Choice Options */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {['A', 'B', 'C', 'D'].map((opt) => {
                const fieldKey = `option_${opt.toLowerCase()}`;
                const isCorrect = questionForm.correct_option === opt;

                return (
                  <div
                    key={opt}
                    className={`p-3 rounded-xl border transition ${
                      isCorrect ? 'bg-emerald-50/70 border-emerald-400 ring-1 ring-emerald-400' : 'border-slate-200 bg-slate-50/50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-bold text-slate-800">Option {opt}</span>
                      <label className="flex items-center gap-1 text-[11px] font-semibold text-slate-600 cursor-pointer">
                        <input
                          type="radio"
                          name="correctOption"
                          value={opt}
                          checked={isCorrect}
                          onChange={(e) => setQuestionForm((prev) => ({ ...prev, correct_option: e.target.value }))}
                          className="text-emerald-600 focus:ring-emerald-500"
                        />
                        <span>Correct Answer</span>
                      </label>
                    </div>
                    <input
                      type="text"
                      required
                      value={questionForm[fieldKey]}
                      onChange={(e) => setQuestionForm((prev) => ({ ...prev, [fieldKey]: e.target.value }))}
                      placeholder={`Enter answer option ${opt}...`}
                      className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white focus:border-[#08306B] outline-none"
                    />
                  </div>
                );
              })}
            </div>

            {/* Difficulty, Concept Tag & Explanation */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Difficulty</label>
                <select
                  value={questionForm.difficulty}
                  onChange={(e) => setQuestionForm((prev) => ({ ...prev, difficulty: e.target.value }))}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:border-[#08306B] outline-none bg-white"
                >
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">Concept Tag (snake_case) *</label>
                <input
                  type="text"
                  required
                  value={questionForm.concept_tag}
                  onChange={(e) => setQuestionForm((prev) => ({ ...prev, concept_tag: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') }))}
                  placeholder="e.g. cable_types or safety_dguv"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:border-[#08306B] outline-none font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Post-Attempt Explanation</label>
              <input
                type="text"
                value={questionForm.explanation}
                onChange={(e) => setQuestionForm((prev) => ({ ...prev, explanation: e.target.value }))}
                placeholder="Explain why the correct answer is right for post-quiz review..."
                className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:border-[#08306B] outline-none"
              />
            </div>

            <div className="flex items-center justify-end pt-2">
              <button
                type="submit"
                disabled={actionLoading}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-[#08306B] text-white hover:bg-[#0a3d87] shadow-xs transition cursor-pointer disabled:opacity-50"
              >
                {actionLoading ? 'Adding...' : '+ Add Question to Module'}
              </button>
            </div>
          </form>
        </div>

        {/* Right 1 Col: CSV Bulk Importer */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-base font-bold text-slate-900">CSV Bulk Importer</h3>
              <button
                type="button"
                onClick={handleDownloadSampleCsv}
                className="text-[11px] text-[#08306B] font-semibold hover:underline cursor-pointer flex items-center gap-1"
                title="Download CSV Template"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Template
              </button>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Upload multiple questions in bulk. Columns: <code className="text-[10px] bg-slate-100 p-0.5 rounded">question_text, option_a, option_b, option_c, option_d, correct_option, difficulty, concept_tag, explanation</code>.
            </p>

            <form onSubmit={handleCsvImport} className="mt-4 space-y-3">
              <div className="border-2 border-dashed border-slate-300 rounded-xl p-4 text-center hover:border-[#08306B] transition cursor-pointer bg-slate-50">
                <input
                  type="file"
                  accept=".csv"
                  onChange={(e) => setCsvFile(e.target.files[0])}
                  className="w-full text-xs text-slate-500 file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-[#08306B] file:text-white cursor-pointer"
                />
              </div>

              <button
                type="submit"
                disabled={!csvFile || actionLoading}
                className="w-full py-2.5 rounded-xl text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition cursor-pointer disabled:opacity-40"
              >
                {actionLoading ? 'Processing CSV...' : 'Run CSV Bulk Import'}
              </button>
            </form>

            {/* CSV Import Results Matrix */}
            {csvSummary && (
              <div className="mt-4 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-2">
                <div className="flex items-center justify-between font-bold">
                  <span className="text-emerald-700">Inserted: {csvSummary.successCount}</span>
                  <span className="text-rose-700">Failed: {csvSummary.failedCount}</span>
                </div>

                {csvErrors.length > 0 && (
                  <div className="max-h-36 overflow-y-auto space-y-1 pt-2 border-t border-slate-200 text-[11px]">
                    <p className="font-semibold text-rose-800">Errors encountered:</p>
                    {csvErrors.map((err, idx) => (
                      <p key={idx} className="text-rose-600">
                        Row {err.row}: {err.error}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Versioned Question Bank Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Module Question Bank ({questions.length} Active Questions)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">Learner quizzes pull random active questions from this bank</p>
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center">
            <div className="h-8 w-8 animate-spin rounded-full border-3 border-[#08306B] border-t-transparent mx-auto" />
            <p className="text-xs text-slate-500 mt-2 font-medium">Loading questions...</p>
          </div>
        ) : questions.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-sm font-semibold text-slate-700">No questions in this module yet.</p>
            <p className="text-xs text-slate-500 mt-1">Add at least 5 questions to satisfy the Publish Quality Guard.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3.5">Version</th>
                  <th className="px-4 py-3.5">Question Prompt</th>
                  <th className="px-4 py-3.5">Correct Answer</th>
                  <th className="px-4 py-3.5">Concept Tag</th>
                  <th className="px-4 py-3.5">Difficulty</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {paginatedQuestions.map((q) => {
                  const correctKey = `option_${(q.correct_option || 'a').toLowerCase()}`;
                  const correctText = q[correctKey] || '—';

                  return (
                    <tr key={q._id} className="hover:bg-slate-50/70 transition">
                      <td className="px-5 py-3.5">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                          v{q.version || 1}
                        </span>
                      </td>

                      <td className="px-4 py-3.5 max-w-sm">
                        <p className="font-semibold text-slate-900 line-clamp-2">{q.question_text || q.questionText}</p>
                        {q.explanation && (
                          <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1 italic">{q.explanation}</p>
                        )}
                      </td>

                      <td className="px-4 py-3.5">
                        <p className="font-bold text-emerald-700">Option {q.correct_option}:</p>
                        <p className="text-[11px] text-slate-600 truncate max-w-[160px]">{correctText}</p>
                      </td>

                      <td className="px-4 py-3.5">
                        <span className="font-mono text-[11px] px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md">
                          {q.concept_tag}
                        </span>
                      </td>

                      <td className="px-4 py-3.5">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase border ${getDifficultyBadge(q.difficulty)}`}>
                          {q.difficulty || 'medium'}
                        </span>
                      </td>

                      <td className="px-5 py-3.5 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            onClick={() => handleOpenEdit(q)}
                            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 hover:text-[#08306B] transition cursor-pointer"
                            title="Edit & Create New Version"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDeleteQuestion(q)}
                            className="p-1.5 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition cursor-pointer"
                            title="Soft Delete Question"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="p-4 bg-slate-50/50 border-t border-slate-200">
          <Pagination
            currentPage={questionsPage}
            totalItems={questions.length}
            pageSize={QUESTIONS_PER_PAGE}
            onPageChange={setQuestionsPage}
            itemLabel="questions"
          />
        </div>
      </div>

      {/* Edit Question Modal (Versioning) */}
      {showEditModal && editingQuestion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-bold text-slate-900">
              Edit Question (Creates Version v{(editingQuestion.version || 1) + 1})
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">Existing quiz records will retain v{editingQuestion.version || 1} for historic accuracy</p>

            <form onSubmit={handleSaveEdit} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Question Prompt</label>
                <textarea
                  rows={2}
                  required
                  value={editForm.question_text}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, question_text: e.target.value }))}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:border-[#08306B] outline-none resize-none"
                />
              </div>

              {['A', 'B', 'C', 'D'].map((opt) => {
                const fieldKey = `option_${opt.toLowerCase()}`;
                const isCorrect = editForm.correct_option === opt;

                return (
                  <div key={opt} className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-700 w-6">({opt})</span>
                    <input
                      type="text"
                      required
                      value={editForm[fieldKey]}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, [fieldKey]: e.target.value }))}
                      className="flex-1 px-3 py-1.5 text-xs border border-slate-300 rounded-lg outline-none focus:border-[#08306B]"
                    />
                    <label className="flex items-center gap-1 text-[11px] font-semibold text-slate-600 cursor-pointer shrink-0">
                      <input
                        type="radio"
                        name="editCorrect"
                        value={opt}
                        checked={isCorrect}
                        onChange={(e) => setEditForm((prev) => ({ ...prev, correct_option: e.target.value }))}
                        className="text-emerald-600"
                      />
                      <span>Correct</span>
                    </label>
                  </div>
                );
              })}

              <div className="grid grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Difficulty</label>
                  <select
                    value={editForm.difficulty}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, difficulty: e.target.value }))}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl outline-none bg-white"
                  >
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Concept Tag</label>
                  <input
                    type="text"
                    required
                    value={editForm.concept_tag}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, concept_tag: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') }))}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl outline-none font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Explanation</label>
                <input
                  type="text"
                  value={editForm.explanation}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, explanation: e.target.value }))}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#08306B] text-white hover:bg-[#0a3d87] transition cursor-pointer disabled:opacity-50"
                >
                  {actionLoading ? 'Saving...' : 'Save New Version'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuestionBankTab;
