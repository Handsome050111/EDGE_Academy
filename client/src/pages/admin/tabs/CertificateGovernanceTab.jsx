import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../../services/api';
import Pagination from '../../../components/Pagination';

const CertificateGovernanceTab = ({ showNotification }) => {
  const { t } = useTranslation();

  // Signatory Config Form State
  const [configForm, setConfigForm] = useState({
    director_name: '',
    director_title: '',
    director_signature_url: '',
    director_signature_file: null,
    director_signature_preview: '',
    remove_director_signature: false,
    instructor_name: '',
    instructor_title: '',
    instructor_signature_url: '',
    instructor_signature_file: null,
    instructor_signature_preview: '',
    remove_instructor_signature: false,
  });
  const [configLoading, setConfigLoading] = useState(false);

  // Helper to resolve backend image URLs
  const resolveUrl = (url) => {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) return url;
    const backendBase = import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace('/api/v1', '') : 'http://localhost:5000';
    return `${backendBase}${url.startsWith('/') ? '' : '/'}${url}`;
  };

  // Certificates List State
  const [certificates, setCertificates] = useState([]);
  const [loadingCertificates, setLoadingCertificates] = useState(false);
  const [certPage, setCertPage] = useState(1);
  const CERTS_PER_PAGE = 8;

  // Revocation Modal State
  const [showRevokeModal, setShowRevokeModal] = useState(false);
  const [selectedCert, setSelectedCert] = useState(null);
  const [revocationReason, setRevocationReason] = useState('');
  const [revokeLoading, setRevokeLoading] = useState(false);

  // Search Filter
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchConfig();
    fetchCertificates();
  }, []);

  const fetchConfig = async () => {
    try {
      const res = await api.get('/certificates/config');
      if (res.data) {
        setConfigForm({
          director_name: res.data.director_name || '',
          director_title: res.data.director_title || '',
          director_signature_url: res.data.director_signature_url || '',
          director_signature_file: null,
          director_signature_preview: '',
          remove_director_signature: false,
          instructor_name: res.data.instructor_name || '',
          instructor_title: res.data.instructor_title || '',
          instructor_signature_url: res.data.instructor_signature_url || '',
          instructor_signature_file: null,
          instructor_signature_preview: '',
          remove_instructor_signature: false,
        });
      }
    } catch (err) {
      console.error('Error fetching certificate config:', err);
    }
  };

  const fetchCertificates = async () => {
    setLoadingCertificates(true);
    try {
      const res = await api.get('/certificates/verify/all');
      setCertificates(res.data || []);
    } catch (err) {
      showNotification('error', 'Failed to load issued certificates list');
      setCertificates([]);
    } finally {
      setLoadingCertificates(false);
    }
  };

  const handleDirectorFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const preview = URL.createObjectURL(file);
      setConfigForm((prev) => ({
        ...prev,
        director_signature_file: file,
        director_signature_preview: preview,
        remove_director_signature: false,
      }));
    }
  };

  const handleInstructorFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const preview = URL.createObjectURL(file);
      setConfigForm((prev) => ({
        ...prev,
        instructor_signature_file: file,
        instructor_signature_preview: preview,
        remove_instructor_signature: false,
      }));
    }
  };

  const handleRemoveDirectorSignature = () => {
    setConfigForm((prev) => ({
      ...prev,
      director_signature_url: '',
      director_signature_file: null,
      director_signature_preview: '',
      remove_director_signature: true,
    }));
  };

  const handleRemoveInstructorSignature = () => {
    setConfigForm((prev) => ({
      ...prev,
      instructor_signature_url: '',
      instructor_signature_file: null,
      instructor_signature_preview: '',
      remove_instructor_signature: true,
    }));
  };

  const handleSaveConfig = async (e) => {
    e.preventDefault();
    setConfigLoading(true);
    try {
      const formData = new FormData();
      formData.append('director_name', configForm.director_name);
      formData.append('director_title', configForm.director_title);
      formData.append('instructor_name', configForm.instructor_name);
      formData.append('instructor_title', configForm.instructor_title);

      if (configForm.director_signature_file) {
        formData.append('director_signature', configForm.director_signature_file);
      } else if (configForm.remove_director_signature) {
        formData.append('remove_director_signature', 'true');
      }

      if (configForm.instructor_signature_file) {
        formData.append('instructor_signature', configForm.instructor_signature_file);
      } else if (configForm.remove_instructor_signature) {
        formData.append('remove_instructor_signature', 'true');
      }

      const res = await api.put('/certificates/config', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (res.data?.config) {
        setConfigForm((prev) => ({
          ...prev,
          director_signature_url: res.data.config.director_signature_url || '',
          director_signature_file: null,
          director_signature_preview: '',
          remove_director_signature: false,
          instructor_signature_url: res.data.config.instructor_signature_url || '',
          instructor_signature_file: null,
          instructor_signature_preview: '',
          remove_instructor_signature: false,
        }));
      }

      showNotification('success', res.data?.message || 'Certificate template signatories & signatures saved successfully!');
    } catch (err) {
      showNotification('error', err.response?.data?.message || err.message || 'Failed to save configuration');
    } finally {
      setConfigLoading(false);
    }
  };

  // Filtered Certificates
  const filteredCertificates = useMemo(() => {
    if (!searchQuery.trim()) return certificates;
    const q = searchQuery.toLowerCase().trim();
    return certificates.filter((c) => {
      const certId = (c.certificate_id || '').toLowerCase();
      const engName = (c.engineer_id?.fullName || c.engineer_id?.full_name || c.user_name || '').toLowerCase();
      const engEmail = (c.engineer_id?.email || c.user_email || '').toLowerCase();
      const trackName = (c.track_id?.name || c.track_name || '').toLowerCase();
      return certId.includes(q) || engName.includes(q) || engEmail.includes(q) || trackName.includes(q);
    });
  }, [certificates, searchQuery]);

  useEffect(() => {
    setCertPage(1);
  }, [searchQuery]);

  const paginatedCertificates = useMemo(() => {
    const start = (certPage - 1) * CERTS_PER_PAGE;
    return filteredCertificates.slice(start, start + CERTS_PER_PAGE);
  }, [filteredCertificates, certPage]);

  // Open Revocation Modal
  const handleOpenRevoke = (cert) => {
    setSelectedCert(cert);
    setRevocationReason('');
    setShowRevokeModal(true);
  };

  // Confirm Revocation
  const handleConfirmRevocation = async (e) => {
    e.preventDefault();
    if (!selectedCert) return;

    if (!revocationReason.trim()) {
      showNotification('error', 'Mandatory revocation reason is required.');
      return;
    }

    setRevokeLoading(true);
    try {
      const res = await api.post(`/admin/certificates/${selectedCert._id || selectedCert.id}/revoke`, {
        revocation_reason: revocationReason.trim(),
      });

      showNotification('success', `Certificate '${selectedCert.certificate_id}' revoked successfully.`);
      setShowRevokeModal(false);
      setSelectedCert(null);

      // Refresh certificates
      fetchCertificates();
    } catch (err) {
      showNotification('error', err.response?.data?.message || err.message || 'Failed to revoke certificate');
    } finally {
      setRevokeLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-900">Certificate Governance & Signatories</h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Configure official certificate signatories, inspect issued credentials, and manage certificate revocations
        </p>
      </div>

      {/* Two Column Section: Signatory Config (Left) & Summary Stats (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Signatory Form */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-base font-bold text-slate-900">Certificate Template Signatories</h3>
              <p className="text-xs text-slate-500">Signatures rendered dynamically onto generated PDF certificates</p>
            </div>
            <span className="text-xs font-mono px-2.5 py-1 bg-slate-100 rounded-lg text-slate-700">Official Signatures</span>
          </div>

          <form onSubmit={handleSaveConfig} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
              {/* Director Card */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">Director Credentials</span>
                  <span className="text-[10px] font-semibold text-blue-600 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
                    Official Signatory
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Director Full Name</label>
                  <input
                    type="text"
                    required
                    value={configForm.director_name}
                    onChange={(e) => setConfigForm((prev) => ({ ...prev, director_name: e.target.value }))}
                    className="w-full px-3.5 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:border-[#08306B] outline-none"
                    placeholder="e.g. Anya Sharma"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Director Title / Role</label>
                  <input
                    type="text"
                    required
                    value={configForm.director_title}
                    onChange={(e) => setConfigForm((prev) => ({ ...prev, director_title: e.target.value }))}
                    className="w-full px-3.5 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:border-[#08306B] outline-none"
                    placeholder="e.g. Director, Technonex EDGE Academy"
                  />
                </div>

                {/* Director Signature Upload / Preview */}
                <div className="pt-2 border-t border-slate-200">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Original Handwritten Signature</label>
                  {configForm.director_signature_preview || (configForm.director_signature_url && !configForm.remove_director_signature) ? (
                    <div className="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-10 w-28 bg-slate-100/70 border border-slate-200 rounded-lg flex items-center justify-center p-1 overflow-hidden">
                          <img
                            src={configForm.director_signature_preview || resolveUrl(configForm.director_signature_url)}
                            alt="Director Signature"
                            className="max-h-full max-w-full object-contain"
                          />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-emerald-700 truncate">Custom Signature Uploaded</p>
                          <p className="text-[10px] text-slate-400">Rendered dynamically on certificate</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleRemoveDirectorSignature}
                        className="text-xs text-rose-600 hover:text-rose-700 font-semibold px-2.5 py-1 rounded-lg hover:bg-rose-50 border border-rose-200 transition cursor-pointer"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <label className="flex flex-col items-center justify-center p-3 border-2 border-dashed border-slate-300 hover:border-[#08306B] bg-white rounded-xl cursor-pointer transition group">
                        <div className="flex items-center gap-2 text-slate-600 group-hover:text-[#08306B]">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                          </svg>
                          <span className="text-xs font-semibold">Upload Signature File (PNG/JPG/SVG)</span>
                        </div>
                        <span className="text-[10px] text-slate-400 mt-0.5">Transparent PNG recommended</span>
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/svg+xml,image/webp"
                          onChange={handleDirectorFileChange}
                          className="hidden"
                        />
                      </label>
                      <p className="text-[10px] text-slate-400 italic">
                        *If not uploaded, the system will use cursive font signature automatically.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Instructor Card */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">Instructor Credentials</span>
                  <span className="text-[10px] font-semibold text-blue-600 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
                    Lead Instructor
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Lead Instructor Full Name</label>
                  <input
                    type="text"
                    required
                    value={configForm.instructor_name}
                    onChange={(e) => setConfigForm((prev) => ({ ...prev, instructor_name: e.target.value }))}
                    className="w-full px-3.5 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:border-[#08306B] outline-none"
                    placeholder="e.g. James Chen"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Instructor Title / Role</label>
                  <input
                    type="text"
                    required
                    value={configForm.instructor_title}
                    onChange={(e) => setConfigForm((prev) => ({ ...prev, instructor_title: e.target.value }))}
                    className="w-full px-3.5 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:border-[#08306B] outline-none"
                    placeholder="e.g. Lead Instructor"
                  />
                </div>

                {/* Instructor Signature Upload / Preview */}
                <div className="pt-2 border-t border-slate-200">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Original Handwritten Signature</label>
                  {configForm.instructor_signature_preview || (configForm.instructor_signature_url && !configForm.remove_instructor_signature) ? (
                    <div className="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-10 w-28 bg-slate-100/70 border border-slate-200 rounded-lg flex items-center justify-center p-1 overflow-hidden">
                          <img
                            src={configForm.instructor_signature_preview || resolveUrl(configForm.instructor_signature_url)}
                            alt="Instructor Signature"
                            className="max-h-full max-w-full object-contain"
                          />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-emerald-700 truncate">Custom Signature Uploaded</p>
                          <p className="text-[10px] text-slate-400">Rendered dynamically on certificate</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleRemoveInstructorSignature}
                        className="text-xs text-rose-600 hover:text-rose-700 font-semibold px-2.5 py-1 rounded-lg hover:bg-rose-50 border border-rose-200 transition cursor-pointer"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <label className="flex flex-col items-center justify-center p-3 border-2 border-dashed border-slate-300 hover:border-[#08306B] bg-white rounded-xl cursor-pointer transition group">
                        <div className="flex items-center gap-2 text-slate-600 group-hover:text-[#08306B]">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                          </svg>
                          <span className="text-xs font-semibold">Upload Signature File (PNG/JPG/SVG)</span>
                        </div>
                        <span className="text-[10px] text-slate-400 mt-0.5">Transparent PNG recommended</span>
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/svg+xml,image/webp"
                          onChange={handleInstructorFileChange}
                          className="hidden"
                        />
                      </label>
                      <p className="text-[10px] text-slate-400 italic">
                        *If not uploaded, the system will use cursive font signature automatically.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={configLoading}
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-[#08306B] text-white hover:bg-[#0a3d87] shadow-sm transition cursor-pointer disabled:opacity-50 flex items-center gap-2"
              >
                {configLoading ? (
                  <>
                    <div className="h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Saving Changes...</span>
                  </>
                ) : (
                  <span>Save Signatory Configuration & Signatures</span>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Certificate Credential Metrics */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col justify-between space-y-4">
          <div>
            <h3 className="text-base font-bold text-slate-900 mb-1">Credential Metrics</h3>
            <p className="text-xs text-slate-500">Live platform certification counts</p>

            <div className="mt-4 space-y-3">
              <div className="p-3.5 bg-emerald-50 rounded-xl border border-emerald-100 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-emerald-800">Active Certificates</p>
                  <p className="text-2xl font-extrabold text-emerald-900 mt-1">
                    {certificates.filter((c) => c.status !== 'revoked').length}
                  </p>
                </div>
                <div className="h-10 w-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                  </svg>
                </div>
              </div>

              <div className="p-3.5 bg-rose-50 rounded-xl border border-rose-100 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-rose-800">Revoked Credentials</p>
                  <p className="text-2xl font-extrabold text-rose-900 mt-1">
                    {certificates.filter((c) => c.status === 'revoked').length}
                  </p>
                </div>
                <div className="h-10 w-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          <p className="text-[11px] text-slate-400">
            Public verification links are served at <code className="text-slate-600 font-mono">/verify/:id</code>
          </p>
        </div>
      </div>

      {/* Issued Certificates & Revocation Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Issued Certificates Registry ({certificates.length} Credentials)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">Search credentials and manage administrative revocations</p>
          </div>

          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by ID, engineer name, or track..."
            className="px-3.5 py-1.5 text-xs border border-slate-300 rounded-xl outline-none focus:border-[#08306B] min-w-[240px]"
          />
        </div>

        {loadingCertificates ? (
          <div className="p-12 text-center">
            <div className="h-8 w-8 animate-spin rounded-full border-3 border-[#08306B] border-t-transparent mx-auto" />
            <p className="text-xs text-slate-500 mt-2 font-medium">Loading credentials registry...</p>
          </div>
        ) : filteredCertificates.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-sm font-semibold text-slate-700">No certificates found.</p>
            <p className="text-xs text-slate-500 mt-1">Certificates are automatically awarded when engineers achieve 100% track completion.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3.5">Certificate ID</th>
                  <th className="px-4 py-3.5">Recipient Engineer</th>
                  <th className="px-4 py-3.5">Certified Track</th>
                  <th className="px-4 py-3.5">Issued Date</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {paginatedCertificates.map((cert) => {
                  const isRevoked = cert.status === 'revoked';
                  const engName = cert.engineer_id?.fullName || cert.engineer_id?.full_name || cert.user_name || 'Engineer';
                  const engEmail = cert.engineer_id?.email || cert.user_email || '';
                  const trackTitle = cert.track_id?.name || cert.track_name || 'Certification Track';

                  return (
                    <tr key={cert._id || cert.id} className="hover:bg-slate-50/70 transition">
                      <td className="px-5 py-3.5">
                        <span className="font-mono font-bold text-slate-900">
                          {cert.certificate_id || 'CERT-N/A'}
                        </span>
                      </td>

                      <td className="px-4 py-3.5">
                        <p className="font-semibold text-slate-900">{engName}</p>
                        {engEmail && <p className="text-[11px] text-slate-500">{engEmail}</p>}
                      </td>

                      <td className="px-4 py-3.5">
                        <p className="font-medium text-slate-800">{trackTitle}</p>
                      </td>

                      <td className="px-4 py-3.5 text-slate-500 text-[11px]">
                        {cert.issued_at || cert.createdAt
                          ? new Date(cert.issued_at || cert.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                          : '—'}
                      </td>

                      <td className="px-4 py-3.5">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                            isRevoked
                              ? 'bg-rose-100 text-rose-800 border-rose-200'
                              : 'bg-emerald-100 text-emerald-800 border-emerald-200'
                          }`}
                        >
                          {isRevoked ? 'Revoked' : 'Active'}
                        </span>
                        {isRevoked && cert.revocation_reason && (
                          <p className="text-[10px] text-rose-600 mt-0.5 italic truncate max-w-[140px]" title={cert.revocation_reason}>
                            Reason: {cert.revocation_reason}
                          </p>
                        )}
                      </td>

                      <td className="px-5 py-3.5 text-right">
                        <div className="inline-flex items-center gap-2">
                          <a
                            href={`/verify/${cert.certificate_id}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs font-semibold text-[#08306B] hover:underline"
                          >
                            Verify Link
                          </a>

                          {!isRevoked && (
                            <button
                              onClick={() => handleOpenRevoke(cert)}
                              className="px-2.5 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                            >
                              Revoke
                            </button>
                          )}
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
            currentPage={certPage}
            totalItems={filteredCertificates.length}
            pageSize={CERTS_PER_PAGE}
            onPageChange={setCertPage}
            itemLabel="certificates"
          />
        </div>
      </div>

      {/* Mandatory Revocation Reason Modal */}
      {showRevokeModal && selectedCert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100">
            <div className="h-10 w-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center mb-3">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
            </div>
            <h3 className="text-base font-bold text-slate-900">Revoke Certificate</h3>
            <p className="text-xs text-slate-600 mt-1">
              Revoking certificate <strong className="text-slate-900 font-mono">{selectedCert.certificate_id}</strong> will immediately invalidate public verification.
            </p>

            <form onSubmit={handleConfirmRevocation} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Mandatory Revocation Reason *
                </label>
                <textarea
                  rows={3}
                  required
                  value={revocationReason}
                  onChange={(e) => setRevocationReason(e.target.value)}
                  placeholder="State the justification for revoking this certificate (e.g. academic integrity breach, employment termination)..."
                  className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:border-rose-600 outline-none resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setShowRevokeModal(false);
                    setSelectedCert(null);
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={revokeLoading}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600 text-white hover:bg-rose-700 transition cursor-pointer disabled:opacity-50"
                >
                  {revokeLoading ? 'Revoking...' : 'Confirm Revocation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CertificateGovernanceTab;
