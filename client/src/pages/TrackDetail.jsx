import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../services/api';

const TrackDetail = () => {
  const { trackId } = useParams();
  const [track, setTrack] = useState(null);
  const [progress, setProgress] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchTrackData = async () => {
      try {
        const [trackResponse, progressResponse] = await Promise.all([
          api.get(`/tracks/${trackId}`),
          api.get(`/progress/${trackId}`),
        ]);

        setTrack(trackResponse.data?.data || trackResponse.data || null);
        setProgress(progressResponse.data || null);
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to load track details');
      } finally {
        setLoading(false);
      }
    };

    fetchTrackData();
  }, [trackId]);

  const modules = track?.modules || [];
  const completedModuleIds = useMemo(() => {
    return (progress?.completedModules || []).map((item) => item.moduleId?._id || item.moduleId);
  }, [progress]);

  const overallProgress = useMemo(() => {
    if (!modules.length) return 0;
    const completedCount = modules.filter((moduleItem) => completedModuleIds.includes(moduleItem._id)).length;
    return Math.round((completedCount / modules.length) * 100);
  }, [completedModuleIds, modules]);

  if (loading) {
    return <div className="p-6 text-gray-600">Loading track details...</div>;
  }

  if (error) {
    return <div className="p-6 text-red-600">{error}</div>;
  }

  return (
    <div className="p-6">
      <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h1 className="text-3xl font-semibold text-gray-900">{track?.title || 'Track'}</h1>
        <p className="mt-2 text-gray-600">{track?.description || 'No description available.'}</p>

        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between text-sm text-gray-600">
            <span>Overall progress</span>
            <span>{overallProgress}%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-gray-200">
            <div className="h-2 rounded-full bg-green-500" style={{ width: `${overallProgress}%` }} />
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {modules.map((moduleItem) => {
          const isCompleted = completedModuleIds.includes(moduleItem._id);
          const thumb = moduleItem.thumbnail_url || moduleItem.thumbnailUrl;

          return (
            <div key={moduleItem._id} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4 min-w-0">
                <div className="h-16 w-28 rounded-xl bg-slate-900 overflow-hidden shrink-0 border border-slate-200 flex items-center justify-center">
                  {thumb ? (
                    <img src={thumb} alt={moduleItem.title} className="w-full h-full object-cover" />
                  ) : (
                    <svg className="w-6 h-6 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  )}
                </div>
                <div className="min-w-0">
                  <h2 className="text-base font-bold text-gray-900 truncate">{moduleItem.title}</h2>
                  <p className="mt-1 text-xs text-gray-600 line-clamp-2">{moduleItem.description || 'No description available.'}</p>
                </div>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold shrink-0 ${isCompleted ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'}`}>
                {isCompleted ? 'Completed' : 'Pending'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default TrackDetail;
