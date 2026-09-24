import { Platform } from 'react-native';

// In-app subscriptions via RevenueCat. The package is optional at build time:
// until you run `npx expo install react-native-purchases` (and build a dev
// client) the Upgrade screen shows "purchases aren't set up" instead of failing.
// What a user is entitled to is decided on the server from RevenueCat's webhook,
// never from anything the app reports.
let Purchases = null;
try {
  // eslint-disable-next-line global-require
  Purchases = require('react-native-purchases').default;
} catch (e) {
  Purchases = null;
}

const API_KEY =
  Platform.OS === 'ios'
    ? process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY
    : process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY;

export const billingConfigured = () => !!Purchases && !!API_KEY && Platform.OS !== 'web';

let configured = false;

// Ties store purchases to the Supabase user id (the webhook relies on this).
export async function identifyBillingUser(userId) {
  if (!billingConfigured()) return;
  try {
    if (!configured) {
      Purchases.configure({ apiKey: API_KEY, appUserID: userId });
      configured = true;
    } else {
      await Purchases.logIn(userId);
    }
  } catch (e) {
    console.warn('Billing init failed:', e?.message);
  }
}

export async function resetBillingUser() {
  if (!billingConfigured() || !configured) return;
  try {
    await Purchases.logOut();
  } catch (e) {
    // already anonymous
  }
}

export async function loadPackages() {
  if (!billingConfigured() || !configured) return [];
  const offerings = await Purchases.getOfferings();
  return offerings?.current?.availablePackages ?? [];
}

// Returns { cancelled: true } if the user backed out.
export async function buyPackage(pkg) {
  try {
    await Purchases.purchasePackage(pkg);
    return {};
  } catch (e) {
    if (e?.userCancelled) return { cancelled: true };
    return { error: e };
  }
}

export async function restorePurchases() {
  if (!billingConfigured() || !configured) return { error: new Error('not_configured') };
  try {
    await Purchases.restorePurchases();
    return {};
  } catch (e) {
    return { error: e };
  }
}

export const MANAGE_SUBSCRIPTION_URL =
  Platform.OS === 'ios'
    ? 'https://apps.apple.com/account/subscriptions'
    : 'https://play.google.com/store/account/subscriptions';
