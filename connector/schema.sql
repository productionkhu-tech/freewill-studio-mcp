-- 프리윌 스튜디오 MCP 사용 기록 (Cloudflare D1 "freewill-usage")
-- 새 DB: npx wrangler@4 d1 execute freewill-usage --remote --file schema.sql
-- 옛 DB 는 이 파일 전에 한 번씩(차례대로): migrate-2026-10-13-devices.sql(장치 칸) → migrate-2026-10-13-rollup.sql(하루 요약 표).
-- 프롬프트·그림은 저장하지 않는다. day 는 한국 시간 날짜.
CREATE TABLE IF NOT EXISTS usage (
  id TEXT PRIMARY KEY,
  ts INTEGER NOT NULL,
  day TEXT NOT NULL,
  email TEXT NOT NULL,
  name TEXT,
  pc TEXT,
  win_user TEXT,
  device TEXT,
  ip TEXT,
  app TEXT NOT NULL,
  kind TEXT,
  model TEXT,
  resolution TEXT,
  n INTEGER NOT NULL,
  billing TEXT,
  project TEXT,
  job TEXT,
  status TEXT NOT NULL DEFAULT 'sent'
);
-- 기록 탭 · CSV 는 시간 범위로(관리 화면의 합계 · 한도 확인은 아래 하루 요약 표로)
CREATE INDEX IF NOT EXISTS usage_ts ON usage (ts);
CREATE INDEX IF NOT EXISTS usage_device_ts ON usage (device, ts);

-- 하루 요약 — usage 에 넣고 · 고치고 · 지울 때 트리거가 자동으로 맞춘다. 하루 한도 확인과 관리 화면 합계는 이 표만 읽어서
-- 기록이 하루 수만 건이어도 가볍다(보낼 때마다 그날 기록을 다시 더하지 않는다). n · sends = 보낸 것, cancels = 무른 것.
CREATE TABLE IF NOT EXISTS usage_daily (
  day TEXT NOT NULL,
  device TEXT NOT NULL,
  email TEXT NOT NULL,
  app TEXT NOT NULL,
  model TEXT NOT NULL,          -- '' = 앱 설정 그대로
  n INTEGER NOT NULL DEFAULT 0,
  sends INTEGER NOT NULL DEFAULT 0,
  cancels INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, device, email, app, model)
);
CREATE INDEX IF NOT EXISTS usage_daily_email ON usage_daily (day, email, app);
CREATE TRIGGER IF NOT EXISTS usage_daily_ins AFTER INSERT ON usage BEGIN
  INSERT INTO usage_daily (day, device, email, app, model, n, sends, cancels)
  VALUES (NEW.day, COALESCE(NEW.device, ''), NEW.email, NEW.app, COALESCE(NEW.model, ''),
          CASE WHEN NEW.status = 'sent' THEN NEW.n ELSE 0 END, CASE WHEN NEW.status = 'sent' THEN 1 ELSE 0 END, CASE WHEN NEW.status = 'cancelled' THEN 1 ELSE 0 END)
  ON CONFLICT (day, device, email, app, model) DO UPDATE SET n = n + excluded.n, sends = sends + excluded.sends, cancels = cancels + excluded.cancels;
END;
CREATE TRIGGER IF NOT EXISTS usage_daily_upd AFTER UPDATE OF n, status, device, model ON usage BEGIN
  UPDATE usage_daily SET n = n - CASE WHEN OLD.status = 'sent' THEN OLD.n ELSE 0 END,
                         sends = sends - CASE WHEN OLD.status = 'sent' THEN 1 ELSE 0 END,
                         cancels = cancels - CASE WHEN OLD.status = 'cancelled' THEN 1 ELSE 0 END
   WHERE day = OLD.day AND device = COALESCE(OLD.device, '') AND email = OLD.email AND app = OLD.app AND model = COALESCE(OLD.model, '');
  INSERT INTO usage_daily (day, device, email, app, model, n, sends, cancels)
  VALUES (NEW.day, COALESCE(NEW.device, ''), NEW.email, NEW.app, COALESCE(NEW.model, ''),
          CASE WHEN NEW.status = 'sent' THEN NEW.n ELSE 0 END, CASE WHEN NEW.status = 'sent' THEN 1 ELSE 0 END, CASE WHEN NEW.status = 'cancelled' THEN 1 ELSE 0 END)
  ON CONFLICT (day, device, email, app, model) DO UPDATE SET n = n + excluded.n, sends = sends + excluded.sends, cancels = cancels + excluded.cancels;
END;
CREATE TRIGGER IF NOT EXISTS usage_daily_del AFTER DELETE ON usage BEGIN
  UPDATE usage_daily SET n = n - CASE WHEN OLD.status = 'sent' THEN OLD.n ELSE 0 END,
                         sends = sends - CASE WHEN OLD.status = 'sent' THEN 1 ELSE 0 END,
                         cancels = cancels - CASE WHEN OLD.status = 'cancelled' THEN 1 ELSE 0 END
   WHERE day = OLD.day AND device = COALESCE(OLD.device, '') AND email = OLD.email AND app = OLD.app AND model = COALESCE(OLD.model, '');
END;

-- 장치 = PC 한 대의 윈도 사용자. id 는 스크립트가 사용자 폴더(~/.freewill-studio/device.json)에 한 번 만들어 두는 값이라
-- PC 이름을 바꿔도 같다. 장치 ID 를 안 보내던 옛 기록은 'pc:<PC 이름>|<윈도 사용자>' — 그 PC 가 ID 를 보내 오면 합친다(usage.js).
-- last_ts 는 바뀐 게 없으면 10분에 한 번만 고친다(보낼 때마다 쓰지 않는다).
CREATE TABLE IF NOT EXISTS devices (
  id TEXT PRIMARY KEY,
  pc TEXT,            -- 마지막으로 알려 온 PC 이름
  win_user TEXT,
  pc_names TEXT,      -- 전에 쓰던 PC 이름들 (", " 로 이음)
  label TEXT,         -- 관리자가 붙인 사람 이름 — 한 사람이 PC 여러 대면 같은 이름
  label_by TEXT,
  label_at INTEGER,
  ip TEXT,            -- 마지막으로 보낸 곳의 IP
  first_ts INTEGER,
  last_ts INTEGER
);
CREATE INDEX IF NOT EXISTS devices_pc_user ON devices (pc, win_user);

-- 장치마다 쓴 공인 IP (바뀔 때 · 10분마다 남김)
CREATE TABLE IF NOT EXISTS device_ips (
  device TEXT NOT NULL,
  ip TEXT NOT NULL,
  first_ts INTEGER,
  last_ts INTEGER,
  PRIMARY KEY (device, ip)
);

-- 장치의 하루 한도 (관리자 화면에서 정함). 없으면 기본(usage.js 의 LIMITS). until 은 그날까지(한국 날짜, 포함), 비면 계속.
-- daily = 0 이면 그 장치는 MCP 로 보내지 못한다(사람·PC 탭 '막기' = 두 앱 모두 0).
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

-- 계정 전체 하루 상한 (관리자 화면에서 정한 계정만). 그 계정으로 보낸 모든 장치의 합계가 이 안이어야 한다 — 없으면 상한 없음.
-- until · 0 은 위와 같다.
CREATE TABLE IF NOT EXISTS limits (
  email TEXT NOT NULL,
  app TEXT NOT NULL,
  daily INTEGER NOT NULL,
  until TEXT,
  note TEXT,
  set_by TEXT,
  set_at INTEGER,
  PRIMARY KEY (email, app)
);

-- 장치 ID 를 새로 만들어 보낸 것(device.json 을 지움 등) → 같은 PC 이름·윈도 사용자의 원래 장치로 묶어 둔 표
CREATE TABLE IF NOT EXISTS device_alias (
  alias TEXT PRIMARY KEY,
  device TEXT NOT NULL,
  ts INTEGER
);

-- 커넥터에 연결한 계정 (연결할 때마다 남김) — 관리 화면 '계정' 탭. blocked = 1 이면 연결도 보내기도 못 한다.
-- last_use 는 그 계정으로 마지막에 보낸 때(10분에 한 번만 고침).
CREATE TABLE IF NOT EXISTS accounts (
  email TEXT PRIMARY KEY,
  name TEXT,
  first_login INTEGER,
  last_login INTEGER,
  logins INTEGER DEFAULT 0,
  clients TEXT,       -- 연결한 앱 이름들 (", " 로 이음)
  blocked INTEGER DEFAULT 0,
  blocked_by TEXT,
  blocked_at INTEGER,
  last_use INTEGER
);

-- 살펴볼 일 · 관리 기록 (events.js)
CREATE TABLE IF NOT EXISTS events (
  ts INTEGER NOT NULL,
  kind TEXT NOT NULL,
  email TEXT,
  device TEXT,
  detail TEXT
);
CREATE INDEX IF NOT EXISTS events_ts ON events (ts);
