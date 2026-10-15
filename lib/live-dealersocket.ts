export type LiveLead = {
  id: string; opportunityId: string; customerId: string; rooftopId: string; rooftop: string;
  customerName: string; mobile: string; email: string; vehicle: string; source: string;
  owner: string; status: string; sourceTimestamp: string; sourceTimestampBasis: string;
  observedAt: string | null; detailsObservedAt: string | null; detailsVerified: boolean;
  missingFields: string; warnings: string;
};
export type LiveLeadSnapshot = {
  state: 'idle' | 'running' | 'complete' | 'partial' | 'error'; jobId: string | null;
  snapshotState: 'complete' | 'partial' | null;
  schedule: { enabled: boolean; intervalSeconds: number; nextRunAt: string | null };
  startedAt: string | null; fetchedAt: string | null; completedAt: string | null;
  durationSeconds: number | null; progress: string | null; errorCode: string | null;
  readOnly: true; limited: boolean; records: LiveLead[];
  rooftops: { id: string; name: string; recordCount: number; matchedCandidateCount: number | null }[];
  issues: string[]; coverageNote: string;
};
const roofNames: Record<string,string> = { cranbourne_kia:'Cranbourne Kia',cranbourne_mg:'Cranbourne MG',geely_cranbourne:'Geely Cranbourne' };
const rowFields = ['id','opportunityId','customerId','rooftopId','rooftop','customerName','mobile','email','vehicle','source','owner','status','sourceTimestamp','sourceTimestampBasis','missingFields','warnings'] as const;
const date = (v: unknown) => v === null || typeof v === 'string' && Number.isFinite(Date.parse(v));
const number = (v: unknown) => v === null || typeof v === 'number' && Number.isFinite(v) && v >= 0;

// Validate and whitelist even when the configured backend returns unexpected fields.
export function sanitizeLiveSnapshot(value: unknown): LiveLeadSnapshot {
  if (!value || typeof value !== 'object') throw new Error('Invalid live lead snapshot.');
  const raw = value as LiveLeadSnapshot;
  const snapshotState = raw.snapshotState ?? (['complete','partial'].includes(raw.state) ? raw.state as 'complete' | 'partial' : null);
  const schedule = raw.schedule ?? { enabled:false,intervalSeconds:3600,nextRunAt:null };
  if (!(snapshotState === null || ['complete','partial'].includes(snapshotState)) ||
      typeof schedule.enabled !== 'boolean' || !Number.isInteger(schedule.intervalSeconds) || schedule.intervalSeconds < 300 ||
      schedule.intervalSeconds > 86400 || !date(schedule.nextRunAt)) throw new Error('Invalid sync status.');
  if (!['idle','running','complete','partial','error'].includes(raw.state) || raw.readOnly !== true ||
      !(raw.jobId === null || typeof raw.jobId === 'string') || !date(raw.startedAt) || !date(raw.fetchedAt) || !date(raw.completedAt) ||
      !number(raw.durationSeconds) || !(raw.progress === null || typeof raw.progress === 'string') ||
      !(raw.errorCode === null || ['login_required','snapshot_unavailable'].includes(raw.errorCode)) ||
      typeof raw.limited !== 'boolean' || typeof raw.coverageNote !== 'string' ||
      !Array.isArray(raw.records) || raw.records.length > 1000 || !Array.isArray(raw.rooftops) || raw.rooftops.length > 3 ||
      !Array.isArray(raw.issues) || !raw.issues.every(v => typeof v === 'string')) throw new Error('Invalid live lead snapshot.');
  const rooftops = raw.rooftops.map(roof => {
    if (!roof || roofNames[roof.id] !== roof.name || !number(roof.recordCount) || roof.recordCount === null || !number(roof.matchedCandidateCount)) throw new Error('Invalid rooftop coverage.');
    return { id:roof.id,name:roof.name,recordCount:roof.recordCount,matchedCandidateCount:roof.matchedCandidateCount };
  });
  const records = raw.records.map(row => {
    if (!row || rowFields.some(key => typeof row[key] !== 'string') || !date(row.observedAt) || !date(row.detailsObservedAt) ||
        typeof row.detailsVerified !== 'boolean' || roofNames[row.rooftopId] !== row.rooftop ||
        !rooftops.some(roof => roof.id === row.rooftopId)) throw new Error('Invalid live lead record.');
    const fields = Object.fromEntries(rowFields.map(key => [key,row[key]])) as Pick<LiveLead,typeof rowFields[number]>;
    return { ...fields,observedAt:row.observedAt,detailsObservedAt:row.detailsObservedAt,detailsVerified:row.detailsVerified };
  });
  return { state:raw.state,jobId:raw.jobId,startedAt:raw.startedAt,fetchedAt:raw.fetchedAt,completedAt:raw.completedAt,
    snapshotState,schedule:{enabled:schedule.enabled,intervalSeconds:schedule.intervalSeconds,nextRunAt:schedule.nextRunAt},
    durationSeconds:raw.durationSeconds,progress:raw.progress,errorCode:raw.errorCode,readOnly:true,limited:raw.limited,
    records,rooftops,issues:[...raw.issues],coverageNote:raw.coverageNote };
}
