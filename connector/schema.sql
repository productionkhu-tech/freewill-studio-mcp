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

-- 사람별 하루 한도 (관리자 화면에서 정함). 없으면 기본(usage.js 의 LIMITS). until 은 그날까지(한국 날짜, 포함), 비면 계속.
-- daily = 0 이면 그 사람은 MCP 로 보내지 못한다.
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
