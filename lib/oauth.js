import { Platform } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

import { supabase } from './supabase';

// Completes the auth session if the app was reopened by the redirect (web only).
WebBrowser.maybeCompleteAuthSession();

// Supabase names Microsoft "azure".
export const PROVIDERS = {
  google: { label: 'Google', supabase: 'google' },
  microsoft: { label: 'Microsoft', supabase: 'azure' },
};

// Google and Microsoft: browser-based OAuth with PKCE. The provider redirects
// back to the app's whired:// link with a one-time code that only this device
// can exchange for a session.
export async function signInWithBrowserProvider(key) {
  const provider = PROVIDERS[key];
  if (!provider) return { error: new Error('Unknown provider') };

  const redirectTo = Linking.createURL('auth/callback');
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: provider.supabase,
    options: {
      redirectTo,
      skipBrowserRedirect: true,
      ...(provider.supabase === 'azure' ? { scopes: 'email' } : {}),
    },
  });
  if (error || !data?.url) return { error: error ?? new Error('No sign-in URL') };

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success') return { cancelled: true };

  const { queryParams } = Linking.parse(result.url);
  if (queryParams?.error_description || queryParams?.error) {
    return { error: new Error(String(queryParams.error_description || queryParams.error)) };
  }
  const code = queryParams?.code;
  if (!code) return { error: new Error('No sign-in code returned') };

  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(String(code));
  return exchangeError ? { error: exchangeError } : {};
}

export async function appleAvailable() {
  if (Platform.OS !== 'ios') return false;
  try {
    return await AppleAuthentication.isAvailableAsync();
  } catch (e) {
    return false;
  }
}

// Apple: the native sheet returns an identity token that Supabase verifies.
// Apple only shares the user's name the first time, so it is saved right away.
export async function signInWithApple() {
  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });
    if (!credential.identityToken) return { error: new Error('Apple did not return a token') };

    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'apple',
      token: credential.identityToken,
    });
    if (error) return { error };

    const name = [credential.fullName?.givenName, credential.fullName?.familyName]
      .filter(Boolean)
      .join(' ')
      .trim();
    if (name && data?.user) {
      await supabase.from('profiles').update({ display_name: name }).eq('id', data.user.id);
    }
    return {};
  } catch (e) {
    if (e?.code === 'ERR_REQUEST_CANCELED') return { cancelled: true };
    return { error: e };
  }
}
