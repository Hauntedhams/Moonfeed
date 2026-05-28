import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useWallet } from '@jup-ag/wallet-adapter';
import { getFullApiUrl } from '../config/api';

const UserProfileContext = createContext({});

export const useUserProfile = () => useContext(UserProfileContext);

export const UserProfileProvider = ({ children }) => {
  const { publicKey, connected, signMessage } = useWallet();
  const [profile, setProfile] = useState({ displayName: '', bio: '', profilePicture: null });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Fetch profile from backend whenever wallet connects
  useEffect(() => {
    if (connected && publicKey) {
      fetchProfile(publicKey.toString());
    } else {
      setProfile({ displayName: '', bio: '', profilePicture: null });
    }
  }, [connected, publicKey]);

  const fetchProfile = async (walletAddress) => {
    setLoading(true);
    try {
      const res = await fetch(getFullApiUrl(`/api/users/${walletAddress}`));
      if (res.ok) {
        const data = await res.json();
        setProfile({
          displayName: data.displayName || '',
          bio: data.bio || '',
          profilePicture: data.profilePicture || null
        });

        // Migrate any existing localStorage profile pic to backend (one-time)
        const localPic = localStorage.getItem(`profilePic_${walletAddress}`);
        if (localPic && !data.profilePicture) {
          saveProfile({ profilePicture: localPic }, walletAddress);
          localStorage.removeItem(`profilePic_${walletAddress}`);
        }
      }
    } catch (err) {
      console.warn('Could not fetch user profile:', err.message);
    } finally {
      setLoading(false);
    }
  };

  // Save profile to backend — signs a message to prove wallet ownership
  const saveProfile = useCallback(async (updates, overrideWallet) => {
    const walletAddr = overrideWallet || publicKey?.toString();
    if (!walletAddr) return { success: false, error: 'No wallet connected' };

    setSaving(true);
    try {
      let signature = null;

      // Only sign if we have an active wallet connection (not during migration)
      if (!overrideWallet && signMessage) {
        const message = new TextEncoder().encode('Moonfeed profile update');
        const sigBytes = await signMessage(message);
        // Convert Uint8Array to base64
        signature = btoa(String.fromCharCode(...sigBytes));
      } else if (!overrideWallet) {
        return { success: false, error: 'Wallet does not support message signing' };
      } else {
        // Migration path — no signature verification, skip
        return { success: false, error: 'Migration skipped' };
      }

      const res = await fetch(getFullApiUrl(`/api/users/${walletAddr}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...updates, signature })
      });

      if (!res.ok) {
        const err = await res.json();
        return { success: false, error: err.error };
      }

      const data = await res.json();
      setProfile({
        displayName: data.displayName || '',
        bio: data.bio || '',
        profilePicture: data.profilePicture || null
      });
      return { success: true };
    } catch (err) {
      console.error('Profile save error:', err);
      return { success: false, error: err.message };
    } finally {
      setSaving(false);
    }
  }, [publicKey, signMessage]);

  return (
    <UserProfileContext.Provider value={{ profile, loading, saving, saveProfile, fetchProfile }}>
      {children}
    </UserProfileContext.Provider>
  );
};
