import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, AuthState, LoginCredentials } from '../types';
import { db } from '../data/database';
import { supabase } from '../lib/supabase';

interface AuthContextType extends AuthState {
  login: (credentials: LoginCredentials) => Promise<boolean>;
  logout: () => void;
  hasPermission: (resource: string, action: string) => boolean;
  updateUser: (userData: Partial<User>) => void;
  migrateData: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    user: null,
    loading: true
  });

  useEffect(() => {
    checkAuthState();
  }, []);

  const checkAuthState = async () => {
    try {
      // بدء بحالة غير مصادق عليها
      setAuthState({
        isAuthenticated: false,
        user: null,
        loading: false
      });
    } catch (error) {
      console.error('Error checking auth state:', error);
      setAuthState({
        isAuthenticated: false,
        user: null,
        loading: false
      });
    }
  };

  const login = async (credentials: LoginCredentials): Promise<boolean> => {
    const user = await db.login(credentials.email, credentials.password);
    
    if (user) {
      setAuthState({
        isAuthenticated: true,
        user,
        loading: false
      });
      return true;
    }
    
    return false;
  };

  const logout = async () => {
    await db.logout();
    setAuthState({
      isAuthenticated: false,
      user: null,
      loading: false
    });
  };

  const updateUser = async (userData: Partial<User>) => {
    const updatedUser = await db.updateCurrentUser(userData);
    if (updatedUser) {
      setAuthState(prev => ({
        ...prev,
        user: updatedUser
      }));
    }
  };

  const migrateData = async () => {
    try {
      await db.migrateToSupabase();
    } catch (error) {
      console.error('Error migrating data:', error);
      throw error;
    }
  };

  const hasPermission = (resource: string, action: string): boolean => {
    if (!authState.user) return false;
    
    const permissions = authState.user.permissions as any;
    if (!permissions) return false;
    
    return permissions[resource]?.[action] || false;
  };

  // الاستماع لتغييرات المصادقة في Supabase
  useEffect(() => {
    // تبسيط الاستماع لتغييرات المصادقة
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('Auth state changed:', event, session?.user?.email);
        // لا نقوم بأي إجراءات تلقائية هنا لتجنب الحلقات اللا نهائية
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{
      ...authState,
      login,
      logout,
      hasPermission,
      updateUser,
      migrateData
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}