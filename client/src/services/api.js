import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api/v1',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token') || sessionStorage.getItem('token');

  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      sessionStorage.removeItem('token');
      const publicPaths = ['/', '/login', '/accept-invite', '/invite/accept', '/reset-password'];
      const isPublicPath = publicPaths.includes(window.location.pathname) || window.location.pathname.startsWith('/verify');
      if (!isPublicPath) {
        window.location.href = '/login';
      }
    }

    if (error.response && error.response.data && error.response.data.error) {
      return Promise.reject(error.response.data.error);
    }

    return Promise.reject(error);
  }
);

export default api;
