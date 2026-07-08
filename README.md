# carol-issue

**carol**의 **"문의하기"** 기능을 담당하는 분리된 서비스입니다.

Discord에서 들어온 제보를 받아 **AI로 GitHub Issue 초안을 생성**하고, **GitHub App으로 실제 Issue를 발행**하는 triage 서버입니다. carol 봇과는 HTTP API(OpenAPI/Scalar 계약)로만 연결되며, 공유 secret으로 인증합니다.

## 프로젝트 배경

| 항목 | 내용 |
|------|------|
| 상위 프로젝트 | [team-carol/carol](https://github.com/team-carol/carol) — maimai DX NET 프로필 Discord 봇 |
| 이 레포 | [team-carol/carol-issue](https://github.com/team-carol/carol-issue) — 제보→GitHub Issue triage 서비스 |
| 분리 이유 | **VM 분리**. AI 호출·GitHub App 발행이라는 별도 책임과 배포 단위를 carol 본체에서 떼어내기 위해 레포/배포를 분리했다. |
| 연동 방식 | carol 봇이 Discord 제보를 이 서비스의 `/triage/*` API로 전달 → 인증(공유 secret) → AI draft → GitHub Issue 생성 |
| 경계 | 이 서비스는 **Discord를 직접 다루지 않는다.** carol 봇이 Discord 컨텍스트(guild/channel/message URL, 로그, 첨부)를 수집해 API 페이로드로 넘긴다. |

### carol와의 관계

```
[carol 봇]  Discord 제보 수집
    │  guild/channel/message URL, 대화 로그, 첨부 URL
    ▼
[carol-issue]  POST /triage/issues  (Authorization: 공유 secret)
    │  ① 요청 검증 → ② AI draft 생성 → ③ schema 검증
    │  ④ GitHub App installation token → ⑤ Issue 생성
    ▼
[GitHub]  team-carol/carol 저장소에 Issue 발행 → issueUrl 반환
```

carol 본체 아키텍처(북마클릿 기반 프로필 동기화, SQLite, satori PNG 렌더링 등)는 상위 레포 README/AGENTS.md를 참고. 이 서비스는 그와 독립적으로 배포되는 별도 VM/컨테이너다.

> 아래는 이 서비스가 구현해야 할 **기능 명세서**입니다.

---

## 1. Health Check

### GET `/health`

서비스가 정상 실행 중인지 확인한다.

#### 기능

* 서버 실행 상태 반환
* 배포 환경에서 헬스체크 용도로 사용

#### 응답 예시

```json
{
  "status": "ok"
}
```

---

## 2. API 인증

모든 triage API 요청은 인증을 거쳐야 한다.

### 기능

* `Authorization` 헤더 검사
* 공유 secret 검증
* 허용된 client ID 검증
* 허용된 guild ID 검증
* 잘못된 요청은 거부

### 예외

* `/health`
* `/openapi.json`
* `/docs`

---

## 3. Issue Draft 생성

### POST `/triage/draft`

Discord 제보 내용을 받아 AI로 GitHub Issue 초안을 생성한다.

### 입력 정보

* 제보 내용
* 제보자 Discord ID
* 제보자 이름
* Discord guild ID
* Discord channel ID
* Discord message URL
* 관련 대화 로그
* 첨부 파일 URL 목록

### 기능

* 요청 데이터 검증
* AI Provider 호출
* Issue 제목 생성
* Issue 본문 생성
* Issue 타입 분류
* 우선순위 추정
* 라벨 후보 생성
* AI 출력 JSON 검증
* 검증된 draft 반환

### 출력 정보

```json
{
  "draft": {
    "title": "프로필 동기화 실패",
    "body": "...",
    "labels": ["bug", "triage"],
    "type": "bug",
    "priority": "medium"
  }
}
```

---

## 4. GitHub Issue 생성

### POST `/triage/issues`

Discord 제보 내용을 받아 GitHub Issue를 생성한다.

### 기능

* 요청 데이터 검증
* 인증 검증
* AI Issue Draft 생성
* Draft schema 검증
* GitHub App installation token 발급
* GitHub Issue 생성
* 생성된 Issue URL 반환

### 출력 정보

```json
{
  "issueNumber": 12,
  "issueUrl": "https://github.com/team-carol/carol/issues/12"
}
```

---

## 5. Issue Draft 직접 생성

클라이언트가 이미 만든 draft를 받아 GitHub Issue를 생성할 수 있어야 한다.

### 기능

* 외부에서 전달된 draft 검증
* title/body/labels 검증
* GitHub Issue 생성
* Issue URL 반환

### 목적

* Discord에서 미리보기 후 생성
* 관리자가 수정한 draft로 Issue 생성
* AI 없이 수동 생성 가능

---

## 6. AI Provider 관리

AI 호출부는 provider 교체가 가능해야 한다.

### 기능

* OpenAI-compatible API 지원
* `AI_BASE_URL` 설정 지원
* `AI_MODEL` 설정 지원
* AI 응답 JSON 파싱
* 잘못된 AI 응답 처리
* provider 에러 처리

### 필수 조건

* AI 응답을 그대로 GitHub에 보내면 안 됨
* 반드시 schema validation을 통과해야 함

---

## 7. GitHub App 연동

GitHub Issue 생성은 GitHub App으로 처리한다.

### 기능

* GitHub App ID 로드
* Private key 로드
* Installation ID 로드
* Installation token 생성
* 지정 repository에 Issue 생성
* GitHub API 에러 처리

### 권한

```text
Metadata: read
Issues: read/write
```

### 저장소 설정

기본은 다음 값을 사용한다.

```text
GITHUB_REPOSITORY=owner/repo
```

하위 호환용으로 다음 값도 지원할 수 있다.

```text
GITHUB_OWNER=owner
GITHUB_REPO=repo
```

---

## 8. Issue 본문 템플릿

생성되는 Issue body는 일정한 형식을 가져야 한다.

### 포함 항목

* 요약
* 상세 설명
* 재현 방법
* 기대 동작
* 실제 동작
* 관련 Discord 정보
* 원문 제보
* 첨부 파일
* AI 생성 여부 표시

### 예시 구조

```md
## Summary

## Details

## Steps to Reproduce

## Expected Behavior

## Actual Behavior

## Discord Context

## Original Report
```

---

## 9. Label 처리

AI가 추천한 label을 GitHub Issue에 적용한다.

### 기능

* AI label 후보 생성
* 허용된 label만 사용
* 존재하지 않는 label은 제외하거나 기본 label로 대체
* 기본 label `triage` 적용

### 기본 label

```text
triage
```

---

## 10. 요청 검증

API 요청은 schema validation을 거쳐야 한다.

### 검증 항목

* content가 비어 있지 않은지 확인
* Discord user ID 형식 확인
* guild ID 허용 여부 확인
* channel ID 형식 확인
* message URL 형식 확인
* attachments 배열 형식 확인
* draft title/body 길이 확인

---

## 11. 에러 응답

모든 에러는 일정한 JSON 형식으로 반환한다.

### 응답 형식

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request body"
  }
}
```

### 주요 에러 코드

```text
UNAUTHORIZED
FORBIDDEN_CLIENT
FORBIDDEN_GUILD
VALIDATION_ERROR
AI_PROVIDER_ERROR
AI_INVALID_OUTPUT
GITHUB_AUTH_ERROR
GITHUB_CREATE_ISSUE_ERROR
INTERNAL_ERROR
```

---

## 12. API 문서

OpenAPI와 Scalar 문서를 제공한다.

### GET `/openapi.json`

OpenAPI JSON을 반환한다.

### GET `/docs`

Scalar 기반 API 문서 UI를 제공한다.

### 기능

* API 요청/응답 schema 확인
* 개발 중 테스트 가능
* carol 봇 연동 시 계약 문서 역할

---

## 13. 설정 관리

환경 변수 기반으로 서비스를 설정한다.

### 필수 설정

```text
PORT
BASE_URL
GITHUB_APP_ID
GITHUB_INSTALLATION_ID
GITHUB_REPOSITORY
AI_PROVIDER
AI_API_KEY
AI_MODEL
CAROL_SHARED_SECRET
```

### 선택 설정

```text
GITHUB_PRIVATE_KEY
GITHUB_PRIVATE_KEY_FILE
AI_BASE_URL
CAROL_ALLOWED_CLIENT_IDS
CAROL_ALLOWED_GUILD_IDS
CAROL_SIGNATURE_TTL_SECONDS
```

---

## 14. 로그

서비스 동작을 확인할 수 있는 로그를 남긴다.

### 기능

* 요청 시작/종료 로그
* draft 생성 성공 로그
* issue 생성 성공 로그
* 에러 로그

### 금지 사항

다음 정보는 로그에 남기지 않는다.

* Authorization header
* GitHub private key
* GitHub installation token
* AI API key
* CAROL_SHARED_SECRET

---

## 15. Docker 실행

Docker 기반 실행을 지원한다.

### 기능

* Dockerfile 제공
* docker-compose.yml 제공
* 환경 변수 주입
* `/health` 기반 healthcheck
* Cloudflare Tunnel 구성 지원

### 로컬 실행

```bash
docker compose up -d --build
```

### CI/CD 배포

이 레포는 `master` 브랜치에 push 되면 GitHub Actions가 다음 순서로 동작한다.

1. `npm ci`
2. `npm test`
3. `npm run build`
4. Docker image 빌드
5. `ghcr.io/<owner>/carol-issue:latest` 와 커밋 SHA 태그로 GHCR push
6. SSH로 원격 서버 접속
7. 원격 서버에서 `docker compose -f docker-compose.tunnel.yml pull && up -d`

원격 서버는 포트를 직접 열지 않고 Cloudflare Tunnel 로 붙는다.

원격 서버에는 이 레포를 한 번 체크아웃해 두고, `.env`를 채워 둔다.
`docker-compose.tunnel.yml`은 그 디렉터리에서 실행된다.

서버에 Docker가 없다면 레포 루트에서 아래 스크립트를 먼저 실행한다.

```bash
sudo bash ./setup.sh
```

```bash
docker compose -f docker-compose.tunnel.yml pull
docker compose -f docker-compose.tunnel.yml up -d
```

`docker-compose.yml`은 로컬 개발용 build와 원격 pull을 같이 지원하도록 `image`와 `build`를 함께 둔다.
`docker-compose.tunnel.yml`은 전용 `tunnel` 네트워크에서 `carol-issue` 와 `cloudflared` 를 묶고, 서버 포트를 publish하지 않는 배포용 compose 파일이다.

Cloudflare Tunnel 대시보드에서는 origin service 를 `http://carol-issue:3000` 으로 두면 된다.

### GitHub Secrets

workflow 배포 단계에는 다음 secrets가 필요하다.

* `DEPLOY_HOST`
* `DEPLOY_USER`
* `DEPLOY_KEY`
* `DEPLOY_PATH`
* `DEPLOY_PORT` - 선택, 기본값 `22`

---

## 16. MVP 필수 기능

초기 MVP에서 반드시 구현할 기능은 다음과 같다.

* `GET /health`
* `POST /triage/draft`
* `POST /triage/issues`
* API 인증
* AI draft 생성
* AI 출력 검증
* GitHub App으로 Issue 생성
* OpenAPI JSON 제공
* Scalar docs 제공
* Docker 실행

## 17. 추후 기능

MVP 이후 추가할 수 있는 기능은 다음과 같다.

* Discord에서 Issue 생성 전 미리보기
* 관리자 승인 후 Issue 생성
* 중복 Issue 검색
* 기존 Issue에 comment 추가
* GitHub label 자동 동기화
* GitHub Project 자동 등록
* Discord thread와 Issue 연결
* 첨부 이미지 분석
* 로그 파일 요약
* rate limit 적용
* audit log 저장
