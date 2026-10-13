-- 2026-10-13 하루 한도를 장치 기준으로 — 그 전에 만든 DB 에 한 번만 돌린다(두 번 돌리면 ALTER 에서 멈춘다). 그다음 schema.sql.
--   npx wrangler@4 d1 execute freewill-usage --remote --file migrate-2026-10-13-devices.sql
-- 옛 기록은 장치 ID 가 없어서 'pc:<PC 이름>|<윈도 사용자>' 장치로 묶는다. 같은 날 오전에 잠깐 쓴 pc_names · pc_limits 는 옮기고 지운다.
ALTER TABLE usage ADD COLUMN device TEXT;
UPDATE usage SET device = 'pc:' || COALESCE(pc, '') || '|' || COALESCE(win_user, '') WHERE device IS NULL;
CREATE INDEX IF NOT EXISTS usage_device_day_app ON usage (device, day, app);

CREATE TABLE IF NOT EXISTS devices (
  id TEXT PRIMARY KEY,
  pc TEXT,
  win_user TEXT,
  pc_names TEXT,
  label TEXT,
  label_by TEXT,
  label_at INTEGER,
  ip TEXT,
  first_ts INTEGER,
  last_ts INTEGER
);
CREATE INDEX IF NOT EXISTS devices_pc_user ON devices (pc, win_user);
CREATE TABLE IF NOT EXISTS device_limits (
  device TEXT NOT NULL,
  app TEXT NOT NULL,
  daily INTEGER NOT NULL,
  until TEXT,
  note TEXT,
  set_by TEXT,
  set_at INTEGER,
  PRIMARY KEY (device, app)
);

INSERT OR IGNORE INTO devices (id, pc, win_user, ip, first_ts, last_ts)
  SELECT device, COALESCE(pc, ''), COALESCE(win_user, ''),
         (SELECT u2.ip FROM usage u2 WHERE u2.device = usage.device ORDER BY u2.ts DESC LIMIT 1), MIN(ts), MAX(ts)
    FROM usage GROUP BY device;

CREATE TABLE IF NOT EXISTS pc_names (pc TEXT NOT NULL, win_user TEXT NOT NULL, label TEXT NOT NULL, set_by TEXT, set_at INTEGER, PRIMARY KEY (pc, win_user));
CREATE TABLE IF NOT EXISTS pc_limits (pc TEXT NOT NULL, win_user TEXT NOT NULL, app TEXT NOT NULL, daily INTEGER NOT NULL, until TEXT, note TEXT, set_by TEXT, set_at INTEGER, PRIMARY KEY (pc, win_user, app));
INSERT OR IGNORE INTO devices (id, pc, win_user, first_ts, last_ts)
  SELECT 'pc:' || pc || '|' || win_user, pc, win_user, set_at, set_at FROM pc_names;
UPDATE devices SET label = (SELECT n.label FROM pc_names n WHERE 'pc:' || n.pc || '|' || n.win_user = devices.id),
                   label_by = (SELECT n.set_by FROM pc_names n WHERE 'pc:' || n.pc || '|' || n.win_user = devices.id),
                   label_at = (SELECT n.set_at FROM pc_names n WHERE 'pc:' || n.pc || '|' || n.win_user = devices.id)
 WHERE id IN (SELECT 'pc:' || pc || '|' || win_user FROM pc_names);
INSERT OR IGNORE INTO device_limits (device, app, daily, until, note, set_by, set_at)
  SELECT 'pc:' || pc || '|' || win_user, app, daily, until, note, set_by, set_at FROM pc_limits;
DROP TABLE pc_names;
DROP TABLE pc_limits;
