# BL-0002~BL-0024 수행 계획 (phase 2026-11-12-requirements-build)

> 실행: Orca

> 문서 종류: 계획 · 작성: planner (Task `task_b8962aeca657`, Dispatch `ctx_92fdc78b1555`) · 2026-11-12
> 브리프: `_workspace/_run/2026-11-12-requirements-build/brief.md` · 메모: `spec/P03-plan.memo.md`(결정 8 회차, 연결 구조)
> 그림 입력: 같은 폴더의 `dag.json`(Task 스윔레인), `waterfall.json`(예상시간). 둘 다 `tmp/plan-schedule.mjs`, `tmp/dag-layout.mjs`가 이 계획의 표에서 만든다.
> 상태: 계획 승인 전. 커밋하지 않는다. Task마다 커밋 단계를 두지 않는다(워커는 커밋하지 않고, 커밋은 8단계에서 코디네이터가 한 번에 한다).

**Goal:** 백로그 23개(BL-0002~BL-0024)를 정적 Three.js 앱(`web/`) 위에서 끝내고, 필수 두 항목(BL-0016 스크린 유튜브, BL-0020 Full Mode)을 가장 먼저 끝낸다.

**Architecture:** 첫 구현 Task(T11)가 `web/main.js`를 동작 그대로 모듈로 나누고 모든 기능 모듈의 빈 자리와 설정 파일을 만든다. 그 뒤 각 Task는 자기 모듈·설정·시험 파일만 고친다. 그래픽 자산(캐릭터 4종, 클립, 경기장 v2, 효과음)은 Blender로 따로 만들고, 웹은 약속한 이름의 임시 자산으로 먼저 만든 뒤 연결 Task(T36~T38)에서 진짜 자산으로 바꾼다.

**Tech Stack:** Three.js r170(+ r170에 딸린 `CSS3DRenderer.js`, 필요하면 `SkeletonUtils.js`를 `web/vendor/`로 복사), 유튜브 IFrame Player API, PeerJS 1.5.5(PeerJS Cloud), Playwright(`@playwright/test`, 개발 의존성만), Blender(MCP 1대 + 배치 실행), Draco GLB.

**Spec:** `docs/superpowers/specs/2026-11-12-requirements-build-design.md`(승인 2026-11-12, 답 반영). 수락 기준의 정본은 `docs/backlog.md`의 각 항목이며 이 계획에 다시 쓰지 않는다.

## Global Constraints

모든 Task spec에 이 절이 따라간다.

- 정적 Three.js r170 앱(`web/`) 위에서 만든다. Next.js로 옮기지 않는다.
- 웹 런타임 라이브러리를 늘리지 않는다. Three.js r170에 딸린 파일(원본 그대로 `web/vendor/`로 복사)과 유튜브 공식 IFrame 플레이어만 더한다.
- Playwright는 개발 의존성으로만 둔다. `package.json`과 잠금 파일은 웹 결과물(`web/`)에 들어가지 않는다.
- 무료만 쓴다. Higgsfield와 Blender MCP `generate_3d`를 쓰지 않는다. TURN, Vercel, 유료 도구를 쓰지 않는다. 배포·외부 게시·push가 없다.
- 원본을 덮어쓰거나 옮기지 않는다: `barclays-worlds-2026.blend`, `web/arena.glb`, `web/lightmaps/*.png`, 기존 텍스처·음원. 경기장 수정은 복사본 `.blend`에서 하고 결과는 `-v2` 이름으로 낸다.
- 다시 내보낼 때 런타임이 이름으로 찾는 것을 지킨다(설계 5.5 이름 보존 목록).
- `window.arena`의 지금 속성, `createAvatar(color)`의 인자·반환·`userData.material`, 위치 메시지 `pose`, `validPose`를 바꾸지 않는다.
- 새 GLB는 Draco만 쓴다.
- 같은 때에 두 Task가 같은 파일을 고치지 않는다. 각 Task의 `편집 범위` 밖은 고치지 않는다. 하네스 문서(`docs/harness/team-org.md`의 Next.js 경로)와 이 계획이 다르면 이 계획과 설계서의 편집 범위가 이긴다.
- Blender MCP는 `_workspace/graphicmodel/blender-lock.json`으로 한 Task만 쓴다. 라이트맵 굽기, 브라우저 시험, 성능 실측은 `_workspace/gpu-lock.json`을 잡고 한 번에 하나다.
- 시험을 먼저 쓰고 실패를 확인한 뒤 구현한다. 완료 검사 명령은 `AGENTS.md`의 `## 명령` 절에 있는 것만 쓴다(T10이 올린다).
- 워커는 커밋하지 않는다. 사용자에게 직접 묻지 않고 `orca orchestration ask`로 올린다.

## Review Focus

시험이 놓치기 쉬운데 사용자가 가장 먼저 부딪힐 다섯 가지다. 각 줄의 시험은 그 코드를 가진 Task의 완료 검사에 들어 있다.

1. 유튜브가 막힐 때(임베드 거부, 생방송이 꺼짐, 자동 재생 차단, 네트워크 없음) 스크린이 검게 뚫리지 않고 기존 그림과 안내가 보인다 → T13 시험.
2. 초대 링크로 늦게 들어온 사람은 자기 기본 회차가 아니라 방장이 알려 준 그 방의 회차 위치로 재방을 본다 → T27 시험(`room:joined.roundStart`)과 T13 시험(받은 `roundStart`로 다시 맞춤).
3. 티켓 없이 들어가는 다른 길(화면의 이동 버튼, 개구부 옆 커튼월, 점프)이 모두 막힌다. 회귀 시험의 `window.arena.go`는 막히지 않는다 → T21 시험.
4. Alt 메뉴·티켓 창·Full Mode가 열리고 닫힐 때 포인터 잠금과 키가 엉키지 않는다(Alt가 브라우저 메뉴를 열지 않고, 닫은 뒤 이동 키가 다시 듣는다) → T20, T21, T14 시험.
5. 17번째 사람은 20초 시간 초과가 아니라 곧바로 "방이 가득 찼습니다(16명)"를 본다. 방장이 나가면 남은 사람에게 안내가 뜬다 → T27 시험.

## 실행 방식: 팀장과 직접 기동

`AGENTS.md`의 규모별 경로와 `docs/harness/team-org.md`로 정했다. 규칙은 "한 팀의 Task가 3개 이상이면 팀장"이다. 다만 팀 사이 의존은 팀 Task(등록 단위)끼리만 걸리므로, 한 팀의 일을 다른 팀이 중간 산출물을 기다리는 자리에서 끊어 여러 등록 단위로 나눴다. 끊은 단위 안의 Task가 3개 이상이면 팀장, 1~2개면 코디네이터가 직접 띄운다.

| 등록 단위 | 팀 | 담는 Task | 띄우는 쪽 | 팀장 배정 | 끊은 이유 |
| --- | --- | --- | --- | --- | --- |
| LGA 법무 앞 검토 묶음 | legal-review | T07, T08, T09 | 팀장 | `legal-leader` / 리드 (claude opus/high) | 끝 검토 T47·T48은 연결 Task 뒤라 따로 |
| WF 웹 기능 묶음 | web-metaverse-develop | T16~T27 (12개) | 팀장 | `metaverse-develop-leader` / 리드 (claude opus/high) | 필수 T13·T14는 필수 리뷰 T15가 곧바로 봐야 해서 밖, 연결 T36~T38은 그래픽 산출물을 기다려서 밖 |
| GX 그래픽 제작 묶음 | graphicmodel | T28~T34 (7개) | 팀장 | `graphic-leader` / 리드 (claude opus/high) | 클립 T35는 웹 T36이 T30의 `fan.glb`를 먼저 받아야 해서 밖. T05·T06은 묶음의 선행이라 밖 |
| QA 끝 QA 묶음 | qa | T42~T45 | 팀장 | `qa-inspector` / 리드 (claude opus/high) | 중간 리뷰 T39~T41은 각자 다른 때에 돌아서 밖 |
| 그 밖의 Task 30개 | 모두 | T01~T06, T10~T15, T35~T41, T46~T53, T55~T57 | 코디네이터 직접 | — | 단위 안의 Task가 1~2개 |
| T54, T58, C01 | 코디네이터 | 최종 테스트, 커밋, 기동 | 코디네이터가 직접 함 | — | — |

- 팀장 spec의 첫 줄은 `[역할: <에이전트> · 리드]`이고 배정 줄은 `배정: <에이전트> / 리드 (claude opus/high)`다. 팀원 배정은 아래 `## DAG`의 줄을 그대로 옮긴다.
- 팀장도 터미널 하나이므로 슬롯 하나를 쓴다(슬롯 8 = 팀장 포함 워커 터미널 수, 코디네이터 제외). 한 팀의 동시 팀원은 4명 이하이고, 코디네이터가 직접 띄운 같은 팀 Task도 이 4명에 든다.
- **WF 팀장에게 줄 것:** T13 또는 T14가 돌거나 곧 뜰 때(앞 Task가 끝났을 때)는 팀원을 3명까지만 띄운다. 웹 자리 하나는 필수 줄의 몫이다. 띄우는 순서는 남은 길이가 긴 것부터: T27, T23, T24, T21, T18, T26, T17, T19, T22, T16, T25, T20.
- **GX 팀장에게 줄 것:** Blender MCP 줄(T28 → T29 → T30)과 배치 줄(T31 → T32)과 효과 줄(T33 → T34)을 함께 돌린다. T28이 먼저 뜬다.
- **QA 팀장에게 줄 것:** 네 영역을 한 번에 띄우고 결함 ID 접두어 `A-`, `B-`, `C-`, `X-`를 배정한다. 대조할 경계면은 아래 각 Task의 `의존` 줄이다.
- 팀장을 두지 않고 코디네이터가 GX와 QA 묶음을 직접 띄우면 임계 경로가 28분 짧아진다. 규칙의 예외이므로 끝의 `## 사용자 결정 필요` 1번으로 올렸다.

## 공용 약속

Task 사이에서 이름과 모양이 맞아야 하는 것만 적는다. 정본은 T03(아키텍처)과 T04(자산 연동 규약)이고, 아래는 그 출발값이다(설계 5.1, 5.6).

- **모듈:** `export function create(ctx)` → `{update?(dt, now), dispose?()}`. `ctx = {THREE, scene, camera, renderer, root, cssLayer, uiRoot, events, config(name), player, cameraRig, input}`. 모듈 목록은 `web/modules.js` 하나(T11만 고친다).
- **플레이어 API(T11이 만든다):** `player.addBlocker(mesh)`, `player.removeBlocker(mesh)`, `player.setLocked(bool)`, `player.teleport(name)`, `player.setTeleportGuard(fn)`; `cameraRig.setOverride(fn | null)`; `input.releasePointer()`, `input.capturePointer()`.
- **이벤트:** `team:changed {teamId}`, `character:changed {characterId}`, `emote:request {id}`, `emote:played {id}`, `emoteMenu:open`, `ticket:issued {teamId}`, `seat:enter {seatId}`, `seat:exit`, `fullmode:enter`, `fullmode:exit`, `screen:state {source, playing, time, muted}`, `room:joined {code, host, roundStart}`, `room:left`, `peer:state {peerId, team, character, nickname, emote, emoteSeq, seated}`. `emoteMenu:open`은 티켓 창의 "응원하기"가 같은 메뉴를 여는 길이다(결정 14).
- **화면 API(T13이 만든다):** `window.arena.screen = {state, source, face, roundStart, fullMode}`, `screen.enterFullMode()`, `screen.exitFullMode()`, 순수 함수 `roundPosition(nowMs, roundStartMs, durationSec) → {seconds, ended}`.
- **캐릭터 자산(T30·T35가 만든다):** `web/assets/characters/fan.glb` = 뼈대 하나 + 메시 `fan_f1`, `fan_f2`, `fan_m1`, `fan_m2`, 저지 부분 재질 `Uniform`. `web/assets/characters/fan-anim.glb` = 같은 뼈대 + 클립 `Idle`, `Walk`, `Run`, `Jump`, `Sit`, `Emote_CheerClap`, `Emote_Heart`, `Emote_Angry`, `Emote_EggThrow` + 소품 `Prop_Egg`. 감정표현 ID는 `cheer_clap`, `heart`, `angry`, `egg_throw`.
- **효과(T33·T34가 만든다):** `art/vfx/arena-show/spec.md`, `cues.json`(이벤트 `sky_beam`, `firework`, `pro_shout`, `egg_release`, `egg_scream`), `web/assets/audio/sfx/egg-scream_01`, `pro-shout_01`~`03`(확장자는 T04가 정한다). `egg_release`·`egg_scream`의 프레임은 T35 리포트의 `## 클립` 표에서 T37이 가져온다.
- **경기장 v2(T31·T32가 만든다):** `art/environment/arena/barclays-arena-v2.blend`(원본의 복사본), `web/arena-v2.glb`, `web/lightmaps/<아틀라스>-v2.png`. 앱이 읽는 경로만 T38이 바꾼다.
- **시험 명령(T02가 만들고 T10이 `AGENTS.md`에 올린다):** `npm test`(모든 `tests/*.spec.mjs`, 빈 포트에서 `web/`를 띄움), `npm test -- tests/<이름>.spec.mjs`(한 파일), `node tests/gpu-lock.mjs acquire <Task ID>` / `release <Task ID>`.

## DAG

- 시간은 분이다. likely 일정은 T+0 = 계획 승인, 기동 3분(하네스 출발값)과 슬롯·자원 대기를 넣은 값이며 `waterfall.json`과 같다.
- 의존은 산출물 의존만 적었다. 묶음(LGA, WF, GX, QA)의 팀원은 묶음의 의존을 함께 받는다.
- 구현 Task의 단계는 같다: ① 완료 검사의 시험을 먼저 쓰고 실패를 확인 ② 구현 ③ 완료 검사 통과 ④ `npm test` 전체 통과(회귀 2개 포함) ⑤ 리포트(`## 검증`에 검사 줄을 ✅·❌로). 리포트는 `_workspace/<팀>/2026-11-12-requirements-build/`에 팀 스킬의 이름 규칙으로 쓴다.
- 실패한 Task는 원인을 새 spec에 적어 1회 다시 띄운다. 중간 리뷰(T15, T39~T41)에서 High가 나오면 코디네이터가 그 파일의 원래 담당으로 수정 Task를 띄우고, 그 수정이 정산된 뒤 뒤 Task를 띄운다(일정에는 넣지 않았다).

### G1: 계획 승인 (사용자)
- 의존: 없음
- 산출물: 브리프 `## 사용자 결정`의 승인 원문
- 완료 검사: 창구가 승인 원문을 브리프에 적음 → 날짜와 원문 1줄
- 편집 범위: 없음(창구)
- 예상 시간(분): 미정(0분으로 확정하지 않는다)
- 분할선: 없음
- 배정: 없음(사람 승인)

### C01: 코디네이터 기동
- 의존: G1 — 승인된 이 계획서와 브리프의 슬롯 수 8을 읽는다.
- 산출물: `_workspace/_run/2026-11-12-requirements-build/orca-tasks.json`
- 완료 검사: `node .claude/scripts/orca-launch.mjs ready --map _workspace/_run/2026-11-12-requirements-build/orca-tasks.json` → T01~T06과 LGA가 준비 상태
- 편집 범위: `_workspace/_run/2026-11-12-requirements-build/`
- 예상 시간(분): low 10 / likely 15 / high 25 (likely T+0~15)
- 분할선: 없음
- 배정: coordinator / 실행 감독 (claude opus/high) — 창구가 띄운다

### T01: 백로그 연결 (4단계)
- 항목: BL-0002~BL-0024 전부
- 의존: C01 — 등록된 Task ID(`orca-tasks.json`)를 백로그 행에 적는다.
- 산출물: `_workspace/product/2026-11-12-requirements-build/01_product-manager_backlog-link_v1.md`(`Task | 백로그 ID | 새 항목 여부` 표)
- 완료 검사: `node .claude/scripts/report-check.mjs _workspace/product/2026-11-12-requirements-build/01_product-manager_backlog-link_v1.md` → `"ok":true`
- 편집 범위: `docs/backlog.md`. 사용자 답으로 바뀐 수락 기준과 비고를 함께 고친다: BL-0002(4종·공용 뼈대·팀 창에서 고름), BL-0003(유니폼 = 옷 자체 그림), BL-0006(빛줄기 3개), BL-0007(첫 입구 x≈−95.6), BL-0010·BL-0022(PeerJS Cloud·방 id 목록·Vercel 후보), BL-0013(웹 런타임), BL-0015(2층 + 반대편), BL-0016(주소 2개·10분 회차), BL-0020(내 화면의 플레이어). 이 Task가 끝날 때까지 코디네이터는 백로그 상태 열을 고치지 않는다(같은 파일).
- 예상 시간(분): low 15 / likely 25 / high 40 (likely T+18~43)
- 분할선: 수락 기준 고치기와 Task 연결 표
- 배정: product-manager / 항목화 (claude opus/medium)

### T02: 검증 토대 (설계 f1)
- 항목: 전부(시험 명령)
- 의존: C01 — 코디네이터가 띄운다.
- 산출물: `package.json`
- 완료 검사: `npm test` → 스모크 1개(로드, `window.arena.ready`, 페이지 오류 0)와 기존 회귀 2개(`web/verify-tps.mjs`, `web/verify-jump.mjs`) 통과, 실패 0. `node tests/gpu-lock.mjs acquire T02 && node tests/gpu-lock.mjs release T02` → 코드 0
- 편집 범위: `package.json`, 잠금 파일, `.gitignore`(`node_modules/`), `playwright.config.mjs`, `tests/`(새로), `web/verify-tps.mjs`·`web/verify-jump.mjs`(고정 주소 `127.0.0.1:8766`을 인자로 받게 하는 줄만, 파일은 옮기지 않는다)
- 약속: 내놓음 — 위 `## 공용 약속`의 시험 명령. 서버는 빈 포트를 고르고 `web/`를 루트로 띄운다. 브라우저 시험은 시작 전에 GPU 점유 표시를 잡고 끝나면 놓는다(기다림 상한 넘으면 ❌).
- 예상 시간(분): low 25 / likely 35 / high 60 (likely T+18~53)
- 분할선: 시험 실행기(Playwright 설정·서버)와 GPU 점유 도우미
- 배정: metaverse-web-developer / UI·기능 구현 (claude opus/medium)

### T03: 아키텍처 문서 (설계 a1 앞쪽)
- 항목: 전부
- 의존: C01 — 설계서 5.1·5.2·5.6을 문서로 고정한다.
- 산출물: `docs/live/web-metaverse-develop/architecture.md`
- 완료 검사: `grep -c -E "^## (모듈|약속|파일 소유|설정 파일|점유 표시)" docs/live/web-metaverse-develop/architecture.md` → `5`
- 편집 범위: `docs/live/web-metaverse-develop/architecture.md`
- 예상 시간(분): low 20 / likely 30 / high 45 (likely T+18~48)
- 분할선: 모듈·약속 절과 파일 소유·설정 절
- 배정: metaverse-develop-leader / 아키텍처 (claude fable/high)

### T04: 자산 연동 규약 (설계 a1 뒤쪽)
- 항목: BL-0002, BL-0003, BL-0008, BL-0011, BL-0014, BL-0004
- 의존: C01 — 설계서 5.5·5.6과 `## 공용 약속`의 자산 이름을 규약으로 고정한다.
- 산출물: `docs/live/web-metaverse-develop/asset-contract.md`
- 완료 검사: `grep -c -E "^## (이름 보존|캐릭터|클립|효과음|경기장 버전)" docs/live/web-metaverse-develop/asset-contract.md` → `5`
- 편집 범위: `docs/live/web-metaverse-develop/asset-contract.md`
- 담을 값: 캐릭터 4종의 예산(삼각형·뼈·재질·텍스처·파일 크기, 없으면 `web3d-performance` 출발값이라고 표시), 공용 뼈대의 뼈 이름, 달 방향, 밤을 어둡게 할 하늘 세기(결정 19), 효과음 형식, `-v2` 이름.
- 예상 시간(분): low 20 / likely 30 / high 50 (likely T+18~48)
- 분할선: 캐릭터·효과 절과 경기장 절
- 배정: metaverse-develop-leader / 아키텍처 (claude fable/high)

### T05: 아트 디렉션
- 항목: BL-0002, BL-0004, BL-0005, BL-0006, BL-0018
- 의존: C01 — 브리프의 결정 11·13·19·21·23을 기준 문서로 옮긴다.
- 산출물: `docs/live/graphicmodel/art-direction.md`
- 완료 검사: `grep -c -E "^## (팬 캐릭터|밤|바다|하늘 쇼|마네킹)" docs/live/graphicmodel/art-direction.md` → `5`
- 편집 범위: `docs/live/graphicmodel/art-direction.md`
- 담을 것: 팬 캐릭터 4종(여 2·남 2, 머리 모양·인종 변화, 가벼운 야외 차림, 기존 관중·선수와 같은 양식), 유니폼은 옷 자체의 그림, 지금보다 어두운 밤과 달빛 범위, 바다·하늘 쇼(빛줄기 3개) 색, 2층 마네킹 모양.
- 예상 시간(분): low 25 / likely 35 / high 50 (likely T+18~53)
- 분할선: 캐릭터 절과 월드 절
- 배정: graphic-leader / 아트 디렉션 (codex gpt-6-astra/medium)

### T06: Blender 연결 확인·경기장 결함 조사 (설계 g0)
- 항목: BL-0011, BL-0014, BL-0007(F-16)
- 의존: C01 — 코디네이터가 띄운다.
- 산출물: `_workspace/graphicmodel/2026-11-12-requirements-build/02_graphic-model-designer_model-arena-survey_v1.md`(`## 수정 목록` 표: 오브젝트 이름·좌표·문제·고치는 법)
- 완료 검사: `node .claude/scripts/report-check.mjs <산출물> --expect <산출물>` → `"ok":true`
- 편집 범위: 리포트만. Blender는 읽기만 하고 원본 `.blend`를 저장하지 않는다.
- 볼 것: Codex 워커가 Blender MCP에 붙는가(R-1, 실패하면 곧바로 `ask` — 결정 6의 예외로 다시 띄운다), 뜬 의자·사물, 관중석 아래 지지 기둥 자리, 계단 아래 빈 곳, 서로 파고든 오브젝트, `EXR_Entrance glazing`에 문이 있는가(R-13).
- 예상 시간(분): low 20 / likely 30 / high 50 (likely T+18~48)
- 자원: Blender MCP
- 분할선: 연결 확인과 결함 조사
- 배정: graphic-model-designer / 3D 모델링 (codex gpt-6-astra/max). Codex가 Blender MCP에 붙지 못하면 `claude fable/max`(사용자 예외: "6번 fable/max로 붙일것", "Codex 실패 시에만")

### LGA: 법무 앞 검토 묶음 (팀장)
- 의존: C01 — 묶음 전체의 선행.
- 산출물: `_workspace/legal-review/2026-11-12-requirements-build/00_legal-leader_lead-front_v1.md`(통합 보고)
- 완료 검사: `node .claude/scripts/report-check.mjs <산출물>` → `"ok":true`, 팀원 T07~T09가 모두 정산됨
- 편집 범위: 팀원 spec(`_workspace/legal-review/2026-11-12-requirements-build/spec/`)과 통합 보고
- 예상 시간(분): 팀장 기동 low 5 / likely 5 / high 10, 통합 보고 low 5 / likely 5 / high 10 (묶음 likely T+18~134)
- 분할선: 팀원 Task 단위(T07, T08, T09)
- 배정: legal-leader / 리드 (claude opus/high)

### T07: 법무 기준 (LGA)
- 항목: BL-0003, BL-0012, BL-0016
- 의존: LGA 팀장 기동 — 팀원 spec.
- 산출물: `docs/live/legal-review/legal-baseline.md`
- 완료 검사: `grep -c -E "^## (서비스의 사실|적용 규범|판정 기준|미결)" docs/live/legal-review/legal-baseline.md` → `4`
- 편집 범위: `docs/live/legal-review/legal-baseline.md`
- 담을 사실: 개인 사용·로컬만·배포 없음, PeerJS Cloud로 오가는 정보(위치·팀·캐릭터·닉네임·감정표현), 유튜브 임베드 2개, GEN.G·BLG·Barclays Center·WORLDS 표지, CC0 자산, 리그 오브 레전드와 비슷한 화면.
- 예상 시간(분): low 25 / likely 35 / high 50 (likely T+26~61)
- 분할선: 사실 표와 판정 기준
- 배정: legal-leader / 법무 기준 (claude fable/high)

### T08: Riot 정책 앞 검토 (LGA)
- 항목: BL-0003, BL-0012, BL-0016
- 의존: T07 — `legal-baseline.md`의 사실 표.
- 산출물: `_workspace/legal-review/2026-11-12-requirements-build/02_riot-policy-reviewer_review-front_v1.md`
- 완료 검사: `node .claude/scripts/report-check.mjs <산출물>` → `"ok":true`
- 편집 범위: 리포트만
- 예상 시간(분): low 25 / likely 35 / high 55 (likely T+76~111)
- 분할선: 팀 표지·게임 화면과 유튜브
- 배정: riot-policy-reviewer / Riot 정책 검토 (claude fable/high)

### T09: 법률 앞 검토 (LGA)
- 항목: BL-0016, BL-0003, BL-0012
- 의존: T07 — `legal-baseline.md`의 사실 표.
- 산출물: `_workspace/legal-review/2026-11-12-requirements-build/03_legal-reviewer_review-front_v1.md`
- 완료 검사: `node .claude/scripts/report-check.mjs <산출물>` → `"ok":true`
- 편집 범위: 리포트만
- 예상 시간(분): low 25 / likely 35 / high 55 (likely T+94~129)
- 분할선: 유튜브 임베드 조건과 표지·CC0·PeerJS 정보
- 배정: legal-reviewer / 법률 검토 (claude fable/high)
- BL-0016 표시 방식(가림·최소 크기·브랜딩)에 High가 나오면 코디네이터가 T13 담당으로 필수 수정 Task를 띄운다.

### T10: 하네스 1차 (설계 h1)
- 항목: 없음(실행 토대)
- 의존: T02 — T02 리포트에 적힌, 실제로 돌린 명령.
- 산출물: `AGENTS.md`의 `## 명령` 절
- 완료 검사: `grep -c -E "npm test" AGENTS.md` → 1 이상, `grep -c "Next.js + Three.js" AGENTS.md` → `0`
- 편집 범위: `AGENTS.md`(명령 절, 기술 스택 줄 → "정적 Three.js r170 웹 앱(`web/`). Next.js 전환은 사용자 결정 전까지 하지 않는다"), `docs/harness/team-org.md:12-13`(편집 범위에 `web/`, `web/assets/`, `art/`, 경기장 스크립트, `package.json`·잠금 파일, `tests/`)
- 예상 시간(분): low 10 / likely 20 / high 30 (likely T+56~76)
- 분할선: 없음
- 배정: harness-engineer / 구조 변경 (claude fable/high)

### T11: main.js 분할 (설계 f2)
- 항목: 전부
- 의존: T02 — 동작이 바뀌지 않았음을 `npm test`로 본다. T03 — `architecture.md`의 모듈 표와 약속.
- 산출물: `tests/modules.spec.mjs`
- 완료 검사: `npm test` → 실패 0(스모크·회귀 2개 그대로). `npm test -- tests/modules.spec.mjs` → 모듈 목록이 `architecture.md`와 같고 `window.arena`의 기존 키가 그대로임
- 편집 범위: `web/main.js`, `web/index.html`(모듈 스크립트 한 줄), `web/events.js`, `web/modules.js`, `web/input.js`, `web/camera-rig.js`, `web/player-controller.js`, `web/character.js`, 빈 자리 `web/screen-video.js`·`web/seat-mode.js`·`web/environment.js`·`web/sky-show.js`·`web/stage-monitors.js`·`web/stage-players.js`·`web/nameplate.js`·`web/ui/*.js`, 설정 파일 `web/config/*.json`(설계 10절의 기본값으로), `tests/modules.spec.mjs`
- 약속: 내놓음 — `## 공용 약속`의 모듈·플레이어 API·이벤트. 렌더러 `alpha:true`. 기존 `crowd-motion.js`, `multiplayer.js`, `avatar.js`, `lighting.js`, `baked-lighting.js`는 등록만 하고 고치지 않는다. 이동 버튼과 `go()`를 `player.teleport`로 옮기되 `window.arena.go`는 남긴다. `controls.json`에 감정표현 메뉴 Alt, 앉기 E, Full Mode F를 미리 넣는다.
- 예상 시간(분): low 30 / likely 45 / high 75 (likely T+56~101)
- 분할선: 입력·카메라·이동 모듈 나누기와 빈 자리·설정 파일 만들기
- 배정: metaverse-3d-developer / 3D 런타임 구현 (codex gpt-6-astra/max)

### T12: 방 서버 구조 설계 문서 (BL-0022, 설계 r1)
- 항목: BL-0022
- 의존: T03 — `architecture.md`의 멀티 모듈 경계.
- 산출물: `docs/superpowers/specs/2026-11-12-room-service-design.md`
- 완료 검사: `grep -c -E "^## (흐름|서버 역할|signaling|TURN)" docs/superpowers/specs/2026-11-12-room-service-design.md` → `4`(BL-0022의 네 요소)
- 편집 범위: 그 문서 하나
- 담을 것: 연결 중개 = PeerJS Cloud(지금 방식), 방은 접속자가 만들고 만든 사람이 방장, 서버 역할 = 운영자가 관리하는 방 id 목록(정원·빈자리·종료 상태)과 회차별 배치, 재방 10분 회차와 회차별 공개 방 찾기·랜덤 입장의 흐름, Vercel(필요하면 유료)은 방 id 목록과 정적 호스팅의 후보, Cloudflare 임시 터널은 전제가 아님, TURN은 후보. 공급자·요금제·DB는 정하지 않고 결정 항목으로 남긴다.
- 예상 시간(분): low 30 / likely 45 / high 70 (likely T+51~96)
- 분할선: 흐름·서버 역할과 signaling·TURN
- 배정: metaverse-develop-leader / 아키텍처 (claude fable/high)

### T13: 스크린 유튜브 (필수, BL-0016)
- 항목: BL-0016 (결정 7·8·9)
- 의존: T11 — `web/screen-video.js` 빈 자리, `ctx.cssLayer`, 렌더러 `alpha:true`. T10 — 완료 검사에 쓰는 `AGENTS.md`의 `npm test`.
- 산출물: `tests/screen-video.spec.mjs`
- 완료 검사: `npm test -- tests/screen-video.spec.mjs` → 실패 0. 시험이 확인할 것: 재방 `rQTHR3aL0SE`·생방송 `EacB7ADMGpY`의 플레이어 상태, 카메라를 향한 스크린 면의 화면 투영 사각형과 플레이어 사각형의 겹침, `roundPosition`(회차 시작 13:10, 지금 13:14:30 → 270초, 영상 길이를 넘으면 `ended`), `room:joined {roundStart}`를 받으면 그 위치로 다시 맞춤, 임베드 거부·방송 없음 때 기존 그림과 안내(Review Focus 1). 유튜브·네트워크 때문에 못 본 것은 원인과 함께 리포트에 ❌로.
- 편집 범위: `web/screen-video.js`, `web/vendor/CSS3DRenderer.js`(three@0.170.0 원본 복사), `web/config/screen.json`, `tests/screen-video.spec.mjs`
- 방식: 설계 5.4. 재방 위치 = 지금 − 방의 회차 시작 시각을 주소의 `start`로 강제하고, 5초마다 계산값과 2초 넘게 어긋나면 다시 맞춘다. 방에 들기 전은 방금 시작한 회차. 생방송은 맞추지 않는다. 각자 자기 플레이어로 본다.
- 약속: 내놓음 — `window.arena.screen`, `screen.enterFullMode()`·`exitFullMode()`, `screen:state`. 받음 — `room:joined.roundStart`.
- 예상 시간(분): low 50 / likely 75 / high 120 (likely T+104~179)
- 분할선: 회차 계산(`roundPosition`, 순수 함수)과 CSS3D 배치·플레이어
- 배정: metaverse-3d-developer / 3D 런타임 구현 (codex gpt-6-astra/max)

### T14: Full Mode (필수, BL-0020)
- 항목: BL-0020 (결정 10)
- 의존: T13 — `screen.enterFullMode()`·`exitFullMode()`와 플레이어 DOM.
- 산출물: `tests/full-mode.spec.mjs`
- 완료 검사: `npm test -- tests/full-mode.spec.mjs` → 실패 0. 시험이 확인할 것: 오른쪽 위 버튼과 F로 들어가면 유튜브 플레이어가 내 화면 전체에 보이고 재생 위치가 이어짐, Esc·F·닫기 버튼과 `fullscreenchange`로 나오면 3D 화면과 원래 조작(포인터 잠금, 이동 키)으로 돌아옴(Review Focus 4), 전체화면을 못 쓰는 환경에서는 창 전체를 덮는 방식.
- 편집 범위: `web/ui/full-mode.js`, `tests/full-mode.spec.mjs`
- 예상 시간(분): low 20 / likely 30 / high 50 (likely T+182~212)
- 분할선: 없음
- 배정: metaverse-web-developer / UI·기능 구현 (claude opus/medium)

### T15: 필수 리뷰 (중간 리뷰 1, 설계 cr1)
- 항목: BL-0016, BL-0020
- 의존: T14 — T13·T14의 변경(diff)과 리포트.
- 산출물: `_workspace/qa/2026-11-12-requirements-build/01_code-reviewer_review-must_v1.md`
- 완료 검사: `node .claude/scripts/report-check.mjs <산출물>` → `"ok":true`
- 편집 범위: 리포트만
- High가 나오면 코디네이터가 곧바로 T13·T14 담당으로 필수 수정 Task와 재검을 띄운다(필수가 끝 수정 루프를 기다리지 않게).
- 예상 시간(분): low 15 / likely 25 / high 40 (likely T+215~240)
- 분할선: 없음
- 배정: code-reviewer / 일반 변경 리뷰 (claude opus/medium)

### WF: 웹 기능 묶음 (팀장)
- 의존: T11 — 모듈 빈 자리·설정 파일·플레이어 API. T10 — `AGENTS.md`의 `npm test`.
- 산출물: `_workspace/web-metaverse-develop/2026-11-12-requirements-build/00_metaverse-develop-leader_lead-features_v1.md`(통합 보고)
- 완료 검사: `node .claude/scripts/report-check.mjs <산출물>` → `"ok":true`, 팀원 T16~T27이 모두 정산됨
- 편집 범위: 팀원 spec(`_workspace/web-metaverse-develop/2026-11-12-requirements-build/spec/`)과 통합 보고
- 배정: metaverse-develop-leader / 리드 (claude opus/high)
- 팀원 공통: 완료 검사는 `npm test -- tests/<그 Task의 시험>.spec.mjs` → 실패 0, 그리고 `npm test` → 실패 0. 진짜 자산(캐릭터·클립·효과음·v2 GLB)이 아직 없으므로 자산 규약에 맞춘 임시 자산·임시 동작으로 만들고, 임시 자산은 제품에 남기지 않는다.
- 예상 시간(분): 팀장 기동 low 5 / likely 5 / high 10, 통합 보고 low 5 / likely 5 / high 10 (묶음 likely T+111~324)
- 분할선: 팀원 Task 단위(T16~T27)

### T16: 드래그 커서·우클릭 메뉴·휠 줌 (WF)
- 항목: BL-0023, BL-0024 (결정 29)
- 의존: WF — `web/input.js`, `web/camera-rig.js`(T11).
- 산출물: `tests/controls.spec.mjs`
- 완료 검사: `npm test -- tests/controls.spec.mjs` → 실패 0, 그리고 `npm test` → 실패 0
- 시험이 확인할 것: 좌·우클릭 드래그 중 커서 숨김과 떼면 보임, 3D 화면 우클릭에 기본 메뉴 없음, 휠 앞으로 1인칭에서 멈춤·뒤로 7.5 m에서 멈춤(기본 5 m, 한 칸 0.5 m).
- 편집 범위: `web/input.js`, `web/camera-rig.js`, `web/config/camera.json`, `tests/controls.spec.mjs`
- 예상 시간(분): low 25 / likely 40 / high 60 (likely T+262~302)
- 분할선: 입력(BL-0023)과 카메라(BL-0024)
- 배정: metaverse-3d-developer / 3D 런타임 구현 (codex gpt-6-astra/max)

### T17: 2층 진입 막기·캐릭터 관통 막기 (WF)
- 항목: BL-0017, BL-0014(캐릭터 쪽)
- 의존: WF — `web/player-controller.js`(T11)의 걷는 면 필터와 충돌.
- 산출물: `tests/collision.spec.mjs`
- 완료 검사: `npm test -- tests/collision.spec.mjs` → 실패 0, 그리고 `npm test` → 실패 0
- 시험이 확인할 것: 계단·점프로 2층(`Walk_Tier1`)에 못 올라감, 벽·의자·사물로 계속 밀어도 들어가지 않음, `validPose`와 회귀 2개 그대로.
- 편집 범위: `web/player-controller.js`, `tests/collision.spec.mjs`
- 예상 시간(분): low 30 / likely 45 / high 75 (likely T+217~262)
- 분할선: 2층 막기와 관통 막기
- 배정: metaverse-3d-developer / 3D 런타임 구현 (codex gpt-6-astra/max)

### T18: 좌석 관람 (WF)
- 항목: BL-0019 (결정 18)
- 의존: WF — `cameraRig.setOverride`, `player.setLocked`(T11).
- 산출물: `tests/seat.spec.mjs`
- 완료 검사: `npm test -- tests/seat.spec.mjs` → 실패 0, 그리고 `npm test` → 실패 0
- 시험이 확인할 것: 빈 좌석 근처에서 E·"앉기"로 앉음(앉기 자세는 임시, 진짜 `Sit` 클립은 T37), 앉은 카메라에서 스크린 투영 넓이가 서 있을 때보다 큼(시야각 68° → 45°), E·이동 키로 일어나 원래 조작으로 돌아옴. 빈 좌석이 없으면 R-12대로 코디네이터에 올린다.
- 편집 범위: `web/seat-mode.js`, `web/config/seats.json`, `tests/seat.spec.mjs`
- 예상 시간(분): low 35 / likely 50 / high 80 (likely T+194~244)
- 분할선: 좌석 조사와 앉기·카메라
- 배정: metaverse-3d-developer / 3D 런타임 구현 (codex gpt-6-astra/max)

### T19: 팀·캐릭터 선택 (WF)
- 항목: BL-0003 (결정 11·13)
- 의존: WF — `web/ui/team-select.js` 빈 자리와 `team:changed`·`character:changed`(T11).
- 산출물: `tests/team-select.spec.mjs`
- 완료 검사: `npm test -- tests/team-select.spec.mjs` → 실패 0, 그리고 `npm test` → 실패 0
- 시험이 확인할 것: 한 창에서 팀 2개(GEN.G, BLG)와 캐릭터 4종 중 하나씩 고름, 고르면 이벤트가 나감, 다시 고르면 바뀜. 유니폼 교체는 임시 아바타의 팀 색으로만 보이고 진짜 저지 그림은 T36.
- 편집 범위: `web/ui/team-select.js`, `web/config/teams.json`, `web/config/characters.json`, `tests/team-select.spec.mjs`
- 예상 시간(분): low 30 / likely 45 / high 70 (likely T+244~289)
- 분할선: 팀 칸과 캐릭터 칸
- 배정: metaverse-web-developer / UI·기능 구현 (claude opus/medium)

### T20: Alt 감정표현 메뉴 (WF)
- 항목: BL-0009 (결정 14·15)
- 의존: WF — `controls.json`의 Alt 배정과 `emote:request`(T11).
- 산출물: `tests/emote-menu.spec.mjs`
- 완료 검사: `npm test -- tests/emote-menu.spec.mjs` → 실패 0, 그리고 `npm test` → 실패 0
- 시험이 확인할 것: Alt로 2x2 버튼 4개, 버튼·Alt·Esc로 닫힘(떼면 안 닫힘), 각 버튼이 자기 `emote:request {id}`를 냄, Alt가 브라우저 메뉴를 열지 않음, `emoteMenu:open`으로도 열림(Review Focus 4).
- 편집 범위: `web/ui/emote-menu.js`, `tests/emote-menu.spec.mjs`
- 예상 시간(분): low 20 / likely 30 / high 45 (likely T+289~319)
- 분할선: 없음
- 배정: metaverse-web-developer / UI·기능 구현 (claude opus/medium)

### T21: 티켓팅·입장 차단 (WF)
- 항목: BL-0007 (결정 14·16·30)
- 의존: WF — `player.addBlocker`, `player.setTeleportGuard`, `team:changed`, `emote:played`(T11).
- 산출물: `tests/ticket.spec.mjs`
- 완료 검사: `npm test -- tests/ticket.spec.mjs` → 실패 0, 그리고 `npm test` → 실패 0
- 시험이 확인할 것: 막는 면이 광장에서 처음 들어가는 입구(커튼월 개구부 x≈−95.6, z −12.4~12.4, F-15)에 있음, 3 m 안에서 티켓 창이 뜸, 팀 선택과 감정표현 1회 전에는 발급이 안 되고 입구·이동 버튼(lobby·arena)·개구부 옆으로 들어갈 수 없음, "응원하기"가 `emoteMenu:open`을 냄, 둘을 마치면 팀 색 티켓 카드 애니메이션 뒤 통과, 새로고침하면 처음부터, `window.arena.go`는 막지 않음(Review Focus 3).
- 편집 범위: `web/ui/ticket.js`, `web/config/ticket.json`, `tests/ticket.spec.mjs`
- 값: T06이 유리면 문을 찾으면(R-13) 코디네이터가 메모로 막는 면 좌표를 바꿔 준다. 값만 바뀐다.
- 예상 시간(분): low 35 / likely 55 / high 85 (likely T+189~244)
- 분할선: 막는 면·이동 막기와 티켓 창 연출
- 배정: metaverse-web-developer / UI·기능 구현 (claude opus/medium)

### T22: 모니터 게임 화면 (WF)
- 항목: BL-0012 (결정 22)
- 의존: WF — `web/stage-monitors.js` 빈 자리(T11).
- 산출물: `tests/stage-monitors.spec.mjs`
- 완료 검사: `npm test -- tests/stage-monitors.spec.mjs` → 실패 0, 그리고 `npm test` → 실패 0
- 시험이 확인할 것: `REF_Reused_Monitor_pixels__cyan` 10대 모두에 런타임 UV가 생기고 리그 오브 레전드와 비슷한 반복 화면이 움직임(실제 게임 화면 아님, 소스는 설정 파일 경로로 바꿀 수 있음).
- 편집 범위: `web/stage-monitors.js`, `web/config/stage-monitors.json`, `tests/stage-monitors.spec.mjs`
- 예상 시간(분): low 30 / likely 45 / high 70 (likely T+244~289)
- 분할선: 없음
- 배정: metaverse-3d-developer / 3D 런타임 구현 (codex gpt-6-astra/max)

### T23: 2층 마네킹·먼 관중 텍스처 (WF)
- 항목: BL-0018, BL-0015 (결정 23)
- 의존: WF — 기존 `web/crowd-motion.js`(T11이 등록만 함).
- 산출물: `tests/crowd.spec.mjs`
- 완료 검사: `npm test -- tests/crowd.spec.mjs` → 실패 0, 그리고 `npm test` → 실패 0
- 시험이 확인할 것: 2층 관중이 단순 마네킹 인스턴스로 바뀌고 삼각형 수가 1층보다 적음, 환호 구간에만 움직임, "멀리" = 2층 전체 + 보는 사람에서 경기장 중심 너머 ±60° 관중석이 낮은 해상도 텍스처를 씀(카메라를 옮기면 반대편이 바뀜), 영상 소리가 켜진 동안(`screen:state.muted=false`) 환호음 30%.
- 편집 범위: `web/crowd-motion.js`, `web/config/crowd.json`, `tests/crowd.spec.mjs`
- 예상 시간(분): low 45 / likely 65 / high 100 (likely T+124~189)
- 분할선: 2층 마네킹(BL-0018)과 먼 관중 텍스처(BL-0015)
- 배정: metaverse-3d-developer / 3D 런타임 구현 (codex gpt-6-astra/max)

### T24: 밤·별·달·달빛·바다 (WF)
- 항목: BL-0004(런타임 쪽), BL-0005 (결정 19·20)
- 의존: WF — `web/environment.js` 빈 자리(T11), 달 방향 값(T04).
- 산출물: `tests/environment.spec.mjs`
- 완료 검사: `npm test -- tests/environment.spec.mjs` → 실패 0, 그리고 `npm test` → 실패 0
- 시험이 확인할 것: 밤하늘·은은한 별·달이 보임, 지금보다 어두움(설정값), 캐릭터에 달빛, 서쪽 광장 끝(x≈−180) 너머 바다가 지평선까지, 해안선의 막는 면으로 바다에 못 들어감. `lighting.js`·`baked-lighting.js`는 고치지 않는다.
- 편집 범위: `web/environment.js`, `web/config/environment.json`, `tests/environment.spec.mjs`
- 예상 시간(분): low 40 / likely 60 / high 95 (likely T+134~194)
- 분할선: 하늘·달과 바다
- 배정: metaverse-3d-developer / 3D 런타임 구현 (codex gpt-6-astra/max)

### T25: 하늘 쇼 (WF)
- 항목: BL-0006 (결정 21)
- 의존: WF — `web/sky-show.js` 빈 자리(T11).
- 산출물: `tests/sky-show.spec.mjs`
- 완료 검사: `npm test -- tests/sky-show.spec.mjs` → 실패 0, 그리고 `npm test` → 실패 0
- 시험이 확인할 것: 사선 빛줄기 3개가 좌우로 왕복(8초, ±25°), 폭죽이 20~40초마다 1~3발. 큐 값은 설정 기본값으로 먼저 만들고 T33의 `cues.json` 값은 T38이 넣는다.
- 편집 범위: `web/sky-show.js`, `web/config/sky-show.json`, `tests/sky-show.spec.mjs`
- 예상 시간(분): low 25 / likely 40 / high 60 (likely T+262~302)
- 분할선: 빛줄기와 폭죽
- 배정: metaverse-3d-developer / 3D 런타임 구현 (codex gpt-6-astra/max)

### T26: 프로게이머 랜덤 동작 (WF)
- 항목: BL-0013 (결정 2)
- 의존: WF — `web/stage-players.js` 빈 자리(T11).
- 산출물: `tests/stage-players.spec.mjs`
- 완료 검사: `npm test -- tests/stage-players.spec.mjs` → 실패 0, 그리고 `npm test` → 실패 0
- 시험이 확인할 것: 선수 10명이 부위 관절 동작 5종(마우스, 키보드, 고개, 소리 지름, 머리 쓸어넘기기)을 3~8초마다 랜덤으로 바꿈, 같은 순간 모두 같은 동작이 아님, 소리 지를 때 소리(임시 소리, 진짜는 T38).
- 편집 범위: `web/stage-players.js`, `web/config/stage-players.json`, `tests/stage-players.spec.mjs`
- 예상 시간(분): low 35 / likely 50 / high 80 (likely T+212~262)
- 분할선: 동작과 소리
- 배정: metaverse-3d-developer / 3D 런타임 구현 (codex gpt-6-astra/max)

### T27: 멀티: 회차·초대·정원·상태·닉네임 (WF)
- 항목: BL-0010, BL-0021 (결정 8·11·17·25, 연결 구조)
- 의존: WF — 기존 `web/multiplayer.js`(T11이 등록만 함), `room:joined`·`peer:state` 약속.
- 산출물: `tests/multiplayer.spec.mjs`
- 완료 검사: `npm test -- tests/multiplayer.spec.mjs` → 실패 0, 그리고 `npm test` → 실패 0
- 시험이 확인할 것: 연결 중개는 PeerJS Cloud 그대로. 방 만들기에서 회차를 고름(지난 2개·방금 시작·다음 2개, 기본 = 방금 시작한 회차 — **방을 만들 때 회차를 고르는 UI는 이 Task**), 방장이 들어온 사람에게 `room {roundStart}`를 보내고 양쪽이 `room:joined {code, host, roundStart}`를 냄(**회차 시작 시각을 참가자에게 전하는 일은 이 Task**), 초대 URL 복사 → 다른 브라우저가 그 URL로 같은 방·같은 회차에 들어감(Review Focus 2), `state {team, character, nickname, emote, emoteSeq, seated}`가 오가고 `peer:state`가 나감, 자동 닉네임("팬" + 숫자 4자리, 겹치면 방장이 한 자리 더함)이 머리 위에 보임, 17번째는 곧바로 "방이 가득 찼습니다(16명)"(Review Focus 5), `pose`·`validPose` 그대로.
- 편집 범위: `web/multiplayer.js`, `web/ui/invite.js`, `web/nameplate.js`, `web/config/network.json`, `tests/multiplayer.spec.mjs`
- 예상 시간(분): low 65 / likely 95 / high 145 (likely T+122~217)
- 분할선: 방(회차·초대·정원)과 상태·닉네임(같은 `multiplayer.js`라 차례로)
- 배정: metaverse-web-developer / UI·기능 구현 (claude opus/medium)

### GX: 그래픽 제작 묶음 (팀장)
- 의존: T04 — `asset-contract.md`의 이름·예산·`-v2` 이름. T05 — `art-direction.md`. T06 — Blender 연결 확인과 `## 수정 목록`.
- 산출물: `_workspace/graphicmodel/2026-11-12-requirements-build/00_graphic-leader_lead-assets_v1.md`(통합 보고. 팀원의 `## 넘기는 것`·`## 클립`·`## 효과`·`## 효과음` 표 경로를 모은다)
- 완료 검사: `node .claude/scripts/report-check.mjs <산출물>` → `"ok":true`, 팀원 T28~T34가 모두 정산됨
- 편집 범위: 팀원 spec(`_workspace/graphicmodel/2026-11-12-requirements-build/spec/`)과 통합 보고
- 배정: graphic-leader / 리드 (claude opus/high)
- 제작 방식(결정 11, 계획이 정함): **뼈대 하나(같은 뼈 이름·같은 기준 자세)에 몸 4종을 입히고 클립 9개는 그 뼈대에 한 번만 만든다.** 여 2·남 2는 몸 2개(여·남)를 같은 관절 위치에 맞춰 만들고, 4종은 머리 모양 메시·피부색·얼굴 재질로 나눈다. 근거: 클립은 뼈 이름으로 묶이므로 Three.js에서 한 클립 묶음을 네 메시가 함께 쓰고, 리깅과 애니메이션을 4번 하지 않는다. 4종을 따로 만들면 b2·b3가 각각 약 4배가 되지만 이 방식은 b2 +30분, b3 +10분이다. T28이 먼저 `search_assets`로 CC0 리깅 캐릭터(여·남이 같은 뼈대)를 찾아보고, 쓸 수 있으면 그것에서 시작한다(low 값이 그 경우).
- 예상 시간(분): 팀장 기동 low 5 / likely 5 / high 10, 통합 보고 low 5 / likely 5 / high 10 (묶음 likely T+56~277)
- 분할선: 팀원 Task 단위(MCP 줄 T28~T30, 배치 줄 T31~T32, 효과 줄 T33~T34)

### T28: 캐릭터 시트·블록아웃 4종 (GX)
- 항목: BL-0002
- 의존: GX — `art-direction.md`의 팬 캐릭터 절, `asset-contract.md`의 캐릭터 예산.
- 산출물: `art/characters/fan/fan-sheet.png`(4종 앞·옆)
- 완료 검사: `node .claude/scripts/report-check.mjs _workspace/graphicmodel/2026-11-12-requirements-build/03_graphic-character-designer_character-fan-blockout_v1.md --expect art/characters/fan/fan-sheet.png` → `"ok":true`
- 편집 범위: `art/characters/fan/`(`fan.blend` 블록아웃, 시트)
- 예상 시간(분): low 40 / likely 60 / high 95 (likely T+64~124)
- 자원: Blender MCP
- 분할선: 여 몸과 남 몸
- 배정: graphic-character-designer / 캐릭터 모델링 (codex gpt-6-astra/max). Codex가 Blender MCP에 붙지 못하면 `claude fable/max`(사용자 예외, 결정 6)

### T29: 아트 리뷰 1 (GX)
- 항목: BL-0002
- 의존: T28 — `fan-sheet.png`와 블록아웃의 실루엣·비례.
- 산출물: `_workspace/graphicmodel/2026-11-12-requirements-build/07_graphic-leader_art-review-char_v1.md`
- 완료 검사: `node .claude/scripts/report-check.mjs <산출물>` → `"ok":true`, High 0이면 T30으로
- 편집 범위: 리포트만
- 예상 시간(분): low 15 / likely 20 / high 30 (likely T+129~149)
- 분할선: 없음
- 배정: graphic-leader / 아트 리뷰 (codex gpt-6-astra/medium)

### T30: 캐릭터 모델·공용 뼈대·유니폼 자리 (GX)
- 항목: BL-0002, BL-0003 (결정 11·13)
- 의존: T29 — 아트 리뷰 1의 High 0 판정과 고칠 점.
- 산출물: `web/assets/characters/fan.glb`
- 완료 검사: `node .claude/skills/blender-pipeline/scripts/glb-inspect.mjs web/assets/characters/fan.glb --names --max-tris <T04 예산> --max-joints <T04 예산> --max-kb <T04 예산>` → 코드 0, 메시 `fan_f1`·`fan_f2`·`fan_m1`·`fan_m2`와 재질 `Uniform`이 이름 목록에 있음
- 편집 범위: `art/characters/fan/`, `web/assets/characters/fan.glb`
- 지킬 것: 유니폼은 몸 메시의 저지 부분 재질 `Uniform`(몸 위에 겹친 별도 옷 메시 없음). Draco.
- 예상 시간(분): low 80 / likely 120 / high 190 (likely T+152~272)
- 자원: Blender MCP
- 분할선: 여 몸·리그와 남 몸·변형 4종
- 배정: graphic-character-designer / 캐릭터 모델링 (codex gpt-6-astra/max). 결정 6 예외 같음

### T31: 경기장 수정 (GX, 배치 Blender)
- 항목: BL-0011, BL-0014(오브젝트 쪽), BL-0004(정적 면의 달 조명) (결정 1)
- 의존: GX — T06의 `## 수정 목록`, `asset-contract.md`의 이름 보존·달 방향·하늘 세기.
- 산출물: `art/environment/arena/barclays-arena-v2.blend`
- 완료 검사: `node .claude/scripts/report-check.mjs _workspace/graphicmodel/2026-11-12-requirements-build/02_graphic-model-designer_model-arena-v2_v1.md --expect art/environment/arena/barclays-arena-v2.blend` → `"ok":true`(리포트에 고친 목록과 이름 보존 대조)
- 편집 범위: `art/environment/arena/`(복사본 `.blend`, 수정 스크립트). 원본 `.blend`는 읽기만.
- 예상 시간(분): low 50 / likely 75 / high 120 (likely T+64~139)
- 자원: 배치 Blender(`blender -b <복사본> -P <스크립트>`), MCP 안 씀
- 분할선: 지지 기둥·계단 아래와 뜬 사물·겹침
- 배정: graphic-model-designer / 3D 모델링 (codex gpt-6-astra/max)

### T32: 다시 굽기·내보내기 (GX, 배치 Blender)
- 항목: BL-0011, BL-0014, BL-0004
- 의존: T31 — `barclays-arena-v2.blend`의 형상 수정이 끝난 상태.
- 산출물: `web/arena-v2.glb`
- 완료 검사: `node .claude/skills/blender-pipeline/scripts/glb-inspect.mjs web/arena-v2.glb --names` → 설계 5.5의 이름 보존 목록이 모두 있음, glTF 검증 오류 0(리포트), 라이트맵 7장 `web/lightmaps/*-v2.png`
- 편집 범위: `art/environment/arena/`(굽기·내보내기 스크립트 복사본, 옛 절대경로 정리), `web/arena-v2.glb`, `web/lightmaps/*-v2.png`
- 예상 시간(분): low 20 / likely 30 / high 60 (likely T+142~172)
- 자원: 배치 Blender, GPU(굽기 동안 `node tests/gpu-lock.mjs acquire T32`)
- 분할선: 굽기와 내보내기
- 배정: graphic-model-designer / 3D 모델링 (codex gpt-6-astra/max)

### T33: 이펙트 명세·큐 표 (GX)
- 항목: BL-0006, BL-0013, BL-0008
- 의존: GX — `art-direction.md`의 하늘 쇼 절.
- 산출물: `art/vfx/arena-show/cues.json`(+ `spec.md`)
- 완료 검사: `node -e "const c=require('./art/vfx/arena-show/cues.json');console.log(['sky_beam','firework','pro_shout','egg_release','egg_scream'].every(k=>JSON.stringify(c).includes(k)))"` → `true`
- 편집 범위: `art/vfx/arena-show/`
- 지킬 것: `egg_release`·`egg_scream`은 이름만 정하고 프레임은 T35의 `## 클립` 표에서 T37이 가져온다(손으로 어림하지 않는다).
- 예상 시간(분): low 20 / likely 30 / high 45 (likely T+64~94)
- 분할선: 하늘 쇼와 고함·계란
- 배정: graphic-effect-vfx-designer / 이펙트 제작 (codex gpt-6-astra/max)

### T34: 효과음 (GX)
- 항목: BL-0008, BL-0013
- 의존: T33 — `cues.json`의 소리 이벤트 이름.
- 산출물: `web/assets/audio/sfx/`(`egg-scream_01`, `pro-shout_01`~`03`, CC0, 출처 표)
- 완료 검사: `node .claude/scripts/report-check.mjs _workspace/graphicmodel/2026-11-12-requirements-build/06_graphic-effect-vfx-designer_sfx-arena-show_v1.md --expect web/assets/audio/sfx` → `"ok":true`
- 편집 범위: `web/assets/audio/sfx/`
- 예상 시간(분): low 15 / likely 25 / high 40 (likely T+97~122)
- 분할선: 없음
- 배정: graphic-effect-vfx-designer / 효과음 (codex gpt-6-astra/max)

### T35: 캐릭터 클립 9개·계란 소품
- 항목: BL-0008, BL-0019(`Sit`), BL-0002 (2) (결정 12)
- 의존: GX — T30의 `fan.glb`와 공용 뼈대.
- 산출물: `web/assets/characters/fan-anim.glb`
- 완료 검사: `node .claude/skills/blender-pipeline/scripts/glb-inspect.mjs web/assets/characters/fan-anim.glb --names` → 클립 9개(`Idle`, `Walk`, `Run`, `Jump`, `Sit`, `Emote_CheerClap`, `Emote_Heart`, `Emote_Angry`, `Emote_EggThrow`)와 `Prop_Egg`, 리포트의 `## 클립` 표에 계란 손 놓는 프레임
- 편집 범위: `art/characters/fan/`, `web/assets/characters/fan-anim.glb`
- 지킬 것: 여·남 몸 둘 다에서 팔이 몸을 뚫지 않는지 확인한다(하트, 박수).
- 예상 시간(분): low 70 / likely 100 / high 160 (likely T+280~380)
- 자원: Blender MCP
- 분할선: 기본 클립 5개와 감정표현 4개
- 배정: graphic-character-designer / 캐릭터 애니메이션 (codex gpt-6-astra/max). 결정 6 예외 같음

### T36: 캐릭터 연결 1: 모델·선택·유니폼·원격
- 항목: BL-0002, BL-0003 (결정 11·13·17)
- 의존: GX — `fan.glb`(T30), `## 넘기는 것` 표. WF — `team:changed`·`character:changed`(T19), `peer:state`·닉네임(T27). LGA — 실제 팀 이름·저지 그림을 써도 되는지(T08·T09 판정, 안 되면 로고 없는 팀 색).
- 산출물: `tests/character.spec.mjs`
- 완료 검사: `npm test -- tests/character.spec.mjs` → 실패 0(4종이 각자 보임, 팀을 바꾸면 `Uniform` 그림만 바뀜, 원격 아바타가 그 사람의 캐릭터·팀·닉네임으로 보임, `createAvatar(color)` 겉모양 그대로), `npm test` → 실패 0
- 편집 범위: `web/character.js`, `web/avatar.js`(겉모양 유지), `web/vendor/SkeletonUtils.js`(필요할 때 r170 원본 복사), `tests/character.spec.mjs`
- 예상 시간(분): low 30 / likely 45 / high 75 (likely T+327~372)
- 분할선: 내 캐릭터와 원격 캐릭터
- 배정: metaverse-3d-developer / 3D 런타임 구현 (codex gpt-6-astra/max)

### T37: 캐릭터 연결 2: 클립·감정표현·앉기
- 항목: BL-0008, BL-0009, BL-0007, BL-0019, BL-0002 (2)
- 의존: T35 — `fan-anim.glb`와 `## 클립` 표의 계란 프레임. T36 — `character.js`의 캐릭터 불러오기(같은 파일이라 차례로). GX — 효과음 `egg-scream_01`(T34).
- 산출물: `tests/character-clips.spec.mjs`
- 완료 검사: `npm test -- tests/character-clips.spec.mjs` → 실패 0(이동·점프·앉기 클립 전환, 감정표현 4종이 각자 재생, 계란이 클립 프레임에 손을 떠나고 괴성이 그 프레임에 남, 티켓의 응원하기 1회가 진짜 감정표현으로 참), `npm test` → 실패 0
- 편집 범위: `web/character.js`, `tests/character-clips.spec.mjs`
- 예상 시간(분): low 20 / likely 30 / high 50 (likely T+383~413)
- 분할선: 기본 클립과 감정표현
- 배정: metaverse-3d-developer / 3D 런타임 구현 (codex gpt-6-astra/max)

### T38: 경기장 v2·연출 연결
- 항목: BL-0011, BL-0014, BL-0004, BL-0006, BL-0013
- 의존: GX — `web/arena-v2.glb`·`*-v2.png`(T32), `cues.json`(T33), 효과음(T34). WF — `sky-show.json`·`stage-players.json`(T25·T26).
- 산출물: `tests/arena-v2.spec.mjs`
- 완료 검사: `npm test -- tests/arena-v2.spec.mjs` → 실패 0(앱이 `arena-v2.glb`와 v2 라이트맵을 읽음, 이름으로 찾는 것이 모두 있음, 지지 기둥·계단 아래 확인 지점의 화면, 빛줄기·폭죽이 `cues.json` 값, 선수 고함이 진짜 효과음), `npm test` → 실패 0(회귀 2개 포함)
- 편집 범위: `web/main.js`(GLB 경로 한 줄), `web/baked-lighting.js`(v2 라이트맵 이름이 필요할 때만), `web/config/sky-show.json`, `web/config/stage-players.json`, `tests/arena-v2.spec.mjs`
- 예상 시간(분): low 25 / likely 40 / high 65 (likely T+327~367)
- 분할선: 경기장 v2와 연출 값
- 배정: metaverse-3d-developer / 3D 런타임 구현 (codex gpt-6-astra/max)

### T39: 중간 리뷰 2a: 웹 기능 3D 파일
- 항목: BL-0023, BL-0024, BL-0017, BL-0014, BL-0019, BL-0012, BL-0018, BL-0015, BL-0004, BL-0005, BL-0006, BL-0013
- 의존: WF — T16~T18·T22~T26의 변경과 리포트(그 파일의 편집이 끝난 뒤 한 번만 본다).
- 산출물: `_workspace/qa/2026-11-12-requirements-build/01_code-reviewer_review-w3d_v1.md`
- 완료 검사: `node .claude/scripts/report-check.mjs <산출물>` → `"ok":true`
- 편집 범위: 리포트만
- 예상 시간(분): low 20 / likely 30 / high 45 (likely T+327~357)
- 분할선: 조작·좌석과 월드·무대·관중
- 배정: code-reviewer / 일반 변경 리뷰 (claude opus/medium)

### T40: 중간 리뷰 2b: 웹 기능 UI·멀티·BL-0022 문서
- 항목: BL-0003, BL-0009, BL-0007, BL-0010, BL-0021, BL-0022
- 의존: WF — T19~T21·T27의 변경. T12 — `room-service-design.md`(네 요소와 연결 구조 대조).
- 산출물: `_workspace/qa/2026-11-12-requirements-build/01_code-reviewer_review-wui_v1.md`
- 완료 검사: `node .claude/scripts/report-check.mjs <산출물>` → `"ok":true`
- 편집 범위: 리포트만
- 예상 시간(분): low 20 / likely 30 / high 45 (likely T+327~357)
- 분할선: UI와 멀티·문서
- 배정: code-reviewer / 일반 변경 리뷰 (claude opus/medium)

### T41: 중간 리뷰 3: 연결 변경
- 항목: BL-0002, BL-0003, BL-0008, BL-0011
- 의존: T37 — `character.js`의 최종 변경. T38 — `main.js`·설정 파일의 변경.
- 산출물: `_workspace/qa/2026-11-12-requirements-build/01_code-reviewer_review-wire_v1.md`
- 완료 검사: `node .claude/scripts/report-check.mjs <산출물>` → `"ok":true`
- 편집 범위: 리포트만
- 예상 시간(분): low 15 / likely 20 / high 30 (likely T+416~436)
- 분할선: 없음
- 배정: code-reviewer / 일반 변경 리뷰 (claude opus/medium)

### QA: 끝 QA 묶음 (팀장)
- 의존: T39, T40, T41 — 세 리뷰의 결함 표(High는 수정이 정산된 뒤).
- 산출물: `_workspace/qa/2026-11-12-requirements-build/00_qa-inspector_lead-final_v1.md`(통합 보고)
- 완료 검사: `node .claude/scripts/report-check.mjs <산출물>` → `"ok":true`, 팀원 T42~T45가 모두 정산됨
- 편집 범위: 팀원 spec(`_workspace/qa/2026-11-12-requirements-build/spec/`)과 통합 보고
- 배정: qa-inspector / 리드 (claude opus/high)
- 팀원 공통: 산출물은 `_workspace/qa/2026-11-12-requirements-build/02_qa-inspector_qa-<영역>_v1.md`, 완료 검사는 `node .claude/scripts/report-check.mjs <산출물>` → `"ok":true`. 편집 범위는 `tests/qa-<영역>.spec.mjs`와 리포트. 브라우저는 워커마다 따로 띄우고 GPU 점유 표시로 차례대로 쓴다. 대조할 경계면은 맡은 항목의 Task `의존` 줄이다.
- 예상 시간(분): 팀장 기동 low 5 / likely 5 / high 10, 통합 보고 low 5 / likely 5 / high 10 (묶음 likely T+439~522)
- 분할선: 영역 단위(T42~T45)

### T42: QA A: 스크린·Full Mode·좌석 (QA)
- 항목: BL-0016, BL-0020, BL-0019. 접두어 `A-`. R-14(시계 차이)는 관찰로 적는다.
- 의존: QA — T13·T14·T18·T37의 시험과 화면.
- 산출물: `_workspace/qa/2026-11-12-requirements-build/02_qa-inspector_qa-A_v1.md`
- 완료 검사: `node .claude/scripts/report-check.mjs _workspace/qa/2026-11-12-requirements-build/02_qa-inspector_qa-A_v1.md` → `"ok":true`
- 편집 범위: `tests/qa-a.spec.mjs`, 리포트
- 예상 시간(분): low 35 / likely 55 / high 85 (likely T+447~502)
- 분할선: 스크린·Full Mode와 좌석
- 배정: qa-inspector / 흐름 검증 (claude opus/medium)

### T43: QA B: 캐릭터·팀·감정표현·티켓 (QA)
- 항목: BL-0002, BL-0003, BL-0008, BL-0009, BL-0007. 접두어 `B-`.
- 의존: QA — T19~T21·T36·T37의 시험과 화면.
- 산출물: `_workspace/qa/2026-11-12-requirements-build/02_qa-inspector_qa-B_v1.md`
- 완료 검사: `node .claude/scripts/report-check.mjs _workspace/qa/2026-11-12-requirements-build/02_qa-inspector_qa-B_v1.md` → `"ok":true`
- 편집 범위: `tests/qa-b.spec.mjs`, 리포트
- 예상 시간(분): low 40 / likely 60 / high 95 (likely T+447~507)
- 분할선: 캐릭터·팀과 감정표현·티켓
- 배정: qa-inspector / 흐름 검증 (claude opus/medium)

### T44: QA C: 월드·무대·관중·경기장 (QA)
- 항목: BL-0004, BL-0005, BL-0006, BL-0011, BL-0012, BL-0013, BL-0014, BL-0017, BL-0018. 접두어 `C-`.
- 의존: QA — T17·T22~T26·T38의 시험과 화면.
- 산출물: `_workspace/qa/2026-11-12-requirements-build/02_qa-inspector_qa-C_v1.md`
- 완료 검사: `node .claude/scripts/report-check.mjs _workspace/qa/2026-11-12-requirements-build/02_qa-inspector_qa-C_v1.md` → `"ok":true`
- 편집 범위: `tests/qa-c.spec.mjs`, 리포트
- 예상 시간(분): low 45 / likely 70 / high 110 (likely T+447~517)
- 분할선: 월드·경기장과 무대·관중
- 배정: qa-inspector / 흐름 검증 (claude opus/medium)

### T45: QA X: 조작·멀티·횡단 (QA)
- 항목: BL-0023, BL-0024, BL-0010, BL-0021, 키보드·콘솔 오류·보안. 접두어 `X-`. 16명 접속은 V01의 로컬 PeerJS 서버 방식을 다시 쓴다.
- 의존: QA — T16·T27의 시험, 앱 전체.
- 산출물: `_workspace/qa/2026-11-12-requirements-build/02_qa-inspector_qa-X_v1.md`
- 완료 검사: `node .claude/scripts/report-check.mjs _workspace/qa/2026-11-12-requirements-build/02_qa-inspector_qa-X_v1.md` → `"ok":true`
- 편집 범위: `tests/qa-x.spec.mjs`, 리포트
- 예상 시간(분): low 45 / likely 70 / high 110 (likely T+447~517)
- 분할선: 멀티 16명과 조작·횡단
- 배정: qa-inspector / 흐름 검증 (claude opus/medium)

### T46: 아트 리뷰 2
- 항목: BL-0002, BL-0004, BL-0005, BL-0006, BL-0011, BL-0012, BL-0013, BL-0018
- 의존: T37, T38 — 연결이 끝난 최종 화면.
- 산출물: `_workspace/graphicmodel/2026-11-12-requirements-build/07_graphic-leader_art-review-scene_v1.md`
- 완료 검사: `node .claude/scripts/report-check.mjs <산출물>` → `"ok":true`
- 편집 범위: 리포트만
- 예상 시간(분): low 15 / likely 25 / high 40 (likely T+416~441)
- 분할선: 캐릭터와 월드
- 배정: graphic-leader / 아트 리뷰 (codex gpt-6-astra/medium)

### T47: Riot 정책 끝 검토
- 항목: BL-0003, BL-0012, BL-0016
- 의존: T37, T38 — 실제 화면·문구. LGA — 기준 문서(T36 경유).
- 산출물: `_workspace/legal-review/2026-11-12-requirements-build/02_riot-policy-reviewer_review-final_v1.md`
- 완료 검사: `node .claude/scripts/report-check.mjs <산출물>` → `"ok":true`
- 편집 범위: 리포트만
- 예상 시간(분): low 25 / likely 40 / high 60 (likely T+416~456)
- 분할선: 없음
- 배정: riot-policy-reviewer / Riot 정책 검토 (claude fable/high)

### T48: 법률 끝 검토
- 항목: BL-0003, BL-0016, BL-0010
- 의존: T37, T38 — 출처 표, 임베드, 오가는 정보(닉네임 포함).
- 산출물: `_workspace/legal-review/2026-11-12-requirements-build/03_legal-reviewer_review-final_v1.md`
- 완료 검사: `node .claude/scripts/report-check.mjs <산출물>` → `"ok":true`
- 편집 범위: 리포트만
- 예상 시간(분): low 25 / likely 40 / high 60 (likely T+416~456)
- 분할선: 없음
- 배정: legal-reviewer / 법률 검토 (claude fable/high)

### T49: 성능 점검
- 항목: BL-0015(판정), BL-0018(삼각형 수), 전체 예산
- 의존: QA — 끝 QA가 끝난 같은 빌드. T46, T47, T48 — 다른 검증이 모두 끝남(혼자 돈다).
- 산출물: `_workspace/graphicmodel/2026-11-12-requirements-build/08_graphic-performance-verifier_perf_v1.md`
- 완료 검사: `node .claude/scripts/report-check.mjs <산출물>` → `"ok":true`(GLB·텍스처·드로 콜·데스크톱 FPS, 2층·반대편 관중의 텍스처 해상도 수치)
- 편집 범위: 리포트만(점검)
- 예상 시간(분): low 20 / likely 30 / high 50 (likely T+525~555)
- 자원: GPU
- 분할선: 자산 수치와 실측
- 배정: graphic-performance-verifier / 성능 점검 (codex gpt-6-astra/max)

### T50: 수정 A·B (High만)
- 항목: A·B 영역에서 High가 나온 항목
- 의존: T49 — 끝 QA·리뷰·법무·아트·성능 리포트의 High 목록(모든 검증이 끝난 뒤).
- 산출물: 고친 Task 리포트의 다음 버전 `_v2`
- 완료 검사: 그 결함 ID의 재현 시험 `npm test -- tests/<그 Task>.spec.mjs` → 실패 0, `npm test` → 실패 0
- 편집 범위: High가 가리킨 파일. T51과 같은 파일을 받지 않도록 코디네이터가 파일 단위로 나눈다.
- 예상 시간(분): low 20 / likely 35 / high 70 (likely T+558~593)
- 분할선: 결함 ID 단위
- 배정: 원래 담당. 그림의 대표 배정은 metaverse-3d-developer / 3D 런타임 구현 (codex gpt-6-astra/max)

### T51: 수정 C·X (High만)
- 항목: C·X 영역에서 High가 나온 항목
- 의존: T49 — 위와 같다.
- 산출물: 고친 Task 리포트의 다음 버전 `_v2`
- 완료 검사: T50과 같은 방식
- 편집 범위: High가 가리킨 파일(T50과 겹치지 않게)
- 예상 시간(분): low 20 / likely 35 / high 70 (likely T+558~593)
- 분할선: 결함 ID 단위
- 배정: 원래 담당. 그림의 대표 배정은 metaverse-web-developer / UI·기능 구현 (claude opus/medium)

### T52: 재검 A·B
- 의존: T50 — 고친 결함 ID와 재현 시험.
- 산출물: `_workspace/qa/2026-11-12-requirements-build/02_qa-inspector_qa-A_v2.md`, `_workspace/qa/2026-11-12-requirements-build/02_qa-inspector_qa-B_v2.md`(재검 회차 1)
- 완료 검사: `node .claude/scripts/report-check.mjs <산출물>` → `"ok":true`
- 편집 범위: 리포트만
- 예상 시간(분): low 10 / likely 20 / high 30 (likely T+596~616)
- 분할선: 영역 단위
- 배정: qa-inspector / 재검 (claude opus/medium)

### T53: 재검 C·X
- 의존: T51 — 고친 결함 ID와 재현 시험.
- 산출물: `_workspace/qa/2026-11-12-requirements-build/02_qa-inspector_qa-C_v2.md`, `_workspace/qa/2026-11-12-requirements-build/02_qa-inspector_qa-X_v2.md`(재검 회차 1)
- 완료 검사: `node .claude/scripts/report-check.mjs <산출물>` → `"ok":true`
- 편집 범위: 리포트만
- 예상 시간(분): low 10 / likely 20 / high 30 (likely T+596~616)
- 분할선: 영역 단위
- 배정: qa-inspector / 재검 (claude opus/medium)

### T54: 최종 테스트 1회 (기한의 기준, 결정 3)
- 의존: T52, T53 — 수정과 재검이 모두 정산된 최종 코드 상태.
- 산출물: `_workspace/_run/2026-11-12-requirements-build/report.md`의 최종 테스트 줄
- 완료 검사: `npm test` → 실패 0(백그라운드로 돌리고 출력을 끝까지 읽음). 못 돌렸으면 "테스트 미실행"
- 편집 범위: Run 폴더
- 예상 시간(분): low 10 / likely 15 / high 25 (likely T+616~631)
- 분할선: 없음
- 배정: coordinator / 실행 감독 (claude opus/high) — 코디네이터가 직접

### T55: 완료 처리 (6단계)
- 의존: T54 — 최종 테스트 결과. T01 — 연결 표.
- 산출물: `_workspace/product/2026-11-12-requirements-build/02_product-manager_closeout_v1.md`
- 완료 검사: `node .claude/scripts/report-check.mjs <산출물>` → `"ok":true`
- 편집 범위: `docs/backlog.md`, `docs/backlog-archive.md`
- 예상 시간(분): low 10 / likely 15 / high 25 (likely T+634~649)
- 분할선: 없음
- 배정: product-manager / 완료 처리 (claude sonnet/medium) — 결정 31, 예외 없음

### T56: 하네스 회고 (7단계)
- 의존: T55 — 완료 처리(팀 스킬의 순서). 코디네이터가 띄우기 전에 `actual.json`을 남긴다.
- 산출물: `_workspace/harness/2026-11-12-requirements-build/01_harness-engineer_retro_v1.md`
- 완료 검사: `node .claude/scripts/report-check.mjs <산출물>` → `"ok":true`
- 편집 범위: 리포트만
- 예상 시간(분): low 20 / likely 30 / high 45 (likely T+652~682)
- 분할선: 없음
- 배정: harness-engineer / 회고 (claude fable/high)

### T57: 하네스 수정
- 의존: T56 — 회고의 근거 있는 수정 목록(설계 9절의 Next.js 전제 문구 22개 파일 31곳, 이번 phase에서 잰 것, `waterfall-timeline` 경로 문제).
- 산출물: `_workspace/harness/2026-11-12-requirements-build/02_harness-engineer_changes_v1.md`
- 완료 검사: `node .claude/scripts/report-check.mjs <산출물>` → `"ok":true`
- 편집 범위: `.claude/`, `AGENTS.md`, `CLAUDE.md`, `docs/harness/`(모델 표 제외)
- 예상 시간(분): low 20 / likely 30 / high 50 (likely T+685~715)
- 분할선: 에이전트·스킬 문구와 그 밖
- 배정: harness-engineer / 구조 변경 (claude fable/high)

### G2: 커밋 승인 (사용자)
- 의존: T57 — 회고까지 끝난 변경 목록.
- 산출물: 브리프 `## 사용자 결정`의 커밋 승인 원문
- 완료 검사: 창구가 승인 원문을 브리프에 적음 → 날짜와 원문 1줄
- 편집 범위: 없음(창구)
- 예상 시간(분): 미정(0분으로 확정하지 않는다)
- 분할선: 없음
- 배정: 없음(사람 승인)

### T58: 로컬 커밋
- 의존: G2 — 승인 원문.
- 산출물: 로컬 커밋 2개(제품, 하네스)
- 완료 검사: `git status --short` → 남은 것 없음
- 편집 범위: 없음(경로를 지정한 커밋만. 회고가 고친 하네스 파일은 별도 커밋)
- 예상 시간(분): low 5 / likely 10 / high 15 (likely T+715~725)
- 분할선: 없음
- 배정: coordinator / 실행 감독 (claude opus/high) — 코디네이터가 직접

### 임계 경로와 병렬도

- 임계 경로(likely): G1 → C01 → T05 → GX(팀장 기동 → T28 → T29 → T30 → 통합 보고) → T35 → T37 → T41 → QA(팀장 기동 → T44 → 통합 보고) → T49 → T50 → T52 → T54 → T55 → T56 → T57 → G2 → T58. Task 시간 합 675분, 기동 3분과 대기를 넣으면 **725분**(승인 대기 제외). 기한의 기준인 T54(최종 테스트)까지는 590분, 기동과 대기를 넣으면 **631분**.
- 작업 시간 합 ÷ 임계 경로 길이: likely **2460 ÷ 725 = 3.39** (low 1635 ÷ 507 = 3.22, high 3930 ÷ 1140 = 3.45).
- 슬롯 수: **8** (팀장 포함 워커 터미널, 코디네이터 제외).
- 최대 동시 Task 수: **7** (팀장 터미널을 더하면 8). 한 팀 동시 팀원은 4명 이하.
- 필수 줄(T02 → T11 → T13 → T14 → T15)은 그래픽·법무·Blender를 기다리지 않는다. 필수 리뷰까지 끝: low T+165, **likely T+240**, high T+385. 23개 중 가장 먼저 끝난다.
- Task 수: 워커 Task 56개(코디네이터 직접 30개 + 팀장 묶음 4개 안의 26개), 코디네이터가 하는 일 3개(C01, T54, T58), 사람 승인 2개(G1, G2).

## 기한

기준은 결정 3대로 "23개 항목의 최종 테스트(T54) 통과가 2026-11-12 24:00 전"이다. T+0은 계획 승인 시각이고, 승인 대기는 0분으로 확정하지 않았다.

| 시나리오 | 필수 리뷰 끝(T15) | 최종 테스트 끝(T54) | 커밋 끝(T58, 커밋 승인 대기 제외) | 24:00에 들려면 계획 승인이 |
| --- | --- | --- | --- | --- |
| low | T+165 | T+443 | T+507 | 16:37 전 |
| **likely** | **T+240** | **T+631** | T+725 | **13:29 전** |
| high | T+385 | T+996 | T+1140 | 07:24 전(오늘은 불가) |
| likely, 사용자 결정 1을 받을 때 | T+240 | T+603 | T+697 | 13:57 전 |

**판정: likely는 기한을 넘는다.** 이 계획서를 쓰는 지금이 13시 반 무렵이라 승인은 13:29를 넘는다. 승인이 14:00이면 likely로 최종 테스트는 00:31(31분 초과), 14:30이면 01:01(61분 초과)이다. 필수 두 항목은 승인 14:00 기준 likely 18:00, high 20:25에 리뷰까지 끝나 어떤 시나리오에서도 오늘 안이다. 길이를 정하는 것은 Blender MCP 한 대의 캐릭터 줄(T28 → T29 → T30 → T35, 300분)이다.

**캐릭터 4종·닉네임·캐릭터 선택이 더한 값(설계의 흐름 추정 대비, likely):** 캐릭터 줄 +60분(T28 +15, T29 +5, T30 +30, T35 +10)이 그대로 임계 경로에 얹힌다. 멀티(T27) +20, 팀·캐릭터 선택(T19) +10, 티켓 연출(T21) +15는 웹 기능 묶음 안이라 임계 경로 밖이다. 설계 때 없던 것: Task마다 기동 3분(임계 경로 위 약 40분), 팀장 기동·통합 보고(임계 경로 위 약 28분), 회고가 완료 처리 뒤로 감(팀 스킬 순서, 기한 뒤).

**점검(결정 4).** 코디네이터가 19:00과 21:30에 장부의 실제 시각으로 남은 임계 경로를 다시 잰다. 승인 14:00이면 19:00은 T+300, 21:30은 T+450이다. likely대로라면 19:00에는 T35(클립)가 돌고 있고, 21:30에는 끝 QA 묶음이 막 시작했다.

**미루면 무엇이 밀리나(결정 4의 순서, 뒤쪽부터).** 뒤쪽 묶음 대부분이 임계 경로(캐릭터 줄) 밖에 있어, 미뤄도 줄어드는 것은 그 항목의 끝 QA·성능 점검 몫뿐이다(likely 추정).

| 순서(뒤부터) | 미루는 묶음 | 줄어드는 남은 임계 경로 | 이유 |
| --- | --- | --- | --- |
| 10 | BL-0022 설계 문서 | 0분 | T12는 T+96에 이미 끝난다 |
| 9 | BL-0010 멀티 보강 | 0분 | QA X의 16명 시험이 빠져도 끝 QA 길이는 QA C(70분)가 정한다 |
| 8 | BL-0018·BL-0015 관중 | 약 15분 | QA C −10, 성능 점검의 BL-0015 판정 −5 |
| 7 | BL-0012·BL-0013 무대 | 0분 | 끝 QA 길이가 QA B(60분)로 넘어간다 |
| 6 | BL-0011·BL-0014 경기장 수정 | 0분 | T38은 임계 경로 밖 |
| 5 | BL-0004·0005·0006 밤·바다·하늘 쇼 | 0분 | 같은 이유 |
| 4 | BL-0019 좌석 | 약 5분 | T37의 앉기 연결 |
| 3 | BL-0002·0003·0008·0009·0007 캐릭터·티켓 | 약 40분 이상 | 클립 T35·연결 T37이 줄어든다(임계 경로 위) |

- 순서를 그대로 쓰면 승인 14:00의 likely(31분 초과)를 메우려고 10~4번 일곱 묶음(약 20분)을 미루고도 모자라 3번 캐릭터·티켓 묶음까지 미루게 된다. 10~4번 가운데 다섯 묶음은 미뤄도 줄지 않는다. 그래서 적용 방식을 끝의 `## 사용자 결정 필요` 2번으로 올렸다.
- 필수 BL-0016·BL-0020은 어떤 경우에도 미루지 않는다(순서의 1번).

## 설정값과 기본값

값만 바꾸면 되는 것은 설계서 10절의 설정 파일과 추천 기본값이 정본이다(답 반영으로 `screen.json`의 회차, `sky-show.json`의 빛줄기 3개, `crowd.json`의 반대편 관중, `network.json`의 닉네임·회차 고르기, 새 `characters.json`·`ticket.json`이 바뀌거나 생겼다). 이 계획에서 더한 기본값은 아래 둘이다. 사용자가 바꾸라고 하면 값만 바꾼다.

| 값 | 기본값 | 둔 곳 |
| --- | --- | --- |
| 팀장 터미널을 슬롯에 넣는가 | 넣는다(슬롯 8 = 팀장 포함 워커 터미널) | 이 계획 `## 실행 방식` |
| 필수 줄의 몫 | T13·T14가 뜰 때 웹 자리 1개와 슬롯 1개를 비워 둔다 | 이 계획 `## 실행 방식`, WF 팀장 spec |

## 승인 전 점검 (`phase-planning` parallel-rules)

- ✅ 사유 없는 의존이 없다. 모든 `의존` 줄이 앞 Task의 무엇을 읽는지 적는다.
- ✅ 편집 범위가 겹치는 Task가 같은 때에 돌지 않는다. `character.js`는 T11 → T36 → T37, `main.js`는 T11 → T38, 설정 파일은 T11이 만들고 그 모듈의 Task 하나가 고친다. `docs/backlog.md`는 T01이 끝날 때까지 코디네이터가 상태 열을 고치지 않는다.
- ✅ 산출물이 둘 이상인 Task가 없다(설계의 a1을 T03·T04로, vfx를 T33·T34로, wi를 T36~T38로, cr2를 T39~T41로 나눴다).
- ❌ 사슬이 4단을 넘는다. 임계 경로는 17단이다. 캐릭터 줄(시트 → 리뷰 → 모델 → 클립)은 팀 규칙(형태가 정해지는 지점의 아트 리뷰)과 Blender MCP 한 대 때문에 옆으로 펼 수 없다. 대신 웹 연결을 T36(모델)과 T37(클립)로 나눠 T36을 클립과 함께 돌렸다.
- ✅ likely가 6분보다 짧은 같은 역할 Task가 따로 서 있지 않다(가장 짧은 것은 재검 20분).
- ✅ 임계 경로 위의 분할선 있는 Task는 처음부터 나눴다: 설계 wi → T36·T37, cr2 → T39·T40·T41, 끝 QA → 4영역, 끝 수정 → 2영역. T30(120분)은 Blender MCP 한 대라 나눠도 옆으로 돌 수 없어 분할선만 적었다.
- ✅ 끝 검증이 영역별로 나뉘어 있고 횡단 QA(T45)가 하나 있다.
- ✅ 병렬도 수치(3.39, 슬롯 8, 최대 동시 7)가 `## DAG` 절 끝에 있다.

## 사용자 결정 필요

1. **그래픽 제작 묶음(GX)과 끝 QA 묶음(QA)을 팀장 없이 코디네이터가 직접 띄울지.** 규칙("한 팀의 Task가 3개 이상이면 팀장")대로면 두 묶음에 팀장을 둔다. 두 묶음은 임계 경로 위에 있어 팀장 기동과 통합 보고가 likely 28분을 더하고, 묶음이 도는 동안 슬롯 하나씩을 쓴다. 직접 띄우면 최종 테스트가 likely T+631 → T+603(승인 마감 13:29 → 13:57)이 되고, 코디네이터가 띄우고 정산할 Task가 11개 늘어난다. **추천: 이번 phase만 예외로 직접 띄운다.** 법무 앞 검토와 웹 기능 묶음은 임계 경로 밖이라 규칙대로 팀장을 둔다.
2. **19:00·21:30 점검에서 미룰 때, 남은 임계 경로를 줄이지 못하는 묶음을 건너뛸지.** 결정 4는 "뒤쪽부터 미룬다"이다. 뒤쪽 일곱 묶음 가운데 다섯(BL-0022, BL-0010, 무대, 경기장 수정, 밤·바다·하늘 쇼)은 미뤄도 최종 테스트가 당겨지지 않고 항목만 잃는다(`## 기한` 표). **추천: 순서는 그대로 뒤쪽부터 보되, 줄어드는 몫이 0분인 묶음은 미루지 않고 건너뛴다. 미루기 전에 미룰 묶음과 당겨지는 분을 사용자에게 알린다.**
