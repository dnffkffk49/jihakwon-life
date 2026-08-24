-- ════════════════════════════════════════
-- 세탁실 예약 테이블 추가 (당일 예약, 18~22시 1시간 단위)
-- Neon 콘솔 SQL Editor에 전체 붙여넣고 Run (한 번만!)
-- ════════════════════════════════════════

create table if not exists laundry_bookings (
  id            serial primary key,
  created_at    timestamptz default now(),
  machine_type  text not null,     -- 'washer' | 'dryer'
  floor         int not null,
  booking_date  date not null,     -- 한국시간 기준 예약 날짜 (당일만 사용)
  hour          int not null,      -- 예약 시작 시각 (18~22)
  name          text not null      -- 이름 또는 호실
);

create unique index if not exists laundry_slot_uidx
  on laundry_bookings (machine_type, floor, booking_date, hour);
