// 살펴볼 일 · 관리 기록 — D1 events 한 표에 남긴다(관리 화면 개요의 '살펴볼 것', 한도 탭의 '관리 기록').
//   late_settle    30분이 지난 기록을 무르거나 줄이려 함(만들고 나서 무르기)
//   device_reset   장치 ID 를 새로 만들어 보냄 — 같은 PC 이름·윈도 사용자의 장치로 묶음
//   blocked_login  막힌 계정이 커넥터에 연결하려 함
//   blocked_usage  막힌 계정의 스크립트가 보내려 함
//   admin.*        관리자가 바꾼 것(이름 · PC 한도 · 계정 상한 · 연결 끊기 · 막기 · 풀기)
export async function logEvent(env, kind, { email = null, device = null, detail = null } = {}) {
  try {
    await env.USAGE_DB.prepare("INSERT INTO events (ts, kind, email, device, detail) VALUES (?, ?, ?, ?, ?)")
      .bind(Date.now(), kind, email, device, detail === null ? null : String(detail).slice(0, 300)).run();
  } catch {
    // 기록하다 실패해도 본래 일(보내기 · 로그인 · 관리)은 막지 않는다
  }
}
