-- 2026-10-13(셋째) 보내기 1건의 D1 쓰기를 줄인다 — 원본 usage 의 색인을 모두 없애고 id 를 정수(넣은 순서 = 시간 순서)로,
-- 기간으로 찾을 때는 하루 요약 표가 기억하는 그날의 첫 · 끝 id(first_id · last_id)로 범위를 잡는다.
-- migrate-2026-10-13-rollup.sql 다음에, schema.sql 전에 한 번만.
--   npx wrangler@4 d1 execute freewill-usage --remote --file migrate-2026-10-13-lean.sql
CREATE TABLE usage_lean (
  id INTEGER PRIMARY KEY,
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
INSERT INTO usage_lean (ts, day, email, name, pc, win_user, device, ip, app, kind, model, resolution, n, billing, project, job, status)
  SELECT ts, day, email, name, pc, win_user, device, ip, app, kind, model, resolution, n, billing, project, job, status FROM usage ORDER BY ts;
DROP TABLE usage;
ALTER TABLE usage_lean RENAME TO usage;

ALTER TABLE usage_daily ADD COLUMN first_id INTEGER;
ALTER TABLE usage_daily ADD COLUMN last_id INTEGER;
CREATE TRIGGER IF NOT EXISTS usage_daily_ins AFTER INSERT ON usage BEGIN
  INSERT INTO usage_daily (day, device, email, app, model, n, sends, cancels, first_id, last_id)
  VALUES (NEW.day, COALESCE(NEW.device, ''), NEW.email, NEW.app, COALESCE(NEW.model, ''),
          CASE WHEN NEW.status = 'sent' THEN NEW.n ELSE 0 END, CASE WHEN NEW.status = 'sent' THEN 1 ELSE 0 END, CASE WHEN NEW.status = 'cancelled' THEN 1 ELSE 0 END, NEW.id, NEW.id)
  ON CONFLICT (day, device, email, app, model) DO UPDATE SET n = n + excluded.n, sends = sends + excluded.sends, cancels = cancels + excluded.cancels,
    first_id = MIN(COALESCE(first_id, excluded.first_id), excluded.first_id), last_id = MAX(COALESCE(last_id, excluded.last_id), excluded.last_id);
END;
CREATE TRIGGER IF NOT EXISTS usage_daily_upd AFTER UPDATE OF n, status, device, model ON usage BEGIN
  UPDATE usage_daily SET n = n - CASE WHEN OLD.status = 'sent' THEN OLD.n ELSE 0 END,
                         sends = sends - CASE WHEN OLD.status = 'sent' THEN 1 ELSE 0 END,
                         cancels = cancels - CASE WHEN OLD.status = 'cancelled' THEN 1 ELSE 0 END
   WHERE day = OLD.day AND device = COALESCE(OLD.device, '') AND email = OLD.email AND app = OLD.app AND model = COALESCE(OLD.model, '');
  INSERT INTO usage_daily (day, device, email, app, model, n, sends, cancels, first_id, last_id)
  VALUES (NEW.day, COALESCE(NEW.device, ''), NEW.email, NEW.app, COALESCE(NEW.model, ''),
          CASE WHEN NEW.status = 'sent' THEN NEW.n ELSE 0 END, CASE WHEN NEW.status = 'sent' THEN 1 ELSE 0 END, CASE WHEN NEW.status = 'cancelled' THEN 1 ELSE 0 END, NEW.id, NEW.id)
  ON CONFLICT (day, device, email, app, model) DO UPDATE SET n = n + excluded.n, sends = sends + excluded.sends, cancels = cancels + excluded.cancels,
    first_id = MIN(COALESCE(first_id, excluded.first_id), excluded.first_id), last_id = MAX(COALESCE(last_id, excluded.last_id), excluded.last_id);
END;
CREATE TRIGGER IF NOT EXISTS usage_daily_del AFTER DELETE ON usage BEGIN
  UPDATE usage_daily SET n = n - CASE WHEN OLD.status = 'sent' THEN OLD.n ELSE 0 END,
                         sends = sends - CASE WHEN OLD.status = 'sent' THEN 1 ELSE 0 END,
                         cancels = cancels - CASE WHEN OLD.status = 'cancelled' THEN 1 ELSE 0 END
   WHERE day = OLD.day AND device = COALESCE(OLD.device, '') AND email = OLD.email AND app = OLD.app AND model = COALESCE(OLD.model, '');
END;
DELETE FROM usage_daily;
INSERT INTO usage_daily (day, device, email, app, model, n, sends, cancels, first_id, last_id)
  SELECT day, COALESCE(device, ''), email, app, COALESCE(model, ''),
         SUM(CASE WHEN status = 'sent' THEN n ELSE 0 END), SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END), SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END), MIN(id), MAX(id)
    FROM usage GROUP BY day, COALESCE(device, ''), email, app, COALESCE(model, '');
