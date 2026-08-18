import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

const PLAYBACK_SPEEDS = [0.75, 1, 1.25, 1.5, 2];

export const formatTime = (seconds) => {
  if (!seconds || isNaN(seconds)) return '00:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

export const resolveVideoUrl = (url) => {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  const baseUrl = import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace(/\/api\/v1\/?$/, '') : '';
  return `${baseUrl}${url.startsWith('/') ? '' : '/'}${url}`;
};

export const isEmbedUrl = (url) => {
  if (!url) return false;
  return (
    url.includes('iframe.videodelivery.net') ||
    url.includes('youtube.com/embed') ||
    url.includes('player.vimeo.com')
  );
};

const VideoPlayer = ({
  streamUrl,
  thumbnailUrl,
  title,
  videoRef,
  playbackRate = 1,
  setPlaybackRate,
  videoPosition = 0,
  percentWatched = 0,
  onLoadedMetadata,
  onTimeUpdate,
  resumeNotice,
  onRestart,
}) => {
  const { t } = useTranslation();
  const [isPlaying, setIsPlaying] = useState(false);

  const resolvedPoster = thumbnailUrl ? resolveVideoUrl(thumbnailUrl) : '';
  const resolvedStream = resolveVideoUrl(streamUrl);

  return (
    <div className="space-y-4">
      {/* Resume Notification Banner */}
      {resumeNotice && (
        <div className="flex items-center justify-between p-3 rounded-2xl bg-blue-50/90 border border-blue-200 text-xs text-blue-900 shadow-xs animate-fade-in">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-blue-700 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{resumeNotice}</span>
          </div>
          {onRestart && (
            <button
              onClick={onRestart}
              type="button"
              className="text-xs font-bold text-blue-700 hover:text-blue-900 underline ml-3 cursor-pointer"
            >
              {t('videoPlayer.restart')}
            </button>
          )}
        </div>
      )}

      {/* Video Player Container */}
      <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-slate-950 shadow-inner flex items-center justify-center group border border-slate-800">
        {resolvedStream ? (
          isEmbedUrl(resolvedStream) ? (
            <iframe
              src={resolvedStream}
              title={title || 'Module Training Video'}
              className="h-full w-full border-0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <video
              ref={videoRef}
              key={resolvedStream}
              src={resolvedStream}
              poster={resolvedPoster || undefined}
              controls
              controlsList="nodownload"
              playsInline
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onLoadedMetadata={onLoadedMetadata}
              onTimeUpdate={onTimeUpdate}
              className="h-full w-full object-contain bg-black"
            >
              {t('videoPlayer.unsupported')}
            </video>
          )
        ) : (
          <div className="relative w-full h-full flex flex-col items-center justify-center p-8 text-center bg-slate-900 overflow-hidden">
            {resolvedPoster && (
              <img
                src={resolvedPoster}
                alt={title || 'Module Thumbnail'}
                className="absolute inset-0 w-full h-full object-cover opacity-25 filter blur-xs"
              />
            )}
            <div className="relative z-10 flex flex-col items-center">
              <div className="h-16 w-16 rounded-2xl bg-slate-800/90 border border-slate-700 flex items-center justify-center mb-3 shadow-lg text-slate-400">
                <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </div>
              <p className="text-sm font-semibold text-slate-200">{title || 'Untitled Module'}</p>
              <p className="text-xs text-slate-400 mt-1">{t('videoPlayer.noVideoDesc')}</p>
            </div>
          </div>
        )}

        {/* Poster indicator overlay when poster is present */}
        {!isPlaying && resolvedPoster && !isEmbedUrl(resolvedStream) && (
          <div className="absolute top-3 right-3 pointer-events-none z-10">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-black/60 backdrop-blur-md text-[10px] font-semibold text-white/90 border border-white/10 shadow-sm">
              {t('videoPlayer.previewPoster')}
            </span>
          </div>
        )}
      </div>

      {/* Video Control Bar: Speed & Watched Progress */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl">
        {/* Playback Speed Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mr-1">
            {t('videoPlayer.speed')}:
          </span>
          {PLAYBACK_SPEEDS.map((spd) => (
            <button
              key={spd}
              type="button"
              onClick={() => {
                if (setPlaybackRate) setPlaybackRate(spd);
                if (videoRef?.current) {
                  videoRef.current.playbackRate = spd;
                }
              }}
              className={`px-2.5 py-1 rounded-xl text-xs font-bold transition cursor-pointer ${
                playbackRate === spd
                  ? 'bg-[#08306B] text-white shadow-xs'
                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              {spd}x
            </button>
          ))}
        </div>

        {/* Progress Indicator */}
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
          <span>{t('videoPlayer.watched')}:</span>
          <span className="font-bold text-[#08306B]">{formatTime(videoPosition)}</span>
          <span className="text-slate-300">/</span>
          <span
            className={`font-bold px-2.5 py-0.5 rounded-full text-[11px] ${
              percentWatched >= 95
                ? 'bg-emerald-100 text-emerald-700 border border-emerald-300/60'
                : 'bg-blue-50 text-blue-700 border border-blue-200/60'
            }`}
          >
            {percentWatched}%
          </span>
        </div>
      </div>
    </div>
  );
};

export default VideoPlayer;
