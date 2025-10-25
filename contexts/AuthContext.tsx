import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';
import type { User } from '../types';

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (token: string, user: User) => void;
  logout: () => void;
  updateUser: (updatedUser: User) => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // On initial load, try to rehydrate auth state from localStorage
    try {
      const storedToken = localStorage.getItem('comicra-token');
      const storedUser = localStorage.getItem('comicra-user');
      if (storedToken && storedUser) {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
      }
    } catch (e) {
        console.error("Could not rehydrate auth state", e);
    } finally {
        setIsLoading(false);
    }
  }, []);

  const login = (newToken: string, newUser: User) => {
    setToken(newToken);
    setUser(newUser);
    localStorage.setItem('comicra-token', newToken);
    localStorage.setItem('comicra-user', JSON.stringify(newUser));
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('comicra-token');
    localStorage.removeItem('comicra-user');
  };

  const updateUser = (updatedUser: User) => {
    setUser(updatedUser);
    localStorage.setItem('comicra-user', JSON.stringify(updatedUser));
  };


  const isAuthenticated = !!token;

  if (isLoading) {
    return (
        <div className="flex items-center justify-center h-screen bg-gray-100 text-gray-700">
            Initializing...
        </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, token, login, logout, updateUser, isAuthenticated }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};