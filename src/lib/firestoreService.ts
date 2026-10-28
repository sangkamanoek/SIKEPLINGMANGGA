export const cleanFirestoreData = (data: any) => {
  const cleaned: any = {};
  for (const key of Object.keys(data || {})) {
    if (data[key] !== undefined) {
      cleaned[key] = data[key];
    }
  }
  return cleaned;
};

export interface SyncAuditLog {
  id?: string;
  timestamp: string;
  actor: string;
  action: string;
  status: string;
  details?: any;
}

export interface AttendanceQREntity {
  id: string;
  code: string;
  createdAt: string;
  expiresAt: string;
  active: boolean;
  [key: string]: any;
}

export const fetchReportsFromFirestore = async () => [];
export const saveReportToFirestore = async () => {};
export const deleteReportFromFirestore = async () => {};
export const resetAllReportsInFirestore = async () => {};
export const subscribeReportsFromFirestore = (cb: any) => { cb([]); return () => {}; };
export const shouldFilterReport = (_r?: any) => false;

export const fetchTargetsFromFirestore = async (): Promise<any> => ({});
export const saveTargetToFirestore = async () => {};
export const saveAllTargetsToFirestore = async () => {};
export const resetTargetsInFirestore = async () => {};
export const subscribeTargetsFromFirestore = (cb: any) => { cb([]); return () => {}; };

export const saveSyncAuditLog = async (_log: any) => {};
export const fetchSyncAuditLogs = async (): Promise<SyncAuditLog[]> => [];
export const saveAttendanceQRToFirestore = async (_qr: any) => {};
export const subscribeAttendanceQRFromFirestore = (_dateStr: string, cb: (qr: AttendanceQREntity | null) => void) => {
  if (typeof cb === 'function') {
    cb(null);
  }
  return () => {};
};

export const subscribeCustomEventsFromFirestore = (cb: any) => { cb([]); return () => {}; };
export const subscribeEventAttendanceFromFirestore = (cb: any) => { cb([]); return () => {}; };
export const saveCustomEventToFirestore = async (_event: any) => {};
export const deleteCustomEventFromFirestore = async (_id: string) => {};
export const saveEventAttendanceToFirestore = async (_att: any) => {};
