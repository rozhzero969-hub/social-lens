export type Platform = 'instagram' | 'tiktok';
export type Profile = {
  id: string;
  user_id?: string;
  platform: Platform;
  username: string;
  display_name: string;
  kind: 'connected' | 'saved';
  status: 'connected' | 'setup_required' | 'expired' | 'paused' | 'unsupported';
  last_sync: string | null;
  last_attempt_at?: string | null;
  last_sync_error?: string | null;
  followers: number | null;
  bio: string;
  alerts: boolean;
  created_at?: string;
};
export type Change = {
  id: string;
  profile_id: string;
  platform: Platform;
  username: string;
  kind: 'post' | 'bio' | 'metric' | 'connection';
  title: string;
  detail: string;
  detected_at: string;
  posted_at: string | null;
  source_url: string;
  read: boolean;
};
export type Report = {
  id: string;
  title: string;
  date: string;
  summary: string;
  coverage: { success: number; total: number; failed: number };
  items: Change[];
  generated_by: 'template' | 'ai';
  created_at: string;
};
export type Bookmark = {
  id: string;
  title: string;
  url: string;
  platform: Platform;
  collection: string;
  created_at: string;
};
export type Preferences = {
  timezone: string;
  report_time: string;
  language: string;
  report_length: 'short' | 'detailed';
  email_enabled: boolean;
  digest_only: boolean;
  quiet_start: string;
  quiet_end: string;
  retention_days: number;
  last_report_date?: string | null;
};
export type AppData = {
  profiles: Profile[];
  changes: Change[];
  reports: Report[];
  bookmarks: Bookmark[];
  preferences: Preferences;
};
export const defaultPreferences: Preferences = {
  timezone: 'Asia/Baghdad',
  report_time: '09:00',
  language: 'English',
  report_length: 'short',
  email_enabled: false,
  digest_only: false,
  quiet_start: '22:00',
  quiet_end: '08:00',
  retention_days: 90,
};
export const emptyData = (): AppData => ({
  profiles: [],
  changes: [],
  reports: [],
  bookmarks: [],
  preferences: { ...defaultPreferences },
});
