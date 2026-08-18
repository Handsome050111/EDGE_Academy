import { useState, useEffect } from 'react';
import api from '../services/api';

const CertificateConfigModal = ({ isOpen, onClose }) => {
  const [directorName, setDirectorName] = useState('');
  const [directorTitle, setDirectorTitle] = useState('');
  const [instructorName, setInstructorName] = useState('');
  const [instructorTitle, setInstructorTitle] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (isOpen) {
      fetchConfig();
    }
  }, [isOpen]);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      const res = await api.get('/certificates/config');
      if (res.data) {
        setDirectorName(res.data.director_name || '');
        setDirectorTitle(res.data.director_title || '');
        setInstructorName(res.data.instructor_name || '');
        setInstructorTitle(res.data.instructor_title || '');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const res = await api.put('/certificates/config', {
        director_name: directorName,
        director_title: directorTitle,
        instructor_name: instructorName,
        instructor_title: instructorTitle,
      });

      setSuccess(res.data?.message || 'Certificate template configuration saved successfully!');
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to update certificate configuration');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 pb-4">
          <div className="flex items-center gap-2">
            <h3 className="text-xl font-bold text-[#092857]">Certificate Template Configuration</h3>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 focus:outline-none text-xl font-bold cursor-pointer"
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-medium text-red-600 border border-red-100">
            {error}
          </div>
        )}

        {success && (
          <div className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm font-medium text-emerald-600 border border-emerald-100">
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div className="rounded-xl bg-blue-50/60 p-3.5 border border-blue-100 text-xs text-blue-900 leading-relaxed">
            Configure official signees and titles rendered on automatically issued Technonex EDGE & CORE certificates.
          </div>

          <div className="space-y-3">
            <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider">
              1. Academy Director Signature Block
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-gray-600 mb-1">Director Name</label>
                <input
                  type="text"
                  value={directorName}
                  onChange={(e) => setDirectorName(e.target.value)}
                  required
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs outline-none focus:border-[#092857]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-600 mb-1">Director Title</label>
                <input
                  type="text"
                  value={directorTitle}
                  onChange={(e) => setDirectorTitle(e.target.value)}
                  required
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs outline-none focus:border-[#092857]"
                />
              </div>
            </div>
          </div>

          <div className="space-y-3 border-t border-gray-100 pt-3">
            <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider">
              2. Lead Instructor Signature Block
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-gray-600 mb-1">Instructor Name</label>
                <input
                  type="text"
                  value={instructorName}
                  onChange={(e) => setInstructorName(e.target.value)}
                  required
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs outline-none focus:border-[#092857]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-600 mb-1">Instructor Title</label>
                <input
                  type="text"
                  value={instructorTitle}
                  onChange={(e) => setInstructorTitle(e.target.value)}
                  required
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs outline-none focus:border-[#092857]"
                />
              </div>
            </div>
          </div>

          <div className="mt-6 flex justify-end space-x-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-xl bg-[#092857] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#071f45] transition disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Save Template Config'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CertificateConfigModal;
