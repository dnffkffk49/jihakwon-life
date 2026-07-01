// ════════════════════════════════════════
// 지학원라이프 API (Vercel 서버리스 + Neon Postgres)
//  - 기존 Google Apps Script 의 요청 형식(?type=...)을 그대로 흉내냄
//    → 프론트엔드는 SCRIPT_URL 만 '/api' 로 바꾸면 그대로 동작
//  - 환경변수: DATABASE_URL (Neon 연결문자열), ADMIN_PW (관리자 비밀번호)
// ════════════════════════════════════════

const { neon } = require('@neondatabase/serverless');
const sql = neon(process.env.DATABASE_URL || process.env.POSTGRES_URL);

// ── 공통 ──
function checkPw(pw) {
  const real = process.env.ADMIN_PW || '';
  return real !== '' && pw === real;
}
function send(res, obj, status) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.status(status || 200).send(JSON.stringify(obj));
}
function d(v) { return v ? v : null; }               // 빈 문자열 → null
function fmtDate(v) {
  if (!v) return '';
  if (typeof v === 'string') return v.slice(0, 10);
  try { return new Date(v).toISOString().slice(0, 10); } catch (e) { return ''; }
}
function fmtDateTime(v) {                              // KST 'YYYY-MM-DD HH:mm'
  if (!v) return '';
  const t = new Date(v).getTime();
  if (isNaN(t)) return typeof v === 'string' ? v : '';
  return new Date(t + 9 * 3600 * 1000).toISOString().slice(0, 16).replace('T', ' ');
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    if (req.method === 'GET') return await handleGet(req, res);
    if (req.method === 'POST') return await handlePost(req, res);
    return send(res, { error: 'Method Not Allowed' }, 405);
  } catch (err) {
    return send(res, { ok: false, success: false, error: err.message }, 500);
  }
};

// ───────── GET (읽기) ─────────
async function handleGet(req, res) {
  const q = req.query || {};
  const type = q.type;

  // 학생용 (공개)
  if (type === 'notices')  return send(res, await getNotices());
  if (type === 'schedule') return send(res, await getSchedule());
  if (type === 'votes')    return send(res, await getVotes());

  // 관리자용 (비밀번호 필요)
  if (type && type.indexOf('admin') === 0) {
    if (!checkPw(q.pw)) return send(res, { ok: false, error: '인증 실패' });
    if (type === 'adminLogin')       return send(res, { ok: true });
    if (type === 'adminNotices')     return send(res, { ok: true, rows: await listNotices() });
    if (type === 'adminSchedule')    return send(res, { ok: true, rows: await listSchedule() });
    if (type === 'adminVotes')       return send(res, { ok: true, rows: await listVotes() });
    if (type === 'adminVoteResults') return send(res, { ok: true, tally: await tallyVotes(q.voteId) });
    if (type === 'adminComplaints')  return send(res, { ok: true, rows: await listComplaints() });
  }
  return send(res, { error: '잘못된 요청입니다.' });
}

// 본문을 안전하게 읽음 (Vercel이 파싱했으면 req.body, 아니면 원시 스트림)
function readRawBody(req) {
  return new Promise((resolve) => {
    let s = '';
    req.on('data', (c) => { s += c; });
    req.on('end', () => resolve(s));
    req.on('error', () => resolve(''));
  });
}

// ───────── POST (쓰기) ─────────
async function handlePost(req, res) {
  let data = req.body;
  if (data === undefined || data === null || data === '') data = await readRawBody(req);
  if (typeof data === 'string') { try { data = JSON.parse(data); } catch (e) { data = {}; } }
  if (!data || typeof data !== 'object') data = {};
  const type = data.type;

  // 학생용
  if (type === 'complaint') return send(res, await saveComplaint(data));
  if (type === 'vote')      return send(res, await saveVote(data));

  // 관리자용
  if (type && type.indexOf('admin') === 0) {
    if (!checkPw(data.pw)) return send(res, { ok: false, error: '인증 실패' });
    switch (type) {
      case 'adminNoticeAdd':       return send(res, await noticeAdd(data));
      case 'adminNoticeUpdate':    return send(res, await noticeUpdate(data));
      case 'adminNoticeDelete':    return send(res, await rowDelete('notices', data.row));
      case 'adminScheduleAdd':     return send(res, await scheduleAdd(data));
      case 'adminScheduleUpdate':  return send(res, await scheduleUpdate(data));
      case 'adminScheduleDelete':  return send(res, await rowDelete('schedule', data.row));
      case 'adminVoteAdd':         return send(res, await voteAdd(data));
      case 'adminVoteUpdate':      return send(res, await voteUpdate(data));
      case 'adminVoteDelete':      return send(res, await rowDelete('votes', data.row));
      case 'adminComplaintStatus': return send(res, await complaintStatus(data));
      case 'adminComplaintDelete': return send(res, await rowDelete('complaints', data.row));
    }
  }
  return send(res, { success: false, error: '잘못된 요청' });
}

// ════════ 공지 ════════
async function getNotices() {
  const rows = await sql`
    select title, content, category, importance, write_date, start_date, end_date, pinned, attach
    from notices
    where (start_date is null or start_date <= current_date)
      and (end_date   is null or end_date   >= current_date)
    order by pinned desc, coalesce(start_date, write_date) desc nulls last, id desc`;
  return rows.map(r => ({
    title: r.title || '', content: r.content || '', category: r.category || '기타',
    importance: r.importance || '🟢 안내', writeDate: fmtDate(r.write_date),
    startDate: fmtDate(r.start_date), endDate: fmtDate(r.end_date),
    pinned: !!r.pinned, attach: r.attach || ''
  }));
}
async function listNotices() {
  const rows = await sql`select * from notices order by pinned desc, coalesce(start_date, write_date) desc nulls last, id desc`;
  return rows.map(r => ({
    row: r.id, title: r.title || '', content: r.content || '', category: r.category || '',
    importance: r.importance || '', writeDate: fmtDate(r.write_date),
    startDate: fmtDate(r.start_date), endDate: fmtDate(r.end_date),
    pinned: !!r.pinned, attach: r.attach || ''
  }));
}
async function noticeAdd(x) {
  const rows = await sql`
    insert into notices (title, content, category, importance, write_date, start_date, end_date, pinned, attach)
    values (${x.title || ''}, ${x.content || ''}, ${x.category || '기타'}, ${x.importance || '🟢 안내'},
            coalesce(${d(x.writeDate)}::date, current_date), ${d(x.startDate)}, ${d(x.endDate)},
            ${x.pinned === true}, ${x.attach || ''})
    returning id`;
  return { ok: true, row: rows[0].id };
}
async function noticeUpdate(x) {
  await sql`
    update notices set title=${x.title || ''}, content=${x.content || ''}, category=${x.category || '기타'},
      importance=${x.importance || '🟢 안내'}, start_date=${d(x.startDate)}, end_date=${d(x.endDate)},
      pinned=${x.pinned === true}, attach=${x.attach || ''}
    where id=${x.row}`;
  return { ok: true };
}

// ════════ 일정 ════════
async function getSchedule() {
  const rows = await sql`select date, title, in_time, out_time, note from schedule order by date`;
  return rows.map(r => ({ date: fmtDate(r.date), title: r.title || '', inTime: r.in_time || '', outTime: r.out_time || '', note: r.note || '' }));
}
async function listSchedule() {
  const rows = await sql`select * from schedule order by date`;
  return rows.map(r => ({ row: r.id, date: fmtDate(r.date), title: r.title || '', inTime: r.in_time || '', outTime: r.out_time || '', note: r.note || '' }));
}
async function scheduleAdd(x) {
  await sql`insert into schedule (date, title, in_time, out_time, note)
            values (${d(x.date)}, ${x.title || ''}, ${x.inTime || ''}, ${x.outTime || ''}, ${x.note || ''})`;
  return { ok: true };
}
async function scheduleUpdate(x) {
  await sql`update schedule set date=${d(x.date)}, title=${x.title || ''}, in_time=${x.inTime || ''}, out_time=${x.outTime || ''}, note=${x.note || ''}
            where id=${x.row}`;
  return { ok: true };
}

// ════════ 투표 ════════
async function getVotes() {
  const rows = await sql`select vote_key, title, descr, method, options from votes where active = true order by id`;
  return rows.map(r => ({
    id: r.vote_key, title: r.title || '', desc: r.descr || '', method: r.method || '단일',
    options: (r.options || []).filter(o => o && String(o).trim())
  }));
}
async function listVotes() {
  const rows = await sql`select * from votes order by id`;
  return rows.map(r => ({
    row: r.id, id: r.vote_key, title: r.title || '', desc: r.descr || '', method: r.method || '단일',
    options: (r.options || []).filter(o => o && String(o).trim()), active: !!r.active
  }));
}
async function voteAdd(x) {
  const key = x.id || ('v' + Date.now());
  const opts = (x.options || []).slice(0, 5);
  await sql`insert into votes (vote_key, title, descr, method, options, active)
            values (${key}, ${x.title || ''}, ${x.desc || ''}, ${x.method || '단일'}, ${JSON.stringify(opts)}::jsonb, ${x.active !== false})`;
  return { ok: true, id: key };
}
async function voteUpdate(x) {
  const opts = (x.options || []).slice(0, 5);
  await sql`update votes set title=${x.title || ''}, descr=${x.desc || ''}, method=${x.method || '단일'},
            options=${JSON.stringify(opts)}::jsonb, active=${x.active !== false} where id=${x.row}`;
  return { ok: true };
}
async function tallyVotes(voteKey) {
  const rows = voteKey
    ? await sql`select selected from vote_results where vote_key=${voteKey}`
    : await sql`select selected from vote_results`;
  const counts = {};
  let voters = 0;
  rows.forEach(r => {
    voters++;
    String(r.selected || '').split(',').map(s => s.trim()).filter(Boolean).forEach(o => { counts[o] = (counts[o] || 0) + 1; });
  });
  return { voters, counts };
}
async function saveVote(x) {
  await sql`insert into vote_results (vote_key, vote_title, hakbun, name, selected)
            values (${x.voteId || ''}, ${x.voteTitle || ''}, ${x.hakbun || ''}, ${x.name || ''},
                    ${Array.isArray(x.selected) ? x.selected.join(', ') : (x.selected || '')})`;
  return { success: true };
}

// ════════ 민원 ════════
async function listComplaints() {
  const rows = await sql`select * from complaints order by created_at desc, id desc`;
  return rows.map(r => ({
    row: r.id, sheet: 'db', datetime: fmtDateTime(r.created_at),
    hakbun: r.hakbun || '', name: r.name || '', category: r.category || '',
    content: r.content || '', status: r.status || '접수됨',
    completedDate: (r.status === '처리완료' && r.completed_at) ? fmtDate(r.completed_at) : ''
  }));
}
async function saveComplaint(x) {
  await sql`insert into complaints (hakbun, name, category, content, status)
            values (${x.hakbun || ''}, ${x.name || ''}, ${x.category || ''}, ${x.content || ''}, '접수됨')`;
  return { success: true };
}
async function complaintStatus(x) {
  if (x.status === '처리완료')
    await sql`update complaints set status=${x.status}, completed_at=now() where id=${x.row}`;
  else
    await sql`update complaints set status=${x.status || '접수됨'}, completed_at=null where id=${x.row}`;
  return { ok: true };
}

// ════════ 공통: 행 삭제 (테이블 화이트리스트) ════════
async function rowDelete(table, id) {
  if (!id) return { ok: true };
  if (table === 'notices')    await sql`delete from notices    where id=${id}`;
  else if (table === 'schedule')   await sql`delete from schedule   where id=${id}`;
  else if (table === 'votes')      await sql`delete from votes      where id=${id}`;
  else if (table === 'complaints') await sql`delete from complaints where id=${id}`;
  return { ok: true };
}
