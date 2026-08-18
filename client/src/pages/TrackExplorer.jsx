import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';

const TrackExplorer = () => {
  const [tracks, setTracks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchTracks = async () => {
      try {
        const response = await api.get('/tracks');
        setTracks(response.data?.data || response.data || []);
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to load tracks');
      } finally {
        setLoading(false);
      }
    };

    fetchTracks();
  }, []);

  if (loading) {
    return <div className="p-6 text-gray-600">Loading tracks...</div>;
  }

  if (error) {
    return <div className="p-6 text-red-600">{error}</div>;
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-semibold text-gray-900">Explore Tracks</h1>
        <p className="mt-2 text-gray-600">Browse available learning paths and start your next module.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {tracks.map((track) => (
          <Link
            key={track._id}
            to={`/tracks/${track._id}`}
            className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">{track.title}</h2>
              <span className="rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-700">
                {track.modules?.length || 0} modules
              </span>
            </div>

            <p className="mb-4 text-sm leading-6 text-gray-600">
              {track.description || 'No description provided yet.'}
            </p>

            <div className="text-sm text-gray-500">
              {track.isPublished ? 'Published' : 'Draft'}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default TrackExplorer;
