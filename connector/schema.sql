-- 프리윌 스튜디오 MCP 사용 기록 (Cloudflare D1 "freewill-usage")
-- 적용: npx wrangler@4 d1 execute freewill-usage --remote --file schema.sql
-- 프롬프트·그림은 저장하지 않는다. day 는 한국 시간 날짜.
CREATE TABLE IF NOT EXISTS usage (
  id TEXT PRIMARY KEY,
  ts INTEGER NOT NULL,
  day TEXT NOT NULL,
  email TEXT NOT NULL,
  name TEXT,
  pc TEXT,
  win_user TEXT,
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
CREATE INDEX IF NOT EXISTS usage_day ON usage (day);
CREATE INDEX IF NOT EXISTS usage_email_day_app ON usage (email, day, app);

-- 계정 전체 하루 상한 (관리자 화면에서 정한 계정만). 그 계정으로 보낸 모든 PC 의 합계가 이 안이어야 한다 — 없으면 상한 없음.
-- until 은 그날까지(한국 날짜, 포함), 비면 계속. daily = 0 이면 그 계정은 MCP 로 보내지 못한다.
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

-- PC 한 대(PC 이름 + 윈도 사용자)의 하루 한도 (관리자 화면에서 정함). 없으면 기본(usage.js 의 LIMITS). until·0 은 위와 같다.
-- pc · win_user 는 usage 의 값과 같고, 비어 있던 기록은 '' 로 맞춘다.
CREATE TABLE IF NOT EXISTS pc_limits (
  pc TEXT NOT NULL,
  win_user TEXT NOT NULL,
  app TEXT NOT NULL,
  daily INTEGER NOT NULL,
  until TEXT,
  note TEXT,
  set_by TEXT,
  set_at INTEGER,
  PRIMARY KEY (pc, win_user, app)
);

-- PC 에 붙인 사람 이름 (관리자 화면에서). 한 사람이 PC 여러 대면 같은 이름을 붙인다.
CREATE TABLE IF NOT EXISTS pc_names (
  pc TEXT NOT NULL,
  win_user TEXT NOT NULL,
  label TEXT NOT NULL,
  set_by TEXT,
  set_at INTEGER,
  PRIMARY KEY (pc, win_user)
);
