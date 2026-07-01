# 지학원라이프 — 백엔드만 Vercel+Neon으로 (주소 유지)

**학생/관리자 페이지 주소는 그대로** (`dnffkffk49.github.io/jihakwon-life`).
데이터 서버만 느린 Google Apps Script → 빠른 **Vercel 서버리스 + Neon(Postgres)** 로 바꿉니다.
페이지가 뒤에서 Vercel의 `/api` 를 호출하는 구조(주소는 코드 속 상수라 사용자는 모름).

---

## 1. Vercel 프로젝트 만들기 (API 배포용)
1. https://vercel.com 로그인 (GitHub 계정)
2. **Add New… → Project** → `dnffkffk49/jihakwon-life` **Import**
3. Framework Preset **Other** 그대로 → **Deploy**
   - Vercel이 `api/index.js` 를 서버리스 함수로 배포합니다. (정적 페이지도 같이 올라가지만 학생들은 계속 github.io 를 씀)
4. 배포 끝나면 프로젝트 주소를 확인해 두세요 — 예: `https://jihakwon-life-xxxx.vercel.app`

## 2. Neon(Postgres) DB 연결
1. 프로젝트 → **Storage** 탭 → **Create Database** → **Neon (Postgres)** → 생성·**Connect**
   - `DATABASE_URL` 환경변수가 자동 추가됩니다.

## 3. 테이블 생성 + 일정 시드
1. 그 Neon DB → **Open in Neon** → **SQL Editor**
2. 저장소의 **`schema.sql`** 전체 붙여넣고 **Run** (테이블 5개 + 일정 25건)

## 4. 관리자 비밀번호
- Vercel 프로젝트 → **Settings → Environment Variables** → `ADMIN_PW` = 원하는 비번 (Production) → Save

## 5. 다시 배포
- **Deployments** → 최신 → **⋯ → Redeploy** (환경변수 반영)

## 6. 페이지를 새 API에 연결 (마지막 한 방)
- **1번에서 확인한 Vercel 주소를 알려주시면**, `index.html`·`admin.html` 의
  `SCRIPT_URL` 을 `https://<그 주소>/api` 로 바꿔서 커밋·푸시해 드립니다.
- 그 순간부터 `github.io` 페이지가 **빠른 Vercel+Neon** 을 쓰게 됩니다. 주소는 그대로!

---

## 참고
- 환경변수 2개: `DATABASE_URL`(2번 자동), `ADMIN_PW`(4번 수동).
- 공지·투표·민원은 빈 상태로 시작(일정만 시드). 기존 구글시트 내용 옮기려면 CSV로 주세요.
- CORS 허용돼 있어 github.io ↔ vercel.app 교차 호출이 됩니다.
- 옛 GAS/구글시트/`apps-script/Code.gs` 는 그대로 둬도 무방(미사용).
