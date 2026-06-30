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
        case 'adminScheduleDelete':  return rowDelete_('📅 일정', data.row);
        case 'adminVoteAdd':         return voteAdd_(data);
        case 'adminVoteUpdate':      return voteUpdate_(data);
        case 'adminVoteDelete':      return rowDelete_('🗳️ 투표설정', data.row);
        case 'adminComplaintStatus': return complaintStatus_(data);
        case 'adminComplaintDelete': return rowDelete_(data.sheet || '📬 민원(접수)', data.row);
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

// ── 일정 읽기 (📅 일정 시트: 날짜·행사명·입소시간·퇴소시간·비고) ──
function getSchedule() {
  const sheet = getSheet('📅 일정');
  if (!sheet) return res([]);
  const rows = sheet.getDataRange().getValues();
  const schedules = rows.slice(1)
    .filter(r => r[0] && r[1])
    .map(r => ({
      date:    fmt(r[0]),
      title:   r[1] || '',
      inTime:  r[2] || '',
      outTime: r[3] || '',
      note:    r[4] || ''
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
  const sheet = getSheet('📅 일정');
  if (!sheet) return [];
  const values = sheet.getDataRange().getValues();
  return values.slice(1).map((r, i) => ({
    row:     i + 2,
    date:    r[0] ? fmt(r[0]) : '',
    title:   r[1] || '',
    inTime:  r[2] || '',
    outTime: r[3] || '',
    note:    r[4] || ''
  })).filter(s => s.date && s.title);
}

function scheduleRow_(d) {
  return [d.date || '', d.title || '', d.inTime || '', d.outTime || '', d.note || ''];
}
function scheduleAdd_(d) {
  getSheet('📅 일정').appendRow(scheduleRow_(d));
  return res({ ok: true });
}
function scheduleUpdate_(d) {
  getSheet('📅 일정').getRange(d.row, 1, 1, 5).setValues([scheduleRow_(d)]);
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
// 접수 시트 + 처리완료(보관) 시트 둘 다 읽어서, 완료된 민원도 계속 보이게 함
function listComplaints_() {
  const out = [];
  [['📬 민원(접수)', false], ['✅ 민원(처리완료)', true]].forEach(function (pair) {
    const name = pair[0], isDone = pair[1];
    const sheet = getSheet(name);
    if (!sheet) return;
    const values = sheet.getDataRange().getValues();
    values.forEach((r, i) => {
      if (!r[0] && !r[2]) return;                          // 빈 행
      if (r[0] === '접수일시' || r[1] === '학번' || r[2] === '이름') return; // 헤더 행
      out.push({
        row:           i + 1,
        sheet:         name,                                // 어느 시트의 행인지 (수정/삭제용)
        datetime:      r[0] ? (typeof r[0] === 'string' ? r[0] : fmt(r[0])) : '',
        hakbun:        r[1] || '',
        name:          r[2] || '',
        category:      r[3] || '',
        content:       r[4] || '',
        status:        isDone ? '처리완료' : (r[5] || '접수됨'),
        completedDate: isDone ? (r[6] ? (typeof r[6] === 'string' ? r[6] : fmt(r[6])) : '') : ''
      });
    });
  });
  return out;
}
function complaintStatus_(d) {
  getSheet(d.sheet || '📬 민원(접수)').getRange(d.row, 6).setValue(d.status || '접수됨');
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

// ════════ 최초 1회: 옛 '📅 특별일정' 삭제 + 새 '📅 일정' 생성 + 기존 일정 이관 ════════
// ▶ 에디터에서 함수 목록을 'setupSchedule'로 바꾸고 한 번만 ▶실행 하세요.
function setupSchedule() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // 1) 옛 특별일정 시트 삭제
  const old = ss.getSheetByName('📅 특별일정');
  if (old) ss.deleteSheet(old);

  // 2) 새 일정 시트 준비 (있으면 비우고 헤더 재설정)
  let sheet = ss.getSheetByName('📅 일정');
  if (!sheet) sheet = ss.insertSheet('📅 일정');
  sheet.clear();
  sheet.getRange(1, 1, 1, 5).setValues([['날짜', '행사명', '입소시간', '퇴소시간', '비고']]);

  // 3) 기존 코드에 있던 6~8월 일정 이관 (행사명 / 입소시간 / 퇴소시간 / 비고)
  const seed = [
    ['2026-06-02', '퇴소(선거일 전날)', '', '16:00 ~ 21:30', ''],
    ['2026-06-03', '지방선거일', '', '', ''],
    ['2026-06-03', '입소', '19:00 ~ 23:00', '', ''],
    ['2026-06-04', '입소(모의고사)', '16:30 ~ 23:00', '', ''],
    ['2026-06-06', '현충일(토)', '', '', '입퇴소 없음'],
    ['2026-06-29', '입소(기말고사)(석식17:30)', '13:00 ~ 23:00', '', ''],
    ['2026-06-30', '입소(기말고사)(석식17:30)', '13:00 ~ 23:00', '', ''],
    ['2026-07-01', '입소(기말고사)(석식17:30)', '13:00 ~ 23:00', '', ''],
    ['2026-07-02', '입소(기말고사)(석식17:30)', '13:00 ~ 23:00', '', ''],
    ['2026-07-03', '퇴소', '', '13:00 ~ 18:00', ''],
    ['2026-07-08', '입소(3학년 모의고사)', '16:30 ~ (3학년만)', '', ''],
    ['2026-07-09', '(1,2학년)교육과정박람회', '', '', ''],
    ['2026-07-10', '(3학년)대입박람회', '', '', ''],
    ['2026-07-13', '(1,2학년)자율적교육과정', '', '', ''],
    ['2026-07-15', '학생회 선거', '', '', ''],
    ['2026-07-16', '방학식 (퇴소)', '', '10:30 ~', ''],
    ['2026-07-19', '입소', '19:00 ~ 23:00', '', ''],
    ['2026-07-23', '생기부 진학 컨설팅', '', '', ''],
    ['2026-07-24', '생기부 진학 컨설팅', '', '', ''],
    ['2026-07-24', '퇴소', '', '16:00 ~ 21:30', ''],
    ['2026-07-26', '입소', '19:00 ~ 23:00', '', ''],
    ['2026-07-31', '퇴소', '', '16:00 ~ 21:30', ''],
    ['2026-08-10', '입소(개학 전날)', '19:00 ~ 23:00', '', ''],
    ['2026-08-11', '2학기 개학식', '', '', ''],
    ['2026-08-15', '광복절(토)', '', '', '입퇴소 없음']
  ];
  sheet.getRange(2, 1, seed.length, 5).setValues(seed);

  // 입소/퇴소 시간 칸이 시간으로 자동변환되지 않도록 텍스트 서식 고정
  sheet.getRange(2, 3, seed.length, 2).setNumberFormat('@');
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
function res(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
