import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

// Helper to get a value from localStorage or sessionStorage
const getStoredValue = (key) => {
  return localStorage.getItem(key) || sessionStorage.getItem(key) || null;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(getStoredValue('token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedUser = getStoredValue('user');
    const storedToken = getStoredValue('token');

    if (storedToken && storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch {
        localStorage.removeItem('user');
        sessionStorage.removeItem('user');
      }
    }

    setLoading(false);
  }, []);

  const login = async (email, password, rememberMe = false) => {
    setLoading(true);
    try {
      const response = await api.post('/auth/login', { email, password, rememberMe });
      const authUser = response.data;

      // Choose storage based on rememberMe
      const storage = rememberMe ? localStorage : sessionStorage;
      storage.setItem('token', authUser.token);
      storage.setItem('user', JSON.stringify(authUser));

      // Clear the other storage to avoid stale data
      const otherStorage = rememberMe ? sessionStorage : localStorage;
      otherStorage.removeItem('token');
      otherStorage.removeItem('user');

      setToken(authUser.token);
      setUser(authUser);
      return authUser;
    } finally {
      setLoading(false);
    }
  };

  const register = async (name, email, password, role = 'Engineer') => {
    setLoading(true);
    try {
      const response = await api.post('/auth/register', {
        fullName: name,
        email,
        password,
        role,
      });
      const authUser = response.data;

      localStorage.setItem('token', authUser.token);
      localStorage.setItem('user', JSON.stringify(authUser));
      setToken(authUser.token);
      setUser(authUser);
      return authUser;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
    setToken(null);
    setUser(null);
  };

  const value = useMemo(
    () => ({
      user,
      token,
      loading,
      login,
      register,
      logout,
    }),
    [user, token, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside an AuthProvider');
  }
  return context;
};
