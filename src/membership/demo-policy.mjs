export const DEMO_COOKIE = 'nugaom_demo_session';
export const DEMO_ROLES = ['onboarding', 'trial', 'starter', 'pro', 'ultimate', 'expired'];
export const demoEnabled = () => process.env.DEMO_LOGIN_ENABLED === 'true';
export const isDemoIdentity = member => Boolean(member?.id?.startsWith('demo-') || member?.line_id?.startsWith('Udemo_'));
export const DEMO_SCHEMA = `CREATE TABLE demo_access (
  member_id TEXT PRIMARY KEY REFERENCES members(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK(role IN ('onboarding','trial','starter','pro','ultimate','expired')),
  expires_at TEXT NOT NULL
);`;
