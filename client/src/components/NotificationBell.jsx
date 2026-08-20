import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

const formatTimeAgo = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const diffSec = Math.floor((now - date) / 1000);

  if (diffSec < 60) return 'Just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return `${Math.floor(diffSec / 86400)}d ago`;
};

const getTypeBadge = (type) => {
  switch (type) {
    case 'assignment':
      return { label: 'ASSIGNMENT', color: 'bg-blue-100 text-blue-800 border-blue-200' };
    case 'review_quiz':
      return { label: 'REVIEW QUIZ', color: 'bg-purple-100 text-purple-800 border-purple-200' };
    case 'certificate':
      return { label: 'CERTIFICATE', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' };
    case 'invite':
      return { label: 'INVITE', color: 'bg-amber-100 text-amber-800 border-amber-200' };
    default:
      return { label: 'SYSTEM', color: 'bg-gray-100 text-gray-800 border-gray-200' };
  }
};

const NotificationBell = () => {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const popoverRef = useRef(null);

  const fetchNotifications = async () => {
    try {
      const res = await api.get('/notifications');
      if (res.data) {
        setUnreadCount(res.data.unreadCount || 0);
        setNotifications(res.data.notifications || []);
      }
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000); // poll every 30s
    return () => clearInterval(interval);
  }, []);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMarkAsRead = async (e, id) => {
    e.stopPropagation();
    try {
      await api.put(`/notifications/${id}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n._id === id ? { ...n, is_read: true, isRead: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error(err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      setLoading(true);
      await api.put('/notifications/mark-all-read');
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true, isRead: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleNotificationClick = (item) => {
    if (!item.is_read && !item.isRead) {
      handleMarkAsRead({ stopPropagation: () => {} }, item._id);
    }
    setIsOpen(false);
    if (item.link) {
      if (item.link.includes('review-quiz')) {
        navigate('/engineer');
      } else {
        navigate(item.link);
      }
    }
  };

  return (
    <div className="relative" ref={popoverRef}>
      <button
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) fetchNotifications();
        }}
        className="relative text-slate-500 hover:text-slate-800 p-1.5 rounded-xl hover:bg-slate-100 transition cursor-pointer"
        title="Notifications"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 01-6 0v-1m6 0H9"
          />
        </svg>

        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white shadow-xs">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Popover Dropdown */}
      {isOpen && (
        <div className="fixed left-3 right-3 top-16 mt-1 sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-2 sm:w-96 rounded-2xl bg-white shadow-2xl border border-slate-100 z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-bold text-[#092857]">Notifications</h4>
              {unreadCount > 0 && (
                <span className="bg-blue-100 text-[#092857] text-[10px] font-extrabold px-2 py-0.5 rounded-full">
                  {unreadCount} new
                </span>
              )}
            </div>

            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                disabled={loading}
                className="text-xs font-semibold text-blue-600 hover:text-blue-800 disabled:opacity-50"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
            {notifications.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">
                No notifications found.
              </div>
            ) : (
              notifications.map((item) => {
                const isRead = item.is_read || item.isRead;
                const badge = getTypeBadge(item.type);

                return (
                  <div
                    key={item._id}
                    onClick={() => handleNotificationClick(item)}
                    className={`p-3.5 transition cursor-pointer hover:bg-slate-50 flex items-start justify-between gap-3 ${
                      !isRead ? 'bg-blue-50/40 font-medium' : 'opacity-85'
                    }`}
                  >
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded border ${badge.color}`}>
                          {badge.label}
                        </span>
                        <span className="text-[10px] text-slate-400 font-normal">
                          {formatTimeAgo(item.createdAt || item.created_at)}
                        </span>
                      </div>
                      <p className="text-xs font-bold text-slate-900 leading-tight">{item.title}</p>
                      <p className="text-xs text-slate-600 leading-normal">{item.message}</p>
                    </div>

                    {!isRead && (
                      <button
                        onClick={(e) => handleMarkAsRead(e, item._id)}
                        className="text-[10px] text-blue-600 hover:underline font-bold whitespace-nowrap self-center"
                        title="Mark as read"
                      >
                        ● Read
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
