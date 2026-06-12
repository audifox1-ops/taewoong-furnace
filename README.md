# TAEWOONG - 가열로 가스 검침 & 장입도 통합 관리 시스템

가열로 가스 검침 시계열 데이터, 차지(Charge)별 가스 사용량, 장입도(裝入度) 스캔본(PDF)을 통합 관리하는 웹 애플리케이션입니다.

## 기능

| 기능 | 설명 |
|------|------|
| 가스 시계열 조회 | 분 단위 가스 데이터 조회, 필터, 내보내기 |
| 가스 데이터 업로드 | Excel/CSV 드래그앤드롭, 컬럼 매핑 UI |
| 가스 다중 업로드 | 여러 xlsx 파일 동시 업로드, 큐 UI, 파일명에서 호기/기간 자동 추출, 중복 처리 |
| 차지 사용량 관리 | 스프레드시트형 그리드, 직접 입력/편집 |
| 클립보드 붙여넣기 | 엑셀에서 복사 → 붙여넣기 (서버 검증 포함) |
| 자동 채움 | 시계열에서 사용전/사용후 자동 산출 |
| 장입도 PDF | 대량 업로드, PDF 뷰어, 기록 관리 |
| 장입도 매칭 관리 | 날짜 정합, 재매칭, 미매칭 레코드 관리 |
| 차지 상세 분석 | 시계열 차트 + PDF + 요약 카드 비교 |
| 월별 리포트 | 호기별 사용량, 주간/야간 비율 차트 |
| 분석 | 호기별/주간야간별 차트, 차지+PDF 비교 |
| 대시보드 | 실시간 통계, 바로가기 |
| 설정 | 교대 시간 설정 (로컬 스토리지) |
| 사용자 관리 | admin 전용, 사용자 생성/삭제 |
| 인증 | JWT 기반 로그인, admin/user 권한 |

## 기술 스택

- **프론트엔드**: React + TypeScript + Vite, TanStack Query, Tailwind CSS
- **백엔드**: NestJS + TypeScript
- **데이터베이스**: SQLite (Prisma ORM) — PostgreSQL 전환 가능
- **파일 저장**: MinIO (S3 호환) — Docker 환경에서 사용
- **인증**: JWT + bcrypt

## 빠른 시작

### 1. 백엔드 실행

```bash
cd backend
npm install
npx prisma generate
npx prisma migrate dev --name init
npm run prisma:seed
npm run start:dev
```

백엔드: http://localhost:3000
API 문서: http://localhost:3000/api/docs

### 2. 프론트엔드 실행

```bash
cd frontend
npm install
npm run dev
```

프론트엔드: http://localhost:5173

### 3. 샘플 데이터 생성 (선택)

```bash
cd samples
npm install
node generate-sample-data.js
node generate-sample-charges.js
node generate-sample-pdf.js
```

생성 파일:
- `가열로1호기_가스_온도(2026-06-01 ~ 2026-06-03).xlsx` (4,320행)
- `sample-charges.xlsx` (8건)
- `sample-charge-scan.pdf` (3페이지)

## 기본 계정

| 아이디 | 비밀번호 | 권한 |
|--------|----------|------|
| admin | admin123 | 관리자 (업로드/삭제/사용자 관리) |
| user | user123 | 일반 사용자 (조회/입력/내보내기) |

## 가열로 정보

- 총 **19개** 가열로 (1~20호기, **7호기 제외**)
- 표기: "가열1호", "가열19호" 형식

## 가스 사용량 계산 규칙

### 기본 공식
```
사용량 = 사용후(가스누적지침) − 사용전(가스누적지침)
```

### 핵심 규칙

1. **기준값**: `가스누적지침`(적산계 누적값)을 사용합니다. `가스` 컬럼이 아닙니다.

2. **수기 시간의 의미**: 장입도에 수기로 작성된 시간은 **작업이 끝난 종료 시점**입니다. 사용량 계산 구간의 **종료점(end, 사용후)**이 됩니다.

3. **교대(근무) 시간**:
   - 주간(Day): 08:00 ~ 19:30
   - 야간(Night): 20:00 ~ 익일 07:00 (자정을 넘김)

4. **시작점(사용전) 결정** (우선순위):
   - (1) 같은 호기의 직전 작업 종료 시각이 같은 근무(주간/야간) 안에 있으면 그 시각
   - (2) 없으면 해당 근무의 시작 경계(주간 08:00 / 야간 20:00)

5. **가장 가까운 분 데이터**: 사용전·사용후 시각에 가장 가까운 분 데이터의 `가스누적지침`을 찾습니다 (±2분 허용).

### 예외 처리

| 상황 | 처리 |
|------|------|
| 적산계 리셋/롤오버 (누적값 감소) | 경고 표시, 음수 사용량 |
| 결측 구간 | 가능한 범위에서 보정 |
| 수기 종료 시각이 비근무 구간에 걸침 | 경고 표시 |
| 가스 시계열 데이터 없음 | 자동 채움 불가, 수동 입력 안내 |

## API 엔드포인트

| Method | 경로 | 설명 |
|--------|------|------|
| POST | `/api/auth/login` | 로그인 |
| GET | `/api/auth/users` | 사용자 목록 (admin) |
| DELETE | `/api/auth/users/:id` | 사용자 삭제 (admin) |
| GET | `/api/furnaces` | 가열로 목록 |
| GET | `/api/gas-readings` | 가스 시계열 조회 |
| GET | `/api/gas-readings/parse-filename` | 파일명에서 호기/기간 추출 |
| GET | `/api/gas-readings/upload-history` | 업로드 이력 |
| POST | `/api/gas-readings/upload` | 가스 데이터 단일 업로드 |
| POST | `/api/gas-readings/upload-batch` | 가스 데이터 다중 업로드 |
| GET | `/api/charges` | 차지 목록 |
| POST | `/api/charges` | 차지 생성 |
| PUT | `/api/charges/:id` | 차지 수정 |
| POST | `/api/charges/bulk-update` | 차지 일괄 수정 |
| POST | `/api/charges/paste` | 클립보드 붙여넣기 |
| POST | `/api/charges/auto-fill` | 자동 채움 |
| POST | `/api/charges/:id/link-record` | 장입도 연결 |
| POST | `/api/charges/rematch-all` | 전체 재매칭 (admin) |
| GET | `/api/charges/unmatched` | 미매칭 레코드 조회 (admin) |
| PUT | `/api/charges/record/:id` | 레코드 수정 + 자동 재매칭 |
| POST | `/api/uploads/pdf` | PDF 업로드 |
| GET | `/api/uploads/pdf` | PDF 목록 |
| GET | `/api/analysis/dashboard` | 대시보드 통계 |
| GET | `/api/analysis/usage-trend` | 사용량 추이 |
| GET | `/api/analysis/usage-by-furnace` | 호기별 사용량 |

## Docker 환경 (선택)

```bash
docker compose up -d
```

서비스:
- PostgreSQL: localhost:5432
- MinIO: localhost:9000 (콘솔: localhost:9001)
- 백엔드: localhost:3000
- 프론트엔드: localhost:5173

## 문제 해결

### SQLite 초기화
```bash
cd backend
rm -f prisma/dev.db
npx prisma migrate dev --name init
npm run prisma:seed
```

### TypeScript 에러
```bash
cd backend && npx prisma generate
cd frontend && npm install
```
