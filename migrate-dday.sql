-- ════════════════════════════════════════
-- D-day 설정 테이블 추가 (공지사항 상단 표시, 관리자 페이지에서 수정)
-- Neon 콘솔 SQL Editor에 전체 붙여넣고 Run (한 번만!)
-- ════════════════════════════════════════

create table if not exists dday_setting (
  id           smallint primary key default 1,
  title        text,
  target_date  date
);

-- 항상 id=1 하나만 존재 (없으면 빈 값으로 시드)
insert into dday_setting (id, title, target_date) values (1, null, null)
on conflict (id) do nothing;
