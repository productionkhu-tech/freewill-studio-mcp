-- 2026-10-13(둘째) 많이 보내도 가볍게 — 하루 요약 표(트리거로 자동) · 장치 IP 표 · 계정 마지막 사용, 기록 색인을 시간 기준으로.
-- migrate-2026-10-13-devices.sql 다음에, schema.sql 전에 한 번만(두 번 돌리면 ALTER 에서 멈춘다).
--   npx wrangler@4 d1 execute freewill-usage --remote --file migrate-2026-10-13-rollup.sql
-- 요약 표와 트리거를 같은 번에 만들고 채우므로, 그사이 옛 워커가 넣은 기록도 빠지지 않는다.
CREATE TABLE IF NOT EXISTS usage_daily (
  day TEXT NOT NULL,
  device TEXT NOT NULL,
  email TEXT NOT NULL,
  app TEXT NOT NULL,
  model TEXT NOT NULL,
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
DELETE FROM usage_daily;
INSERT INTO usage_daily (day, device, email, app, model, n, sends, cancels)
  SELECT day, COALESCE(device, ''), email, app, COALESCE(model, ''),
         SUM(CASE WHEN status = 'sent' THEN n ELSE 0 END), SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END), SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END)
    FROM usage GROUP BY day, COALESCE(device, ''), email, app, COALESCE(model, '');

CREATE INDEX IF NOT EXISTS usage_ts ON usage (ts);
CREATE INDEX IF NOT EXISTS usage_device_ts ON usage (device, ts);
DROP INDEX IF EXISTS usage_day;
DROP INDEX IF EXISTS usage_email_day_app;
DROP INDEX IF EXISTS usage_device_day_app;

CREATE TABLE IF NOT EXISTS device_ips (
  device TEXT NOT NULL,
  ip TEXT NOT NULL,
  first_ts INTEGER,
  last_ts INTEGER,
  PRIMARY KEY (device, ip)
);
INSERT OR IGNORE INTO device_ips (device, ip, first_ts, last_ts)
  SELECT device, ip, MIN(ts), MAX(ts) FROM usage WHERE device IS NOT NULL AND ip IS NOT NULL GROUP BY device, ip;

ALTER TABLE accounts ADD COLUMN last_use INTEGER;
INSERT INTO accounts (email, name, last_use)
  SELECT email, MAX(name), MAX(ts) FROM usage WHERE true GROUP BY email
  ON CONFLICT (email) DO UPDATE SET last_use = excluded.last_use;
