import React, { createContext, useContext, useState, useEffect } from 'react';

interface User {
  id: number;
  name: string;
  email: string;
  level: number;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  signup: (email: string, name: string, password: string) => Promise<void>;
  updateProfile: (name: string) => Promise<void>;
  deleteAccount: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = 'baro_token';

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

async function apiFetch(path: string, options: RequestInit = {}) {
  const token = getToken();
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers ?? {}),
      },
    });
  } catch {
    throw new Error('서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.');
  }
  let data: any = {};
  try {
    data = await res.json();
  } catch {
    if (!res.ok) throw new Error('요청에 실패했습니다.');
    return data;
  }
  if (!res.ok) throw new Error(data.message ?? '요청에 실패했습니다.');
  return data;
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // 앱 시작 시 저장된 토큰으로 사용자 정보 복원
  useEffect(() => {
    const token = getToken();
    if (!token) {
      setIsLoading(false);
      return;
    }
    apiFetch('/auth/me')
      .then(({ user: u }) => setUser(u))
      .catch(() => localStorage.removeItem(TOKEN_KEY))
      .finally(() => setIsLoading(false));
  }, []);

  const login = async (email: string, password: string) => {
    const { token, user: u } = await apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    localStorage.setItem(TOKEN_KEY, token);
    setUser(u);
  };

  const signup = async (email: string, name: string, password: string) => {
    const { token, user: u } = await apiFetch('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, name, password }),
    });
    localStorage.setItem(TOKEN_KEY, token);
    setUser(u);
  };

  const updateProfile = async (name: string) => {
    const { user: u } = await apiFetch('/auth/me', {
      method: 'PATCH',
      body: JSON.stringify({ name }),
    });
    setUser(u);
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
  };

  const deleteAccount = async () => {
    await apiFetch('/auth/me', { method: 'DELETE' });
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, signup, updateProfile, deleteAccount }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
