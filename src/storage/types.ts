export type Cell = string | number | boolean | null;
export type Row = Record<string, Cell>;
export type Destination = 'session' | 'labeled_response' | 'unlabeled_response';
export interface Sink {
  writeSessionRows(rows: Row[]): Promise<void>;
  writeLabeledResponseRows(rows: Row[]): Promise<void>;
  writeUnlabeledResponseRows(rows: Row[]): Promise<void>;
  flush(): Promise<void>;
}
export interface BrowserMeta { browser: string; jspsych_version: string; viewport_width: number; viewport_height: number }
