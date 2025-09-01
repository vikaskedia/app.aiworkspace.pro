import { supabase } from '../supabase'
import { ensureCrossSubdomainCookies, getCookie, syncCookiesToLocalStorage, ACCESS_COOKIE, REFRESH_COOKIE } from '../utils/authRedirect'

export async function restoreCrossSubdomainSession() {
  try {
    ensureCrossSubdomainCookies([ACCESS_COOKIE, REFRESH_COOKIE])
    const at = getCookie(ACCESS_COOKIE)
    const rt = getCookie(REFRESH_COOKIE)
    if (at && rt) {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        const { data, error } = await supabase.auth.setSession({ access_token: at, refresh_token: rt })
        if (error) console.log('[auth][restore] error', error)
        else console.log('[auth][restore] done', !!data.session)
      }
    } else {
      console.log('[auth][restore] no cookies present')
    }
    syncCookiesToLocalStorage()
  } catch (e) {
    console.log('[auth][restore] exception', e)
  }
}
