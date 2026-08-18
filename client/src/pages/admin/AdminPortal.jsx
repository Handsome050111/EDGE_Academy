import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import LanguageSwitcher from '../../components/LanguageSwitcher';
import NotificationBell from '../../components/NotificationBell';
import ProfileModal from '../../components/ProfileModal';

// Tab Components
import UserManagementTab from './tabs/UserManagementTab';
import ModuleCatalogTab from './tabs/ModuleCatalogTab';
import QuestionBankTab from './tabs/QuestionBankTab';
import AssignmentTab from './tabs/AssignmentTab';
import AuditLogTab from './tabs/AuditLogTab';
import CertificateGovernanceTab from './tabs/CertificateGovernanceTab';

const AdminPortal = () => {
  const { t } = useTranslation();
  const { user, logout } = useAuth();

  // Active Tab State ('users' | 'curriculum' | 'questions' | 'assignments' | 'audit' | 'certificates')
  const [activeTab, setActiveTab] = useState('users');

  // Modals & Navigation Drawer
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Global Notification / Toast State
  const [toast, setToast] = useState({ show: false, type: 'success', message: '' });

  const showNotification = (type, message) => {
    setToast({ show: true, type, message });
    setTimeout(() => {
      setToast((prev) => ({ ...prev, show: false }));
    }, 5000);
  };

  const navTabs = [
    {
      id: 'users',
      label: t('adminPortal.tabs.userManagement'),
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ),
    },
    {
      id: 'curriculum',
      label: t('adminPortal.tabs.curriculum'),
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      ),
    },
    {
      id: 'questions',
      label: t('adminPortal.tabs.questionBank'),
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      id: 'assignments',
      label: t('adminPortal.tabs.assignmentEngine'),
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
        </svg>
      ),
    },
    {
      id: 'audit',
      label: t('adminPortal.tabs.auditLog'),
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
    },
    {
      id: 'certificates',
      label: t('adminPortal.tabs.certificateGovernance'),
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col lg:flex-row font-sans relative">
      {/* Mobile Backdrop Overlay */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-40 lg:hidden transition-opacity duration-300"
          aria-hidden="true"
        />
      )}

      {/* Slide-Out Navigation Drawer on Mobile / Fixed Sidebar on Desktop */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-[80vw] max-w-xs lg:w-72 bg-[#092857] text-white p-6 flex flex-col justify-between border-r border-blue-900/40 shrink-0 min-h-screen shadow-2xl lg:shadow-none transform transition-transform duration-300 ease-in-out ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="overflow-y-auto">
          {/* Brand Header */}
          <div className="flex items-start justify-between mb-7">
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight text-white flex items-center gap-2">
                EDGE Academy
              </h1>
              <p className="text-xs text-blue-300/70 font-medium mt-0.5">Admin Portal</p>
            </div>
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="lg:hidden p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-blue-200 hover:text-white transition cursor-pointer"
              aria-label="Close navigation drawer"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* 6 Navigation Tabs */}
          <nav className="space-y-1.5">
            {navTabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-xs font-semibold transition cursor-pointer ${
                    isActive
                      ? 'bg-white/15 text-white border border-white/20 shadow-xs'
                      : 'text-blue-200/80 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <span className={isActive ? 'text-white' : 'text-blue-300'}>{tab.icon}</span>
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer: Profile & Logout */}
        <div className="pt-6 border-t border-blue-900/50 space-y-3 mt-auto">
          <button
            onClick={() => {
              setShowProfileModal(true);
              setMobileMenuOpen(false);
            }}
            className="w-full flex items-center gap-3 p-2 -mx-2 rounded-xl hover:bg-white/10 transition cursor-pointer text-left group"
            title="Open Profile Settings"
          >
            <div className="h-9 w-9 rounded-xl bg-[#08306B] border border-blue-400/30 flex items-center justify-center font-bold text-white text-sm shadow-sm shrink-0 group-hover:border-white/50 transition">
              {(user?.fullName || 'A')[0]}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate group-hover:text-blue-200 transition">
                {user?.fullName || 'Admin User'}
              </p>
              <p className="text-xs text-blue-300/60 truncate capitalize">Administrator</p>
            </div>
            <svg className="w-4 h-4 text-blue-300/50 group-hover:text-white transition" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
            </svg>
          </button>

          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-2 py-2 text-xs font-medium text-blue-200/80 hover:text-white hover:bg-white/5 rounded-xl transition-colors group cursor-pointer"
          >
            <svg className="w-4 h-4 text-blue-300 group-hover:text-white transition-transform group-hover:-translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Right Content Workspace */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Navbar Header */}
        <header className="h-16 bg-white border-b border-slate-200 text-slate-800 flex items-center justify-between px-4 sm:px-6 sticky top-0 z-30 shadow-xs">
          {/* Mobile Hamburger Button */}
          <div className="flex items-center">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="text-slate-600 hover:text-slate-900 p-2 -ml-2 rounded-xl hover:bg-slate-100 transition lg:hidden cursor-pointer flex items-center justify-center"
              aria-label="Open navigation drawer"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>

          {/* Right: Notifications, Language Switcher, Profile Badge */}
          <div className="flex items-center gap-3 sm:gap-5">
            <NotificationBell />
            <LanguageSwitcher />

            <div className="flex items-center gap-3 pl-2 sm:pl-3 border-l border-slate-200 select-none">
              <div className="h-8 w-8 rounded-full bg-[#08306B] text-white flex items-center justify-center font-bold text-xs shadow-xs shrink-0">
                {(user?.fullName || 'A')[0]}
              </div>
              <span className="text-xs font-semibold text-slate-800 hidden sm:inline truncate max-w-[140px]">
                {user?.fullName || 'Admin User'}
              </span>
            </div>
          </div>
        </header>

        {/* Main Body */}
        <main className="flex-1 p-6 md:p-8 overflow-y-auto space-y-6">
          {/* Global Toast Notification */}
          {toast.show && (
            <div
              className={`rounded-2xl border p-4 text-xs font-medium flex items-center justify-between shadow-xs transition animate-in fade-in ${
                toast.type === 'error'
                  ? 'bg-rose-50 border-rose-200 text-rose-800'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-800'
              }`}
            >
              <span>{toast.message}</span>
              <button
                onClick={() => setToast((prev) => ({ ...prev, show: false }))}
                className="font-bold ml-4 text-sm cursor-pointer hover:opacity-70"
              >
                &times;
              </button>
            </div>
          )}

          {/* Active Tab Router */}
          {activeTab === 'users' && (
            <UserManagementTab currentUser={user} showNotification={showNotification} />
          )}
          {activeTab === 'curriculum' && (
            <ModuleCatalogTab showNotification={showNotification} />
          )}
          {activeTab === 'questions' && (
            <QuestionBankTab showNotification={showNotification} />
          )}
          {activeTab === 'assignments' && (
            <AssignmentTab showNotification={showNotification} />
          )}
          {activeTab === 'audit' && (
            <AuditLogTab showNotification={showNotification} />
          )}
          {activeTab === 'certificates' && (
            <CertificateGovernanceTab showNotification={showNotification} />
          )}
        </main>
      </div>

      {/* Profile Settings Modal */}
      <ProfileModal isOpen={showProfileModal} onClose={() => setShowProfileModal(false)} />
    </div>
  );
};

export default AdminPortal;
