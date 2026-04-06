import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null); // 'student' | 'parent'
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check localStorage for saved session
    const savedUser = localStorage.getItem('portal_user');
    const savedRole = localStorage.getItem('portal_role');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
      setRole(savedRole);
    }
    setLoading(false);
  }, []);

  const login = (userData, userRole) => {
    setUser(userData);
    setRole(userRole);
    localStorage.setItem('portal_user', JSON.stringify(userData));
    localStorage.setItem('portal_role', userRole);
  };

  const logout = () => {
    setUser(null);
    setRole(null);
    localStorage.removeItem('portal_user');
    localStorage.removeItem('portal_role');
  };

  const isParent = role === 'parent';

  return (
    <AuthContext.Provider value={{ user, role, isParent, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
