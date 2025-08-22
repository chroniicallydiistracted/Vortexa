export type DataSource = {
  area: string; layer: string; provider: string; access: string;
  base_url: string; format?: string; cadence?: string; latency?: string;
  coverage?: string; auth?: string; notes?: string;
};
export type Catalog = { generated_at: string; entries: DataSource[] };
