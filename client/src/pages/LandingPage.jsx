import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

const officialModules = [
  {
    id: 'm3-rack-fundamentals',
    code: 'M3',
    tier: 'EDGE L1',
    tierBadge: 'EDGE L1',
    category: 'INFRASTRUCTURE',
    badge: 'EDGE L1 • INFRASTRUCTURE',
    title: 'M3: Rack & Cabinet Fundamentals',
    description: 'RU counting, cable dressing to Siemens visual standard, bend radius, and rack elevations.',
    image: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=800&auto=format&fit=crop&q=80',
    duration: '45 min',
    fieldScope: 'Hands-on physical infrastructure standard for installing, organizing, and securing enterprise server racks (12U to 42U) in live customer data centers. Focuses on Siemens benchmark visual cable management, copper/fiber minimum bend radius adherence, hot/cold aisle thermal containment, and PDU distribution.',
    learningOutcomes: [
      'Accurately calculate Rack Unit (RU) spacing and align equipment per elevation diagrams',
      'Dress copper and fiber cabling adhering to Siemens visual benchmark standards with zero-tension velcro',
      'Install M5/M6 cage nuts safely without rail distortion or structural paint scratch damage',
      'Verify Power Distribution Unit (PDU) C13/C14 vs C19/C20 cable routing and thermal airflow management',
      'Perform mandatory before, during, and after photo documentation for field audit sign-off',
    ],
    assessmentMethod: 'Live Viva Video Call (30 min for L1)',
  },
  {
    id: 'm2-fiber-sfps',
    code: 'M2',
    tier: 'EDGE L1',
    tierBadge: 'EDGE L1',
    category: 'OPTICAL MEDIA',
    badge: 'EDGE L1 • OPTICAL MEDIA',
    title: 'M2: Fiber Cables & SFPs',
    description: 'Single/Multi-Mode (OS1/OS2, OM1–OM4), LC/SC connectors, and SFP/SFP+/QSFP transceiver matching.',
    image: 'https://images.unsplash.com/photo-1544197150-b99a580bb7a8?w=800&auto=format&fit=crop&q=80',
    duration: '40 min',
    fieldScope: 'Physical identification, inspection, and deployment of enterprise optical cabling and transceiver interfaces. Covers core diameter differences between Single-Mode (9µm) and Multi-Mode (50/62.5µm), optical transceiver form factors (SFP, SFP+, SFP28, QSFP+), and proper inspection/cleaning protocols prior to insertion.',
    learningOutcomes: [
      'Distinguish Single Mode (OS1/OS2 yellow) and Multi Mode (OM1–OM4 orange/aqua/magenta) fiber cores',
      'Inspect fiber end-faces with digital inspection scopes and apply one-click dry cleaning standards',
      'Match optical transceiver wavelengths (850nm, 1310nm, 1550nm) and form factors to switch ports',
      'Handle duplex LC, SC, and MPO/MTP push-pull trunk terminations safely without exceeding tensile limits',
      'Log fiber patch panel port mappings and label optical interfaces in CMDB records',
    ],
    assessmentMethod: 'Live Viva Video Call (30 min for L1)',
  },
  {
    id: 'c3-site-survey',
    code: 'C3',
    tier: 'CORE L2',
    tierBadge: 'CORE L2',
    category: 'SURVEY STANDARDS',
    badge: 'CORE L2 • SURVEY STANDARDS',
    title: 'C3: Site Survey (Infosys Form)',
    description: '14-section survey standard, Must-field validation, and the Technonex dual-validation model.',
    image: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=800&auto=format&fit=crop&q=80',
    duration: '60 min',
    fieldScope: 'Comprehensive methodology for conducting pre-transformation and physical wireless/LAN site surveys on client campuses. Covers all 14 mandatory sections of the official Infosys field audit document, distinguishing non-negotiable Must validation criteria from Good to Have metrics, and executing the Technonex dual-validation signoff process.',
    learningOutcomes: [
      'Complete all 14 structured sections of the official Infosys Site Survey Form on site',
      'Validate critical Must-Have fields (MDF/IDF room dimensions, power redundancy, ceiling heights, AP mounts)',
      'Perform dual-validation check against BOM (Bill of Materials) and CMO/FMO architecture plans',
      'Capture high-resolution 5-stage site photos adhering to strict naming and timestamping conventions',
      'Execute formal on-site handover signoffs with client POCs and Regional Lead escalation logs',
    ],
    assessmentMethod: 'Live Viva Video Call (45 min for L2)',
  },
  {
    id: 'c2-wlan-ekahau',
    code: 'C2',
    tier: 'CORE L2',
    tierBadge: 'CORE L2',
    category: 'WIRELESS INFRASTRUCTURE',
    badge: 'CORE L2 • WIRELESS INFRASTRUCTURE',
    title: 'C2: WLAN Fundamentals (Ekahau)',
    description: 'Heatmap interpretation, RSSI signal standards, AP placement, and active/passive surveys.',
    image: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=800&auto=format&fit=crop&q=80',
    duration: '50 min',
    fieldScope: 'Advanced RF design and on-site Wi-Fi validation utilizing Ekahau AI Pro survey tools and sidekicks. Covers primary/secondary signal coverage (-65 dBm / -70 dBm RSSI benchmarks), SNR calculation, co-channel interference mitigation, attenuation modeling across physical wall materials, and active vs passive survey workflows.',
    learningOutcomes: [
      'Interpret Ekahau heatmaps for Signal Strength (RSSI), SNR (≥25dB), and Channel Overlap',
      'Conduct continuous active and passive Wi-Fi surveys across warehouse, office, and manufacturing zones',
      'Verify AP physical placement against predicted predictive RF design elevations',
      'Troubleshoot roaming dead-zones, co-channel contention, and non-Wi-Fi 2.4/5GHz interference',
      'Generate formal post-deployment Ekahau survey validation reports for customer sign-off',
    ],
    assessmentMethod: 'Live Viva Video Call (45 min for L2)',
  },
];

const defaultCertificationTiers = [
  {
    id: 'edge',
    tierPill: 'TIER 1 • EDGE',
    tierBadge: 'EDGE',
    tierTitle: 'EDGE Certified Technician',
    badgeColor: 'bg-blue-600',
    subtitle: 'Engineering Development & Growth Ecosystem',
    description: 'Deployment-ready field technician qualified to identify, document, and execute standard physical infrastructure activities independently under CORE supervision.',
    requirements: [
      'Complete all 16 foundational EDGE curriculum modules',
      'Pass 30-minute Live Viva Video Call assessment with Regional Lead',
      'Zero automated exams — verifies verbal and physical on-site competency',
      'Day Rate qualification: €155/day upon successful pass',
    ],
    sealTitle: 'TECHNONEX EDGE CERTIFIED',
    idFormat: 'TNX-YYYY-XXX-NN (EDGE)',
  },
  {
    id: 'core',
    tierPill: 'TIER 2 • CORE',
    tierBadge: 'CORE',
    tierTitle: 'CORE Certified Engineer',
    badgeColor: 'bg-indigo-600',
    subtitle: 'Certified Operations & Readiness Excellence',
    description: 'On-site technical leader capable of leading deployment teams, validating 14-section Infosys surveys, mentoring junior technicians, and managing quality handovers.',
    requirements: [
      'Prerequisite: EDGE L1 certified + minimum 3 successful site deployments',
      'Complete all 15 advanced CORE technical and leadership modules',
      'Pass 45-minute Scenario-Based Live Viva with Regional Lead & Country Manager',
      'Day Rate qualification: €170/day after 3 deployments at CORE level',
    ],
    sealTitle: 'TECHNONEX CORE CERTIFIED',
    idFormat: 'TNX-YYYY-XXX-NN (CORE)',
  },
];

const LandingPage = () => {
  const navigate = useNavigate();
  const [verifyInput, setVerifyInput] = useState('');
  const [tracks, setTracks] = useState([]);
  const [modules, setModules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedModule, setSelectedModule] = useState(null);

  useEffect(() => {
    let isMounted = true;
    const fetchLandingData = async () => {
      try {
        const [tracksRes, modulesRes] = await Promise.all([
          api.get('/tracks').catch(() => ({ data: [] })),
          api.get('/modules').catch(() => ({ data: [] })),
        ]);

        if (!isMounted) return;
        const rawTracks = Array.isArray(tracksRes.data) ? tracksRes.data : (tracksRes.data?.tracks || []);
        const rawModules = Array.isArray(modulesRes.data) ? modulesRes.data : (modulesRes.data?.modules || []);

        if (rawTracks.length > 0) setTracks(rawTracks);
        if (rawModules.length > 0) setModules(rawModules);
      } catch (err) {
        console.error('Failed to load dynamic landing data:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchLandingData();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleVerifySubmit = (e) => {
    e.preventDefault();
    if (!verifyInput.trim()) return;
    navigate(`/verify/${verifyInput.trim()}`);
  };

  // Dynamically formatted certification tracks matching official Technonex standards
  const certificationTiers = useMemo(() => {
    if (tracks.length > 0) {
      return tracks.map((track, idx) => {
        const isCore = (track.slug || track.code || track.name || '').toUpperCase().includes('CORE') || idx === 1;
        const defaultTier = defaultCertificationTiers[isCore ? 1 : 0];

        return {
          id: track._id || defaultTier.id,
          tierPill: isCore ? 'TIER 2 • CORE' : 'TIER 1 • EDGE',
          tierBadge: isCore ? 'CORE' : 'EDGE',
          tierTitle: isCore ? 'CORE Certified Engineer' : 'EDGE Certified Technician',
          badgeColor: defaultTier.badgeColor,
          subtitle: defaultTier.subtitle,
          description: defaultTier.description,
          requirements: defaultTier.requirements,
          sealTitle: defaultTier.sealTitle,
          idFormat: defaultTier.idFormat,
        };
      });
    }
    return defaultCertificationTiers;
  }, [tracks]);

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans">
      {/* Top Navbar */}
      <header className="bg-[#062452] text-white px-6 sm:px-12 lg:px-16 py-3 flex items-center justify-between border-b border-blue-900/40 sticky top-0 z-40 shadow-md">
        <div className="flex items-center gap-3">
          <div className="flex items-center cursor-pointer group" onClick={() => navigate('/')}>
            <span className="text-xl sm:text-2xl font-extrabold tracking-tight text-white leading-none group-hover:text-blue-100 transition">
              EDGE <span className="text-[#EAB308]">Academy</span>
            </span>
          </div>
        </div>

        {/* Center Nav Links */}
        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-blue-100/90">
          <a href="#modules" className="hover:text-white transition">Modules</a>
          <a href="#certifications" className="hover:text-white transition">Certifications</a>
          <a href="#about" className="hover:text-white transition">About Us</a>
          <a href="#verification" className="hover:text-white transition">Verify Credential</a>
        </nav>

        {/* Right CTA */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/login')}
            className="bg-[#EAB308] hover:bg-amber-400 text-slate-950 text-xs sm:text-sm font-bold px-6 py-2.5 rounded-full transition shadow-sm cursor-pointer active:scale-95"
          >
            Login
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="bg-gradient-to-br from-[#062452] via-[#08306B] to-[#041E42] text-white px-6 sm:px-12 lg:px-16 py-16 relative overflow-hidden">
        {/* Background ambient light */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-400/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-center relative z-10">
          {/* Left Column Text */}
          <div className="lg:col-span-7 space-y-6">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-tight tracking-tight text-white">
              Become a Certified <br className="hidden sm:inline" />
              Field Engineer
            </h1>

            <p className="text-base sm:text-lg text-blue-100/80 max-w-xl leading-relaxed font-normal">
              Validating hands-on competency in IT infrastructure, fiber optics, and enterprise network provisioning under strict deployment standards.
            </p>

            {/* Dual CTAs */}
            <div className="flex flex-wrap items-center gap-4 pt-2">
              <button
                onClick={() => navigate('/login')}
                className="bg-[#EAB308] hover:bg-amber-400 text-slate-950 font-extrabold text-base px-8 py-3.5 rounded-full shadow-lg shadow-amber-500/20 transition active:scale-95 cursor-pointer"
              >
                Access Portal
              </button>
              <a
                href="#certifications"
                className="border border-white/40 hover:bg-white/10 text-white font-bold text-base px-7 py-3.5 rounded-full transition"
              >
                Explore Certifications
              </a>
            </div>
          </div>

          {/* Right Column Visual */}
          <div className="lg:col-span-5 relative">
            <div className="rounded-3xl overflow-hidden border border-white/20 shadow-2xl bg-slate-900 group">
              <img
                src="https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=1000&auto=format&fit=crop&q=80"
                alt="Server Rack IT Infrastructure"
                className="w-full h-[360px] sm:h-[420px] object-cover group-hover:scale-105 transition duration-500"
              />
            </div>
          </div>
        </div>
      </section>

      {/* 1. Featured Training Modules Section */}
      <section id="modules" className="pt-16 pb-8 px-6 sm:px-12 lg:px-16 max-w-7xl mx-auto w-full">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <span className="text-xs font-extrabold text-[#08306B] uppercase tracking-widest block mb-2">Curriculum Tracks</span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">Featured Training Modules</h2>
        </div>

        {/* Modules Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {officialModules.map((mod) => (
            <div
              key={mod.id}
              className="rounded-3xl border border-slate-200 bg-white overflow-hidden shadow-sm hover:shadow-xl transition duration-300 flex flex-col justify-between group"
            >
              <div>
                <div className="h-44 overflow-hidden relative bg-slate-100">
                  <img
                    src={mod.image}
                    alt={mod.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                  />
                  <div className="absolute top-4 left-4">
                    <span className="bg-slate-900 text-slate-200 text-xs px-2.5 py-1 rounded-full font-bold shadow-md inline-block">
                      {mod.badge}
                    </span>
                  </div>
                </div>

                <div className="p-5">
                  <h3 className="text-base font-bold text-slate-900 mb-2 leading-snug group-hover:text-[#08306B] transition">
                    {mod.title}
                  </h3>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    {mod.description}
                  </p>
                </div>
              </div>

              <div className="px-5 pb-5 pt-3 border-t border-slate-100 flex items-center justify-between">
                <button
                  onClick={() => setSelectedModule(mod)}
                  className="text-xs font-bold text-[#08306B] hover:text-[#062452] flex items-center gap-1 group-hover:translate-x-1 transition cursor-pointer"
                >
                  View Module Syllabus →
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 2. Official Certifications Section */}
      <section id="certifications" className="pt-16 pb-8 px-6 sm:px-12 lg:px-16 bg-slate-100 border-y border-slate-200">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-xs font-extrabold text-[#08306B] uppercase tracking-widest block mb-2">Industry Credentials</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              Official Technonex Certifications
            </h2>
            <p className="text-sm sm:text-base text-slate-600 mt-3 leading-relaxed">
              Operational qualifications verified via structured Live Viva assessments and searchable by unique credential ID across European enterprise client sites.
            </p>
          </div>

          {/* 2 Certification Cards: EDGE & CORE */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
            {certificationTiers.map((cert) => (
              <div
                key={cert.id}
                className="bg-white rounded-3xl border border-slate-200 p-8 shadow-md hover:shadow-xl transition flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center mb-4">
                    <span className="bg-[#0A2463] text-white font-extrabold text-xs px-3.5 py-1.5 rounded-full uppercase tracking-wider shadow-xs">
                      {cert.tierPill || `Tier ${cert.tierBadge}`}
                    </span>
                  </div>

                  <h3 className="text-2xl font-extrabold text-slate-900 mb-1">{cert.tierTitle}</h3>
                  <p className="text-xs font-bold text-[#08306B] mb-4">{cert.subtitle}</p>

                  <p className="text-sm text-slate-600 leading-relaxed mb-6">
                    {cert.description}
                  </p>

                  <div className="space-y-2.5 mb-8 border-t border-slate-100 pt-5">
                    <p className="text-xs font-bold text-slate-800 uppercase tracking-wider">Certification Requirements:</p>
                    {cert.requirements.map((req, idx) => (
                      <div key={idx} className="flex items-start gap-2.5 text-xs sm:text-sm text-slate-600">
                        <svg className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                        </svg>
                        <span>{req}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-5 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 sm:w-14 sm:h-14 shrink-0 drop-shadow-sm">
                      <svg viewBox="0 0 160 160" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                        <defs>
                          <radialGradient id={`goldGradLanding-${cert.id}`} cx="50%" cy="50%" r="50%" fx="35%" fy="35%">
                            <stop offset="0%" stopColor="#FDF0CD" />
                            <stop offset="35%" stopColor="#D4AF37" />
                            <stop offset="70%" stopColor="#B8860B" />
                            <stop offset="100%" stopColor="#8C6510" />
                          </radialGradient>
                          <linearGradient id={`goldRimLanding-${cert.id}`} x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#FFF2B2" />
                            <stop offset="50%" stopColor="#B8860B" />
                            <stop offset="100%" stopColor="#5B3D06" />
                          </linearGradient>
                          <path id={`topArcLanding-${cert.id}`} d="M 40 78 A 42 42 0 0 1 120 78" fill="none" />
                          <path id={`bottomArcLanding-${cert.id}`} d="M 40 82 A 42 42 0 0 0 120 82" fill="none" />
                        </defs>
                        <circle cx="80" cy="80" r="76" fill={`url(#goldGradLanding-${cert.id})`} stroke={`url(#goldRimLanding-${cert.id})`} strokeWidth="2" />
                        <circle cx="80" cy="80" r="72" fill="none" stroke="#FFFFFF" strokeWidth="0.8" opacity="0.6" strokeDasharray="2 2" />
                        <circle cx="80" cy="80" r="62" fill={`url(#goldGradLanding-${cert.id})`} stroke="#784F07" strokeWidth="1.2" />
                        <circle cx="80" cy="80" r="58" fill="none" stroke="#FFF0B0" strokeWidth="1" opacity="0.7" />
                        <text fontSize="8.5" fontWeight="800" fill="#543605" letterSpacing="2">
                          <textPath href={`#topArcLanding-${cert.id}`} startOffset="50%" textAnchor="middle">TECHNONEX</textPath>
                        </text>
                        <text x="80" y="86" fontSize={cert.tierBadge?.length > 4 ? "17" : "20"} fontWeight="900" fill="#422903" textAnchor="middle" letterSpacing="1.5">
                          {cert.tierBadge || 'EDGE'}
                        </text>
                        <text fontSize="8.5" fontWeight="800" fill="#543605" letterSpacing="2">
                          <textPath href={`#bottomArcLanding-${cert.id}`} startOffset="50%" textAnchor="middle">CERTIFIED</textPath>
                        </text>
                      </svg>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-800 tracking-tight">{cert.sealTitle}</p>
                      <p className="text-[11px] text-slate-400 font-mono">Format: {cert.idFormat || 'TNX-YYYY-XXX-NN'}</p>
                    </div>
                  </div>

                  <button
                    onClick={() => navigate('/login')}
                    className="px-5 py-2.5 bg-slate-900 hover:bg-[#062452] text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
                  >
                    <svg className="w-3.5 h-3.5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    Assigned via Invitation
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 3. About Us / Internal Qualification Framework Section */}
      <section id="about" className="pt-16 pb-8 px-6 sm:px-12 lg:px-16 max-w-7xl mx-auto w-full">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="text-xs font-extrabold text-[#08306B] uppercase tracking-widest block mb-2">
            INTERNAL QUALIFICATION FRAMEWORK
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mb-4">
            Built on Site Experience. Validated in Person.
          </h2>
          <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
            Technonex EDGE Academy is a proprietary qualification ecosystem ensuring every deployed field engineer meets strict client benchmarks before stepping on site.
          </p>
        </div>

        {/* 3-Column Feature Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1: Real Field Experience */}
          <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm hover:shadow-xl transition duration-300 flex flex-col justify-between group">
            <div>
              <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200/80 flex items-center justify-center p-2.5 mb-6 group-hover:scale-105 transition-transform duration-300 shadow-xs">
                <img src="/portfolio.png" alt="Real Field Experience" className="w-full h-full object-contain" />
              </div>
              <span className="text-xs font-bold text-amber-600 uppercase tracking-wider block mb-2">
                Field-Grounded Curriculum
              </span>
              <h3 className="text-xl font-extrabold text-slate-900 mb-3 group-hover:text-[#08306B] transition">
                Real Field Experience
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Every module is derived directly from Siemens site standards, Infosys survey requirements, and physical infrastructure lessons learned on the ground.
              </p>
            </div>
            <div className="pt-5 mt-6 border-t border-slate-100 flex items-center text-xs font-semibold text-slate-500 group-hover:text-[#08306B] transition">
              Siemens & Infosys Ground Standard
            </div>
          </div>

          {/* Card 2: Live Assessor Viva */}
          <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm hover:shadow-xl transition duration-300 flex flex-col justify-between group">
            <div>
              <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200/80 flex items-center justify-center p-2.5 mb-6 group-hover:scale-105 transition-transform duration-300 shadow-xs">
                <img src="/quality-control.png" alt="Live Assessor Viva" className="w-full h-full object-contain" />
              </div>
              <span className="text-xs font-bold text-amber-600 uppercase tracking-wider block mb-2">
                Live Viva Verification
              </span>
              <h3 className="text-xl font-extrabold text-slate-900 mb-3 group-hover:text-[#08306B] transition">
                Live Assessor Viva
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                No automated exams or cheat-prone multiple choice quizzes. Engineers must verbally demonstrate and explain technical concepts directly to Regional Leads.
              </p>
            </div>
            <div className="pt-5 mt-6 border-t border-slate-100 flex items-center text-xs font-semibold text-slate-500 group-hover:text-[#08306B] transition">
              Verbal 1-on-1 Regional Lead Viva
            </div>
          </div>

          {/* Card 3: SLA & Quality Compliance */}
          <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm hover:shadow-xl transition duration-300 flex flex-col justify-between group">
            <div>
              <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200/80 flex items-center justify-center p-2.5 mb-6 group-hover:scale-105 transition-transform duration-300 shadow-xs">
                <img src="/shield.png" alt="SLA & Quality Compliance" className="w-full h-full object-contain" />
              </div>
              <span className="text-xs font-bold text-amber-600 uppercase tracking-wider block mb-2">
                Enterprise Deployment Ready
              </span>
              <h3 className="text-xl font-extrabold text-slate-900 mb-3 group-hover:text-[#08306B] transition">
                SLA & Quality Compliance
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Standardized processes covering DGUV V3 safety, 14-section survey validation, fiber OTDR testing, and structured post-activity documentation.
              </p>
            </div>
            <div className="pt-5 mt-6 border-t border-slate-100 flex items-center text-xs font-semibold text-slate-500 group-hover:text-[#08306B] transition">
              DGUV V3 & OTDR Quality Assured
            </div>
          </div>
        </div>
      </section>

      {/* 4. Certificate Verification Quick Lookup */}
      <section id="verification" className="pt-16 pb-8 px-6 sm:px-12 lg:px-16 bg-[#062452] text-white border-t border-blue-900/40">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4">
            Verify Credential Authenticity
          </h2>
          <p className="text-sm sm:text-base text-blue-200/80 mb-8 max-w-xl mx-auto">
            Clients, project leads, and deployment partners can instantly verify Technonex EDGE & CORE credential records by entering a certificate ID below.
          </p>

          <form onSubmit={handleVerifySubmit} className="flex flex-col sm:flex-row items-center gap-3 max-w-xl mx-auto">
            <input
              type="text"
              value={verifyInput}
              onChange={(e) => setVerifyInput(e.target.value)}
              placeholder="e.g. TNX-2026-EDGE-0142 or TNX-2026-CORE-0089"
              className="w-full px-5 py-3.5 rounded-2xl bg-white/10 border border-white/20 text-white placeholder-blue-300/50 text-sm focus:outline-none focus:ring-2 focus:ring-[#EAB308] focus:bg-white/15 transition font-mono"
            />
            <button
              type="submit"
              className="w-full sm:w-auto px-8 py-3.5 bg-[#EAB308] hover:bg-amber-400 text-slate-950 font-bold text-sm rounded-2xl shadow-lg transition cursor-pointer shrink-0 active:scale-95"
            >
              Verify ID
            </button>
          </form>
        </div>
      </section>


      {/* Enterprise Footer */}
      <footer className="bg-[#020D1E] text-slate-400 text-sm border-t border-blue-900/40">
        <div className="max-w-7xl mx-auto px-6 sm:px-12 lg:px-16 pt-16 pb-12">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10 lg:gap-8">
            {/* Column 1: Brand & Identity (2 cols on LG) */}
            <div className="lg:col-span-2 space-y-4">
              <div className="flex flex-col items-start cursor-pointer group select-none" onClick={() => navigate('/')}>
                <span className="text-2xl font-extrabold tracking-tight text-white leading-none">
                  EDGE <span className="text-[#EAB308]">Academy</span>
                </span>
                <span className="text-xs font-medium text-blue-200/80 tracking-wide mt-1">
                  A product of Technonex
                </span>
              </div>

              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed max-w-sm">
                Proprietary operational qualification ecosystem certifying deployment-ready field engineers for high-stakes enterprise IT infrastructure and live data center environments across EMEA.
              </p>
            </div>

            {/* Column 2: Platform Navigation */}
            <div>
              <h4 className="text-xs font-extrabold text-white uppercase tracking-wider mb-4">
                Platform
              </h4>
              <ul className="space-y-2.5 text-xs sm:text-sm">
                <li>
                  <a href="#modules" className="hover:text-amber-400 transition">Curriculum Modules</a>
                </li>
                <li>
                  <a href="#certifications" className="hover:text-amber-400 transition">Certification Tiers</a>
                </li>
                <li>
                  <a href="#about" className="hover:text-amber-400 transition">About Framework</a>
                </li>
                <li>
                  <a href="#verification" className="hover:text-amber-400 transition">Verify Credential</a>
                </li>
                <li>
                  <button onClick={() => navigate('/login')} className="hover:text-amber-400 transition cursor-pointer text-left">
                    Engineer Portal Login
                  </button>
                </li>
              </ul>
            </div>

            {/* Column 3: Standards & Tracks */}
            <div>
              <h4 className="text-xs font-extrabold text-white uppercase tracking-wider mb-4">
                Qualifications
              </h4>
              <ul className="space-y-2.5 text-xs sm:text-sm">
                <li>
                  <a href="#certifications" className="hover:text-amber-400 transition">EDGE Technician (L1)</a>
                </li>
                <li>
                  <a href="#certifications" className="hover:text-amber-400 transition">CORE Lead Engineer (L2)</a>
                </li>
                <li>
                  <a href="#modules" className="hover:text-amber-400 transition">Siemens Rack Standards</a>
                </li>
                <li>
                  <a href="#modules" className="hover:text-amber-400 transition">Infosys 14-Section Survey</a>
                </li>
                <li>
                  <a href="#modules" className="hover:text-amber-400 transition">Fiber Optics & Ekahau WLAN</a>
                </li>
              </ul>
            </div>

            {/* Column 4: Verification & Quality */}
            <div>
              <h4 className="text-xs font-extrabold text-white uppercase tracking-wider mb-4">
                Quality & Verification
              </h4>
              <ul className="space-y-2.5 text-xs sm:text-sm">
                <li>
                  <a href="#verification" className="hover:text-amber-400 transition">Instant ID Lookup</a>
                </li>
                <li>
                  <a href="#about" className="hover:text-amber-400 transition">Live Viva Assessment</a>
                </li>
                <li>
                  <a href="#about" className="hover:text-amber-400 transition">DGUV V3 Electrical Safety</a>
                </li>
                <li>
                  <a href="#about" className="hover:text-amber-400 transition">OTDR Tier-2 Fiber Testing</a>
                </li>
                <li>
                  <span className="text-slate-500">Regional Lead Sign-Off</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Bottom Divider & Sub-footer */}
          <div className="mt-12 pt-8 border-t border-blue-900/40 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
            <p>© {new Date().getFullYear()} Technonex EDGE Academy. All rights reserved.</p>
            <div className="flex items-center gap-6">
              <a href="#" className="hover:text-slate-300 transition">Privacy Policy</a>
              <a href="#" className="hover:text-slate-300 transition">Terms of Service</a>
              <a href="#verification" className="hover:text-amber-400 transition font-mono">TNX Credential Registry</a>
            </div>
          </div>
        </div>
      </footer>

      {/* Interactive Module Syllabus Modal */}
      {selectedModule && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/75 backdrop-blur-xs transition-opacity"
          onClick={() => setSelectedModule(null)}
        >
          <div
            className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] shadow-2xl border border-slate-200 overflow-hidden flex flex-col relative animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="bg-[#062452] text-white p-6 sm:p-7 relative">
              <button
                onClick={() => setSelectedModule(null)}
                className="absolute top-5 right-5 text-blue-200 hover:text-white bg-white/10 hover:bg-white/20 rounded-full p-2 transition cursor-pointer"
                aria-label="Close modal"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              <div className="flex flex-wrap items-center gap-2 mb-3">
                <span className="bg-slate-900 text-amber-400 text-xs px-3 py-1 rounded-full font-extrabold shadow-xs tracking-wider border border-white/10">
                  {selectedModule.badge}
                </span>
              </div>

              <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white pr-8">
                {selectedModule.title}
              </h2>
            </div>

            {/* Modal Body (Scrollable) */}
            <div className="p-6 sm:p-8 space-y-6 overflow-y-auto max-h-[calc(90vh-180px)] font-sans">
              {/* Field Scope */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="h-2 w-2 rounded-full bg-[#08306B]"></span>
                  <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
                    Technical Field Scope
                  </h3>
                </div>
                <p className="text-sm text-slate-600 leading-relaxed bg-slate-50 p-4 rounded-2xl border border-slate-200/70">
                  {selectedModule.fieldScope}
                </p>
              </div>

              {/* Learning Outcomes */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
                  <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
                    Target On-Site Competencies (Learning Outcomes)
                  </h3>
                </div>
                <div className="space-y-2.5">
                  {selectedModule.learningOutcomes.map((outcome, idx) => (
                    <div key={idx} className="flex items-start gap-3 text-xs sm:text-sm text-slate-700">
                      <div className="h-5 w-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5 font-bold">
                        ✓
                      </div>
                      <span className="leading-snug">{outcome}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 sm:px-8 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3">
              <button
                onClick={() => setSelectedModule(null)}
                className="px-5 py-2.5 text-xs font-bold text-slate-700 hover:text-slate-900 bg-white border border-slate-300 rounded-xl shadow-2xs hover:bg-slate-100 transition cursor-pointer"
              >
                Close
              </button>
              <button
                onClick={() => {
                  setSelectedModule(null);
                  navigate('/login');
                }}
                className="px-6 py-2.5 text-xs font-bold text-slate-950 bg-[#EAB308] hover:bg-amber-400 rounded-xl shadow-xs transition cursor-pointer"
              >
                Access Portal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LandingPage;

