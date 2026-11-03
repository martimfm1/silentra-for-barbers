export type ServiceStatus =
  | 'operational'
  | 'degraded'
  | 'partial_outage'
  | 'major_outage'
  | 'maintenance'
  | 'unknown';

export type StatusComponent = {
  id: string;
  name: string;
  description: string;
  status: ServiceStatus;
  sourceUrl?: string;
  sourceUpdatedAt?: string | null;
};

export type StatusIncident = {
  id: string;
  provider: string;
  title: string;
  status: string;
  impact: string;
  updatedAt: string | null;
  sourceUrl: string;
};

export type StatusMaintenance = {
  id: string;
  provider: string;
  title: string;
  status: string;
  scheduledFor: string | null;
  scheduledUntil: string | null;
  sourceUrl: string;
};

export type PublicStatusPayload = {
  ok: true;
  generatedAt: string;
  overall: ServiceStatus;
  components: StatusComponent[];
  incidents: StatusIncident[];
  maintenances: StatusMaintenance[];
};
