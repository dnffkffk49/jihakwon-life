# 지학원라이프 — Vercel + Neon 배포 가이드

기존 Google Apps Script → **Vercel 서버리스 + Neon(Postgres) DB** 로 이전.
콜드 스타트가 없어 훨씬 빠릅니다. 아래 순서대로 한 번만 세팅하면 끝.

---

## 1. Vercel에 프로젝트 만들기
1. https://vercel.com 로그인 (GitHub 계정으로)
2. **Add New… → Project**
3. **Import Git Repository** 에서 `dnffkffk49/jihakwon-life` 선택 → **Import**
4. Framework Preset은 **Other** (자동으로 잡힘). Build/Output 설정은 건드리지 말고 **Deploy**
   - (아직 DB가 없어서 이 첫 배포는 화면만 뜨고 데이터는 안 나와요. 정상입니다.)

## 2. Neon(Postgres) 데이터베이스 연결
1. 방금 만든 프로젝트 → 상단 **Storage** 탭 → **Create Database**
2. **Neon (Postgres)** 선택 → 이름 정하고 생성 → 프로젝트에 **Connect**
   - 이러면 `DATABASE_URL` 환경변수가 프로젝트에 **자동 추가**됩니다.

## 3. 테이블 만들기 + 일정 넣기 (한 번만)
1. Storage의 그 Neon DB → **Open in Neon**(또는 Neon 콘솔) → **SQL Editor**
2. 이 저장소의 **`schema.sql`** 파일 내용을 **전체 복사 → 붙여넣기 → Run**
   - 테이블 5개 생성 + 6~8월 특별일정 25건이 채워집니다.

## 4. 관리자 비밀번호 설정
1. Vercel 프로젝트 → **Settings → Environment Variables**
2. **Add**: 이름 `ADMIN_PW`, 값 = 원하는 관리자 비밀번호, 환경 **Production** 체크 → Save

## 5. 다시 배포 (환경변수 반영)
- **Deployments** 탭 → 최신 배포 오른쪽 **⋯ → Redeploy**

## 6. 접속 & 확인
- 학생: `https://<프로젝트이름>.vercel.app`
- 관리자: `https://<프로젝트이름>.vercel.app/admin.html`
- 로그인 → 공지/투표/민원 등록 테스트. 로딩이 빨라진 걸 체감하실 거예요.

> 학생들에게는 **새 Vercel 주소**를 공유하세요.
> 기존 `dnffkffk49.github.io/jihakwon-life` 주소는 이제 API(`/api`)가 없어 작동하지 않습니다.
> GitHub Pages는 꺼도 되고, 원하면 나중에 새 주소로 리다이렉트를 걸 수 있어요.

---

## 참고
- **환경변수 2개**만 있으면 됩니다: `DATABASE_URL`(2번에서 자동), `ADMIN_PW`(4번에서 수동).
- 공지·투표·민원은 빈 상태로 시작해요(일정만 시드됨). 관리자 페이지에서 새로 등록하면 됩니다.
  기존 구글시트 데이터를 옮기고 싶으면 CSV로 내보내 주세요 — 넣어드릴게요.
- 옛 Google Apps Script / 구글시트는 이제 안 쓰이지만 그대로 둬도 무방합니다.
- `apps-script/Code.gs` 는 옛 백엔드 보관용입니다(현재 미사용).
