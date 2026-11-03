export type ServiceStatus =
  | 'operational'
  | 'degraded'
  | 'partial_outage'
  | 'major_outage'
  | 'maintenance'
  | 'unknown';

export type StatusComponent = {
  id: 'api' | 'database';
  name: string;
  description: string;
  status: ServiceStatus;
};

export type PublicStatusPayload = {
  ok: true;
  generatedAt: string;
  overall: ServiceStatus;
  components: StatusComponent[];
};
