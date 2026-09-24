import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import { supabase } from '../../lib/supabase';

export type OAuthProvider = 'google' | 'apple';

export function getOAuthRedirectUrl(): string {
  return Linking.createURL('auth/callback');
}

export function isOAuthCallbackUrl(url: string): boolean {
  return url.split(/[?#]/, 1)[0] === getOAuthRedirectUrl().split(/[?#]/, 1)[0];
}

let currentCallback: { url: string; promise: Promise<void> } | null = null;

export function completeOAuthFromUrl(url: string): Promise<void> {
  if (currentCallback?.url === url) return currentCallback.promise;

  const promise = (async () => {
    if (!isOAuthCallbackUrl(url)) throw new Error('Unexpected sign-in redirect.');

    const parsed = new URL(url);
    const query = new URLSearchParams(parsed.search);
    const fragment = new URLSearchParams(parsed.hash.slice(1));
    const getParam = (key: string) => fragment.get(key) ?? query.get(key);
    const providerError = getParam('error_description') ?? getParam('error');
    if (providerError) throw new Error(providerError.replace(/\+/g, ' '));

    const accessToken = getParam('access_token');
    const refreshToken = getParam('refresh_token');
    if (accessToken && refreshToken) {
      const { error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      if (error) throw error;
      return;
    }

    const code = getParam('code');
    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) throw error;
      return;
    }

    throw new Error('The sign-in response did not include a session. Please try again.');
  })();

  currentCallback = { url, promise };
  return promise;
}

export async function signInWithOAuthProvider(provider: OAuthProvider): Promise<boolean> {
  const redirectTo = getOAuthRedirectUrl();
  const isWeb = Platform.OS === 'web';
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo,
      skipBrowserRedirect: !isWeb,
    },
  });

  if (error) throw error;
  if (isWeb) return true;
  if (!data.url) throw new Error('Unable to start sign-in. Please try again.');

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success') return false;
  await completeOAuthFromUrl(result.url);
  return true;
}
