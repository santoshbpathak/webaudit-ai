/**
 * Environment for browser processes (Playwright Chromium, the Lighthouse runner and its
 * Chrome). Audited pages are hostile input, so the processes that render them get an
 * allowlisted environment: no API keys, access tokens or database URLs to steal if a
 * renderer is ever compromised.
 */
const PASS =
  /^(PATH|HOME|USER|LOGNAME|SHELL|TMPDIR|TMP|TEMP|TZ|LANG|LC_[A-Z]+|DISPLAY|WAYLAND_DISPLAY|XDG_[A-Z_]+|FONTCONFIG_[A-Z_]+|PLAYWRIGHT_[A-Z_]+|DBUS_SESSION_BUS_ADDRESS|SYSTEMROOT|WINDIR|PROGRAMFILES.*|LOCALAPPDATA|APPDATA|USERPROFILE|COMSPEC|PATHEXT|WEBAUDIT_CHROME_NO_SANDBOX)$/i;

export function browserEnv(env: NodeJS.ProcessEnv = process.env): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(env)) if (v !== undefined && PASS.test(k)) out[k] = v;
  return out;
}
