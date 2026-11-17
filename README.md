# 수업서랍 · Class-Acave

6학년 수업·업무 자료를 가져와 검색하고, 수업별 모음으로 정리하는 웹앱입니다.

- [수업서랍 실행](https://classroom-drawer-6-20261113.asdad123asd.chatgpt.site)
- [GitHub 저장소](https://github.com/gmlduqzhd123-lab/Class-Acave)
- [동료 초대·모음 공유 안내](COLLABORATION.md)
- [Gmail 자동 초대 메일 연결](integrations/google-mail/README.md)

## 저장소와 배포

GitHub의 **main에 푸시하면 Vercel이 즉시 빌드·운영 배포를 시작**합니다. 성공한 빌드가 새 운영 버전으로 전환되며, 빌드가 실패하면 직전 버전을 유지합니다. 일정 간격으로 확인하는 방식은 사용하지 않습니다.

화면과 API는 Next.js + Vercel에서 실행하고, 기존 Sites의 D1 자료 저장소는 서버 전용 HMAC 게이트웨이로 연결합니다. 기존 자료·모음·메모·초대 명단을 그대로 사용합니다. 자료 저장소 역할을 하는 기존 Site와 Gmail Apps Script 배포를 삭제하지 마세요. 자료와 비밀 값은 Git에 포함하지 않습니다.

프로덕션 환경변수: ARCHIVE_GATEWAY_URL, ARCHIVE_GATEWAY_SECRET, BETTER_AUTH_SECRET, BETTER_AUTH_URL. 비밀 값은 Vercel의 암호화된 설정에만 등록합니다. 미리보기 배포에는 운영 데이터 접근 키를 제공하지 않습니다.

로그인은 초대된 이메일로 받은 10분 유효·1회용 링크를 사용합니다. 검증된 이메일을 기존 사용자 ID에 연결하므로 개인 모음 소유권이 유지됩니다. 외부 요청의 사용자 ID 헤더는 신뢰하지 않습니다.

## 구현 범위

- 공개 Google Sheets URL에서 읽기 전용 엑셀 내보내기 가져오기
- .xlsx 파일 및 Google Sheets CellData .json 파일 업로드 (최대 8MB)
- 탭별 변환 미리보기, 탭 선택, 자료·안내·검토 항목 수 확인
- 원본 설명, 셀 메모, 링크, 원본 위치와 출처 표기 보관
- 체육의 가로형 계획표 영역 분리와 링크 없는 아이디어 보존
- 교과·주제와 자료 형태 필터, 설명·메모 통합 검색, 검색어 강조, 페이지 이동
- 자료 모음 생성·이름 변경·삭제, 자료 담기·빼기·순서 변경
- 모음별 개인 준비 메모와 JSON 내보내기
- 재가져오기 중에는 기존 자료 유지, 완료 후 출처 단위로 교체
- 원본에서 사라진 모음 자료는 저장본으로 유지
- 초대 이메일 로그인 링크와 사용자별 서버 저장
- 이메일로 동료 초대, 운영자 Gmail을 통한 안내 메일 자동 발송·재발송·발송 상태 표시

사이트는 이메일로 초대한 교사만 이용합니다. 동료는 공용 자료를 읽고 개인 모음을 만들 수 있으며, 선택한 모음만 읽기 전용으로 공유합니다. 개인 준비 메모는 공유되지 않습니다. 비공개 Google 계정 연결, 정기 동기화, 원본 파일 자체 보관은 후속 범위입니다. 초대 운영과 추가 마이그레이션·테스트 방법은 [COLLABORATION.md](COLLABORATION.md)를 확인하세요.

## 사용 방법

1. `자료 가져오기`를 누릅니다.
2. 제공된 시트 주소를 확인하거나, 엑셀 파일을 선택합니다.
3. 탭별 자료 수를 확인하고 `선택한 자료 가져오기`를 누릅니다.
4. 검색창에 단원이나 활동명을 입력합니다. `/` 키로 검색창에 바로 이동할 수 있습니다.
5. 자료의 `+` 버튼으로 모음에 담습니다. 새 모음을 만들면 선택한 자료도 함께 담깁니다.
6. 모음에서 순서와 메모를 정합니다. 메모 수정 후 `메모 저장`을 누릅니다.

같은 출처를 다시 가져오면 선택한 탭으로 현재 자료 목록을 교체합니다. 모음과 메모는 유지합니다. 원본 행 번호가 바뀌어도 내용의 식별 정보가 같으면 같은 자료로 연결합니다. 내용이나 링크가 크게 달라져 식별되지 않으면 모음에는 기존 저장본이 남습니다.

## 가져오기 형식의 한계

XLSX 형식은 한 셀 안의 여러 개별 하이퍼링크를 모두 표현하지 못할 수 있습니다. 화면에 표시된 URL, 셀 하이퍼링크, 메모 속 URL은 추출하지만, 원본 Google Sheets와 완전히 동일한 링크 보존을 보장하지 않습니다. 원본 위치를 함께 제공합니다. CellData JSON에서는 `textFormatRuns`의 복수 링크도 보존합니다.

자료를 가져오는 것은 설명·메모·링크 정보를 보관하는 동작입니다. 연결된 영상과 첨부파일 자체를 복제하지 않습니다. 앱 로그인은 외부 자료의 열람 권한을 부여하지 않습니다.

## 구성

- React / TypeScript / Next.js 16 + Vercel
- 기존 Cloudflare Worker의 HMAC 게이트웨이 + D1 (SQLite)
- Drizzle의 SQL 스키마 마이그레이션
- fflate / fast-xml-parser를 지연 로딩하는 브라우저 XLSX 변환기
- Better Auth 이메일 로그인과 요청마다 초대 상태 확인

데이터는 D1에 저장하며 브라우저 localStorage에 자료·모음을 저장하지 않습니다. 원본 자료와 사용자 데이터는 소스 저장소·배포 번들에 포함하지 않습니다. API는 요청마다 로그인 사용자와 자료 소유자를 확인합니다.

## 개발 실행

Node.js 24 LTS를 사용합니다. 명령은 저장소 디렉터리에서 실행합니다.

```powershell
git clone https://github.com/gmlduqzhd123-lab/Class-Acave.git
cd Class-Acave
npm ci --prefer-offline --no-audit --no-fund
```

운영 데이터나 실제 메일 키 없이 다음 명령으로 격리된 로컬 SQLite에서 검증합니다. 테스트 서버는 자동으로 시작·종료하며 가상 메일을 로컬 파일로만 보냅니다.

```powershell
npx tsc --noEmit
node --test tests/importer.test.mjs tests/invitation-mail.test.mjs tests/data-gateway.test.mjs
npm run build
node scripts/test-api-ci.mjs
```

CI도 같은 검증을 실행합니다. 합성 사용자 헤더는 서버에 설정된 무작위 테스트 키가 일치하는 로컬 환경에서만 허용되며, Vercel에서는 비활성화됩니다.

실제 엑셀 파일을 함께 검증하려면 `ARCHIVE_FIXTURE` 환경변수에 해당 파일의 절대 경로를 지정합니다. 자료 파일은 저장소에 포함하지 않습니다.

## 파일 위치

- `app/components/archive-app.tsx`: 검색·자료 상세·가져오기·모음 UI
- `app/api/[...path]/route.ts`: 인증, 자료 가져오기, 검색, 모음 API
- `lib/importer.mjs`: XLSX와 CellData 변환
- `db/schema.ts`, `db/auth-schema.ts`, `migrations/`: 현재 저장 구조와 추가 마이그레이션
- `drizzle/`: 기존 Sites 데이터 저장소의 변경하지 않는 초기 이력
- `scripts/migrate-remote.mjs`: 운영 빌드 후 추가 테이블만 적용; 기존 자료 삭제·변경 SQL은 차단
- `tests/`: 변환·API 통합 검증
- `.openai/hosting.json`: 동일 Site의 배포 ID와 저장소 선언

## 검증 기록

2026-11-13 기준, 제공된 공개 시트에서 16개 탭과 1,574개 자료, 셀 메모가 있는 자료 29개, 추출된 링크 1,215개를 확인했습니다. 이 수치는 가져온 시점의 변환 결과이며 원본의 향후 업데이트에 따라 바뀝니다.

- 변환 테스트 9개 통과 (실제 파일 포함)
- 초기 MVP API 통합 검증 24개 통과 (현재 공유 버전은 COLLABORATION.md 참조): 인증, 사용자별 분리, 잘못된 주소·링크 거절, 중복 전송, 미완료 가져오기, 메모 유지, 삭제된 자료 저장본 유지 등
- 브라우저: 실제 시트 URL 가져오기, 검색, 새 모음과 동시 담기, 기존 모음 추가, 메모 저장, 순서 변경 확인

로컬 DB와 배포 DB는 별개입니다. 배포 후 가져온 자료는 배포 DB에 별도로 저장됩니다.
