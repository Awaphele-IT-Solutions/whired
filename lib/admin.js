import { supabase } from './supabase';

// All admin actions go through one Edge Function that re-checks admin
// membership and MFA on the server. Nothing here is trusted by itself.
export async function adminCall(action, payload = {}) {
  const { data, error } = await supabase.functions.invoke('admin', {
    body: { action, ...payload },
  });
  if (error) {
    let detail = null;
    try {
      detail = await error.context.json();
    } catch (e) {
      // not JSON
    }
    const err = new Error(detail?.message || detail?.error || 'Request failed');
    err.status = error.context?.status;
    err.code = detail?.error;
    err.detail = detail;
    throw err;
  }
  return data;
}
