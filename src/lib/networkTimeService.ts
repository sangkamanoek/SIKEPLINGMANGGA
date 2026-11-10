/**
 * Network True Time Service (NTP / Network Clock Synchronization)
 * Ensures attendance timestamps and Apel Pagi window validation (07:30 - 08:30 WIB)
 * are locked to authentic network server time, preventing device clock tampering.
 */

export interface ClockTamperStatus {
  isDeviated: boolean;
  diffMinutes: number;
  localTimeStr: string;
  networkTimeStr: string;
}

// Global in-memory calibrated clock offset in milliseconds
// offset = networkServerTimestamp - clientLocalTimestamp
let clockOffsetMs: number = 0;
let isSyncedWithNetwork: boolean = false;
let lastSyncTimestamp: number = 0;
let syncListeners: Set<(isSynced: boolean) => void> = new Set();
let isSyncingInProgress: boolean = false;

// Attempt to restore calibrated offset from session/localStorage
try {
  const cachedOffset = sessionStorage.getItem('sikepling_network_clock_offset');
  if (cachedOffset !== null) {
    clockOffsetMs = parseInt(cachedOffset, 10) || 0;
    isSyncedWithNetwork = true;
  }
} catch {}

/**
 * Perform network clock synchronization via server endpoint and latency compensation
 */
export async function syncNetworkTime(): Promise<number> {
  if (isSyncingInProgress) return clockOffsetMs;
  isSyncingInProgress = true;

  try {
    const t0 = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const response = await fetch(`/api/time?_t=${t0}`, {
      method: 'GET',
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache' },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const t1 = Date.now();
    const roundTrip = t1 - t0;

    if (response.ok) {
      const data = await response.json();
      if (data && typeof data.timestamp === 'number') {
        const serverTime = data.timestamp;
        // Compensate for half of round-trip latency
        const estimatedServerTimeAtT1 = serverTime + Math.floor(roundTrip / 2);
        clockOffsetMs = estimatedServerTimeAtT1 - t1;
        isSyncedWithNetwork = true;
        lastSyncTimestamp = Date.now();

        try {
          sessionStorage.setItem('sikepling_network_clock_offset', String(clockOffsetMs));
        } catch {}

        notifyListeners();
        return clockOffsetMs;
      }
    }

    // Fallback: Check HTTP Date response header if JSON parsing failed
    const headerDate = response.headers.get('Date');
    if (headerDate) {
      const serverDateMs = new Date(headerDate).getTime();
      if (!isNaN(serverDateMs)) {
        clockOffsetMs = serverDateMs + Math.floor(roundTrip / 2) - t1;
        isSyncedWithNetwork = true;
        lastSyncTimestamp = Date.now();
        notifyListeners();
        return clockOffsetMs;
      }
    }
  } catch (err) {
    // If backend endpoint failed, fallback to external public time API
    try {
      const t0 = Date.now();
      const extRes = await fetch('https://worldtimeapi.org/api/timezone/Asia/Jakarta', {
        cache: 'no-store',
        signal: AbortSignal.timeout(3500),
      });
      const t1 = Date.now();
      if (extRes.ok) {
        const extData = await extRes.json();
        if (extData && extData.unixtime) {
          const serverMs = extData.unixtime * 1000;
          clockOffsetMs = serverMs + Math.floor((t1 - t0) / 2) - t1;
          isSyncedWithNetwork = true;
          lastSyncTimestamp = Date.now();
          notifyListeners();
          return clockOffsetMs;
        }
      }
    } catch {}
  } finally {
    isSyncingInProgress = false;
  }

  return clockOffsetMs;
}

function notifyListeners() {
  syncListeners.forEach((fn) => {
    try {
      fn(isSyncedWithNetwork);
    } catch {}
  });
}

/**
 * Subscribe to network time synchronization updates
 */
export function subscribeNetworkTimeSync(listener: (isSynced: boolean) => void): () => void {
  syncListeners.add(listener);
  listener(isSyncedWithNetwork);
  return () => {
    syncListeners.delete(listener);
  };
}

/**
 * Get the current accurate Date object calculated from Network Time
 */
export function getNetworkNow(): Date {
  return new Date(Date.now() + clockOffsetMs);
}

/**
 * Get current timestamp in milliseconds based on Network Time
 */
export function getNetworkTimestamp(): number {
  return Date.now() + clockOffsetMs;
}

/**
 * Check if the network time is currently synced
 */
export function isNetworkTimeVerified(): boolean {
  return isSyncedWithNetwork;
}

/**
 * Get current clock offset in milliseconds
 */
export function getClockOffsetMs(): number {
  return clockOffsetMs;
}

/**
 * Convert Date to WIB Date & Time details (UTC+7)
 */
export function getWibDetails(dateObj: Date = getNetworkNow()) {
  const utcHours = dateObj.getUTCHours();
  const utcMinutes = dateObj.getUTCMinutes();
  const utcSeconds = dateObj.getUTCSeconds();

  let wibHours = utcHours + 7;
  let dayOffset = 0;
  if (wibHours >= 24) {
    wibHours -= 24;
    dayOffset = 1;
  }

  const dayOfWeek = (dateObj.getUTCDay() + dayOffset) % 7; // 0: Sunday, 1: Monday, ... 6: Saturday
  const totalMin = wibHours * 60 + utcMinutes;

  const hoursStr = String(wibHours).padStart(2, '0');
  const minStr = String(utcMinutes).padStart(2, '0');
  const secStr = String(utcSeconds).padStart(2, '0');

  // Calculate WIB ISO Date (YYYY-MM-DD)
  const wibTimeMs = dateObj.getTime() + 7 * 3600000;
  const wibDateObj = new Date(wibTimeMs);
  const isoYear = wibDateObj.getUTCFullYear();
  const isoMonth = String(wibDateObj.getUTCMonth() + 1).padStart(2, '0');
  const isoDay = String(wibDateObj.getUTCDate()).padStart(2, '0');
  const isoDate = `${isoYear}-${isoMonth}-${isoDay}`;

  return {
    wibHours,
    wibMinutes: utcMinutes,
    wibSeconds: utcSeconds,
    dayOfWeek,
    totalMin,
    formattedTime: `${hoursStr}:${minStr} WIB`,
    formattedTimeWithSec: `${hoursStr}:${minStr}:${secStr} WIB`,
    isoDate,
  };
}

/**
 * Get today's ISO date string (YYYY-MM-DD) in WIB based on Network Time
 */
export function getNetworkIsoDate(): string {
  return getWibDetails().isoDate;
}

/**
 * Get current time string (HH:mm WIB) based on Network Time
 */
export function getNetworkWibTimeString(includeSeconds = false): string {
  const details = getWibDetails();
  return includeSeconds ? details.formattedTimeWithSec : details.formattedTime;
}

/**
 * Check if the device local clock significantly deviates (> 2 minutes) from Network Time
 */
export function checkClockTamperStatus(): ClockTamperStatus {
  const localNow = new Date();
  const networkNow = getNetworkNow();
  const diffMs = Math.abs(networkNow.getTime() - localNow.getTime());
  const diffMinutes = Math.round(diffMs / 60000);

  const localHours = String(localNow.getHours()).padStart(2, '0');
  const localMin = String(localNow.getMinutes()).padStart(2, '0');

  return {
    isDeviated: diffMinutes >= 2,
    diffMinutes,
    localTimeStr: `${localHours}:${localMin}`,
    networkTimeStr: getNetworkWibTimeString(),
  };
}


// Start auto-sync on load
if (typeof window !== 'undefined') {
  syncNetworkTime();

  // Periodic resync every 3 minutes to maintain accurate time drift compensation
  setInterval(() => {
    syncNetworkTime();
  }, 180000);

  // Sync on online or focus event
  window.addEventListener('online', () => syncNetworkTime());
  window.addEventListener('focus', () => {
    if (Date.now() - lastSyncTimestamp > 60000) {
      syncNetworkTime();
    }
  });
}
