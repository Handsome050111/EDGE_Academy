import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../services/api';

const VerificationPage = () => {
  const { id, certificate_id } = useParams();
  const certIdParam = id || certificate_id;

  const [certData, setCertData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchVerification();
  }, [certIdParam]);

  const fetchVerification = async () => {
    if (!certIdParam) return;
    try {
      setLoading(true);
      setError('');
      const res = await api.get(`/certificates/verify/${certIdParam}`);
      if (res.data) {
        setCertData(res.data);
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || `Certificate ID "${certIdParam}" is invalid or does not exist.`);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadPdf = async () => {
    if (!certId) return;
    try {
      const res = await api.get(`/certificates/${certId}/pdf`, { responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${certId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download failed, trying direct link:', err);
      window.open(`/api/v1/certificates/${certId}/pdf`, '_blank');
    }
  };

  const isValid = certData?.valid === true || certData?.status === 'active';
  const certId = certData?.certificate_id || certData?.certificate?.certificate_id || certIdParam;
  const recipientName = certData?.engineer_name || certData?.certificate?.engineer_id?.fullName || certData?.certificate?.engineer_id?.full_name || certData?.certificate?.engineer_id?.name || 'Technonex Engineer';
  const trackTitle = certData?.track || certData?.certificate?.track_id?.title || certData?.certificate?.track_id?.name || 'EDGE Certified Technician';
  const tier = certData?.tier || certData?.certificate?.tier || 'L1_CORE';
  const issueDateRaw = certData?.issued_at || certData?.certificate?.issued_at || new Date();
  const issueDateFormatted = new Date(issueDateRaw).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const directorName = certData?.director_name || certData?.certificate?.director_name || '';
  const directorSignatureUrl = certData?.director_signature_url || certData?.certificate?.director_signature_url || '';
  const instructorName = certData?.instructor_name || certData?.certificate?.instructor_name || '';
  const instructorSignatureUrl = certData?.instructor_signature_url || certData?.certificate?.instructor_signature_url || '';
  const downloadUrl = `/api/v1/certificates/${certId}/pdf`;

  const resolveUrl = (url) => {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) return url;
    const backendBase = import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace('/api/v1', '') : 'http://localhost:5000';
    return `${backendBase}${url.startsWith('/') ? '' : '/'}${url}`;
  };

  return (
    <div className="min-h-screen bg-[#F0F4F8] flex flex-col justify-between font-sans text-slate-900">
      {/* Top Header */}
      <header className="bg-white border-b border-slate-200 text-slate-900 px-6 py-3.5 shadow-xs flex items-center justify-between z-20">
        <div className="flex items-center gap-3">
          <Link to="/" className="flex items-center">
            <img src="/logo.png" alt="Technonex" className="h-7 w-auto object-contain" />
          </Link>
          <span className="text-xs text-slate-500 border-l border-slate-200 pl-3 font-medium">EDGE Academy Official Verification Portal</span>
        </div>
        <Link to="/" className="text-xs font-semibold bg-[#0A2540] hover:bg-[#071a2e] text-white px-4 py-2 rounded-xl transition shadow-xs">
          Portal Home →
        </Link>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col justify-center space-y-6">
        {loading ? (
          <div className="bg-white rounded-3xl p-12 text-center shadow-lg border border-slate-200 space-y-4">
            <div className="inline-block h-10 w-10 animate-spin rounded-full border-4 border-solid border-[#0A2540] border-r-transparent"></div>
            <p className="text-sm font-semibold text-slate-600">Verifying certificate authenticity...</p>
          </div>
        ) : error || !certData ? (
          <div className="bg-white rounded-3xl p-8 sm:p-12 text-center shadow-xl border border-rose-100 space-y-5">
            <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto">
              <svg className="w-8 h-8 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-2xl font-extrabold text-slate-900">Certificate Verification Failed</h2>
            <p className="text-sm text-slate-600 max-w-md mx-auto">{error || `No certificate record found for ID "${certIdParam}".`}</p>
            <div className="pt-2">
              <Link to="/" className="inline-block bg-[#0A2540] text-white text-xs font-bold px-6 py-3 rounded-xl hover:bg-[#071a2e] transition">
                Return to EDGE Academy Portal
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Status & Action Bar */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${
                  isValid ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                }`}>
                  {isValid ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-extrabold text-slate-900">
                      {isValid ? 'Officially Verified & Authentic Certificate' : 'Certificate Revoked'}
                    </h2>
                    <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full uppercase ${
                      isValid ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-rose-100 text-rose-800 border border-rose-300'
                    }`}>
                      {isValid ? 'Active' : 'Revoked'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Certificate ID: <strong className="font-mono text-slate-800">{certId}</strong> &nbsp;|&nbsp; Issued on: <strong>{issueDateFormatted}</strong>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto">
                <button
                  onClick={handleCopyLink}
                  className="flex-1 sm:flex-none bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold px-4 py-2.5 rounded-xl border border-slate-200 transition cursor-pointer"
                >
                  {copied ? 'Link Copied' : 'Copy Link'}
                </button>
                {isValid && (
                  <button
                    onClick={handleDownloadPdf}
                    className="flex-1 sm:flex-none bg-[#0A2540] hover:bg-[#071a2e] text-white text-xs font-bold px-5 py-2.5 rounded-xl shadow-sm transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    <span>Download PDF</span>
                  </button>
                )}
              </div>
            </div>

            {/* VISUAL CERTIFICATE TEMPLATE CONTAINER */}
            <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-4 sm:p-8 overflow-x-auto">
              <div className="min-w-[760px] max-w-[940px] mx-auto bg-white p-8 sm:p-12 relative rounded-lg border-2 border-[#0A2540] shadow-sm select-none" style={{ aspectRatio: '1.414 / 1' }}>
                {/* SVG Corner Accents & Inner Frame */}
                <svg className="absolute inset-0 w-full h-full pointer-events-none z-0" viewBox="0 0 1122 794" fill="none" xmlns="http://www.w3.org/2000/svg">
                  {/* Outer Chamfered Border */}
                  <path d="M 52,26 L 1070,26 L 1096,52 L 1096,742 L 1070,768 L 52,768 L 26,742 L 26,52 Z" stroke="#0A2540" strokeWidth="2.5" />
                  {/* Inner Chamfered Border */}
                  <path d="M 56,34 L 1066,34 L 1088,56 L 1088,738 L 1066,760 L 56,760 L 34,738 L 34,56 Z" stroke="#0A2540" strokeWidth="1" />
                  {/* Corner Accent Brackets */}
                  <path d="M 26,52 L 44,52 M 52,26 L 52,44 M 34,56 L 48,48 L 56,34" stroke="#0A2540" strokeWidth="1" />
                  <path d="M 1096,52 L 1078,52 M 1070,26 L 1070,44 M 1088,56 L 1074,48 L 1066,34" stroke="#0A2540" strokeWidth="1" />
                  <path d="M 26,742 L 44,742 M 52,768 L 52,750 M 34,738 L 48,746 L 56,760" stroke="#0A2540" strokeWidth="1" />
                  <path d="M 1096,742 L 1078,742 M 1070,768 L 1070,750 M 1088,738 L 1074,746 L 1066,760" stroke="#0A2540" strokeWidth="1" />
                </svg>

                {/* Certificate Content Grid */}
                <div className="relative z-10 h-full flex flex-col justify-between px-6 py-2">
                  {/* Header Official Logo */}
                  <div className="flex items-center justify-start">
                    <img src="/logo.png" alt="Technonex Logo" className="h-8 sm:h-9 max-w-[200px] object-contain" />
                  </div>

                  {/* Title & Subtitle */}
                  <div className="text-center my-1">
                    <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0A2540] tracking-tight" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                      {trackTitle}
                    </h1>
                    <p className="text-xs sm:text-sm font-bold text-[#B58D3D] uppercase tracking-widest mt-1" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                      Engineering Development & Growth Ecosystem
                    </p>
                  </div>

                  {/* Recipient Name & Gold Line */}
                  <div className="text-center my-2">
                    <h2 className="text-3xl sm:text-4xl font-bold text-[#0A1C30] tracking-wide" style={{ fontFamily: 'Playfair Display, Georgia, serif' }}>
                      {recipientName}
                    </h2>
                    <div className="w-96 sm:w-120 h-0.5 bg-[#C59B27] mx-auto mt-2.5"></div>
                  </div>

                  {/* Citation Body */}
                  <div className="text-center max-w-xl mx-auto space-y-2">
                    <p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-sans">
                      This certificate is proudly awarded to <strong>{recipientName}</strong> in recognition of successful completion and proficiency demonstrated within the <strong>{(tier === 'EDGE' || tier === 'L2_ADVANCED') ? 'EDGE' : 'CORE'}</strong> program. This achievement verifies the acquisition of skills and knowledge required for excellence in engineering and development.
                    </p>
                    <p className="text-xs font-semibold text-slate-900">Issued by Technonex EDGE Academy</p>
                  </div>

                  {/* Signatures & Embossed Medallion */}
                  <div className="flex items-end justify-between pt-2">
                    <div className="flex items-center gap-8 sm:gap-12 text-left">
                      <div>
                        {directorSignatureUrl ? (
                          <div className="h-8 flex items-end border-b border-slate-300 pb-0.5 min-w-[120px]">
                            <img src={resolveUrl(directorSignatureUrl)} alt={directorName} className="max-h-7 max-w-[140px] object-contain" />
                          </div>
                        ) : (
                          <p className="font-serif italic font-bold text-[#0A2540] text-xl border-b border-slate-300 pb-0.5 min-w-[120px]" style={{ fontFamily: 'Dancing Script, cursive' }}>
                            {directorName}
                          </p>
                        )}
                        <p className="text-xs font-bold text-slate-900 mt-1">{directorName}</p>
                        <p className="text-[10px] text-slate-500">Director, Technonex EDGE Academy</p>
                      </div>

                      <div>
                        {instructorSignatureUrl ? (
                          <div className="h-8 flex items-end border-b border-slate-300 pb-0.5 min-w-[120px]">
                            <img src={resolveUrl(instructorSignatureUrl)} alt={instructorName} className="max-h-7 max-w-[140px] object-contain" />
                          </div>
                        ) : (
                          <p className="font-serif italic font-bold text-[#0A2540] text-xl border-b border-slate-300 pb-0.5 min-w-[120px]" style={{ fontFamily: 'Dancing Script, cursive' }}>
                            {instructorName}
                          </p>
                        )}
                        <p className="text-xs font-bold text-slate-900 mt-1">{instructorName}</p>
                        <p className="text-[10px] text-slate-500">Lead Instructor</p>
                      </div>
                    </div>

                    {/* Gold Medallion SVG */}
                    <div className="w-20 h-20 sm:w-24 sm:h-24 shrink-0">
                      <svg viewBox="0 0 160 160" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                        <defs>
                          <radialGradient id="goldGradModal" cx="50%" cy="50%" r="50%" fx="35%" fy="35%">
                            <stop offset="0%" stopColor="#FDF0CD" />
                            <stop offset="35%" stopColor="#D4AF37" />
                            <stop offset="70%" stopColor="#B8860B" />
                            <stop offset="100%" stopColor="#8C6510" />
                          </radialGradient>
                          <linearGradient id="goldRimModal" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#FFF2B2" />
                            <stop offset="50%" stopColor="#B8860B" />
                            <stop offset="100%" stopColor="#5B3D06" />
                          </linearGradient>
                          <path id="topArcModal" d="M 40 78 A 42 42 0 0 1 120 78" fill="none" />
                          <path id="bottomArcModal" d="M 40 82 A 42 42 0 0 0 120 82" fill="none" />
                        </defs>
                        <circle cx="80" cy="80" r="76" fill="url(#goldGradModal)" stroke="url(#goldRimModal)" strokeWidth="2" />
                        <circle cx="80" cy="80" r="72" fill="none" stroke="#FFFFFF" strokeWidth="0.8" opacity="0.6" strokeDasharray="2 2" />
                        <circle cx="80" cy="80" r="62" fill="url(#goldGradModal)" stroke="#784F07" strokeWidth="1.2" />
                        <circle cx="80" cy="80" r="58" fill="none" stroke="#FFF0B0" strokeWidth="1" opacity="0.7" />
                        <text fontSize="8.5" fontWeight="800" fill="#543605" letterSpacing="2">
                          <textPath href="#topArcModal" startOffset="50%" textAnchor="middle">TECHNONEX</textPath>
                        </text>
                        <text x="80" y="86" fontSize="20" fontWeight="900" fill="#422903" textAnchor="middle" letterSpacing="1.5">EDGE</text>
                        <text fontSize="8.5" fontWeight="800" fill="#543605" letterSpacing="2">
                          <textPath href="#bottomArcModal" startOffset="50%" textAnchor="middle">CERTIFIED</textPath>
                        </text>
                      </svg>
                    </div>
                  </div>

                  {/* Metadata Footer */}
                  <div className="text-center text-[10px] text-slate-500 pt-1">
                    Date issued: {issueDateFormatted} &nbsp;|&nbsp; Certificate ID: {certId}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="py-4 text-center text-xs text-slate-400 border-t border-slate-200 bg-white">
        © {new Date().getFullYear()} Technonex EDGE Academy. All rights reserved.
      </footer>
    </div>
  );
};

export default VerificationPage;
