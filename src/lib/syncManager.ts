import { pullAllDataFromFirestore } from './globalSyncService';

/**
 * Service to manage silent background data synchronization.
 * Runs on app initialization.
 */
export const runSilentBackgroundSync = async () => {
  console.log('Starting silent background sync...');
  // Silent sync, ignore progress messages
  const result = await pullAllDataFromFirestore(() => {});
  
  if (result.success) {
    console.log('Background sync successful:', result.message);
  } else {
    console.error('Background sync failed:', result.message);
  }
};
