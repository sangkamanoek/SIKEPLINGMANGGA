import React from 'react';

/**
 * Enhanced React.lazy with automatic retry mechanism for network resilience.
 * Handles transient module loading failures caused by network drops, dev server
 * restarts, or PWA cache updates.
 */
export function lazyWithRetry<T extends React.ComponentType<any>>(
  factory: () => Promise<any>,
  namedExport?: string,
  retries = 3,
  interval = 1000
): React.LazyExoticComponent<T> {
  return React.lazy(() => {
    return new Promise<{ default: T }>((resolve, reject) => {
      const attempt = (remaining: number) => {
        factory()
          .then((module) => {
            const comp = namedExport ? module[namedExport] : (module?.default || module);
            resolve({ default: comp });
          })
          .catch((error) => {
            console.warn(`[lazyWithRetry] Module import failed, retrying (${remaining - 1} left)...`, error);
            if (remaining <= 1) {
              reject(error);
              return;
            }
            setTimeout(() => {
              attempt(remaining - 1);
            }, interval);
          });
      };
      attempt(retries);
    });
  });
}
