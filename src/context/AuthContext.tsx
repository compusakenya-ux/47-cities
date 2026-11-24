import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type {
  LocationActivatePayload,
  LoginPayload,
  PrivateUserProfile,
  UpdateProfilePayload,
  VerifyEmailPayload,
} from '../shared/types';
import {
  activateLocation as apiActivateLocation,
  beaconClearSessionImages,
  deactivateLocation as apiDeactivateLocation,
  getMe,
  login as apiLogin,
  logout as apiLogout,
  updateProfile as apiUpdateProfile,
  uploadAvatar as apiUploadAvatar,
  verifyEmail as apiVerifyEmail,
} from '../lib/api';

interface AuthContextValue {
  user: PrivateUserProfile | null;
  loading: boolean;
  nearbyCount: number | null;
  setUser: React.Dispatch<React.SetStateAction<PrivateUserProfile | null>>;
  refreshUser: () => Promise<PrivateUserProfile | null>;
  loginUser: (payload: LoginPayload) => Promise<PrivateUserProfile>;
  verifyEmailCode: (payload: VerifyEmailPayload) => Promise<PrivateUserProfile>;
  logoutUser: () => Promise<void>;
  activateUserLocation: (
    payload: LocationActivatePayload
  ) => Promise<{ user: PrivateUserProfile; nearbyCount: number }>;
  deactivateUserLocation: () => Promise<PrivateUserProfile>;
  updateUserProfile: (payload: UpdateProfilePayload) => Promise<PrivateUserProfile>;
  uploadUserAvatar: (fileOrDataUrl: File | string) => Promise<PrivateUserProfile>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<PrivateUserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [nearbyCount, setNearbyCount] = useState<number | null>(null);

  const refreshUser = useCallback(async () => {
    try {
      const res = await getMe();
      const nextUser = res.user ?? null;
      setUser(nextUser);
      return nextUser;
    } catch {
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshUser();
  }, [refreshUser]);

  // Ephemeral image auto-purge on tab close / session end
  useEffect(() => {
    if (!user) return;
    const handleBeforeUnload = () => {
      beaconClearSessionImages();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [user]);

  const loginUser = useCallback(async (payload: LoginPayload) => {
    const res = await apiLogin(payload);
    setUser(res.user);
    return res.user;
  }, []);

  const verifyEmailCode = useCallback(async (payload: VerifyEmailPayload) => {
    const res = await apiVerifyEmail(payload);
    setUser(res.user);
    return res.user;
  }, []);

  const logoutUser = useCallback(async () => {
    try {
      await apiLogout();
    } finally {
      setUser(null);
      setNearbyCount(null);
    }
  }, []);

  const activateUserLocation = useCallback(async (payload: LocationActivatePayload) => {
    const res = await apiActivateLocation(payload);
    setUser(res.user);
    setNearbyCount(res.nearbyCount);
    return { user: res.user, nearbyCount: res.nearbyCount };
  }, []);

  const deactivateUserLocation = useCallback(async () => {
    const res = await apiDeactivateLocation();
    setUser(res.user);
    setNearbyCount(null);
    return res.user;
  }, []);

  const updateUserProfile = useCallback(async (payload: UpdateProfilePayload) => {
    const res = await apiUpdateProfile(payload);
    setUser(res.user);
    return res.user;
  }, []);

  const uploadUserAvatar = useCallback(async (fileOrDataUrl: File | string) => {
    const res = await apiUploadAvatar(fileOrDataUrl);
    setUser(res.user);
    return res.user;
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        nearbyCount,
        setUser,
        refreshUser,
        loginUser,
        verifyEmailCode,
        logoutUser,
        activateUserLocation,
        deactivateUserLocation,
        updateUserProfile,
        uploadUserAvatar,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
