import React from 'react';

export interface RealtimeSyncStatusPanelProps {
  isGoogleConnected?: boolean;
  googleUserEmail?: string | null;
  spreadsheetTitle?: string | null;
  onForceSyncAll?: () => void | Promise<void>;
  [key: string]: any;
}

export const RealtimeSyncStatusPanel: React.FC<RealtimeSyncStatusPanelProps> = () => {
  return null;
};
