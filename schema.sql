-- ════════════════════════════════════════
-- 지학원라이프 DB 스키마 (Neon / Postgres)
-- Vercel Storage → Neon 연결 후, Neon 콘솔의 SQL Editor에
-- 이 파일 전체를 붙여넣고 한 번 실행하세요. (테이블 생성 + 일정 시드)
-- ════════════════════════════════════════

create table if not exists notices (
  id          serial primary key,
  title       text,
  content     text,
  category    text,
  importance  text,
  write_date  date default current_date,
  start_date  date,
  end_date    date,
  pinned      boolean default false,
  attach      text
);

create table if not exists schedule (
  id        serial primary key,
  date      date,
  title     text,
  in_time   text,
  out_time  text,
  note      text
);

create table if not exists votes (
  id        serial primary key,
  vote_key  text unique,
  title     text,
  descr     text,
  method    text default '단일',
  options   jsonb default '[]'::jsonb,
  active    boolean default true
);

create table if not exists vote_results (
  id          serial primary key,
  created_at  timestamptz default now(),
  vote_key    text,
  vote_title  text,
  hakbun      text,
  name        text,
  selected    text
);

create table if not exists complaints (
  id            serial primary key,
  created_at    timestamptz default now(),
  hakbun        text,
  name          text,
  category      text,
  content       text,
  status        text default '접수됨',
  completed_at  timestamptz
);

-- ── 특별일정 시드 (6~8월) : 이미 있으면 건너뜀 ──
insert into schedule (date, title, in_time, out_time, note)
select * from (values
  ('2026-06-02'::date, '퇴소(선거일 전날)',            '',              '16:00 ~ 21:30', ''),
  ('2026-06-03'::date, '지방선거일',                    '',              '',              ''),
  ('2026-06-03'::date, '입소',                          '19:00 ~ 23:00', '',              ''),
  ('2026-06-04'::date, '입소(모의고사)',                '16:30 ~ 23:00', '',              ''),
  ('2026-06-06'::date, '현충일(토)',                    '',              '',              '입퇴소 없음'),
  ('2026-06-29'::date, '입소(기말고사)(석식17:30)',     '13:00 ~ 23:00', '',              ''),
  ('2026-06-30'::date, '입소(기말고사)(석식17:30)',     '13:00 ~ 23:00', '',              ''),
  ('2026-07-01'::date, '입소(기말고사)(석식17:30)',     '13:00 ~ 23:00', '',              ''),
  ('2026-07-02'::date, '입소(기말고사)(석식17:30)',     '13:00 ~ 23:00', '',              ''),
  ('2026-07-03'::date, '퇴소',                          '',              '13:00 ~ 18:00', ''),
  ('2026-07-08'::date, '입소(3학년 모의고사)',          '16:30 ~ (3학년만)', '',          ''),
  ('2026-07-09'::date, '(1,2학년)교육과정박람회',       '',              '',              ''),
  ('2026-07-10'::date, '(3학년)대입박람회',             '',              '',              ''),
  ('2026-07-13'::date, '(1,2학년)자율적교육과정',       '',              '',              ''),
  ('2026-07-15'::date, '학생회 선거',                   '',              '',              ''),
  ('2026-07-16'::date, '방학식 (퇴소)',                 '',              '10:30 ~',       ''),
  ('2026-07-19'::date, '입소',                          '19:00 ~ 23:00', '',              ''),
  ('2026-07-23'::date, '생기부 진학 컨설팅',            '',              '',              ''),
  ('2026-07-24'::date, '생기부 진학 컨설팅',            '',              '',              ''),
  ('2026-07-24'::date, '퇴소',                          '',              '16:00 ~ 21:30', ''),
  ('2026-07-26'::date, '입소',                          '19:00 ~ 23:00', '',              ''),
  ('2026-07-31'::date, '퇴소',                          '',              '16:00 ~ 21:30', ''),
  ('2026-08-10'::date, '입소(개학 전날)',               '19:00 ~ 23:00', '',              ''),
  ('2026-08-11'::date, '2학기 개학식',                  '',              '',              ''),
  ('2026-08-15'::date, '광복절(토)',                    '',              '',              '입퇴소 없음')
) as v(date, title, in_time, out_time, note)
where not exists (select 1 from schedule);
