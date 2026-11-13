# UX·동작·방 수행 계획 (phase 2026-11-13-ux-motion-rooms)

> 실행: Orca

> 문서 종류: 계획 · 작성: planner (Task `task_eeee5a99a68a`, Dispatch `ctx_47b8362280a4`) · 2026-11-13
> 브리프: `_workspace/_run/2026-11-13-ux-motion-rooms/brief.md` · 설계서: `docs/superpowers/specs/2026-11-13-ux-motion-rooms-design.md`(승인: 창구 대행 2026-11-13, 결정 1~18 추천 채택)
> 그림 입력: 같은 폴더의 `dag.json`(Task 스윔레인), `waterfall.json`(예상시간). 둘 다 `tmp/plan-schedule.mjs`가 이 계획의 Task 표에서 만든다(`node _workspace/_run/2026-11-13-ux-motion-rooms/tmp/plan-schedule.mjs --write`).
> 상태: 계획 승인 전. 승인은 창구가 위임으로 대행한다(브리프 위임 2). 커밋하지 않는다. Task마다 커밋 단계를 두지 않는다(워커는 커밋하지 않고, 커밋은 8단계 T57에서 코디네이터가 한 번에 한다).

**Goal:** BL-0025~BL-0032와 BL-0015·BL-0016의 남은 것, 열 항목을 정적 Three.js 앱(`web/`)에서 끝낸다. 막힌 항목(BL-0025)이 있어도 나머지는 끝까지 간다.

**Architecture:** 로직 세 줄(스크린 T10~T12, 방 RM 묶음 T13~T16, 이펙트 T17·T18)은 지금 화면 요소 안에서 먼저 만든다(문구는 임시). 화면은 UX 명세(T05·T06) → UI 토큰·명세(T20~T22) → 아트 대조(T24) → 공용 틀(T27) → 화면 적용 넷(T29~T32) 순서로 모양을 입힌다. 같은 파일을 로직과 화면이 함께 고치는 곳(`screen-video.js`, `multiplayer.js`·`invite.js`)은 로직 → 중간 리뷰(T25·T26) → 화면 적용 차례다. BL-0025(Mixamo, T08 → T19 → T28)는 다른 줄이 그 산출물에 기대지 않는다.

**Tech Stack:** Three.js r170, 유튜브 IFrame Player API, PeerJS(`web/vendor/peerjs.min.js`, PeerJS Cloud), Playwright(개발 의존성만, `npm test`), Blender MCP(T19 하나), Mixamo(사용자 브라우저, T08).

**Spec:** `docs/superpowers/specs/2026-11-13-ux-motion-rooms-design.md`. 수락 기준의 정본은 `docs/backlog.md`의 각 행이며 이 계획에 다시 쓰지 않는다. 설계의 근거(F-1~F-20)와 채택한 결정 1~18은 설계서를 읽는다.

## Global Constraints

모든 Task spec에 이 절이 따라간다.

- 정적 Three.js r170 앱(`web/`) 위에서 만든다. Next.js로 옮기지 않는다.
- 새 웹 런타임 의존성(npm 패키지, CDN 라이브러리)을 더하지 않는다. 방은 지금의 PeerJS만, 이펙트는 Three.js만 쓴다. 여러 사람 방 시험은 git 밖 `_workspace/qa/2026-11-12-webrtc-20-validation/V01/`의 로컬 PeerServer를 `tests/qa-x.spec.mjs`처럼 다시 쓴다(저장소에 패키지를 넣지 않는다).
- 무료만 쓴다. 새 계정, 유료 도구, Higgsfield, Blender MCP `generate_3d`, 유료 이미지 생성, CDN 글꼴을 쓰지 않는다(글꼴은 시스템 글꼴, 필요하면 OFL 파일을 자산으로).
- push, PR, 배포를 하지 않는다. 워커는 커밋하지 않는다. 커밋은 T57이 로컬 브랜치에 한다.
- 사용자 자원과 기존 자산을 덮어쓰거나 옮기지 않는다. `web/assets/characters/fan-anim.glb`는 그대로 두고 새 클립은 `fan-anim-v2.glb`로 낸다. Mixamo 원본 FBX는 git 밖에 둔다(결정 15).
- 바꾸지 않는 약속: `window.arena`의 지금 속성, `window.arena.screen.faces`(읽기 전용, 모양 고정), 위치 메시지 `pose`, `validPose`, `createAvatar`. `## 공용 약속`의 고정 ID 14개는 자리와 모양이 바뀌어도 이름과 뜻을 지킨다(뜻이 바뀌는 `#host-room`·`#join-room`은 T02가 먼저 적는다).
- `web/index.html`의 정적 요소는 T27만 고친다(아키텍처의 "UI 모듈은 index.html을 고치지 않는다"에 대한 이번 phase의 예외, T02가 적는다).
- 같은 때에 두 Task가 같은 파일을 고치지 않는다. 각 Task의 `편집 범위` 밖은 고치지 않는다. 시험 파일도 `## 공용 약속`의 주인 Task만 고친다. 범위 밖 시험이 깨지면 고치지 않고 리포트에 `(참고)`로 적는다.
- Blender MCP는 `_workspace/graphicmodel/blender-lock.json`으로 T19 하나만 쓴다. 브라우저 시험은 `npm test`가 GPU 점유 표시(`_workspace/gpu-lock.json`)를 스스로 잡는다. 시험 밖의 GPU 일(캡처, 재현, 실측)은 `node tests/gpu-lock.mjs acquire <Task ID>`와 `release <Task ID>`로 한 번에 하나씩 잡는다.
- 시험을 먼저 쓰고 실패를 확인한 뒤 구현한다. 완료 검사는 자기 시험 파일만 돌린다(`npm test -- tests/<이름>.spec.mjs`). 전체 시험은 T53 한 번뿐이다.
- 성능 하한: 경기장 FPS 60 이상, 텍스처 메모리 500 MiB 이하(여유 8.5 MiB, F-13). 이펙트 텍스처 합 2 MiB 이하(출발값).
- 워커는 사용자에게 묻지 않고 `orca orchestration ask`로 올린다. 승인이 필요한 명령을 훅이 막으면 우회하지 않고 올린다.

## Review Focus

시험이 놓치기 쉬운데 사용자가 가장 먼저 부딪힐 다섯 가지다. 각 줄의 시험은 그 코드를 가진 Task의 완료 검사에 있다.

1. 방장이 탭을 닫거나(정상 종료) 연결이 끊길 때(비정상 종료), 남은 사람의 영상은 멈추거나 처음으로 돌아가지 않고 "방이 끊겼다" 안내도 없다 → T14 시험(넘기기·혼자 시청에서 `room:left` 없음, 방 키 유지), T12 시험(같은 회차의 `room:joined`에 재생 위치를 옮기지 않음), T41이 두 화면을 이어서 본다.
2. 두 사람이 같은 순간 같은 빈 번호를 잡으면 한 방에 모이고 방이 둘로 갈라지지 않는다. 16명이 찬 방은 다음 번호로 넘어간다 → T13 시험(`unavailable-id` → 손님으로 다시 잇기, `full` → 다음 번호), T15 시험(17번째 사람).
3. 생방송이 꺼져 있거나 재방이 오류 5를 되풀이해도 스크린이 검게 남지 않고, 첫 실패부터 "다시 연결 중", 60초 안에 스크린 그림과 계속 시도 안내가 보이며 자동 재연결이 계속 돈다 → T11 시험, T40.
4. 앉은 직후 아무 키도 누르지 않아도 Full Mode 버튼이 보이고 눌린다. 포인터 잠금 중에는 키 안내로 찾는다 → T31 시험, T34 동행, T43.
5. 원격 아바타가 다시 만들어질 때 마지막 감정표현(계란)이 다시 날아가지 않고, 계란 자국은 1.5초 안에 사라지며 영상은 끊기지 않는다 → T18 시험, T42.

## 실행 방식: 팀장과 직접 기동

`AGENTS.md`의 규모별 경로("한 팀의 Task가 3개 이상이면 팀장")와 `docs/harness/team-org.md`로 정했다. 팀 사이 의존은 팀 Task(등록 단위)끼리만 걸리므로, 한 팀의 일을 다른 팀의 산출물을 기다리는 자리에서 끊어 등록 단위로 나눴다(지난 phase와 같은 읽기). 끊은 단위 안의 Task가 3개 이상이면 팀장, 1~2개면 코디네이터가 직접 띄운다.

| 등록 단위 | 팀 | 담는 Task | 띄우는 쪽 | 팀장 배정 | 끊은 이유 |
| --- | --- | --- | --- | --- | --- |
| RM 방 묶음 | web-metaverse-develop | T13, T14, T15, T16 | 팀장 | `metaverse-develop-leader` / 리드 (claude opus/high) | 넷 모두 T02만 읽고 다른 팀을 기다리지 않는다. 밖에서는 T26·T32·T38이 묶음 전체를 읽는다 |
| QA 끝 QA 묶음 | qa | T40, T41, T42, T43 | 팀장 | `qa-inspector` / 리드 (claude opus/high) | 네 영역이 같은 리뷰 다섯(T25, T26, T35~T37) 뒤에 함께 돈다 |
| 그 밖의 Task | 모두 | T01~T12, T17~T39, T44~T52, T54~T56 | 코디네이터 직접 | — | 단위 안의 Task가 1~2개다. 예: T19는 웹 T03을, T21·T22는 기획 T05·T06을, T27은 그래픽 T24를, T28은 그래픽 T19와 법무 T07을, T31은 검증 T25를, T32는 검증 T26과 법무 T07을 기다린다 |
| C01, T53, T57 | coordinator | 기동, 전체 시험, 커밋 | 코디네이터가 직접 | — | — |

- 팀장 spec의 첫 줄은 `[역할: <에이전트> · 리드]`, 배정 줄은 `배정: <에이전트> / 리드 (claude opus/high)`다. 팀원 배정은 `## DAG`의 줄을 그대로 옮긴다.
- 팀장도 터미널 하나라 슬롯 하나를 쓴다(슬롯 8 = 팀장 포함 워커 터미널 수, 코디네이터 제외). 한 팀의 동시 팀원은 4명 이하이고, 코디네이터가 직접 띄운 같은 팀 Task도 이 4명에 든다.
- **RM 팀장에게 줄 것:** T13과 T14를 함께 띄우고, 둘이 끝나면 T15와 T16을 함께 띄운다. 같은 때 `network.json`은 T14만 고친다(T13은 설정을 인자로 받는다). 통합 보고에 T13~T16이 고친 파일 목록과 T13의 찾기 시간 실측, T14의 R-2 실측을 적는다(T26이 읽는다).
- **QA 팀장에게 줄 것:** 네 영역을 한 번에 띄우고 결함 ID 접두어 `A-`, `B-`, `C-`, `U-`를 배정한다. 대조할 경계면은 각 영역 Task의 `의존`·`경계면` 줄이다. BL-0025가 blocked면 T42에서 Mixamo 클립을 빼고 그 사실을 적는다.
- **비용(참고):** 두 묶음을 팀장 없이 직접 띄우면 likely 끝이 13분(657 → 644), high는 49분 짧다. 거의 모두 QA 묶음 몫이다(RM 묶음은 그 시간대에 웹 팀 4명 상한이 길이를 정해 likely로는 차이가 없다). 규칙대로 팀장을 두고 회고(T55)가 잰다.

### 등록과 기동

- **등록 순서 = 기동 순서.** `launchable`은 준비된 Task를 등록 순서로 고른다. 그래서 남은 임계 경로(likely)가 긴 순으로 등록한다. T01만 4단계라 맨 앞이다: T01, T06, T02, T04, T05, RM, T20, T11, T10, T03, T22, T21, T17, T08, T12, T18, T24, T23, T19, T27, T07, T25, T26, T29, T31, T30, T32, T09, T33, T34, 그 뒤 끝 단계(아래 늦게 등록). 의존은 앞 Task가 먼저 등록되어 있어야 걸리므로 이 순서는 의존 순서와도 맞는다(T09·T33·T34는 의존이 앞에 있어 뒤로 보내도 된다).
- **늦게 등록하는 것.**
  1. T28은 T19가 completed일 때만 등록한다.
  2. BL-0025에 기대는 끝 단계(T35, T38, T39, QA 묶음과 그 뒤의 T44~T48)는 BL-0025 줄이 정산된 뒤 등록한다. T28이 completed면 의존에 T28을 넣고, T08이나 T19가 blocked(실패)로 정산됐으면 T28을 빼고 등록한다. T36·T37은 기동 때 등록해도 된다.
  3. T49~T52는 1회차 재검(T47·T48) 뒤 High가 남을 때만 등록한다.
  4. T54~T56은 T53(코디네이터가 직접) 뒤에 등록한다.
- **`--edits`.** 각 Task `편집 범위`의 제품 파일과 그 Task만 쓰는 폴더만 넘긴다. 팀 리포트 폴더(`_workspace/<팀>/2026-11-13-ux-motion-rooms/`)는 넘기지 않는다. 접두어가 겹쳐 모든 Task가 서로 막힌다.
- **`--resource`.** `blender`: T19. `gpu`: T09, T44(T53은 코디네이터가 `npm test`로 잡는다). 그 밖의 브라우저 시험은 `npm test`가 점유 표시를 잡고 기다리므로 넘기지 않는다(넘기면 네 QA 영역이 한 줄로 선다).
- **중간 판정에서 High.** T24(아트 대조), T25·T26(중간 리뷰)에서 High가 나오면 코디네이터가 그 파일의 원래 담당으로 수정 Task를 띄우고(새 spec, 리포트는 다음 버전), 정산된 뒤 뒤 Task(T27, T31, T32)를 띄운다. 일정에는 넣지 않았다.
- **실패와 재시도.** 실패한 Task는 원인을 새 spec에 적어 1회 다시 띄운다. 두 번째도 실패하면 그 산출물 없이 가고 최종 보고에 누락을 적는다.

### BL-0025가 막힐 때

1. T08은 처음 10분 안에 사용자 브라우저의 로그인된 Mixamo 화면에 닿지 못하면(브라우저를 조작할 수 없음, 로그인 화면, 창 없음) 멈추고 `worker_done --outcome failed`, 제목 `Blocked: <원인>`으로 끝낸다. T19는 Blender MCP가 연결되지 않으면 같은 방식으로 끝낸다. 로그인 정보는 입력하지 않는다.
2. 코디네이터는 `fail --cause "blocked: <원인>"`을 돌리고 백로그 BL-0025의 상태 열을 `blocked`로 둔다. T28을 등록하지 않는다(T08이 막혔으면 T19도 등록된 채 대기로 남으므로 같은 원인으로 `fail`).
3. 끝 단계를 T28 없이 등록한다(위 `늦게 등록하는 것` 2). 다른 줄은 기다리지 않는다. 계산상 likely 끝은 652분으로 늦어지지 않는다(막히지 않을 때 657분).
4. T54(완료 처리)가 막힌 이유를 인박스에 한 줄로 남긴다. 사용자가 돌아와 브라우저나 Blender를 켜면 다음 phase에서 T08부터 다시 한다(대행으로 다시 열지 않는다).

## 공용 약속

Task 사이에서 이름과 모양이 맞아야 하는 것만 적는다. 정본은 T02(아키텍처)와 T03(자산 연동 규약)이고, 아래는 그 출발값이다(설계서 5.2, 5.4, 5.10).

- **고정 ID 14개(`web/index.html`):** `#enter`, `#status`, `#zone`, `#quick`(+`[data-location]`), `#crowd-sound`, `#network`, `#network-status`, `#room-code`, `#host-room`, `#join-room`, `#leave-room`, `#touch`(+`[data-key]`), `#fallback`, `#loading`. 화면 적용 Task는 자기 모듈의 DOM과 스타일만 고치고 T27이 만든 HUD 자리에 붙는다.
- **이벤트(T02가 이름을 확정):** `room:state {key, count, host, phase}`(`phase` = 연결 중·방 안·넘기는 중·혼자), `room:round {roundStart}`, `room:joined {code, host, roundStart}`(`code` 자리에 방 키), `room:left`(사용자가 직접 나갈 때만).
- **방 메시지(T02가 모양을 확정, 받는 쪽은 모양을 검사한 뒤에만 쓴다):** `members`(들어온 순서의 손님 목록, 1초마다), `handoff {to}`, `hello {role: "ops"}`, `info {count, capacity}`, 회차 넘김.
- **방 키:** peer id `barclays-tps-room-<두 자리 번호>`(`01`~`maxRooms`). 방 키는 방에 붙고 방장이 바뀌어도 그대로다. 찾기·자리 잡기는 `web/room-keys.js`(T13)가 맡고, 함수 이름과 인자는 T13 리포트의 `## 넘기는 것`이 정본이다(T15·T16이 그대로 쓴다).
- **화면 API:** `window.arena.screen.faces`는 읽기 전용(T18이 읽는다, T11·T12는 모양을 바꾸지 않는다). `setSource`는 시험 손잡이로 남는다. 편성 상태를 시험이 읽을 손잡이는 T02가 이름을 정하고 T11이 만든다.
- **설정 키:** `screen.json`(편성, 반복 실패 안내와 대기 상한, 거리 음량, 경기장 경계), `network.json`(방 키 접두어, `maxRooms`, 연결 시간 넘김, 넘기기 대기, 운영자 화면 갱신, 나란히 두드리는 수), `characters.json`(클립 파일, 큐 프레임, 이펙트 값). 키 이름은 T02, 값은 `## 설정값과 기본값`.
- **명세 파일:** UX 명세 `docs/live/product/ux/<대상>.md`, UI 화면 명세 `docs/live/graphicmodel/ui/<대상>.md`, 토큰 표 `docs/live/graphicmodel/ui/tokens.md`, 시안 `_workspace/graphicmodel/2026-11-13-ux-motion-rooms/preview/ui/`. 대상 이름: (가) `entry-loading`, `team-select`, `ticket`, `room-invite` / (나) `hud-controls`, `emote-menu`, `seat`, `full-mode`. UX 명세는 모두 `## 5. 상태별 확인 표`로 끝난다(동행과 화면 Task의 완료 검사가 이 표를 쓴다). 토큰의 CSS는 `web/ui/tokens.css`(T27만 고친다. 화면 Task가 없는 토큰이 필요하면 `ask`).
- **자산:** `web/assets/characters/fan-anim-v2.glb` = `fan-anim.glb`와 같은 `FanRig`, 같은 클립 이름 9개(`Idle`, `Walk`, `Run`, `Jump`, `Sit`, `Emote_CheerClap`, `Emote_Heart`, `Emote_Angry`, `Emote_EggThrow`)와 `Prop_Egg`, 같은 예산. 이펙트 연출 명세와 큐 표는 `art/vfx/emotes/spec.md`, `art/vfx/emotes/cues.json`(`vfx-design`의 자리).
- **새 페이지:** 운영자 화면 `web/ops.html`·`web/ops.js`(앱 화면에서 잇지 않는다).
- **시험 파일의 주인(시간 순).** 새 파일: `tests/room-keys.spec.mjs`(T13), `tests/room-handoff.spec.mjs`(T14), `tests/ops.spec.mjs`(T16), `tests/screen-audio.spec.mjs`(T12), `tests/emote-fx.spec.mjs`(T18), `tests/ui-frame.spec.mjs`(T27), `tests/ui-entry.spec.mjs`(T29), `tests/ui-emote-seat.spec.mjs`(T30), `tests/ui-hud.spec.mjs`(T31), `tests/ui-room.spec.mjs`(T32), `tests/qa-screen.spec.mjs`(T40), `tests/qa-room.spec.mjs`(T41), `tests/qa-fx.spec.mjs`(T42), `tests/qa-ui.spec.mjs`(T43). 기존 파일: `screen-video`·`qa-a`·`qa-u`·`qa-u2` T11 → T12 → T31, `full-mode` T12 → T31, `multiplayer`·`qa-x` T15 → T32, `modules` T27 → T32, `character-clips` T18 → T28, `smoke`·`controls`·`stage-players` T27, `loading`·`team-select`·`ticket`·`qa-b` T29, `emote-menu`·`seat`·`qa-u1` T30. 수정 Task(T45·T46, T49·T50)는 결함 ID의 재현 시험이 든 파일을 받는다.

## UX 동행의 자리

화면 개발 Task는 `worker_done` 전에 UX 명세의 `## 5. 상태별 확인 표`를 걷는다(`ux-design`의 UX 동행). 동행은 판정이 아니라 고칠 것을 그 자리에서 넘기는 일이다.

| 화면 Task | 동행 | 걷는 표 | 시점 |
| --- | --- | --- | --- |
| T27 UI 공용 틀 | 개발자가 스스로 걷는다(동행 워커가 아직 없다. 임계 경로 가까이라 기다리지 않는다). T34가 T31 동행 때 그 줄을 다시 걷는다 | `hud-controls.md` 5절의 틀 줄(HUD 자리, 키 안내 자리) | T27 `worker_done` 전 |
| T29 입장·로딩·팀·티켓 | T33 UX 동행 (가) | `entry-loading.md`, `team-select.md`, `ticket.md` 5절 | T29 `worker_done` 전 |
| T32 방 초대 | T33 UX 동행 (가) | `room-invite.md` 5절 | T32 `worker_done` 전 |
| T30 감정표현·좌석 | T34 UX 동행 (나) | `emote-menu.md`, `seat.md` 5절 | T30 `worker_done` 전 |
| T31 HUD·Full Mode | T34 UX 동행 (나) | `hud-controls.md`, `full-mode.md` 5절과 T27 틀 줄 | T31 `worker_done` 전 |

- 코디네이터는 T33·T34를 띄운 뒤 그 Dispatch ID를 맡은 화면 Task의 메모(`spec/<Task ID>.memo.md`)에 적는다. 화면 Task가 늦게 뜨면 띄울 때 spec 메모에 넣는다.
- 개발자는 구현과 자기 시험이 끝나면 `orca orchestration send --to dispatch:<동행 id>`로 알린다. 동행은 그 화면의 표를 위에서부터 걷고 어긋난 줄을 개발자에게 보낸다. 주고받기는 기능 하나에 2회까지, 넘으면 코디네이터에게 `ask`(`team-product` 직접 소통 짝 표).
- 동행 워커가 떠 있지 않으면(슬롯이 없음) 개발자가 같은 표를 스스로 걷고 자기 리포트에 남긴다. 표가 통로다.
- 동행이 둘인 이유: 화면 Task 넷이 25분 안에 몰려 끝난다(likely T+270~295). 한 명이면 걷기가 줄을 서서 마지막 Task가 기다린다. 설계서 R-11의 "한 명"을 대상 묶음 (가)(나)로 나눴다.
- 로직 Task(T11, T12, T13~T16, T18, T28)에는 동행을 두지 않는다. 지금 화면 요소 안에서 임시 문구로 만들고, 사용자가 보는 상태("다시 연결 중", "혼자 시청 중", 이펙트)는 T31·T32의 동행과 끝 QA가 본다.

## DAG

- 시간은 분이다. likely 일정의 T+0 = 계획 승인(창구 대행). 워커 Task마다 기동 3분(하네스 출발값)과 슬롯·팀 상한·자원 대기를 넣은 값이며 `waterfall.json`과 같다.
- 의존은 산출물 의존만 적었다. 팀장 묶음(RM, QA)의 팀원은 묶음의 의존을 함께 받는다.
- 구현 Task의 단계는 같다: ① 완료 검사의 시험을 먼저 쓰고 실패를 확인 ② 구현 ③ 완료 검사 통과 ④ 화면 Task는 UX 동행 ⑤ 리포트(`## 검증`에 검사 줄을 ✅·❌로, 완료 기준 밖은 `(참고)`). 리포트는 `_workspace/<팀>/2026-11-13-ux-motion-rooms/`에 팀 스킬의 이름 규칙으로 쓴다. 정산은 `node .claude/scripts/report-check.mjs <리포트> --expect <산출물>`이다.
- 편집 범위의 시험 파일 목록은 출발값이다. spec을 쓸 때 코디네이터가 Task마다 적은 `grep -rln` 명령으로 다시 확인하고 그 명령도 spec에 적는다(`docs/harness/templates/spec.md`).

### G1: 계획 승인 (창구 대행)
- 항목: 전부
- 의존: 없음
- 산출물: 브리프 `## 사용자 결정`의 대행 원문
- 완료 검사: 창구가 날짜와 원문 1줄을 브리프에 적음
- 편집 범위: 없음(창구)
- 검증 환경값(설정값): 없음
- 예상 시간(분): 미정(0분으로 확정하지 않는다)
- 자원: 없음
- 분할선: 없음
- 배정: 없음(창구 대행, 브리프 위임 2)

### C01: 코디네이터 기동
- 항목: 전부
- 의존: G1 — 승인된 이 계획서와 브리프의 슬롯 수 8을 읽는다.
- 산출물: `_workspace/_run/2026-11-13-ux-motion-rooms/orca-tasks.json`
- 완료 검사: `node .claude/scripts/orca-launch.mjs ready --map _workspace/_run/2026-11-13-ux-motion-rooms/orca-tasks.json` → T01~T10이 준비 상태
- 편집 범위: `_workspace/_run/2026-11-13-ux-motion-rooms/`(spec, 장부, 대응표)
- 검증 환경값(설정값): 없음
- 예상 시간(분): low 10 / likely 15 / high 25 (likely T+0~15)
- 자원: 없음
- 분할선: 없음
- 배정: coordinator / 실행 감독 (claude opus/high) — 창구가 띄운다

### T01: 백로그 연결 (4단계)
- 항목: BL-0015, BL-0016, BL-0025~BL-0032 전부
- 의존: C01 — 등록된 Task ID(`orca-tasks.json`)를 행에 적는다.
- 산출물: `_workspace/product/2026-11-13-ux-motion-rooms/01_product-manager_backlog-link_v1.md`(`Task | 백로그 ID | 새 항목 여부` 표)
- 완료 검사: `node .claude/scripts/report-check.mjs <산출물>` → `"ok":true`, 그리고 `node -e "const t=require('fs').readFileSync('docs/backlog.md','utf8').split('\n');console.log(['15','16','25','26','27','28','29','30','31','32'].filter(n=>t.some(l=>l.startsWith('| BL-00'+n+' ')&&l.includes('2026-11-13-ux-motion-rooms'))).length)"` → `10`
- 편집 범위: `docs/backlog.md`. 채택한 결정으로 바뀐 문장을 함께 고친다: 각 행의 우선순위(결정 1), BL-0016 (2)(5)와 "방을 만드는 사람이 회차를 고르고"(결정 4·9), BL-0026 (2)(결정 4), BL-0027 (3)(결정 6·7), BL-0028(런타임 이펙트, 결정 13), BL-0029(자국 1.5초, 결정 14), BL-0025(원본 git 밖, 결정 15), BL-0032의 `사용자 결정 필요`(결정 8~12), 인박스에서 이번 Task에 붙인 결함(결정 16: B-M-1, B-M-2, T21u → T29, P-L-2 → T30, R-2 → T31, T53 Low → T27, X-L-1 → T14, T41 R-1 → T18, T62 Medium → T11, U-H-10 → T10·T12). 이 Task가 끝날 때까지 코디네이터는 백로그 상태 열을 고치지 않는다(같은 파일).
- 검증 환경값(설정값): 없음
- 예상 시간(분): low 10 / likely 20 / high 30 (likely T+18~38)
- 자원: 없음
- 분할선: 결정 문장 고치기와 Task 연결 표
- 배정: product-manager / 항목화 (claude opus/medium)

### T02: 아키텍처 갱신 (설계 a1 앞쪽)
- 항목: BL-0032, BL-0026, BL-0027, BL-0028, BL-0029, BL-0031
- 의존: C01 — 설계서 5.2·5.4·5.10과 결정 8~12를 문서로 고정한다.
- 산출물: `docs/live/web-metaverse-develop/architecture.md` · 리포트 `_workspace/web-metaverse-develop/2026-11-13-ux-motion-rooms/01_metaverse-develop-leader_architecture_v1.md`
- 완료 검사: `grep -c -E "^## (방 구조|고정 ID와 index.html)" docs/live/web-metaverse-develop/architecture.md` → `2`, `grep -c -E "room:state|room:round" docs/live/web-metaverse-develop/architecture.md` → `1` 이상
- 편집 범위: `docs/live/web-metaverse-develop/architecture.md`, `docs/superpowers/specs/2026-11-12-room-service-design.md`(머리의 상태 줄, R-5, 후보 E를 가리키는 한 절만)
- 적을 것: `## 방 구조`(순번 방 키, 자동 배치 표, 방장 넘기기, 혼자 시청, 영상 끊김 없음, 새 메시지와 모양 검사), `### 이벤트`(위 `## 공용 약속`), `### 화면 API`(`faces` 고정, `setSource` 시험 손잡이, 편성 상태 손잡이), `## 설정 파일`(키 이름, 값은 설계서 10절), `## 고정 ID와 index.html`(14개, T27만 정적 요소를 고치는 예외, `#host-room`·`#join-room`의 새 뜻), `## 파일 소유`(이 계획의 시간 순 차례), 모듈 표의 `room-keys.js`·`ops.html`·`ops.js`.
- 검증 환경값(설정값): 없음
- 예상 시간(분): low 15 / likely 25 / high 40 (likely T+18~43)
- 자원: 없음
- 분할선: 방 구조 절과 그 밖(이벤트·화면 API·설정 키·고정 ID)
- 배정: metaverse-develop-leader / 아키텍처 (claude fable/high)

### T03: 자산 연동 규약 갱신 (설계 a1 뒤쪽)
- 항목: BL-0025, BL-0028, BL-0029
- 의존: C01 — 설계서 5.6·5.7·5.10과 결정 13·15.
- 산출물: `docs/live/web-metaverse-develop/asset-contract.md` · 리포트 `_workspace/web-metaverse-develop/2026-11-13-ux-motion-rooms/01_metaverse-develop-leader_asset-contract_v1.md`
- 완료 검사: `grep -c "fan-anim-v2.glb" docs/live/web-metaverse-develop/asset-contract.md` → `1` 이상, `grep -c "이펙트 런타임" docs/live/web-metaverse-develop/asset-contract.md` → `1` 이상
- 편집 범위: `docs/live/web-metaverse-develop/asset-contract.md`
- 적을 것: `fan-anim-v2.glb`(같은 `FanRig`, 클립 이름 9개, `Prop_Egg`, 예산은 `fan-anim.glb` 줄 그대로: 삼각형 300, 드로 콜 1, 재질 1, 텍스처 0, 뼈 27, 2,048 KB), `fan-anim.glb`는 남긴다, Mixamo 원본 FBX의 자리(git 밖), 클립 표의 이벤트 프레임 열(`egg_release`, `egg_scream`과 이펙트 큐 순간), 이펙트는 자산이 아니라 런타임(텍스처 합 2 MiB 이하 출발값).
- 검증 환경값(설정값): 없음
- 예상 시간(분): low 10 / likely 15 / high 25 (likely T+18~33)
- 자원: 없음
- 분할선: 없음
- 배정: metaverse-develop-leader / 아키텍처 (claude fable/high)

### T04: 아트 디렉션 보강
- 항목: BL-0030, BL-0028, BL-0029
- 의존: C01 — 브리프 결정("화면 UI 전체", "각종 디자인스킬 다 써도돼")과 설계서 F-14.
- 산출물: `docs/live/graphicmodel/art-direction.md` · 리포트 `_workspace/graphicmodel/2026-11-13-ux-motion-rooms/01_graphic-leader_art-direction_v1.md`
- 완료 검사: `grep -c -E "^## (화면 UI|이펙트)" docs/live/graphicmodel/art-direction.md` → `2`
- 편집 범위: `docs/live/graphicmodel/art-direction.md`(새 절 둘만. 기존 절은 바꾸지 않는다)
- 적을 것: 화면 UI의 톤·색(바탕, 판, 글자, 강조색 하나)·글꼴(시스템 글꼴), 이펙트의 톤·색·밝기 위계(밤 경기장, 스크린 위 계란 자국).
- 검증 환경값(설정값): 없음
- 예상 시간(분): low 15 / likely 25 / high 40 (likely T+18~43)
- 자원: 없음
- 분할선: 화면 UI 절과 이펙트 절
- 배정: graphic-leader / 아트 디렉션 (codex gpt-6-astra/medium)

### T05: UX 명세 (가) 입장·로딩, 팀·캐릭터 선택, 티켓, 방 초대
- 항목: BL-0030 (1)과 (2)의 UX 몫, BL-0032(자동 배치·혼자 시청의 안내)
- 의존: C01 — 백로그 행, 브리프 결정, 설계서 5.4·5.8, 지금 앱(읽기만).
- 산출물: `docs/live/product/ux/entry-loading.md`, `team-select.md`, `ticket.md`, `room-invite.md`(대상 묶음 (가)의 명세 넷) · 리포트 `_workspace/product/2026-11-13-ux-motion-rooms/00_ux-designer_ux-spec-a_v1.md`
- 완료 검사: `node -e "const fs=require('fs');console.log(['entry-loading','team-select','ticket','room-invite'].filter(n=>{try{return /^## 5\. 상태별 확인 표/m.test(fs.readFileSync('docs/live/product/ux/'+n+'.md','utf8'))}catch{return false}}).length)"` → `4`, `node .claude/scripts/report-check.mjs <리포트>` → `"ok":true`
- 편집 범위: `docs/live/product/ux/`의 위 네 파일(새)
- 검증 환경값(설정값): 없음
- 예상 시간(분): low 30 / likely 50 / high 85 (likely T+18~68)
- 자원: 브라우저(지금 앱 캡처, GPU 점유 표시)
- 분할선: 대상 단위
- 배정: ux-designer / UX 명세 (claude opus/medium — 표에 줄이 없어 기본 줄, 결정 3)

### T06: UX 명세 (나) HUD·조작 막대, 감정표현 메뉴, 좌석, Full Mode
- 항목: BL-0030 (1)(3)과 (2)의 UX 몫, BL-0026(조작 막대에서 선택 상자가 빠진 뒤의 상태), BL-0028
- 의존: C01 — 백로그 행, 브리프 결정, 설계서 5.5·5.8·F-10(앉은 상태의 Full Mode), 지금 앱(읽기만).
- 산출물: `docs/live/product/ux/hud-controls.md`, `emote-menu.md`, `seat.md`, `full-mode.md` · 리포트 `_workspace/product/2026-11-13-ux-motion-rooms/00_ux-designer_ux-spec-b_v1.md`
- 완료 검사: T05와 같은 명령에 네 이름(`hud-controls`, `emote-menu`, `seat`, `full-mode`) → `4`, 리포트 `report-check` → `"ok":true`
- 편집 범위: `docs/live/product/ux/`의 위 네 파일(새)
- 검증 환경값(설정값): 없음
- 예상 시간(분): low 35 / likely 55 / high 90 (likely T+18~73)
- 자원: 브라우저(지금 앱 캡처, GPU 점유 표시)
- 분할선: 대상 단위
- 배정: ux-designer / UX 명세 (claude opus/medium — 기본 줄, 결정 3)

### T07: 법무 앞 검토
- 항목: BL-0025 (3), BL-0029, BL-0030, BL-0032
- 의존: C01 — 설계서(5.4 자동 연결, 5.6 계란 자국, 5.7 Mixamo, 8절 앞 검토 줄)와 기준 문서 `docs/live/legal-review/legal-baseline.md`.
- 산출물: `_workspace/legal-review/2026-11-13-ux-motion-rooms/03_legal-reviewer_review-front_v1.md`
- 완료 검사: `node .claude/scripts/report-check.mjs <산출물>` → `"ok":true`
- 편집 범위: 리포트만
- 볼 것: Mixamo 이용 조건과 원본 보관(결정 15), 자동 연결로 IP가 나가는 시점과 고지 한 줄(결정 10, F-09·U-12), 계란 자국과 유튜브 가림 조건(YT-05·U-07, 결정 14), 운영자 화면이 담는 정보(U-03), 바뀐 화면에서 지켜야 할 문구 자리. 고지 문구 원문은 `## 넘기는 것`에 적는다(T32가 그대로 쓴다). Mixamo 판정이 통과가 아니면 그렇게 적는다(T28이 클립을 바꾸지 않는다).
- 검증 환경값(설정값): 없음
- 예상 시간(분): low 20 / likely 35 / high 60 (likely T+36~71)
- 자원: 없음
- 분할선: Mixamo와 그 밖
- 배정: legal-reviewer / 법률 검토 (claude fable/high)

### T08: Mixamo 내려받기
- 항목: BL-0025
- 의존: C01 — 브리프 결정 "브라우저로 대신 받기"와 위임 6.
- 산출물: `_workspace/graphicmodel/2026-11-13-ux-motion-rooms/mixamo/`의 FBX(동작 8개까지) · 리포트 `_workspace/graphicmodel/2026-11-13-ux-motion-rooms/04_graphic-character-designer_mixamo-fbx_v1.md`(`## 받은 것` 표)
- 완료 검사: `ls _workspace/graphicmodel/2026-11-13-ux-motion-rooms/mixamo/*.fbx | wc -l` → 리포트 `## 받은 것` 표의 줄 수, `report-check` → `"ok":true`
- 편집 범위: `_workspace/graphicmodel/2026-11-13-ux-motion-rooms/mixamo/`(git 밖)
- 하는 일: 사용자 PC의 로그인된 브라우저 창을 `orca computer`(Claude in Chrome이 켜져 있으면 그것)로 조작해 받는다. 걷기, 달리기, 점프, 앉기, 감정표현 4종(박수 환호, 하트, 화내기, 계란 던지기)에 맞는 동작. FBX, 스킨 없음, 30 fps, 이동 동작은 제자리. 맞는 동작이 없는 감정표현은 지금 클립을 두고 리포트에 적는다. 로그인 정보는 입력하지 않는다. 막히면 `### BL-0025가 막힐 때` 1.
- 검증 환경값(설정값): 없음
- 예상 시간(분): low 15 / likely 30 / high 60 (likely T+18~48). 막히면 10분에 끝난다.
- 자원: 사용자 브라우저(로그인된 Mixamo)
- 분할선: 동작 단위
- 배정: graphic-character-designer / 캐릭터 애니메이션 (codex gpt-6-astra/max)

### T09: 먼 관중 화면 대조
- 항목: BL-0015 (2)
- 의존: C01 — 지금 앱과 `web/config/crowd.json`(읽기만).
- 산출물: `_workspace/graphicmodel/2026-11-13-ux-motion-rooms/07_graphic-leader_art-review-crowd_v1.md`(판정과 캡처 8장의 경로)
- 완료 검사: `report-check` → `"ok":true`, `ls _workspace/graphicmodel/2026-11-13-ux-motion-rooms/preview/crowd/*.png | wc -l` → `8`
- 편집 범위: `_workspace/graphicmodel/2026-11-13-ux-motion-rooms/preview/crowd/`(캡처와 캡처 스크립트). 제품 파일을 고치지 않는다.
- 하는 일: 관람 위치 4곳(1층 좌석 두 곳, 무대 앞, 관중석 진입로)에서 먼 관중 낮은 텍스처를 켠 화면과 끈 화면을 같은 카메라로 찍고 "눈에 띄지 않는다"를 판정한다. 띄면 비율 권고를 적는다(고치는 것은 T45, 텍스처 메모리 여유를 함께 본다).
- 검증 환경값(설정값): `web/config/crowd.json` 먼 관중 낮은 텍스처 = 켬(지금 값, 2층·반대편 128×128) / 끔(캡처 스크립트의 요청 가로채기로만)
- 예상 시간(분): low 15 / likely 25 / high 45 (likely T+41~66)
- 자원: GPU(`--resource gpu`, 캡처 동안 `node tests/gpu-lock.mjs acquire T09` / `release T09`)
- 분할선: 위치 단위
- 배정: graphic-leader / 아트 리뷰 (codex gpt-6-astra/medium)

### T10: U-H-10 원인 가르기 (설계 sv-1의 재현 몫)
- 항목: BL-0016 (1)의 U-H-10
- 의존: C01 — 지금 앱(`web/screen-video.js`, 읽기만)과 U-H-10 기록(`_workspace/qa/2026-11-12-requirements-build/05_qa-inspector_recheck-U3_v1.md`).
- 산출물: `_workspace/web-metaverse-develop/2026-11-13-ux-motion-rooms/03_metaverse-3d-developer_uh10_v1.md`(첫 줄 `판정: 외부 원인`, `판정: 제품 원인`, `판정: 가르지 못함` 중 하나와 회차 표)
- 완료 검사: `report-check` → `"ok":true`, `grep -c -E "^판정: (외부 원인|제품 원인|가르지 못함)" <산출물>` → `1`
- 편집 범위: `_workspace/web-metaverse-develop/2026-11-13-ux-motion-rooms/uh10/`(단독 임베드 페이지와 기록). 제품 파일을 고치지 않는다. 설계서는 `temp/`라고 했으나 브리프 편집 범위 밖이라 웹 팀 작업 폴더에 둔다.
- 하는 일: 같은 재방 영상을 앱과 앱 밖 단독 임베드 페이지에서 각 5회, 회차 사이 간격을 두어 시간대를 나눠 재생하고 오류 5와 미재생 시간을 적는다. 회차마다 GPU 점유 표시를 잡고 놓는다(회차 사이에 다른 Task의 시험이 낀다). 제품 원인이면 고칠 곳을 적어 T12에 넘긴다(결정 5).
- 검증 환경값(설정값): `web/config/screen.json` `vod` = `https://www.youtube.com/watch?v=rQTHR3aL0SE`, `muted` true(지금 값)
- 예상 시간(분): low 30 / likely 50 / high 90 (likely T+18~68)
- 자원: 브라우저(회차마다 GPU 점유 표시)
- 분할선: 앱 쪽과 단독 페이지 쪽
- 배정: metaverse-3d-developer / 3D 런타임 구현 (codex gpt-6-astra/max)

### T11: 스크린 편성 (설계 sv-1)
- 항목: BL-0026, BL-0016 (2)(5)와 U-H-10의 안내·대기 상한, 인박스 T62 Medium(결정 16)
- 의존: T02 — 편성 설정 키 이름, 편성 상태 손잡이, `room:round`(재방이 끝나면 방이 다음 회차로).
- 산출물: `web/screen-video.js` · 리포트 `_workspace/web-metaverse-develop/2026-11-13-ux-motion-rooms/03_metaverse-3d-developer_screen-schedule_v1.md`
- 완료 검사: `npm test -- tests/screen-video.spec.mjs` → 실패 0(선택 상자 없음, 시간표 안·밖, 생방송 실패 때 재방, 첫 실패 "다시 연결 중", 60초 넘으면 스크린 그림과 계속 시도 안내, 재방이 끝나면 다음 회차), `npm test -- tests/qa-a.spec.mjs`, `npm test -- tests/qa-u.spec.mjs`, `npm test -- tests/qa-u2.spec.mjs` → 각각 실패 0
- 편집 범위: `web/screen-video.js`, `web/config/screen.json`, `tests/screen-video.spec.mjs`, `tests/qa-a.spec.mjs`, `tests/qa-u.spec.mjs`, `tests/qa-u2.spec.mjs`(F-17: `grep -rln "arena-screen-controls\|setSource\|영상 선택" tests/`)
- 검증 환경값(설정값): `screen.json` 편성 시간표 = 빈 목록, 시간표 밖 = 재방, 생방송 실패 때 = 재방, 반복 실패 대기 상한 60초, 재시도 간격 상한 30초(지금 값), `roundIntervalMinutes` 10(키 이름은 T02). 시간표 칸은 시험 안에서만 넣는다.
- 예상 시간(분): low 35 / likely 55 / high 100 (likely T+51~106)
- 자원: 브라우저(GPU 점유 표시)
- 분할선: 편성·선택 상자와 반복 실패 안내
- 배정: metaverse-3d-developer / 3D 런타임 구현 (codex gpt-6-astra/max)

### T12: 스크린 소리·방 전환 무중단 (설계 sv-2)
- 항목: BL-0027, BL-0032 (4)(5)의 영상 쪽, BL-0016 U-H-10(T10이 제품 원인이면 그 수정)
- 의존: T11 — 같은 파일(`screen-video.js`)의 편성 코드 위에 짓는다. T10 — 판정과 고칠 곳. T02 — `room:state`·`room:round`·`room:left`의 새 뜻.
- 산출물: `web/screen-video.js` · 리포트 `_workspace/web-metaverse-develop/2026-11-13-ux-motion-rooms/03_metaverse-3d-developer_screen-audio_v1.md`
- 완료 검사: `npm test -- tests/screen-audio.spec.mjs` → 실패 0(경기장 안 등진 위치에서 재생과 소리, 거리 음량, 앉음·Full Mode는 설정 음량, 경기장 밖은 보일 때만, 같은 회차의 `room:joined`·넘기기·혼자 시청에서 재생 위치를 옮기지 않음, 재생을 시작한 뒤 10분 되감기 없음), `npm test -- tests/screen-video.spec.mjs`, `npm test -- tests/qa-u.spec.mjs`, `npm test -- tests/full-mode.spec.mjs` → 각각 실패 0
- 편집 범위: `web/screen-video.js`, `web/config/screen.json`, `tests/screen-audio.spec.mjs`(새), `tests/screen-video.spec.mjs`, `tests/qa-a.spec.mjs`, `tests/qa-u.spec.mjs`, `tests/qa-u2.spec.mjs`, `tests/full-mode.spec.mjs`
- 검증 환경값(설정값): `screen.json` 거리 음량 = 스크린 중심 25 m 안 100%, 90 m에서 40%까지 직선, 앉음·Full Mode 100%, 경기장 경계 = `screen-video.js:277`의 지금 숫자를 설정으로 옮긴 값, `volume` 70, `muted` true와 `unmuteOnEnter` true, `crowdVolume` 0.3(바꾸지 않음, 결정 18), `syncToleranceSeconds` 2. T31이 같은 값으로 음량 막대를 시험한다.
- 예상 시간(분): low 40 / likely 60 / high 110 (likely T+109~169)
- 자원: 브라우저(GPU 점유 표시)
- 분할선: 거리 음량과 방 전환 무중단
- 배정: metaverse-3d-developer / 3D 런타임 구현 (codex gpt-6-astra/max)

### RM: 방 묶음 (팀장)
- 항목: BL-0032 (1)~(6)
- 의존: T02 — `## 방 구조`(팀원 넷이 모두 읽는다).
- 산출물: `_workspace/web-metaverse-develop/2026-11-13-ux-motion-rooms/00_metaverse-develop-leader_lead-room_v1.md`(통합 보고: 고친 파일 목록, T13 찾기 시간, T14 R-2 실측)
- 완료 검사: `report-check` → `"ok":true`, 팀원 T13~T16이 모두 정산됨
- 편집 범위: 팀원 spec(`_workspace/web-metaverse-develop/2026-11-13-ux-motion-rooms/spec/`)과 통합 보고
- 검증 환경값(설정값): 팀원 spec에 아래 `network.json` 값을 그대로 옮긴다
- 예상 시간(분): 팀장 기동 low 5 / likely 5 / high 10, 통합 보고 low 5 / likely 5 / high 10 (묶음 likely T+46~202)
- 자원: 슬롯 하나(팀장 터미널)
- 분할선: 팀원 단위
- 배정: metaverse-develop-leader / 리드 (claude opus/high)

### T13: 순번 방 키 찾기·자리 잡기 (RM)
- 항목: BL-0032 (1)(2)(6)
- 의존: RM — 팀장이 띄운다. T02 — 방 키 형식, 자동 배치 표(받은 것 → 하는 일), 설정 키 이름.
- 산출물: `web/room-keys.js` · 리포트 `_workspace/web-metaverse-develop/2026-11-13-ux-motion-rooms/04_metaverse-web-developer_room-keys_v1.md`(`## 넘기는 것`: 함수 이름과 인자, 찾기 시간 실측)
- 완료 검사: `npm test -- tests/room-keys.spec.mjs` → 실패 0(가짜 Peer로: 받아 줌 → 들어감, `full` → 다음 번호, `peer-unavailable` → 그 번호를 잡고 방장, `unavailable-id` → 손님으로 다시 잇기, 시간 넘김 → 다음 번호, `maxRooms`를 넘지 않음)
- 편집 범위: `web/room-keys.js`(새), `tests/room-keys.spec.mjs`(새)
- 검증 환경값(설정값): 방 키 접두어 `barclays-tps-room-`, 두 자리 번호, `maxRooms` 50, 방 하나 연결 시간 넘김 8초, 나란히 두드리는 수 1(출발값. 찾기 시간을 재고 권고 값을 리포트에 적으면 T15가 넣는다). 모듈은 이 값을 인자로 받는다(같은 때 `network.json`은 T14가 고친다).
- 예상 시간(분): low 35 / likely 55 / high 100 (likely T+71~126)
- 자원: 브라우저(GPU 점유 표시)
- 분할선: 찾기 순서와 자리 잡기 경쟁
- 배정: metaverse-web-developer / UI·기능 구현 (claude opus/medium)

### T14: 방장 넘기기·혼자 시청 (RM)
- 항목: BL-0032 (3)의 방장 쪽 응답, (4), (5), 인박스 X-L-1(결정 16)
- 의존: RM — 팀장이 띄운다. T02 — 새 메시지(`members`, `handoff`, `hello`, `info`)와 모양 검사, `room:state`, `room:left`의 새 뜻.
- 산출물: `web/multiplayer.js` · 리포트 `_workspace/web-metaverse-develop/2026-11-13-ux-motion-rooms/04_metaverse-web-developer_room-handoff_v1.md`(R-2 실측 포함)
- 완료 검사: `npm test -- tests/room-handoff.spec.mjs` → 실패 0(로컬 PeerServer로: 방장 탭 닫기(`pagehide`)와 끊김 둘 다에서 목록 첫 사람이 방장이 되고 남은 사람이 다시 이어짐, 새 방장이 방 키 peer id를 다시 잡음, 응답 없는 새 방장은 다음 사람으로, 혼자 남아도 `room:left` 없이 혼자 시청, 운영자 `hello`에 `info {count, capacity}`만 주고 손님으로 세지 않음, 모양이 틀린 메시지와 null 데이터를 버림)
- 편집 범위: `web/multiplayer.js`, `web/config/network.json`(새 키를 더하기만), `tests/room-handoff.spec.mjs`(새)
- 검증 환경값(설정값): `network.json` `capacity` 16(그대로), 이 Task가 넣는 키 = 방 키 접두어 `barclays-tps-room-`, `maxRooms` 50, 연결 시간 넘김 8초, 넘기기 새 방장 응답 대기 10초, 운영자 화면 갱신 30초, 나란히 두드리는 수 1(키 이름은 T02). 시험은 앱의 PeerJS Cloud 설정을 건드리지 않고 로컬 PeerServer를 쓴다. PeerJS Cloud가 끊긴 id를 쥐는 시간(R-2)은 PeerJS Cloud에 몇 번 이어 재고 리포트에 적는다.
- 예상 시간(분): low 45 / likely 75 / high 130 (likely T+69~144)
- 자원: 브라우저 여러 개(GPU 점유 표시)
- 분할선: 넘기기와 혼자 시청·운영자 응답(같은 파일이라 처음부터 나누지 않는다)
- 배정: metaverse-web-developer / UI·기능 구현 (claude opus/medium)

### T15: 자동 배치 잇기·초대 정리 (RM)
- 항목: BL-0032 (1)(2)(6), 결정 9·10·11
- 의존: RM — 팀장이 띄운다. T13 — `room-keys.js`의 함수와 인자(T13 리포트 `## 넘기는 것`)와 나란히 두드리는 수의 권고. T14 — 넘기기·혼자 시청을 담은 `multiplayer.js`.
- 산출물: `web/multiplayer.js` · 리포트 `_workspace/web-metaverse-develop/2026-11-13-ux-motion-rooms/04_metaverse-web-developer_room-join_v1.md`
- 완료 검사: `npm test -- tests/multiplayer.spec.mjs` → 실패 0, `npm test -- tests/qa-x.spec.mjs` → 실패 0(입장 버튼 뒤에만 자동 배치, 17번째 사람은 다음 번호의 방, 초대 링크의 방 키로 들어감, 가득 찬 방 키는 안내)
- 편집 범위: `web/multiplayer.js`, `web/ui/invite.js`, `web/config/network.json`(나란히 두드리는 수의 값만), `tests/multiplayer.spec.mjs`, `tests/qa-x.spec.mjs`
- 하는 일: 입장 버튼(`#enter`) 뒤에 `room-keys.js`로 자동 배치, 16자리 무작위 코드 방을 없앰, 회차 고르기 상자를 `invite.js`에서 없애고 `roundOffsets`를 읽지 않게 함(키 삭제와 `tests/modules.spec.mjs:66`은 T32), 초대 링크와 방 키 입력은 순번 키로. 문구는 임시(모양은 T32).
- 검증 환경값(설정값): T14와 같은 `network.json` 값, 자동 배치 시작 = 입장 버튼 뒤
- 예상 시간(분): low 30 / likely 50 / high 90 (likely T+147~197)
- 자원: 브라우저 여러 개(GPU 점유 표시)
- 분할선: 자동 배치와 초대 정리
- 배정: metaverse-web-developer / UI·기능 구현 (claude opus/medium)

### T16: 운영자 화면 (RM)
- 항목: BL-0032 (3)
- 의존: RM — 팀장이 띄운다. T13 — 번호 두드리기 함수. T14 — 방장의 `info` 응답.
- 산출물: `web/ops.html` · 리포트 `_workspace/web-metaverse-develop/2026-11-13-ux-motion-rooms/04_metaverse-web-developer_ops-page_v1.md`
- 완료 검사: `npm test -- tests/ops.spec.mjs` → 실패 0(방 둘을 만든 로컬 PeerServer에서 키 목록 둘과 개수 2, 사람 정보 없음, 갱신 간격)
- 편집 범위: `web/ops.html`(새), `web/ops.js`(새), `tests/ops.spec.mjs`(새)
- 검증 환경값(설정값): T14와 같은 `network.json` 값(운영자 화면 갱신 30초, `maxRooms` 50). 시험에서는 갱신 간격을 시험 안에서만 줄인다.
- 예상 시간(분): low 25 / likely 40 / high 70 (likely T+147~187)
- 자원: 브라우저 여러 개(GPU 점유 표시)
- 분할선: 없음
- 배정: metaverse-web-developer / UI·기능 구현 (claude opus/medium)

### T17: 이펙트 연출 명세·큐 표 (설계 vfxs)
- 항목: BL-0028 (1), BL-0029 (1)
- 의존: T04 — `## 이펙트` 톤·색. T03 — 클립 표의 이벤트 프레임 열과 이펙트 예산. T02 — `window.arena.screen.faces`(계란 목표)와 감정표현 동기화(`emoteSeq`).
- 산출물: `art/vfx/emotes/spec.md`와 같은 폴더의 `cues.json` · 리포트 `_workspace/graphicmodel/2026-11-13-ux-motion-rooms/05_graphic-effect-vfx-designer_vfx-emotes_v1.md`(`## 효과` 표)
- 완료 검사: `node -e "const s=JSON.stringify(require('./art/vfx/emotes/cues.json'));console.log(['cheer_clap','heart','angry','egg_throw'].filter(i=>s.includes(i)).length)"` → `4`, `report-check` → `"ok":true`
- 편집 범위: `art/vfx/emotes/`(새 폴더). Blender를 쓰지 않는다(결정 13).
- 적을 것: 감정표현마다 예고·타격·여운, 큐는 지금 클립(`fan-anim.glb`, 지난 phase T35 표)의 이름 붙은 프레임에서 계산, 계란은 놓는 프레임 → 비행 → 면에 맞음 → 껍데기 조각과 노른자 자국 → 사라짐, 입자 수 상한·크기·지속 시간을 이름 붙은 값으로, `## 구현 사양`(재질 구성, 섞는 방식, 텍스처).
- 검증 환경값(설정값): 출발값 = 계란 비행 1.2초, 자국 1.5초 안에 사라짐, 이펙트 텍스처 합 2 MiB 이하
- 예상 시간(분): low 20 / likely 35 / high 60 (likely T+71~106)
- 자원: 없음
- 분할선: 감정표현 셋과 계란
- 배정: graphic-effect-vfx-designer / 이펙트 제작 (codex gpt-6-astra/max)

### T18: 이펙트·계란 명중 런타임 (설계 fx)
- 항목: BL-0028 (1)(2), BL-0029 (1)(2)(3), 인박스 T41 R-1(결정 16)
- 의존: T17 — `spec.md`와 `cues.json`. T02 — `faces` 약속과 감정표현 동기화.
- 산출물: `web/character.js` · 리포트 `_workspace/web-metaverse-develop/2026-11-13-ux-motion-rooms/03_metaverse-3d-developer_emote-fx_v1.md`
- 완료 검사: `npm test -- tests/emote-fx.spec.mjs` → 실패 0(큐 프레임에 이펙트가 시작, 원격 아바타에서도, 계란이 던진 사람 쪽 스크린 면의 한 점에 맞고 자국이 1.5초 안에 사라짐, 플레이어 DOM 그대로, 원격 아바타를 다시 만들어도 마지막 감정표현을 다시 재생하지 않음), `npm test -- tests/character-clips.spec.mjs`, `npm test -- tests/qa-p.spec.mjs`(텍스처 메모리 500 MiB 이하), `npm test -- tests/perf-fps.spec.mjs` → 각각 실패 0
- 편집 범위: `web/character.js`, `web/config/characters.json`, `tests/emote-fx.spec.mjs`(새), `tests/character-clips.spec.mjs`
- 하는 일: Three.js만으로(입자, canvas 텍스처) 그린다. 클립 파일 경로와 큐 프레임(F-11의 숫자)과 이펙트 값을 `characters.json`으로 옮긴다(T28은 값만 바꾼다). `screen-video.js`는 고치지 않는다. `qa-b.spec.mjs`의 계란 줄이 깨지면 리포트에 적어 T29에 넘긴다.
- 검증 환경값(설정값): `characters.json` 클립 파일 `./assets/characters/fan-anim.glb`, 큐 프레임 = 지난 phase T35 값(`egg_release` 34/30, `egg_scream` 40/30), 계란 비행 1.2초, 자국 1.5초, 목표 면 = 던진 사람을 가장 바로 보는 면, 입자 수 상한(T17 값), 이펙트 텍스처 합 2 MiB 이하
- 예상 시간(분): low 60 / likely 100 / high 180 (likely T+109~209)
- 자원: 브라우저(GPU 점유 표시)
- 분할선: 감정표현 이펙트와 계란 명중
- 배정: metaverse-3d-developer / 3D 런타임 구현 (codex gpt-6-astra/max)

### T19: Mixamo 리타깃 (설계 rt)
- 항목: BL-0025 (1)
- 의존: T08 — FBX. T03 — `fan-anim-v2.glb` 규약(클립 이름, 예산, 이벤트 프레임 열).
- 산출물: `web/assets/characters/fan-anim-v2.glb` · 리포트 `_workspace/graphicmodel/2026-11-13-ux-motion-rooms/04_graphic-character-designer_clips-fan-v2_v1.md`(`## 클립` 표: 클립 | 프레임 범위 | 길이 | 재생 | 이벤트 프레임)
- 완료 검사: `node .claude/skills/blender-pipeline/scripts/glb-inspect.mjs web/assets/characters/fan-anim-v2.glb --names --max-tris 300 --max-draws 1 --max-materials 1 --max-textures 0 --max-joints 27 --max-kb 2048` → 종료 코드 0, 클립 9개 이름과 `Prop_Egg`가 찍힘
- 편집 범위: `web/assets/characters/fan-anim-v2.glb`(새), `art/characters/fan/fan-anim-v2.blend`(새. 가져온 Mixamo 뼈대는 굽고 나서 지운다). `fan-anim.glb`와 지금 `.blend`는 고치지 않는다.
- 하는 일: FBX를 `FanRig`(A 자세)에 굽는다. 제자리, `root` 키 없음, `Jump`는 몸을 띄우지 않음, `Sit`은 앉은 자세에서 멈춤, 30 fps. `Emote_EggThrow`의 `egg_release`·`egg_scream`과 T17 큐 순간의 프레임을 `## 클립` 표에 적는다. 맞는 Mixamo 동작이 없는 클립(`Idle` 포함)은 지금 클립을 옮겨 넣는다. `Prop_Egg`는 지금 파일에서 옮긴다. Blender MCP가 연결되지 않으면 `### BL-0025가 막힐 때` 1.
- 검증 환경값(설정값): 없음
- 예상 시간(분): low 45 / likely 90 / high 180 (likely T+74~164)
- 자원: Blender MCP(`--resource blender`, `_workspace/graphicmodel/blender-lock.json`)
- 분할선: 이동 클립(걷기·달리기·점프·앉기)과 감정표현 넷
- 배정: graphic-character-designer / 캐릭터 애니메이션 (codex gpt-6-astra/max)

### T20: UI 토큰 표 (설계 ui의 토큰 몫)
- 항목: BL-0030 (2)
- 의존: T04 — `## 화면 UI` 톤·색·글꼴.
- 산출물: `docs/live/graphicmodel/ui/tokens.md` · 리포트 `_workspace/graphicmodel/2026-11-13-ux-motion-rooms/11_ui-designer_ui-tokens_v1.md`
- 완료 검사: `node -e "const r=require('fs').readFileSync('docs/live/graphicmodel/ui/tokens.md','utf8').split('\n').filter(l=>/^\| \x60/.test(l));console.log(r.length>0&&r.every(l=>l.split('|')[4].trim()!==''))"` → `true`(모든 토큰 줄의 근원 칸이 차 있음)
- 편집 범위: `docs/live/graphicmodel/ui/tokens.md`(새)
- 검증 환경값(설정값): 없음
- 예상 시간(분): low 15 / likely 25 / high 40 (likely T+46~71)
- 자원: 없음
- 분할선: 없음
- 배정: ui-designer / UI 명세 (claude opus/medium — 기본 줄, 결정 3)

### T21: UI 명세 (가) (설계 ui의 배치·시안 몫)
- 항목: BL-0030 (2)
- 의존: T05 — UX 명세 넷(상태별 조작과 문자열). T20 — 토큰 이름.
- 산출물: `docs/live/graphicmodel/ui/entry-loading.md`, `team-select.md`, `ticket.md`, `room-invite.md` · 리포트 `_workspace/graphicmodel/2026-11-13-ux-motion-rooms/11_ui-designer_ui-spec-a_v1.md`(`## 넘기는 것`: 화면 명세·토큰·시안 경로, 새 모듈·이벤트·정적 요소 요구)
- 완료 검사: `node -e "const fs=require('fs');console.log(['entry-loading','team-select','ticket','room-invite'].filter(n=>{try{const t=fs.readFileSync('docs/live/graphicmodel/ui/'+n+'.md','utf8');return /^## 상태별 배치/m.test(t)&&/^## 시안/m.test(t)}catch{return false}}).length)"` → `4`
- 편집 범위: `docs/live/graphicmodel/ui/`의 위 네 파일(새), 시안 `_workspace/graphicmodel/2026-11-13-ux-motion-rooms/preview/ui/a/`
- 하는 일: 시안은 실제 3D 장면 캡처 위에(밝음, 어두움, 영상 재생). 디자인 스킬은 비용·새 계정·새 런타임 라이브러리가 없는 것만 쓴다.
- 검증 환경값(설정값): 없음
- 예상 시간(분): low 30 / likely 45 / high 75 (likely T+74~119)
- 자원: 브라우저(시안 캡처, GPU 점유 표시)
- 분할선: 대상 단위
- 배정: ui-designer / UI 명세 (claude opus/medium)

### T22: UI 명세 (나)
- 항목: BL-0030 (2)(3)
- 의존: T06 — UX 명세 넷. T20 — 토큰 이름.
- 산출물: `docs/live/graphicmodel/ui/hud-controls.md`, `emote-menu.md`, `seat.md`, `full-mode.md` · 리포트 `_workspace/graphicmodel/2026-11-13-ux-motion-rooms/11_ui-designer_ui-spec-b_v1.md`
- 완료 검사: T21과 같은 명령에 네 이름(`hud-controls`, `emote-menu`, `seat`, `full-mode`) → `4`
- 편집 범위: `docs/live/graphicmodel/ui/`의 위 네 파일(새), 시안 `_workspace/graphicmodel/2026-11-13-ux-motion-rooms/preview/ui/b/`
- 검증 환경값(설정값): 없음
- 예상 시간(분): low 30 / likely 50 / high 80 (likely T+76~126)
- 자원: 브라우저(시안 캡처, GPU 점유 표시)
- 분할선: 대상 단위
- 배정: ui-designer / UI 명세 (claude opus/medium)

### T23: 아키텍처 보강 (UI 명세 반영)
- 항목: BL-0031
- 의존: T02 — 보강할 문서. T21, T22 — 리포트 `## 넘기는 것`의 새 모듈·이벤트·정적 요소 요구(설계서 5.2).
- 산출물: `docs/live/web-metaverse-develop/architecture.md` · 리포트 `_workspace/web-metaverse-develop/2026-11-13-ux-motion-rooms/01_metaverse-develop-leader_architecture_v2.md`(요구가 없으면 "변경 없음")
- 완료 검사: `report-check` → `"ok":true`
- 편집 범위: `docs/live/web-metaverse-develop/architecture.md`
- 검증 환경값(설정값): 없음
- 예상 시간(분): low 5 / likely 10 / high 20 (likely T+129~139)
- 자원: 없음
- 분할선: 없음
- 배정: metaverse-develop-leader / 아키텍처 (claude fable/high)

### T24: 아트 대조: UI (설계 aru)
- 항목: BL-0030 (2)
- 의존: T20, T21, T22 — 토큰 표, 화면 명세 여덟, 시안. T04 — 대조의 기준인 `## 화면 UI` 절.
- 산출물: `_workspace/graphicmodel/2026-11-13-ux-motion-rooms/07_graphic-leader_art-review-ui_v1.md`
- 완료 검사: `report-check` → `"ok":true`. High 0이면 승인. High면 `### 등록과 기동`의 중간 판정대로 T27 전에 고친다.
- 편집 범위: 리포트만
- 검증 환경값(설정값): 없음
- 예상 시간(분): low 10 / likely 15 / high 25 (likely T+129~144)
- 자원: 없음
- 분할선: 없음
- 배정: graphic-leader / 아트 리뷰 (codex gpt-6-astra/medium)

### T25: 중간 리뷰: 스크린 (설계 crsv)
- 항목: BL-0026, BL-0027, BL-0016
- 의존: T11, T12 — `screen-video.js`·`screen.json`의 변경과 시험.
- 산출물: `_workspace/qa/2026-11-13-ux-motion-rooms/01_code-reviewer_review-screen_v1.md`
- 완료 검사: `report-check` → `"ok":true`. High 0이면 승인. High면 수정이 정산된 뒤 T31을 띄운다.
- 편집 범위: 리포트만
- 검증 환경값(설정값): 없음
- 예상 시간(분): low 15 / likely 25 / high 40 (likely T+172~197)
- 자원: 없음
- 분할선: 없음
- 배정: code-reviewer / 일반 변경 리뷰 (claude opus/medium)

### T26: 중간 리뷰: 방 (설계 crmp)
- 항목: BL-0032
- 의존: RM — T13~T16의 변경(통합 보고의 파일 목록).
- 산출물: `_workspace/qa/2026-11-13-ux-motion-rooms/01_code-reviewer_review-room_v1.md`
- 완료 검사: `report-check` → `"ok":true`. High면 수정이 정산된 뒤 T32를 띄운다.
- 편집 범위: 리포트만
- 볼 것: 자리 잡기 경쟁, 넘기기 타이밍, 남이 보낸 메시지의 모양 검사와 null 데이터, 운영자 화면이 사람 정보를 담지 않음, 입장 전에 연결하지 않음
- 검증 환경값(설정값): 없음
- 예상 시간(분): low 15 / likely 25 / high 40 (likely T+205~230)
- 자원: 없음
- 분할선: 없음
- 배정: code-reviewer / 보안·돈이 걸린 변경 리뷰 (claude opus/high) — 다른 사람이 보낸 데이터를 받는 코드다

### T27: UI 공용 틀 (설계 uif)
- 항목: BL-0031 (2), 인박스 T53 Low(결정 16)
- 의존: T24 — 승인 판정. T21, T22 — 정적 요소의 상태별 배치. T20 — 토큰. T23 — 모듈 자리와 고정 ID 보강.
- 산출물: `web/index.html` · 리포트 `_workspace/web-metaverse-develop/2026-11-13-ux-motion-rooms/04_metaverse-web-developer_ui-frame_v1.md`(틀 줄의 자기 걷기 포함)
- 완료 검사: `npm test -- tests/ui-frame.spec.mjs` → 실패 0(고정 ID 14개, `tokens.css` 변수, HUD 자리), `npm test -- tests/smoke.spec.mjs`, `npm test -- tests/controls.spec.mjs`, `npm test -- tests/stage-players.spec.mjs`, `npm test -- tests/modules.spec.mjs` → 각각 실패 0, `node -e "const h=require('fs').readFileSync('web/index.html','utf8');console.log(['enter','status','zone','quick','crowd-sound','network','network-status','room-code','host-room','join-room','leave-room','touch','fallback','loading'].filter(i=>h.includes('id=\"'+i+'\"')).length)"` → `14`
- 편집 범위: `web/index.html`, `web/ui/tokens.css`(새), `web/main.js`(화면 글자만), `web/modules.js`(T23이 적은 빈 자리만), `web/input.js`·`web/config/controls.json`(UX 명세가 새 키를 요구할 때만), `tests/ui-frame.spec.mjs`(새), `tests/smoke.spec.mjs`, `tests/controls.spec.mjs`, `tests/stage-players.spec.mjs`, `tests/modules.spec.mjs`
- UX 동행: 개발자가 `hud-controls.md` 5절의 틀 줄을 스스로 걷고 리포트에 남긴다. T34가 T31 동행 때 다시 걷는다.
- 검증 환경값(설정값): 없음(`tokens.css`의 값은 `tokens.md` 그대로)
- 예상 시간(분): low 30 / likely 45 / high 75 (likely T+172~217; 웹 팀 4명 상한으로 23분 기다린 뒤)
- 자원: 브라우저(GPU 점유 표시)
- 분할선: 정적 요소와 토큰 CSS
- 배정: metaverse-web-developer / UI·기능 구현 (claude opus/medium)

### T28: Mixamo 클립 연결·전후 화면 (설계 b25i)
- 항목: BL-0025 (1)(2)(3)
- 의존: T19 — `fan-anim-v2.glb`와 `## 클립` 표의 프레임. T07 — Mixamo 조건 판정(통과가 아니면 클립을 바꾸지 않고 blocked로 보고한다). T18 — `characters.json`의 클립 경로·큐 프레임 키.
- 산출물: `web/config/characters.json` · 리포트 `_workspace/web-metaverse-develop/2026-11-13-ux-motion-rooms/03_metaverse-3d-developer_mixamo-clips_v1.md`(전·후 캡처 표)
- 완료 검사: `npm test -- tests/character-clips.spec.mjs` → 실패 0(새 클립의 앉기·점프 자세, 큐 프레임), `ls _workspace/web-metaverse-develop/2026-11-13-ux-motion-rooms/b25i/*.png | wc -l` → 리포트 전·후 표의 장수(같은 시점의 짝)
- 편집 범위: `web/config/characters.json`(값만), `web/character.js`(클립에 딸린 앉기 보정 줄 `:133`만, 새 클립이 요구할 때), `tests/character-clips.spec.mjs`, 캡처 `_workspace/web-metaverse-develop/2026-11-13-ux-motion-rooms/b25i/`
- 등록: T19가 completed일 때만(`### 등록과 기동`).
- 검증 환경값(설정값): `characters.json` 클립 파일 `./assets/characters/fan-anim-v2.glb`, 큐 프레임 = T19 `## 클립` 표 값. 바꾼 경로는 리포트 `## 넘기는 것`에 적는다(같은 때 T29가 `qa-b.spec.mjs`의 B-M-2 차단 주소를 설정에서 읽는다).
- 예상 시간(분): low 20 / likely 35 / high 60 (likely T+212~247)
- 자원: 브라우저(GPU 점유 표시)
- 분할선: 없음
- 배정: metaverse-3d-developer / 3D 런타임 구현 (codex gpt-6-astra/max)

### T29: 적용: 입장·로딩·팀·티켓 (설계 ui1)
- 항목: BL-0031 (1)(2)(4), BL-0030 (1)의 (가) 줄, 인박스 B-M-1·B-M-2·T21u(결정 16)
- 의존: T27 — 틀(HUD 자리, `tokens.css`). T21 — 화면 명세 (가)와 시안. T05 — 상태별 확인 표.
- 산출물: `web/ui/loading.js`, `web/ui/team-select.js`, `web/ui/ticket.js`(대상 셋) · 리포트 `_workspace/web-metaverse-develop/2026-11-13-ux-motion-rooms/04_metaverse-web-developer_ui-entry_v1.md`
- 완료 검사: `npm test -- tests/ui-entry.spec.mjs`(확인 표의 줄) → 실패 0, `npm test -- tests/loading.spec.mjs`, `npm test -- tests/team-select.spec.mjs`, `npm test -- tests/ticket.spec.mjs`, `npm test -- tests/qa-b.spec.mjs` → 각각 실패 0
- 편집 범위: `web/ui/loading.js`, `web/ui/team-select.js`, `web/ui/ticket.js`, `tests/ui-entry.spec.mjs`(새), `tests/loading.spec.mjs`, `tests/team-select.spec.mjs`, `tests/ticket.spec.mjs`, `tests/qa-b.spec.mjs`(T18이 넘긴 계란 줄 포함)
- UX 동행: T33이 `entry-loading`·`team-select`·`ticket` 5절을 걷는다(`worker_done` 전).
- 검증 환경값(설정값): B-M-2 시험은 클립 파일 경로를 `characters.json`에서 읽는다(같은 때 T28이 `fan-anim.glb` → `fan-anim-v2.glb`로 바꿀 수 있다).
- 예상 시간(분): low 45 / likely 70 / high 120 (likely T+220~290, 동행 포함)
- 자원: 브라우저(GPU 점유 표시)
- 분할선: 입장·로딩과 팀·티켓
- 배정: metaverse-web-developer / UI·기능 구현 (claude opus/medium)

### T30: 적용: 감정표현·좌석 (설계 ui2)
- 항목: BL-0031 (1)(2)(4), 인박스 P-L-2(결정 16)
- 의존: T27 — 틀. T22 — 화면 명세 (나). T06 — 상태별 확인 표.
- 산출물: `web/ui/emote-menu.js`, `web/seat-mode.js` · 리포트 `_workspace/web-metaverse-develop/2026-11-13-ux-motion-rooms/04_metaverse-web-developer_ui-emote-seat_v1.md`
- 완료 검사: `npm test -- tests/ui-emote-seat.spec.mjs` → 실패 0, `npm test -- tests/emote-menu.spec.mjs`, `npm test -- tests/seat.spec.mjs`, `npm test -- tests/qa-u1.spec.mjs` → 각각 실패 0
- 편집 범위: `web/ui/emote-menu.js`, `web/seat-mode.js`, `tests/ui-emote-seat.spec.mjs`(새), `tests/emote-menu.spec.mjs`, `tests/seat.spec.mjs`, `tests/qa-u1.spec.mjs`
- UX 동행: T34가 `emote-menu`·`seat` 5절을 걷는다.
- 검증 환경값(설정값): 없음
- 예상 시간(분): low 30 / likely 50 / high 90 (likely T+220~270, 동행 포함)
- 자원: 브라우저(GPU 점유 표시)
- 분할선: 감정표현 메뉴와 좌석
- 배정: metaverse-web-developer / UI·기능 구현 (claude opus/medium)

### T31: 적용: HUD·Full Mode (설계 ui3)
- 항목: BL-0031 (1)(2)(3)(4), BL-0030 (3)의 알려진 사례, 인박스 R-2(결정 16)
- 의존: T25 — 스크린 줄 리뷰의 승인(같은 파일 `screen-video.js`). T27 — 틀. T22 — 화면 명세 (나). T06 — 상태별 확인 표.
- 산출물: `web/ui/full-mode.js` · 리포트 `_workspace/web-metaverse-develop/2026-11-13-ux-motion-rooms/04_metaverse-web-developer_ui-hud-fullmode_v1.md`
- 완료 검사: `npm test -- tests/ui-hud.spec.mjs` → 실패 0, `npm test -- tests/full-mode.spec.mjs`(앉은 직후 키를 누르지 않아도 Full Mode 버튼이 보이고 눌림), `npm test -- tests/screen-video.spec.mjs`, `npm test -- tests/qa-a.spec.mjs`, `npm test -- tests/qa-u.spec.mjs`, `npm test -- tests/qa-u2.spec.mjs` → 각각 실패 0
- 편집 범위: `web/ui/full-mode.js`, `web/screen-video.js`(조작 막대와 Full Mode 버튼의 화면 부분만), `tests/ui-hud.spec.mjs`(새), `tests/full-mode.spec.mjs`, `tests/screen-video.spec.mjs`, `tests/qa-a.spec.mjs`, `tests/qa-u.spec.mjs`, `tests/qa-u2.spec.mjs`
- 하는 일: 앉은 상태의 Full Mode 버튼은 `full-mode.js`에서 푼다. `seat-mode.js`(같은 때 T30)나 `input.js`를 고쳐야 하면 고치지 않고 `ask`.
- UX 동행: T34가 `hud-controls`·`full-mode` 5절과 T27 틀 줄을 걷는다.
- 검증 환경값(설정값): `screen.json` `volume` 70, `muted`·`unmuteOnEnter` true, 거리 음량(T12 값). 음량 막대의 모양을 바꿔도 값은 바꾸지 않는다.
- 예상 시간(분): low 40 / likely 60 / high 100 (likely T+220~280, 동행 포함)
- 자원: 브라우저(GPU 점유 표시)
- 분할선: 조작 막대와 Full Mode
- 배정: metaverse-web-developer / UI·기능 구현 (claude opus/medium)

### T32: 적용: 방 초대 (설계 ui4)
- 항목: BL-0031 (1)(2)(4), BL-0032(방 패널, 혼자 시청 안내, 자동 연결 고지), 결정 9·10·11
- 의존: T26 — 방 줄 리뷰의 승인. RM — 최종 `multiplayer.js`·`invite.js`. T07 — 자동 연결 고지 원문. T27 — 틀. T21 — 화면 명세 (가). T05 — 상태별 확인 표.
- 산출물: `web/ui/invite.js` · 리포트 `_workspace/web-metaverse-develop/2026-11-13-ux-motion-rooms/04_metaverse-web-developer_ui-room_v1.md`
- 완료 검사: `npm test -- tests/ui-room.spec.mjs` → 실패 0, `npm test -- tests/multiplayer.spec.mjs`, `npm test -- tests/qa-x.spec.mjs`, `npm test -- tests/modules.spec.mjs` → 각각 실패 0
- 편집 범위: `web/ui/invite.js`, `web/multiplayer.js`(화면 글자와 버튼 연결만), `web/config/network.json`(`roundOffsets` 삭제만), `tests/ui-room.spec.mjs`(새), `tests/multiplayer.spec.mjs`, `tests/qa-x.spec.mjs`, `tests/modules.spec.mjs`(`:66`의 `network` 설정 기대값)
- UX 동행: T33이 `room-invite` 5절을 걷는다.
- 검증 환경값(설정값): `network.json` `capacity` 16과 `fullMessage` 그대로, `roundOffsets` 없음, 고지 문구 = T07 원문
- 예상 시간(분): low 30 / likely 45 / high 75 (likely T+250~295, 동행 포함; 웹 팀 4명 상한으로 20분 기다린 뒤)
- 자원: 브라우저 여러 개(GPU 점유 표시)
- 분할선: 방 패널과 고지·안내
- 배정: metaverse-web-developer / UI·기능 구현 (claude opus/medium)

### T33: UX 동행 (가): T29·T32
- 항목: BL-0031 (1)
- 의존: T05 — 상태별 확인 표. T27 — 걷는 앱의 틀.
- 산출물: `_workspace/product/2026-11-13-ux-motion-rooms/00b_ux-designer_walk-a_v1.md`(걸은 표와 그림 경로)
- 완료 검사: `report-check` → `"ok":true`
- 편집 범위: 리포트와 그림(`_workspace/product/2026-11-13-ux-motion-rooms/walk/a/`). 명세가 틀린 줄이면 (가) 네 파일의 그 줄만.
- 하는 일: `## UX 동행의 자리`. 두 화면의 걷기가 끝나면 끝낸다.
- 검증 환경값(설정값): 없음
- 예상 시간(분): low 50 / likely 80 / high 125 (likely T+220~300; 맡은 화면 Task가 끝날 때까지 떠 있다)
- 자원: 브라우저(GPU 점유 표시)
- 분할선: 화면 단위
- 배정: ux-designer / UX 동행 (claude opus/medium — 기본 줄, 결정 3)

### T34: UX 동행 (나): T30·T31과 T27 틀 줄
- 항목: BL-0031 (1)(3)
- 의존: T06 — 상태별 확인 표. T27 — 걷는 앱의 틀.
- 산출물: `_workspace/product/2026-11-13-ux-motion-rooms/00b_ux-designer_walk-b_v1.md`
- 완료 검사: `report-check` → `"ok":true`
- 편집 범위: 리포트와 그림(`_workspace/product/2026-11-13-ux-motion-rooms/walk/b/`). 명세가 틀린 줄이면 (나) 네 파일의 그 줄만.
- 하는 일: `## UX 동행의 자리`. 두 화면의 걷기가 끝나면 끝낸다.
- 검증 환경값(설정값): 없음
- 예상 시간(분): low 45 / likely 65 / high 105 (likely T+220~285)
- 자원: 브라우저(GPU 점유 표시)
- 분할선: 화면 단위
- 배정: ux-designer / UX 동행 (claude opus/medium)

### T35: 끝 리뷰 A: 이펙트·캐릭터·Mixamo (설계 crend)
- 항목: BL-0028, BL-0029, BL-0025
- 의존: T18 — `character.js`·`characters.json`의 변경. T28 — 클립 연결(등록할 때 T28이 completed면).
- 산출물: `_workspace/qa/2026-11-13-ux-motion-rooms/01_code-reviewer_review-fx_v1.md`
- 완료 검사: `report-check` → `"ok":true`
- 편집 범위: 리포트만
- 등록: BL-0025 줄이 정산된 뒤(`### 등록과 기동`).
- 검증 환경값(설정값): 없음
- 예상 시간(분): low 15 / likely 25 / high 40 (likely T+250~275)
- 자원: 없음
- 분할선: 없음
- 배정: code-reviewer / 일반 변경 리뷰 (claude opus/medium)

### T36: 끝 리뷰 B: 틀·화면 (가)
- 항목: BL-0031, BL-0032
- 의존: T27, T29, T32 — `index.html`·`tokens.css`·`main.js`와 화면 (가)의 변경.
- 산출물: `_workspace/qa/2026-11-13-ux-motion-rooms/01_code-reviewer_review-ui-a_v1.md`
- 완료 검사: `report-check` → `"ok":true`
- 편집 범위: 리포트만
- 검증 환경값(설정값): 없음
- 예상 시간(분): low 15 / likely 25 / high 40 (likely T+298~323)
- 자원: 없음
- 분할선: 없음
- 배정: code-reviewer / 일반 변경 리뷰 (claude opus/medium)

### T37: 끝 리뷰 C: 화면 (나)
- 항목: BL-0031, BL-0030 (3)
- 의존: T30, T31 — 감정표현·좌석·HUD·Full Mode의 변경(`screen-video.js`의 화면 부분 포함).
- 산출물: `_workspace/qa/2026-11-13-ux-motion-rooms/01_code-reviewer_review-ui-b_v1.md`
- 완료 검사: `report-check` → `"ok":true`
- 편집 범위: 리포트만
- 검증 환경값(설정값): 없음
- 예상 시간(분): low 15 / likely 20 / high 35 (likely T+283~303)
- 자원: 없음
- 분할선: 없음
- 배정: code-reviewer / 일반 변경 리뷰 (claude opus/medium)

### T38: 법무 끝 검토 (설계 l2)
- 항목: BL-0025, BL-0029, BL-0031, BL-0032
- 의존: RM — 운영자 화면이 담는 정보. T18 — 계란 자국 시간. T28 — 원본 위치와 클립 출처(등록할 때 completed면). T29~T32 — 바뀐 문구와 고지.
- 산출물: `_workspace/legal-review/2026-11-13-ux-motion-rooms/03_legal-reviewer_review-final_v1.md`
- 완료 검사: `report-check` → `"ok":true`
- 편집 범위: 리포트만
- 등록: BL-0025 줄이 정산된 뒤.
- 검증 환경값(설정값): 없음
- 예상 시간(분): low 20 / likely 30 / high 50 (likely T+298~328)
- 자원: 없음
- 분할선: 없음
- 배정: legal-reviewer / 법률 검토 (claude fable/high)

### T39: 끝 아트 리뷰 (설계 ar2)
- 항목: BL-0031, BL-0028, BL-0029, BL-0025
- 의존: T18 — 이펙트. T27, T29~T32 — 적용된 화면. T28 — 새 클립(등록할 때 completed면).
- 산출물: `_workspace/graphicmodel/2026-11-13-ux-motion-rooms/07_graphic-leader_art-review-final_v1.md`
- 완료 검사: `report-check` → `"ok":true`
- 편집 범위: 리포트만
- 등록: BL-0025 줄이 정산된 뒤.
- 검증 환경값(설정값): 없음
- 예상 시간(분): low 15 / likely 25 / high 40 (likely T+298~323)
- 자원: 브라우저(화면 캡처, GPU 점유 표시)
- 분할선: 화면과 이펙트·클립
- 배정: graphic-leader / 아트 리뷰 (codex gpt-6-astra/medium)

### QA: 끝 QA 묶음 (팀장)
- 항목: BL-0015 남은 것을 뺀 전부(BL-0015 (2)는 T09)
- 의존: T25, T26, T35, T36, T37 — 다섯 리뷰의 결함 표(High는 수정이 정산된 뒤).
- 산출물: `_workspace/qa/2026-11-13-ux-motion-rooms/00_qa-inspector_lead-final_v1.md`(통합 보고)
- 완료 검사: `report-check` → `"ok":true`, 팀원 T40~T43이 모두 정산됨
- 편집 범위: 팀원 spec(`_workspace/qa/2026-11-13-ux-motion-rooms/spec/`)과 통합 보고
- 등록: BL-0025 줄이 정산된 뒤(T35 뒤).
- 검증 환경값(설정값): 팀원 spec에 `## 설정값과 기본값`의 값을 그대로 옮긴다
- 예상 시간(분): 팀장 기동 low 5 / likely 5 / high 10, 통합 보고 low 5 / likely 5 / high 10 (묶음 likely T+326~429)
- 자원: 슬롯 하나(팀장 터미널). 팀원 브라우저는 워커마다 따로, GPU 점유 표시로 차례
- 분할선: 영역 단위(T40~T43)
- 배정: qa-inspector / 리드 (claude opus/high)
- 팀원 공통: 편집 범위는 자기 `tests/qa-<영역>.spec.mjs`(새)와 리포트, 완료 검사는 `report-check` → `"ok":true`.

### T40: QA A: 스크린·소리·편성 (QA)
- 항목: BL-0026, BL-0027, BL-0016(U-H-10은 결정 5의 판정대로), BL-0029 (3), BL-0032 (4)(5)의 영상 쪽. 접두어 `A-`
- 의존: QA — 팀장이 띄운다. T25 — 스크린 리뷰. T37 — T31 화면(조작 막대)의 리뷰. T35 — 계란 명중 코드의 리뷰.
- 경계면: T11·T12 ↔ T02(편성 손잡이, `room:*` 이벤트), T31 ↔ T12(음량 값), T18 ↔ `faces`(계란이 맞아도 영상이 끊기지 않음)
- 산출물: `_workspace/qa/2026-11-13-ux-motion-rooms/02_qa-inspector_qa-A_v1.md`
- 편집 범위: `tests/qa-screen.spec.mjs`(새), 리포트
- 검증 환경값(설정값): `screen.json`의 T11·T12 값 그대로
- 예상 시간(분): low 45 / likely 70 / high 120 (likely T+334~404)
- 자원: 브라우저(GPU 점유 표시)
- 분할선: 편성·U-H-10과 소리
- 배정: qa-inspector / 흐름 검증 (claude opus/medium)

### T41: QA B: 방 (QA)
- 항목: BL-0032 (1)~(6). 접두어 `B-`
- 의존: QA — 팀장이 띄운다. T26 — 방 리뷰. T36 — T32 화면의 리뷰.
- 경계면: T13 ↔ T15(찾기 함수와 인자), T14 ↔ T16(`info`), T14 ↔ T12(넘기기·혼자 시청 중 영상 시간이 계속 늘어나는가), T32 ↔ T07(고지 문구), 적대 데이터(모양이 틀린 메시지, null)
- 산출물: `_workspace/qa/2026-11-13-ux-motion-rooms/02_qa-inspector_qa-B_v1.md`
- 편집 범위: `tests/qa-room.spec.mjs`(새, 로컬 PeerServer), 리포트
- 검증 환경값(설정값): `network.json`의 T14·T15·T32 값, 로컬 PeerServer(`qa-x` 방식)
- 예상 시간(분): low 60 / likely 90 / high 150 (likely T+334~424)
- 자원: 브라우저 여러 개(GPU 점유 표시)
- 분할선: 자동 배치·운영자 화면과 넘기기·혼자 시청
- 배정: qa-inspector / 흐름 검증 (claude opus/medium)

### T42: QA C: 캐릭터·이펙트 (QA)
- 항목: BL-0028, BL-0029 (1)(2), BL-0025(blocked면 뺀다). 접두어 `C-`
- 의존: QA — 팀장이 띄운다. T35 — 이펙트·캐릭터 리뷰.
- 경계면: T17 ↔ T18(큐 표와 재생 순간), T19 ↔ T28(클립 표 프레임), T18 ↔ T28(`characters.json` 키)
- 산출물: `_workspace/qa/2026-11-13-ux-motion-rooms/02_qa-inspector_qa-C_v1.md`
- 편집 범위: `tests/qa-fx.spec.mjs`(새), 리포트
- 검증 환경값(설정값): `characters.json`의 T18·T28 값
- 예상 시간(분): low 35 / likely 55 / high 90 (likely T+334~389)
- 자원: 브라우저 두 개(원격 확인, GPU 점유 표시)
- 분할선: 감정표현과 계란·클립
- 배정: qa-inspector / 흐름 검증 (claude opus/medium)

### T43: QA U: 화면·횡단 (QA)
- 항목: BL-0030(상태별 조작 표 대조), BL-0031, 키보드·접근성·콘솔 오류·보안. 접두어 `U-`
- 의존: QA — 팀장이 띄운다. T36, T37 — 화면 리뷰 둘.
- 경계면: T05·T06 ↔ T29~T32(확인 표), T20~T22 ↔ T27(토큰과 배치), T27 ↔ 고정 ID 14개
- 산출물: `_workspace/qa/2026-11-13-ux-motion-rooms/02_qa-inspector_qa-U_v1.md`
- 편집 범위: `tests/qa-ui.spec.mjs`(새), 리포트
- 검증 환경값(설정값): 작은 창은 시험 안에서만 창 크기를 바꾼다
- 예상 시간(분): low 50 / likely 75 / high 120 (likely T+334~409)
- 자원: 브라우저(GPU 점유 표시)
- 분할선: 표 대조와 횡단
- 배정: qa-inspector / 흐름 검증 (claude opus/medium)

### T44: 성능 점검 (설계 perf)
- 항목: BL-0028 (3), BL-0025(`fan-anim-v2.glb` 예산), 전체 예산
- 의존: QA — 끝 QA를 마친 같은 빌드. T38, T39 — 다른 검증이 모두 끝남(혼자 돈다).
- 산출물: `_workspace/graphicmodel/2026-11-13-ux-motion-rooms/08_graphic-performance-verifier_perf_v1.md`(이펙트 넷과 계란을 낸 상태의 경기장 FPS, 텍스처 메모리 MiB, `fan-anim-v2.glb`의 `glb-inspect` 수치)
- 완료 검사: `report-check` → `"ok":true`
- 편집 범위: 리포트만(점검)
- 검증 환경값(설정값): FPS 60 이상, 텍스처 메모리 500 MiB 이하, 화면 크기와 브라우저는 `tests/perf-fps.spec.mjs`·`tests/qa-p.spec.mjs`와 같게. 3D·WebGL 실측은 `qa-verification`의 `launch.cjs`로(`team-qa`).
- 등록: QA 묶음 뒤.
- 예상 시간(분): low 20 / likely 30 / high 50 (likely T+432~462)
- 자원: GPU(`--resource gpu`)
- 분할선: 자산 수치와 실측
- 배정: graphic-performance-verifier / 성능 점검 (codex gpt-6-astra/max)

### T45: 수정 1회차: 3D 쪽 (High만)
- 항목: 3D 쪽 파일에서 High가 나온 항목
- 의존: T44 — 끝 QA·리뷰·법무·아트·성능 리포트의 High 목록(모든 검증이 끝난 뒤). T09 — 먼 관중 판정(띄면 비율을 여기서 고친다).
- 산출물: 고친 Task 리포트의 다음 버전 `_v2`
- 완료 검사: 그 결함 ID의 재현 시험 `npm test -- tests/<그 Task의 시험>.spec.mjs` → 실패 0(전체 시험은 넣지 않는다)
- 편집 범위: High가 가리킨 파일 가운데 `web/screen-video.js`, `web/character.js`, `web/config/screen.json`, `web/config/characters.json`, `web/config/crowd.json`, `web/assets/characters/fan-anim-v2.glb`와 그 시험. 한 파일의 결함은 한 Task로 모은다(T46과 같은 파일을 받지 않게 코디네이터가 나눈다).
- 담당: 원래 담당(그 파일을 고친 Task의 에이전트. 자산이면 graphic-character-designer, Blender면 `--resource blender`). 아래는 그림의 대표 배정이다.
- 검증 환경값(설정값): 그 결함을 낸 Task의 값 그대로
- 예상 시간(분): low 20 / likely 35 / high 70 (likely T+465~500)
- 자원: 브라우저(GPU 점유 표시)
- 분할선: 결함 ID 단위
- 배정: metaverse-3d-developer / 3D 런타임 구현 (codex gpt-6-astra/max)

### T46: 수정 1회차: 화면·방 쪽 (High만)
- 항목: 화면·방 쪽 파일에서 High가 나온 항목
- 의존: T44, T09 — 위와 같다.
- 산출물: 고친 Task 리포트의 다음 버전 `_v2`
- 완료 검사: T45와 같은 방식
- 편집 범위: High가 가리킨 파일 가운데 `web/index.html`, `web/ui/*`, `web/main.js`, `web/seat-mode.js`, `web/multiplayer.js`, `web/room-keys.js`, `web/ops.*`, `web/config/network.json`, `docs/live/graphicmodel/ui/*`와 그 시험(T45와 겹치지 않게)
- 담당: 원래 담당(UI 명세면 ui-designer). 아래는 그림의 대표 배정이다.
- 검증 환경값(설정값): 그 결함을 낸 Task의 값 그대로
- 예상 시간(분): low 20 / likely 35 / high 70 (likely T+465~500)
- 자원: 브라우저(GPU 점유 표시)
- 분할선: 결함 ID 단위
- 배정: metaverse-web-developer / UI·기능 구현 (claude opus/medium)

### T47: 재검 1회차: 3D 쪽
- 의존: T45 — 고친 결함 ID와 재현 시험.
- 산출물: 찾은 검증자 리포트의 다음 버전(예: `_workspace/qa/2026-11-13-ux-motion-rooms/02_qa-inspector_qa-A_v2.md`)
- 완료 검사: `report-check` → `"ok":true`(그 결함 ID의 재현 확인만)
- 편집 범위: 리포트만
- 담당: 원래 찾은 에이전트(리뷰 결함은 code-reviewer, 법무는 legal-reviewer, 아트는 graphic-leader, 성능은 graphic-performance-verifier). 아래는 대표 배정이다.
- 검증 환경값(설정값): 처음 찾을 때의 값 그대로
- 예상 시간(분): low 10 / likely 20 / high 35 (likely T+503~523)
- 자원: 브라우저(GPU 점유 표시)
- 분할선: 영역 단위
- 배정: qa-inspector / 재검 (claude opus/medium)

### T48: 재검 1회차: 화면·방 쪽
- 의존: T46 — 고친 결함 ID와 재현 시험.
- 산출물: 찾은 검증자 리포트의 다음 버전(예: `02_qa-inspector_qa-B_v2.md`, `02_qa-inspector_qa-U_v2.md`)
- 완료 검사: `report-check` → `"ok":true`
- 편집 범위: 리포트만
- 담당: T47과 같은 방식
- 검증 환경값(설정값): 처음 찾을 때의 값 그대로
- 예상 시간(분): low 10 / likely 20 / high 35 (likely T+503~523)
- 자원: 브라우저(GPU 점유 표시)
- 분할선: 영역 단위
- 배정: qa-inspector / 재검 (claude opus/medium)

### T49: 수정 2회차: 3D 쪽 (조건부)
- 의존: T47, T48 — 1회차 재검 뒤 열려 있는 High(재검 중 새로 찾은 High 포함).
- 산출물: 고친 Task 리포트의 다음 버전
- 완료 검사: T45와 같은 방식
- 편집 범위: T45와 같은 파일 묶음
- 등록: 1회차 재검 뒤 High가 남을 때만. 3회차는 열지 않는다(브리프 위임 5). 2회차 뒤에도 남은 High는 T54가 인박스로 넘기고 최종 보고에 적는다.
- 검증 환경값(설정값): T45와 같다
- 예상 시간(분): low 0 / likely 0 / high 35 (high에서만 돈다고 계산)
- 자원: 브라우저(GPU 점유 표시)
- 분할선: 결함 ID 단위
- 배정: metaverse-3d-developer / 3D 런타임 구현 (codex gpt-6-astra/max) — 원래 담당

### T50: 수정 2회차: 화면·방 쪽 (조건부)
- 의존: T47, T48 — 위와 같다.
- 산출물: 고친 Task 리포트의 다음 버전
- 완료 검사: T45와 같은 방식
- 편집 범위: T46과 같은 파일 묶음
- 등록: T49와 같다.
- 검증 환경값(설정값): T46과 같다
- 예상 시간(분): low 0 / likely 0 / high 35
- 자원: 브라우저(GPU 점유 표시)
- 분할선: 결함 ID 단위
- 배정: metaverse-web-developer / UI·기능 구현 (claude opus/medium) — 원래 담당

### T51: 재검 2회차: 3D 쪽 (조건부)
- 의존: T49 — 2회차에 고친 결함 ID.
- 산출물: 찾은 검증자 리포트의 다음 버전
- 완료 검사: `report-check` → `"ok":true`
- 편집 범위: 리포트만
- 등록: T49가 등록될 때만.
- 검증 환경값(설정값): 처음 찾을 때의 값 그대로
- 예상 시간(분): low 0 / likely 0 / high 20
- 자원: 브라우저(GPU 점유 표시)
- 분할선: 영역 단위
- 배정: qa-inspector / 재검 (claude opus/medium)

### T52: 재검 2회차: 화면·방 쪽 (조건부)
- 의존: T50 — 2회차에 고친 결함 ID.
- 산출물: 찾은 검증자 리포트의 다음 버전
- 완료 검사: `report-check` → `"ok":true`
- 편집 범위: 리포트만
- 등록: T50이 등록될 때만.
- 검증 환경값(설정값): 처음 찾을 때의 값 그대로
- 예상 시간(분): low 0 / likely 0 / high 20
- 자원: 브라우저(GPU 점유 표시)
- 분할선: 영역 단위
- 배정: qa-inspector / 재검 (claude opus/medium)

### T53: 전체 시험 1회
- 항목: 전부(브리프 완료 기준)
- 의존: T47, T48, T51, T52 — 수정과 재검이 모두 정산된 최종 코드 상태. T51·T52는 2회차가 돌 때만 의존에 넣는다(등록되지 않았으면 뺀다).
- 산출물: `_workspace/_run/2026-11-13-ux-motion-rooms/report.md`의 최종 시험 줄
- 완료 검사: `npm test` → 실패 0(백그라운드로 돌리고 출력을 끝까지 읽는다). 실패가 남으면 알려진 실패(결정 16으로 풀릴 X-L-1, B-M-1, B-M-2가 남은 경우)와 회귀를 나눠 적는다. 못 돌렸으면 "테스트 미실행".
- 편집 범위: Run 폴더
- 검증 환경값(설정값): `GPU_LOCK_WAIT_MS` 기본(30분)
- 예상 시간(분): low 25 / likely 45 / high 90 (likely T+523~568; 지난 phase 92개 44분, 지금 186개 이상)
- 자원: GPU(`npm test`의 점유 표시)
- 분할선: 없음
- 배정: coordinator / 실행 감독 (claude opus/high) — 코디네이터가 직접

### T54: 완료 처리 (6단계)
- 항목: 전부
- 의존: T53 — 최종 시험 결과. T01 — 연결 표.
- 산출물: `_workspace/product/2026-11-13-ux-motion-rooms/02_product-manager_closeout_v1.md`
- 완료 검사: `report-check` → `"ok":true`
- 편집 범위: `docs/backlog.md`, `docs/backlog-archive.md`
- 넣을 것: `done` 항목 보관, Medium 이하 결함, blocked 항목과 그 이유(BL-0025가 막혔다면), 2회차 뒤 남은 High, R-8(여러 사람 방 시험이 git 밖 패키지에 기댐) 한 줄, 공유 전 결정 묶음에 계란 자국 한 줄(결정 14). 결정 17·18의 인박스 줄은 그대로 둔다.
- 검증 환경값(설정값): 없음
- 예상 시간(분): low 10 / likely 15 / high 25 (likely T+571~586)
- 자원: 없음
- 분할선: 없음
- 배정: product-manager / 완료 처리 (claude sonnet/medium)

### T55: 하네스 회고 (7단계)
- 의존: T54 — 완료 처리(`team-harness`의 순서). 코디네이터가 띄우기 전에 `node .claude/scripts/orca-launch.mjs actual --map <map> > _workspace/_run/2026-11-13-ux-motion-rooms/actual.json`을 남긴다.
- 산출물: `_workspace/harness/2026-11-13-ux-motion-rooms/01_harness-engineer_retro_v1.md`
- 완료 검사: `report-check` → `"ok":true`
- 편집 범위: 리포트만
- 잴 것: 병렬 폭(계획 3.42 대 실제), 코디네이터가 깬 횟수, 수정 루프, 재시도와 원인, 작업 폴더 크기, UX 명세를 실행 첫 묶음에 둔 자리(결정 2)와 팀 명단 문구, UX 동행 둘(T33·T34)의 대기 시간, 디자이너 두 역할의 모델 줄(결정 3, 표는 제안만), 팀장 두 묶음의 비용(계산상 likely 13분), 웹 팀 4명 상한이 만든 대기(T27 23분, T32 20분).
- 검증 환경값(설정값): 없음
- 예상 시간(분): low 20 / likely 30 / high 45 (likely T+589~619)
- 자원: 없음
- 분할선: 없음
- 배정: harness-engineer / 회고 (claude fable/high)

### T56: 하네스 수정 (7단계)
- 의존: T55 — 근거 있는 수정 목록. 근거가 없으면 띄우지 않고 G2는 T55 뒤에 둔다.
- 산출물: `_workspace/harness/2026-11-13-ux-motion-rooms/02_harness-engineer_changes_v1.md`
- 완료 검사: `report-check` → `"ok":true`, 고친 줄마다 `docs/harness/changelog.md`에 한 줄
- 편집 범위: `.claude/`, `AGENTS.md`, `CLAUDE.md`, `docs/harness/`(모델 표 제외)
- 검증 환경값(설정값): 없음
- 예상 시간(분): low 15 / likely 25 / high 45 (likely T+622~647)
- 자원: 없음
- 분할선: 에이전트·스킬 문구와 그 밖
- 배정: harness-engineer / 구조 변경 (claude fable/high)

### G2: 커밋 승인 (창구 대행)
- 의존: T56 — 회고까지 끝난 변경 목록.
- 산출물: 브리프 `## 사용자 결정`의 대행 원문
- 완료 검사: 창구가 날짜와 원문 1줄을 브리프에 적음
- 편집 범위: 없음(창구)
- 검증 환경값(설정값): 없음
- 예상 시간(분): 미정(0분으로 확정하지 않는다)
- 자원: 없음
- 분할선: 없음
- 배정: 없음(창구 대행, 브리프 위임 4. push는 하지 않는다)

### T57: 로컬 커밋 (8단계)
- 의존: G2 — 대행 원문.
- 산출물: 로컬 커밋 2개(제품, 하네스)
- 완료 검사: `git status --short` → 이번 phase가 만든 경로가 남지 않음(phase 전부터 있던 미추적 파일은 그대로)
- 편집 범위: 없음(경로를 지정한 커밋만. 회고가 고친 하네스 파일은 별도 커밋. push 없음)
- 검증 환경값(설정값): 없음
- 예상 시간(분): low 5 / likely 10 / high 15 (likely T+647~657)
- 자원: 없음
- 분할선: 없음
- 배정: coordinator / 실행 감독 (claude opus/high) — 코디네이터가 직접

### 임계 경로와 병렬도

- 임계 경로(likely): G1 → C01 → T02 → RM(팀장 기동 → T14 → T15 → 통합 보고) → T26 → T32 → T36 → QA(팀장 기동 → T41 → 통합 보고) → T44 → T45 → T47 → T53 → T54 → T55 → T56 → G2 → T57 = **657분**(계획 승인 기준, 승인 대기 제외, Task마다 기동 3분 포함). T32는 T26(T+230)과 T27(T+217)이 끝난 뒤 웹 팀 4명 상한으로 T+247에 뜬다. 최종 시험 T53까지는 568분이다.
- 거의 임계: 화면 줄 C01 → T06 → T22 → T24 → T27 → T29(T+290 끝)는 T36 시작(T+298)까지 여유 5분이다. T27도 웹 팀 상한으로 23분 기다린다. 스크린 줄(T11 → T12 → T25 → T31)은 여유 15분, 이펙트 줄(T17 → T18)은 50분 안팎, BL-0025 줄(T08 → T19 → T28)은 T35 등록 전에 끝나 여유가 크다.
- 작업 시간 합 ÷ 임계 경로 길이: likely **2250 ÷ 657 = 3.42** (low 1395 ÷ 427 = 3.27, high 3995 ÷ 1184 = 3.37). 작업 시간 합에는 코디네이터 일, 팀장 기동·보고, 동행 워커가 기다리는 시간이 든다.
- 슬롯 수: **8** (팀장 포함 워커 터미널, 코디네이터 제외).
- 최대 동시 Task 수: **8** (likely T+15 W0에서 슬롯이 찬다: T01~T06, T08, T10. 팀장 터미널을 더해도 8을 넘지 않는다). 한 팀의 동시 팀원은 4명 이하.
- 시나리오: BL-0025가 막히면 likely 652분(작업 시간 합 2120). 팀장 없이 직접 띄우면 likely 644분, high 1135분(참고, `## 실행 방식`).
- 설계(likely 630분)와의 차이: Task마다 기동 3분, 팀장 두 묶음, 웹 팀 4명 상한의 대기, 완료 처리 → 회고 → 하네스 수정 차례(`team-harness`)가 더해졌고, UI 명세·끝 리뷰를 나눠 일부 줄었다.
- Task 수: 워커 Task 57개(코디네이터가 직접 띄우는 49개 = 팀장 Task 2개 포함, 팀장 묶음 안의 팀원 8개; 그 가운데 조건부 4개 T49~T52), 코디네이터가 하는 일 3개(C01, T53, T57), 창구 대행 승인 2개(G1, G2).

## 설정값과 기본값

값만 바꾸면 되는 것은 설계서 10절이 정본이고, 키 이름은 T02가 정한다. 아래는 Task마다 `검증 환경값(설정값)`으로 옮긴 값과, 같은 값으로 시험하는 Task다. 한 값을 서로 다르게 시험하는 Task가 생기면 그 값을 바꾼 담당이 고친다(다른 Task가 바꿨으면 `ask`).

| 파일 | 값 | 기본값 | 고치는 Task(차례) | 같은 값으로 시험하는 Task |
| --- | --- | --- | --- | --- |
| `web/config/screen.json` | 편성 시간표, 시간표 밖, 생방송 실패 때 | 빈 목록, 재방, 재방 | T11 | T40 |
| `web/config/screen.json` | 재방이 끝날 때 | 방이 다음 회차로 | T11 | T40, T41 |
| `web/config/screen.json` | 반복 실패 안내, 대기 상한, 재시도 간격 상한 | 첫 실패부터 "다시 연결 중", 60초, 30초 | T11 → T12(U-H-10 제품 원인일 때) | T40 |
| `web/config/screen.json` | 거리 음량 | 25 m 안 100%, 90 m에서 40%까지 직선, 앉음·Full Mode 100% | T12 | T31, T40 |
| `web/config/screen.json` | 경기장 밖 | 보일 때만 재생, 경계 = 지금 코드의 숫자 | T12 | T40 |
| `web/config/screen.json` | `volume`, `muted`, `unmuteOnEnter`, `crowdVolume`, `syncToleranceSeconds` | 70, true, true, 0.3, 2(바꾸지 않음) | — | T12, T31, T40 |
| `web/config/network.json` | 방 키 접두어, 자리수, `maxRooms` | `barclays-tps-room-`, 두 자리, 50 | T14(키 추가) | T13(인자), T15, T16, T41 |
| `web/config/network.json` | 연결 시간 넘김, 넘기기 응답 대기, 운영자 화면 갱신 | 8초, 10초, 30초 | T14 | T13, T15, T16, T41 |
| `web/config/network.json` | 나란히 두드리는 수 | 1(출발값, T13이 재고 권고) | T14(키) → T15(값) | T13, T41 |
| `web/config/network.json` | 자동 배치 시작 | 입장 버튼 뒤 | T15(코드) | T41 |
| `web/config/network.json` | `roundOffsets` | 없앰 | T32 | T41 |
| `web/config/network.json` | `capacity`, `fullMessage` | 16, "방이 가득 찼습니다(16명)"(바꾸지 않음) | — | T13~T16, T32, T41 |
| `web/config/characters.json` | 클립 파일, 큐 프레임 | `./assets/characters/fan-anim.glb` + 지난 phase T35 프레임(34/30, 40/30) → BL-0025가 되면 `fan-anim-v2.glb` + T19 표 | T18(키로 옮김) → T28(값) | T29(B-M-2), T42 |
| `web/config/characters.json` | 이펙트 | 입자 수 상한·지속·크기(T17), 계란 비행 1.2초, 자국 1.5초 안에 사라짐, 목표 면 = 던진 사람을 가장 바로 보는 면 | T18 | T42, T44 |
| `web/config/characters.json` | 이펙트 텍스처 합 | 2 MiB 이하(출발값) | T18 | T44 |
| `web/config/crowd.json` | 먼 관중 낮은 텍스처 | 바꾸지 않음(T09는 캡처에서만 켬·끔) | T45(T09가 띈다고 판정할 때만) | T09, T44 |
| 시험 환경 | 여러 사람 방 | 로컬 PeerServer(`_workspace/qa/2026-11-12-webrtc-20-validation/V01/`, `qa-x` 방식). 앱의 PeerJS Cloud 설정은 그대로 | — | T14, T15, T16, T32, T41 |
| 시험 환경 | GPU 점유 기다림 상한 | `GPU_LOCK_WAIT_MS` 30분(기본) | — | 브라우저 시험 전부 |

이 계획이 더한 기본값은 둘이다. 사용자가 바꾸라고 하면 값만 바꾼다.

| 값 | 기본값 | 둔 곳 |
| --- | --- | --- |
| 팀장 터미널을 슬롯에 넣는가 | 넣는다(슬롯 8 = 팀장 포함 워커 터미널) | `## 실행 방식` |
| UX 동행 워커 수 | 2(대상 묶음 (가)(나)마다 하나) | `## UX 동행의 자리` |

## 승인 전 점검 (`phase-planning` parallel-rules)

- ✅ 사유 없는 의존이 없다. 모든 `의존` 줄이 앞 Task의 무엇을 읽는지 적는다.
- ✅ 편집 범위가 겹치는 Task가 같은 때 돌지 않는다. 같은 파일은 의존으로 이어진 차례로만 연다: `screen-video.js` T11 → T12 → (T25) → T31, `multiplayer.js`·`network.json` T14 → T15 → (RM·T26) → T32, `invite.js` T15 → T32, `character.js`·`characters.json` T18 → T28, `architecture.md` T02 → T23, `modules.spec.mjs` T27 → T32, `index.html`·`main.js`·`tokens.css`는 T27 하나. 시험 파일은 `## 공용 약속`의 주인 표대로다. 차례가 어긋나도 `launchable`의 `--edits` 검사가 막는다.
- ❌ 산출물이 둘 이상인 Task가 있다: T05·T06·T21·T22(명세 넷), T29(모듈 셋), T30(모듈 둘). 각각 대상 묶음 하나와 완료 검사 하나다. 더 나누면 같은 에이전트의 짧은 Task가 늘고, 화면 적용은 웹 팀 4명 상한 때문에 옆으로 돌 수 없다(T29를 둘로 나눠도 끝이 같다).
- ✅ 구현 Task의 완료 검사에 전체 시험이 없다. 전체 시험은 T53 한 번이다.
- ❌ 사슬이 4단을 넘는다. 임계 경로는 Task 19단이다. 뒤쪽(리뷰 → QA → 성능 → 수정 → 재검 → 전체 시험 → 완료 처리 → 회고 → 하네스 수정)은 단계 규칙이고, 앞쪽은 웹 팀 4명 상한이 길이를 정해 옆으로 펴도 줄지 않는다.
- ✅ likely가 6분보다 짧은 같은 역할 Task가 따로 서 있지 않다(가장 짧은 것은 T23 10분. 팀장 기동·보고 5분은 팀장 Task의 일부. T49~T52의 0분은 조건부).
- ✅ 임계 경로 위의 분할선 있는 Task는 처음부터 나눴다: 방 mp → T13~T16, 스크린 sv → T10~T12, UI 명세 → T20~T22, 끝 리뷰 → T35~T37, 끝 QA → 4영역, 수정·재검 → 두 줄. T14(75분)는 한 파일이라 분할선만 적었다. T41(90분)은 QA 팀 4명 상한 때문에 다섯째 영역으로 나누지 않았다.
- ✅ 끝 검증이 영역별로 나뉘어 있고 횡단 QA(T43)가 하나 있다.
- ✅ 병렬도 수치(3.42, 슬롯 8, 최대 동시 8)가 `## DAG` 절 끝에 있다.

## 사용자 결정 필요

없음. 이 계획은 브리프의 사용자 결정과 설계서에서 대행 채택한 결정 1~18 안에서 Task를 나누고 배정했다. 값만 바꾸면 되는 것은 `## 설정값과 기본값`에 있다.
