import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  isMonitorClientEnabled,
  monitorError,
  monitorPresence,
  monitorReleaseOnce,
  monitorSessionId,
  monitorVital,
} from '../lib/monitorClient';

let globalsInstalled = false;

function installBrowserHooks() {
  if (globalsInstalled || !isMonitorClientEnabled()) return;
  globalsInstalled = true;

  window.addEventListener('error', (event) => {
    monitorError(event.error || event.message);
  });
  window.addEventListener('unhandledrejection', (event) => {
    monitorError(event.reason);
  });

  try {
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    if (nav?.responseStart) monitorVital('ttfb', Math.round(nav.responseStart));
  } catch {
    /* ignore */
  }

  try {
    const lcp = new PerformanceObserver((list) => {
      const last = list.getEntries().at(-1);
      if (last) monitorVital('lcp', Math.round(last.startTime));
    });
    lcp.observe({ type: 'largest-contentful-paint', buffered: true });
  } catch {
    /* ignore */
  }

  try {
    const cls = new PerformanceObserver((list) => {
      let value = 0;
      for (const entry of list.getEntries()) {
        const e = entry as PerformanceEntry & { value?: number; hadRecentInput?: boolean };
        if (!e.hadRecentInput) value += e.value ?? 0;
      }
      if (value) monitorVital('cls', Number(value.toFixed(4)));
    });
    cls.observe({ type: 'layout-shift', buffered: true });
  } catch {
    /* ignore */
  }

  monitorReleaseOnce();
}

export function MonitorInstrumentation() {
  const { user } = useAuth();
  const location = useLocation();

  useEffect(() => {
    installBrowserHooks();
  }, []);

  useEffect(() => {
    if (!isMonitorClientEnabled()) return;
    const sessionId = monitorSessionId();
    const page = `${location.pathname}${location.search}`;
    const beat = () => monitorPresence(sessionId, page, user?.id);
    beat();
    const timer = window.setInterval(beat, 25000);
    return () => window.clearInterval(timer);
  }, [location.pathname, location.search, user?.id]);

  return null;
}
