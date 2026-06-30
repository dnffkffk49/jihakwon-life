// ════════════════════════════════════════
// 지학원라이프 통합 Apps Script
//  - 학생용(index.html) : 공지·일정·투표 읽기 / 민원·투표 제출
//  - 관리자용(admin.html): 공지·투표·민원·일정 CRUD (비밀번호 보호)
//
//  ⚠️ 관리자 비밀번호는 코드에 적지 않습니다.
//     [프로젝트 설정 ⚙️ → 스크립트 속성]에서
//     속성 이름 ADMIN_PW, 값 = 원하는 비밀번호 로 추가하세요.
// ════════════════════════════════════════

// ───────── 라우팅 ─────────
function doGet(e) {
  const type = e.parameter.type;

  // 학생용 (공개)
  if (type === 'notices')  return getNotices();
  if (type === 'schedule') return getSchedule();
  if (type === 'votes')    return getVotes();

  // 관리자용 (비밀번호 필요) — 읽기
  if (type && type.indexOf('admin') === 0) {
    if (!checkPw_(e.parameter.pw)) return res({ ok: false, error: '인증 실패' });
    switch (type) {
      case 'adminLogin':       return res({ ok: true });
      case 'adminNotices':     return res({ ok: true, rows: listNotices_() });
      case 'adminSchedule':    return res({ ok: true, rows: listSchedule_() });
      case 'adminVotes':       return res({ ok: true, rows: listVotes_() });
      case 'adminVoteResults': return res({ ok: true, tally: tallyVotes_(e.parameter.voteId) });
      case 'adminComplaints':  return res({ ok: true, rows: listComplaints_() });
    }
  }
  return res({ error: '잘못된 요청입니다.' });
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const type = data.type;

    // 학생용
    if (type === 'complaint') return saveComplaint(data);
    if (type === 'vote')      return saveVote(data);

    // 관리자용 (비밀번호 필요) — 쓰기
    if (type && type.indexOf('admin') === 0) {
      if (!checkPw_(data.pw)) return res({ ok: false, error: '인증 실패' });
      switch (type) {
        case 'adminNoticeAdd':       return noticeAdd_(data);
        case 'adminNoticeUpdate':    return noticeUpdate_(data);
        case 'adminNoticeDelete':    return rowDelete_('📢 공지사항', data.row);
        case 'adminScheduleAdd':     return scheduleAdd_(data);
        case 'adminScheduleUpdate':  return scheduleUpdate_(data);
        case 'adminScheduleDelete':  return rowDelete_('📅 특별일정', data.row);
        case 'adminVoteAdd':         return voteAdd_(data);
        case 'adminVoteUpdate':      return voteUpdate_(data);
        case 'adminVoteDelete':      return rowDelete_('🗳️ 투표설정', data.row);
        case 'adminComplaintStatus': return complaintStatus_(data);
        case 'adminComplaintDelete': return rowDelete_('📬 민원(접수)', data.row);
      }
    }
    return res({ success: false, error: '잘못된 요청' });
  } catch (err) {
    return res({ success: false, error: err.message });
  }
}

// ───────── 인증 ─────────
function checkPw_(pw) {
  const real = PropertiesService.getScriptProperties().getProperty('ADMIN_PW') || '';
  return real !== '' && pw === real;
}

// ════════ 학생용: 읽기 ════════

// ── 공지사항 읽기 (첨부링크 포함, 노출기간 필터) ──
function getNotices() {
  const sheet = getSheet('📢 공지사항');
  const rows = sheet.getDataRange().getValues();
  const headers = rows[0];
  const attachIdx = headers.indexOf('첨부링크');
  const today = new Date(); today.setHours(0,0,0,0);

  const notices = rows.slice(1)
    .filter(r => {
      if (!r[0]) return false;
      const start = r[5] ? new Date(r[5]) : null;
      const end   = r[6] ? new Date(r[6]) : null;
      if (start) { start.setHours(0,0,0,0); if (start > today) return false; }
      if (end)   { end.setHours(0,0,0,0);   if (end < today)   return false; }
      return true;
    })
    .map(r => ({
      title:      r[0] || '',
      content:    r[1] || '',
      category:   r[2] || '기타',
      importance: r[3] || '🟢 안내',
      writeDate:  r[4] ? fmt(r[4]) : '',
      startDate:  r[5] ? fmt(r[5]) : '',
      endDate:    r[6] ? fmt(r[6]) : '',
      pinned:     r[7] === true || r[7] === 'TRUE',
      attach:     attachIdx >= 0 ? (r[attachIdx] || '') : ''
    }))
    .sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return new Date(b.startDate) - new Date(a.startDate);
    });

  return res(notices);
}

// ── 특별일정 읽기 ──
function getSchedule() {
  const sheet = getSheet('📅 특별일정');
  const rows = sheet.getDataRange().getValues();
  const schedules = rows.slice(1)
    .filter(r => r[0] && r[2])
    .map(r => ({
      date:    r[0] ? fmt(r[0]) : '',
      type:    r[1] || '',
      title:   r[2] || '',
      inTime:  fmtTime(r[3]),
      outTime: fmtTime(r[4]),
      endDate: r[5] ? fmt(r[5]) : '',
      note:    r[6] || ''
    }));
  return res(schedules);
}

// ── 투표 설정 읽기 (활성만) ──
function getVotes() {
  const sheet = getSheet('🗳️ 투표설정');
  const rows = sheet.getDataRange().getValues();
  const votes = rows.slice(1)
    .filter(r => r[0] && (r[9] === true || r[9] === 'TRUE'))
    .map(r => ({
      id:      r[0],
      title:   r[1] || '',
      desc:    r[2] || '',
      method:  r[3] || '단일',
      options: [r[4], r[5], r[6], r[7], r[8]].filter(o => o && o.toString().trim())
    }));
  return res(votes);
}

// ════════ 학생용: 쓰기 ════════

// ── 민원 저장 ──
function saveComplaint(data) {
  const sheet = getSheet('📬 민원(접수)');
  sheet.appendRow([
    data.datetime || '', data.hakbun || '', data.name || '',
    data.category || '', data.content || '', '접수됨'
  ]);
  return res({ success: true });
}

// ── 투표 저장 ──
function saveVote(data) {
  const sheet = getSheet('🗳️ 투표결과');
  sheet.appendRow([
    data.datetime || '',
    data.voteId   || '',
    data.voteTitle|| '',
    data.hakbun   || '',
    data.name     || '',
    Array.isArray(data.selected) ? data.selected.join(', ') : (data.selected || '')
  ]);
  return res({ success: true });
}

// ════════ 관리자용: 공지 ════════
function listNotices_() {
  const sheet = getSheet('📢 공지사항');
  const values = sheet.getDataRange().getValues();
  const headers = values[0] || [];
  const attachIdx = headers.indexOf('첨부링크');
  return values.slice(1).map((r, i) => ({
    row:        i + 2,
    title:      r[0] || '',
    content:    r[1] || '',
    category:   r[2] || '',
    importance: r[3] || '',
    writeDate:  r[4] ? fmt(r[4]) : '',
    startDate:  r[5] ? fmt(r[5]) : '',
    endDate:    r[6] ? fmt(r[6]) : '',
    pinned:     r[7] === true || r[7] === 'TRUE',
    attach:     attachIdx >= 0 ? (r[attachIdx] || '') : ''
  })).filter(n => n.title);
}

function noticeRow_(d) {
  // 0~7 위치 고정 (학생 읽기와 동일한 컬럼 순서)
  return [
    d.title || '', d.content || '', d.category || '기타', d.importance || '🟢 안내',
    d.writeDate || fmt(new Date()), d.startDate || '', d.endDate || '', d.pinned === true
  ];
}

function noticeAdd_(d) {
  const sheet = getSheet('📢 공지사항');
  const headers = sheet.getDataRange().getValues()[0] || [];
  const attachIdx = headers.indexOf('첨부링크');
  const arr = noticeRow_(d);
  if (attachIdx >= 0) { while (arr.length < attachIdx) arr.push(''); arr[attachIdx] = d.attach || ''; }
  sheet.appendRow(arr);
  return res({ ok: true, row: sheet.getLastRow() });
}

function noticeUpdate_(d) {
  const sheet = getSheet('📢 공지사항');
  const headers = sheet.getDataRange().getValues()[0] || [];
  const attachIdx = headers.indexOf('첨부링크');
  const vals = noticeRow_(d);
  sheet.getRange(d.row, 1, 1, vals.length).setValues([vals]);
  if (attachIdx >= 0) sheet.getRange(d.row, attachIdx + 1).setValue(d.attach || '');
  return res({ ok: true });
}

// ════════ 관리자용: 일정 ════════
function listSchedule_() {
  const sheet = getSheet('📅 특별일정');
  const values = sheet.getDataRange().getValues();
  return values.slice(1).map((r, i) => ({
    row:     i + 2,
    date:    r[0] ? fmt(r[0]) : '',
    type:    r[1] || '',
    title:   r[2] || '',
    inTime:  fmtTime(r[3]),
    outTime: fmtTime(r[4]),
    endDate: r[5] ? fmt(r[5]) : '',
    note:    r[6] || ''
  })).filter(s => s.date && s.title);
}

function scheduleRow_(d) {
  return [d.date || '', d.type || '', d.title || '', d.inTime || '', d.outTime || '', d.endDate || '', d.note || ''];
}
function scheduleAdd_(d) {
  getSheet('📅 특별일정').appendRow(scheduleRow_(d));
  return res({ ok: true });
}
function scheduleUpdate_(d) {
  getSheet('📅 특별일정').getRange(d.row, 1, 1, 7).setValues([scheduleRow_(d)]);
  return res({ ok: true });
}

// ════════ 관리자용: 투표 ════════
function listVotes_() {
  const sheet = getSheet('🗳️ 투표설정');
  const values = sheet.getDataRange().getValues();
  return values.slice(1).map((r, i) => ({
    row:     i + 2,
    id:      r[0] || '',
    title:   r[1] || '',
    desc:    r[2] || '',
    method:  r[3] || '단일',
    options: [r[4], r[5], r[6], r[7], r[8]].map(o => (o == null ? '' : o)).filter(o => o.toString().trim()),
    active:  r[9] === true || r[9] === 'TRUE'
  })).filter(v => v.id);
}

function voteRow_(d) {
  const opts = (d.options || []).slice();
  while (opts.length < 5) opts.push('');
  return [
    d.id || ('v' + Date.now()), d.title || '', d.desc || '', d.method || '단일',
    opts[0], opts[1], opts[2], opts[3], opts[4], d.active !== false
  ];
}
function voteAdd_(d) {
  const row = voteRow_(d);
  getSheet('🗳️ 투표설정').appendRow(row);
  return res({ ok: true, id: row[0] });
}
function voteUpdate_(d) {
  getSheet('🗳️ 투표설정').getRange(d.row, 1, 1, 10).setValues([voteRow_(d)]);
  return res({ ok: true });
}

function tallyVotes_(voteId) {
  const sheet = getSheet('🗳️ 투표결과');
  const values = sheet.getDataRange().getValues().slice(1);
  const counts = {};
  let voters = 0;
  values.forEach(r => {
    if (voteId && r[1] !== voteId) return;
    voters++;
    String(r[5] || '').split(',').map(s => s.trim()).filter(Boolean).forEach(opt => {
      counts[opt] = (counts[opt] || 0) + 1;
    });
  });
  return { voters, counts };
}

// ════════ 관리자용: 민원 ════════
function listComplaints_() {
  const sheet = getSheet('📬 민원(접수)');
  const values = sheet.getDataRange().getValues();
  const out = [];
  values.forEach((r, i) => {
    if (!r[0] && !r[2]) return;                          // 빈 행
    if (r[0] === '접수일시' || r[1] === '학번' || r[2] === '이름') return; // 헤더 행
    out.push({
      row:      i + 1,
      datetime: r[0] ? (typeof r[0] === 'string' ? r[0] : fmt(r[0])) : '',
      hakbun:   r[1] || '',
      name:     r[2] || '',
      category: r[3] || '',
      content:  r[4] || '',
      status:   r[5] || '접수됨'
    });
  });
  return out;
}
function complaintStatus_(d) {
  getSheet('📬 민원(접수)').getRange(d.row, 6).setValue(d.status || '접수됨');
  return res({ ok: true });
}

// ════════ 공통: 행 삭제 ════════
function rowDelete_(sheetName, row) {
  const sheet = getSheet(sheetName);
  if (sheet && row && row >= 2) sheet.deleteRow(row);
  return res({ ok: true });
}

// ════════ 자동화: 처리완료 민원 → 처리완료 탭 ════════
function archiveCompleted() {
  const active = getSheet('📬 민원(접수)');
  const done   = getSheet('✅ 민원(처리완료)');
  if (!active || !done) return;
  const rows = active.getDataRange().getValues();
  const toDelete = [];
  for (let i = rows.length - 1; i >= 2; i--) {
    if (rows[i][5] === '처리완료') {
      done.appendRow([...rows[i], fmt(new Date())]);
      toDelete.push(i + 1);
    }
  }
  toDelete.forEach(r => active.deleteRow(r));
}

// ── 트리거 설정 (최초 1회 실행) ──
function setTrigger() {
  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('archiveCompleted').timeBased().everyDays(1).atHour(2).create();
}

// ════════ 헬퍼 ════════
function getSheet(name) {
  return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
}
function fmt(date) {
  return Utilities.formatDate(new Date(date), 'Asia/Seoul', 'yyyy-MM-dd');
}
function fmtTime(val) {
  if (!val) return '';
  if (typeof val === 'string') return val;
  try { return Utilities.formatDate(new Date(val), 'Asia/Seoul', 'HH:mm'); }
  catch (e) { return ''; }
}
function res(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
