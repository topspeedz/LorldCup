# 설계: BL-0002~BL-0024 수행 (phase 2026-11-12-requirements-build)

> 문서 종류: 설계 · 작성: planner (Task `task_ddeeb12b3e00`, Dispatch `ctx_e112f95f5222`) · 2026-11-12
> 브리프: `_workspace/_run/2026-11-12-requirements-build/brief.md` · 그림 입력: 같은 폴더의 `dag.json`(스윔레인), `waterfall.json`(예상시간)
> 상태: 승인됨(2026-11-12 "설계승인"). 사용자 답 31개, 추가 질문 답, 연결 구조·재방 구조 결정을 반영했다(계획 planner, Task `task_b8962aeca657`). 커밋하지 않는다. Task 분해·배정·시간·기한 판정의 정본은 계획서 `docs/superpowers/plans/2026-11-12-requirements-build.md`다.

## 1. 왜, 무엇을

사용자는 백로그 23개(BL-0002~BL-0024, 요구 1~19)를 **오늘(2026-11-12) 안에 전부** 끝내기를 원한다. 그중 **BL-0016**(중앙 스크린에서 유튜브 영상과 생방송 재생)과 **BL-0020**(Full Mode)은 "필수로 되어야 한다"고 했다(브리프 `## 사용자 결정`). 요청 원문은 "병렬처리를 잘 하고 순서를 잘 살리"는 설계다.

이 문서는 다음에 답한다.

- 팀 단위의 굵은 흐름: 무엇이 함께 가고 무엇이 차례를 지켜야 하는가.
- 정적 Three.js 앱(`web/`) 위에서 각 항목이 닿는 파일과, 여러 흐름이 같은 파일을 덮지 않게 가르는 선.
- 필수 두 항목이 다른 줄에 막히지 않고 가장 먼저 끝나는 배치.
- 예상 시간, 임계 경로, 병렬 폭, 기한 판정, 그리고 사용자가 한 번에 답할 결정 목록.

## 2. 목표 · 비목표 · 실패 조건

**목표**

1. 23개 항목의 수락 기준(정본은 `docs/backlog.md`)을 통과시키는 흐름을 정한다.
2. 필수(BL-0016, BL-0020)는 그래픽 자산·법무 결과·Blender를 기다리지 않는 흐름에 둔다.
3. 같은 시각에 두 흐름이 같은 파일을 고치지 않는다.
4. 정적 조명의 다시 굽기와 `web/arena.glb`의 다시 내보내기를 각 1회로 줄인다.

**비목표** (이번에 정하지 않는다)

- Task 단위 분해와 Task별 배정(계획 단계).
- Next.js 전환, 배포·외부 게시·push.
- BL-0022의 공급자·요금제·DB·운영 사용량·TURN 도입(후보로만 남긴다).
- TURN 서버 추가, 유료 도구 사용.

**실패 조건** (기술적으로 돌아가도 실패로 본다)

- 기존 기능의 회귀: TPS 이동, Space 점프, 방장 중심 WebRTC, 관중 GPU 동작과 환호음, 구운 조명(`web/README.md`의 검증 범위).
- 원본 자산을 덮어쓰거나 옮김: `barclays-worlds-2026.blend`, `web/arena.glb`, `web/lightmaps/*.png`, 기존 텍스처·음원.
- 웹 런타임 라이브러리 추가(Three.js r170에 딸린 파일과 유튜브 공식 임베드 플레이어 밖).
- 필수 항목이 그래픽 자산이나 다른 흐름의 끝을 기다림.
- 무거운 일(굽기·브라우저 실행 검증·성능 실측)을 동시에 돌려 측정이 흔들림.

## 3. 제약 (브리프의 사용자 결정 그대로)

| 제약 | 출처 |
| --- | --- |
| 지금의 정적 Three.js 앱(`web/`, r170) 위에 만든다. Next.js로 옮기지 않는다 | 브리프 결정 2026-11-12 "지금 정적 Three.js 앱 위에 이어서 만들어줘", "Three.js로" |
| 무료만. Higgsfield와 Blender MCP `generate_3d`는 기본으로 쓰지 않고, 쓰게 되면 미리 알려 선택적으로 허용받는다 | 브리프 결정 "무료로만 진행해줘 …", 창구 방식 (1) |
| 웹 런타임 라이브러리는 늘리지 않는다. Three.js r170에 딸린 파일과 유튜브 공식 임베드 플레이어만 추가 | 창구 방식 (2) |
| Playwright는 테스트 명령용 개발 의존성으로만. `package.json`을 만들되 웹 결과물에는 넣지 않는다 | 창구 방식 (3) |
| 배포·외부 게시 없음. 커밋은 로컬만, 원격이 없어 PR 없음 | 창구 방식 (4), 브리프 사실 |
| 기한 2026-11-12 안에 23개 전부. 필수: BL-0016(영상·생방송이 스크린에 붙음), BL-0020(Full Mode) | 브리프 결정 |
| PC 한 대, GPU 하나. Blender MCP는 실행 중인 Blender 하나를 점유 표시로 한 Task만 쓴다 | 브리프 사실, `.claude/skills/blender-pipeline/SKILL.md` 1절 |
| 돌릴 수 있는 검증 명령이 아직 없다. 기준 문서 4개가 없다 | 브리프 사실 |
| 기한의 기준은 23개 항목의 최종 테스트 통과다. 완료 처리·하네스 회고·커밋은 그 뒤에 이어서 한다 | 결정 3 |
| 슬롯 8. 경기장 수정·굽기·내보내기는 배치 Blender로 MCP 줄 옆에서 돈다 | 결정 5, 결정 1 |
| 연결 중개는 PeerJS Cloud(지금 방식). 방은 접속자가 만들고 만든 사람이 방장이다. 운영자는 만들어진 방 id 목록만 관리해 배치에 쓴다. Cloudflare 임시 터널은 전제로 삼지 않는다. Vercel(필요하면 유료)은 방 id 목록과 정적 호스팅의 후보로만 적고 이번 phase에는 쓰지 않는다(비용 없음) | 브리프 "연결 구조에 대한 결정의 적용", "재방 구조의 적용" |

## 4. 확인한 사실 (설계의 근거)

| # | 사실 | 근거 | 설계에 미치는 것 |
| --- | --- | --- | --- |
| F-1 | 입력·이동·충돌·점프·카메라·렌더 루프가 `web/main.js` 한 파일(146줄)에 있다 | `web/main.js:51-143` | 거의 모든 항목이 이 파일에 닿는다 → 먼저 나눈다(5.1) |
| F-2 | 기본 카메라 거리는 5 m다(장애물 없을 때 `5`, 광선 `far=5.3`). 거리 0.65 m 이하면 아바타를 숨긴다 | `web/main.js:130-134` | BL-0024 줌아웃 한계 약 7.5 m, 1인칭은 기존 숨김 처리를 쓴다 |
| F-3 | 지금 아바타는 캡슐·구 도형이며 뼈대와 클립이 없다. `createAvatar(color)`는 원격 아바타에도 쓰인다 | `web/avatar.js:2-15`, `web/multiplayer.js:9,15` | BL-0002 수락 기준 (2)의 "기존 이동·응원 애니메이션"은 지금 없다(결정 12). `createAvatar`의 인자·반환·`userData.material`은 고정 약속 |
| F-4 | 중앙 스크린은 GLB의 `REF_Jumbotron_0`~`3` 네 면이다. 한 면은 약 14.8 m × 4.3 m(비율 약 3.4:1), 무대 바닥(y≈−9)보다 약 8~13 m 위, `stage` 라이트맵에 구워져 있고 그림은 이미시브 텍스처 "Final Arena"다 | GLB JSON 실측(접근자 범위), `web-lightmaps/floor-fix/lightmap-report.json`, `refs/screen-reference.png` | BL-0016은 자산을 바꾸지 않고 웹에서 붙인다 |
| F-5 | 입구 참고 이미지의 "WELCOME TO THE FINAL" 개구부 앞에 개찰구 모델이 이미 있다: `Collide_TicketGate__silver`(x≈−91, z −9.2~9.2), `Gate_reader__cyan`, `Welcome`(x≈−86) | GLB JSON 실측, `refs/entrance-reference.png` | BL-0007은 이 선을 입장 차단선으로 쓴다(자산 변경 없음) |
| F-6 | 2층 `Walk_Tier1__concrete`(y 6~20)가 `Walk_` 규칙으로 걷는 면에 들어 있다 | `web/main.js:40`, GLB JSON 실측 | BL-0017은 걷는 면에서 빼는 런타임 변경 |
| F-7 | 관중은 머리 6·몸통 5 메시에 1·2층이 합쳐져 있고 삼각형 약 223만 개(전체 581만의 38%)다. `_CM_*` 정점 속성으로 GPU에서 움직인다. 얼굴 텍스처 3장과 저지 텍스처 2장(`audience-jersey-geng`, `audience-jersey-blg`)을 가까운 관중과 먼 관중이 함께 쓴다. 관중은 라이트맵에서 빠져 있다 | GLB JSON 실측, `web/README.md` 조명 절, `web/baked-lighting.js:26` | BL-0018·BL-0015는 다시 굽기 없이 런타임에서 할 수 있다 |
| F-8 | 프로게이머 10명은 몸 부위별 메시(`REF_PlayerHands__…` 등)에 10명이 합쳐져 있고 라이트맵·UV가 없다. 모니터 화면은 `REF_Reused_Monitor_pixels__cyan` 한 메시(10대, 삼각형 120, UV 없음, 단색 이미시브)다 | GLB JSON 실측 | BL-0012는 런타임 UV 생성과 재질 교체로, BL-0013은 부위를 관절처럼 움직이거나 리깅으로(결정 2) |
| F-9 | 정적 조명은 라이트맵 7장(stage·bowl·seats·concourse·interior·exterior·city, PNG 합 약 151 MB)이며 실시간 빛이 그 위에 더해지지 않는다. 지난 굽기는 66.8초, 내보내기는 73초였다. 내보내기 스크립트에 옛 절대경로가 남아 있다 | `web/baked-lighting.js:3-15`, `web-lightmaps/floor-fix/lightmap-report.json`, `export-report.json`, `web-export/export-web.py:4` | 달빛을 정적 면에 보이려면 굽기 1회가 필요하다. 계산은 싸고 일은 경로 정리와 검증이다 |
| F-10 | GLB 120.6 MB, 삼각형 5,808,498, 재질 120, 이미지 62(22.2 MB), 표준 애니메이션 클립 0, Draco 압축 | `web-export/glb-summary.json`, `web/main.js:31` | 새 자산도 Draco만 쓴다(KTX2·Meshopt 디코더 없음) |
| F-11 | 멀티는 방장 중심, 16명 상한. 17번째는 20초 뒤 시간 초과만 뜬다. 영상 동기화와 TURN이 없다. 회귀 테스트가 `validPose([0,0,0,0])`를 부른다 | `_workspace/_run/2026-11-12-webrtc-20-validation/report.md`(V01-02, V01-03), `web/multiplayer.js:36,52,63`, `web/verify-tps.mjs:17` | 위치 메시지 `pose` 모양은 고정 약속. 새 상태는 다른 메시지로 |
| F-12 | 회귀 테스트 2개는 Playwright 페이지를 받는 함수이고 주소가 `http://127.0.0.1:8766/`에 묶여 있다. 8766은 다른 서버가 쓰고 있을 수 있다. `package.json`이 없다 | `web/verify-tps.mjs:9`, `web/verify-jump.mjs:9`, `HANDOFF.md` 다음 단계 3~6 | 검증 토대가 포트와 루트를 명시해 띄워야 한다(6.5) |
| F-13 | `AGENTS.md:11` 기술 스택이 "Next.js + Three.js"다. `docs/harness/team-org.md:12-13`의 편집 범위가 `src/`, `public/`, `art/`, `public/assets/`다. Next.js·`src/`·`public/` 문구가 하네스 22개 파일 31곳에 있다. 편집 범위를 막는 훅은 없다 | `AGENTS.md`, `docs/harness/team-org.md`, `.claude/settings.json`(훅: 명령 승인·비밀값·대기·압축) | 문구 정리가 늦어도 실행은 막히지 않는다. 코디네이터 spec이 편집 범위를 명시한다(9절) |
| F-14 | `_workspace/`는 git에서 빠진다 | `.gitignore` | 점유 표시 파일의 자리 |
| F-15 | 광장 출발점은 x −139, z 0이고 동쪽을 본다. 동쪽으로 걸으면 처음 들어가는 건물 입구는 커튼월 개구부다(`Collide_CurtainWall__glass`의 서쪽 면 x≈−95.6, 그 안 `Walk_Atrium__concrete` x −96~−64·z −12.4~12.4, 개구부 위 `Entry_sign` y 6.8~7.3). 기존 개찰구 줄(`Collide_TicketGate__silver` x −91.8~−90.2)은 그 개구부 안쪽 약 4 m에 있다. 화면의 이동 버튼(lobby x −83, arena x −25)과 `window.arena.go`는 두 선을 모두 건너뛴다 | `web/main.js:27-29,71`, GLB JSON 실측(2026-11-12 계획 단계), `refs/entrance-reference.png` | 결정 30: 막는 면을 개구부 선으로 옮기고 이동 버튼을 막는다(5.3 BL-0007) |
| F-16 | 개구부 바깥의 `EXR_Entrance glazing`(x −107.1~−104.0, z −60.7~59.2, 높이 0~21 m)은 충돌 대상(`Collide_*`와 `web/main.js:41`의 이름)이 아니어서 캐릭터가 지나간다 | GLB JSON 실측, `web/main.js:41` | 지금은 입구가 아니라 통과되는 유리면이다(R-13) |

## 5. 구조

### 5.1 큰 모양: `main.js`를 먼저 나눈다

거의 모든 항목이 `web/main.js`(F-1)와 `web/index.html`에 닿는다. 그대로 두면 구현 흐름이 이 두 파일 앞에서 한 줄로 선다. 그래서 첫 구현 흐름 **F2**가 동작을 바꾸지 않고 파일을 나누고, 모든 기능 모듈의 빈 자리를 미리 만들어 등록한다. 그 뒤 각 흐름은 **자기 모듈 파일만** 채운다.

```
web/
  main.js              부트스트랩: 렌더러(alpha:true)·장면·카메라·GLB·조명·모듈 등록·프레임 루프·window.arena
  events.js            이벤트 이름 상수와 버스(EventTarget)
  modules.js           기능 모듈 목록. F2가 전부 등록하고 이후 고치지 않는다
  input.js             키·마우스·포인터 잠금·드래그 중 커서·우클릭 메뉴. 키 배정은 config/controls.json
  camera-rig.js        TPS 카메라·장애물·줌·1인칭, 덮어쓰기 훅(setOverride)
  player-controller.js 이동·점프·충돌, 걷는 면 필터, 막는 면(addBlocker/removeBlocker), 이동 잠금(setLocked)
  character.js         캐릭터 GLB·믹서·클립·유니폼·감정표현. F2는 지금 캡슐을 감싼 빈 자리만
  screen-video.js      유튜브 플레이어·CSS3D 배치·Full Mode API
  seat-mode.js         좌석 앉기·일어나기, 카메라 덮어쓰기
  environment.js       밤하늘·별·달·움직이는 대상의 달빛·바다
  sky-show.js          빛줄기·레이저·폭죽
  stage-monitors.js    모니터 화면
  stage-players.js     프로게이머 동작
  nameplate.js         자동 닉네임 이름표(머리 위, 같은 방 사람에게도 보임)
  ui/                  team-select.js(팀과 캐릭터 4종), emote-menu.js, ticket.js, full-mode.js, invite.js(방 만들 때 회차 고르기·초대 URL)
  config/              모듈마다 JSON 한 파일(그 모듈의 흐름만 고친다). 답 반영으로 characters.json, ticket.json 추가
  assets/              새 자산(characters/, audio/sfx/, video/)
  vendor/              three@0.170.0 원본에서 복사한 CSS3DRenderer.js, 필요하면 SkeletonUtils.js
```

**모듈 약속** (A1이 문서로 고정하고 F2가 코드로 만든다)

- 모듈은 `export function create(ctx)`를 내보내고 `{update?(dt, now), dispose?()}`를 돌려준다. `create`는 GLB와 조명이 준비된 뒤 한 번 불린다.
- `ctx`는 `THREE, scene, camera, renderer, root(gltf.scene), cssLayer(CSS3D용 층), uiRoot, events, config(name), player, cameraRig, input`을 담는다.
- `window.arena`의 지금 속성(`ready, camera, player, avatar, multiplayer, crowd, lighting, go, attempt, groundAt, state`)은 바꾸지 않는다. 회귀 테스트가 쓴다. 새 모듈은 시험용 손잡이를 `window.arena.<모듈>`에 더한다.
- 순간이동은 `player.teleport(name)` 하나로 모으고, 화면의 이동 버튼은 `player.setTeleportGuard(fn)`의 허락을 받는다. 티켓이 없으면 lobby·arena 이동을 거부한다(결정 30, F-15). 회귀 테스트가 쓰는 `window.arena.go`는 막지 않는다.
- 입력은 `config/controls.json`의 키를 이름 붙은 동작(`emoteMenu`, `sit`, `fullMode` 등)으로 바꿔 이벤트로 낸다. 모듈은 동작 이름만 듣는다. 키를 바꿔도 코드를 고치지 않는다.
- 포인터 잠금을 풀고 다시 잡는 것은 `input.js`의 API로만 한다. 메뉴·티켓 창·Full Mode처럼 커서가 필요한 모듈이 `requestPointerLock`을 직접 부르지 않는다.
- UI 모듈은 자기 DOM과 스타일을 실행 중에 `uiRoot`에 붙인다. `index.html`을 고치지 않는다.
- `createAvatar(color)`의 인자·반환(Group)·`userData.material`, 위치 메시지 `pose`의 모양, `validPose`는 고정 약속이다(F-3, F-11).

### 5.2 파일 소유: 누가 언제 고치나

같은 파일을 두 흐름이 고치면 차례(의존)로 잇는다. 아래 "이후" 칸이 비어 있지 않은 파일은 앞 흐름이 끝난 뒤에만 연다.

| 파일 | 만드는 흐름 | 이후 고치는 흐름(차례) | 항목 |
| --- | --- | --- | --- |
| `web/main.js`, `web/index.html`, `web/events.js`, `web/modules.js` | f2 | wi(새 GLB 경로 한 줄만) | 전부 |
| `web/input.js` | f2(기존 코드 이동) | w1a | BL-0023, 키 등록: BL-0009·BL-0019·BL-0020 |
| `web/camera-rig.js`, `web/config/camera.json` | f2 | w1a | BL-0024, BL-0019(훅만 사용) |
| `web/player-controller.js` | f2 | w1a | BL-0014, BL-0017, BL-0007(막는 면 API 사용), BL-0019(잠금 API 사용) |
| `web/screen-video.js`, `web/vendor/CSS3DRenderer.js`, `web/config/screen.json` | m | — (net은 이벤트로만 닿는다) | BL-0016, BL-0020 |
| `web/ui/full-mode.js` | m | — | BL-0020 |
| `web/ui/team-select.js`, `web/ui/emote-menu.js`, `web/ui/ticket.js`, `web/config/teams.json`, `web/config/characters.json`, `web/config/ticket.json` | w1b | wi(진짜 유니폼·클립 연결 시 확인만) | BL-0003, BL-0009, BL-0007, 결정 11·30 |
| `web/stage-monitors.js`, `web/crowd-motion.js`, `web/config/stage-monitors.json`, `web/config/crowd.json` | w1b | — | BL-0012, BL-0018, BL-0015 |
| `web/environment.js`, `web/sky-show.js`, `web/stage-players.js`, `web/config/environment.json`, `web/config/sky-show.json`, `web/config/stage-players.json` | w1c | — | BL-0004, BL-0005, BL-0006, BL-0013 |
| `web/seat-mode.js`, `web/config/seats.json` | w1a | wi(앉기 클립 연결) | BL-0019 |
| `web/multiplayer.js`, `web/ui/invite.js`, `web/nameplate.js`, `web/config/network.json` | net | wi(원격 아바타가 고른 캐릭터를 쓰는지 확인) | BL-0010, BL-0021, 결정 8(회차 고르기·전달), 결정 11·17(캐릭터·닉네임) |
| `web/character.js`, `web/avatar.js`(바깥 모양 유지) | f2(빈 자리) | wi | BL-0002, BL-0003, BL-0008, BL-0019 |
| `web/lighting.js`, `web/baked-lighting.js` | (기존) | wi(새 라이트맵 경로가 필요할 때만). environment.js는 이 파일을 고치지 않고 배경만 덮어쓴다 | BL-0004 |
| `art/environment/arena/` 아래 복사본 `.blend`, 경기장 내보내기·굽기 스크립트 | b5 | b6 | BL-0011, BL-0014, BL-0004 |
| `web/arena-<버전>.glb`, `web/lightmaps/<아틀라스>-<버전>.png` | b6 | — (원본 `web/arena.glb`·`web/lightmaps/*.png`는 그대로) | BL-0011, BL-0014, BL-0004 |
| `art/characters/fan/`, `web/assets/characters/fan.glb`(몸 4종·공용 뼈대), `web/assets/characters/fan-anim.glb`(클립 9개), 유니폼 텍스처 | b1→b2→b3 | — | BL-0002, BL-0003, BL-0008 |
| `web/assets/audio/sfx/` | vfx | — | BL-0008, BL-0013 |
| `package.json`, 잠금 파일, `.gitignore`, `tests/` | f1 | 각 흐름은 자기 시험 파일만 새로 만든다 | 전부 |
| `docs/live/web-metaverse-develop/architecture.md`, `asset-contract.md` | a1 | — (약속을 바꾸려면 a1 계열 Task를 새로) | 전부 |
| `docs/live/graphicmodel/art-direction.md` | ad | — | BL-0002, BL-0004~0006, BL-0018 |
| `docs/live/legal-review/legal-baseline.md` | l1 | — | BL-0003, BL-0012, BL-0016 |
| `docs/superpowers/specs/2026-11-12-room-service-design.md` | r1 | — | BL-0022 |
| `AGENTS.md`, `docs/harness/team-org.md`, `.claude/**` | h1 | retro | — |

### 5.3 항목별로 닿는 곳

| 항목 | 고치는 곳 | 흐름 | Blender | 다시 내보내기 | 다시 굽기 |
| --- | --- | --- | --- | --- | --- |
| BL-0002 새 캐릭터 4종(여 2·남 2, 머리 모양·인종 다르게, 결정 11) | `art/characters/fan/`, `fan.glb`(뼈대 하나에 몸 4종)·`fan-anim.glb`(4종이 함께 쓰는 클립 9개) → `character.js` | b1·b2·b3 → wi | 예(MCP 줄) | 아니오 | 아니오 |
| BL-0003 팀 선택·유니폼 | `ui/team-select.js`(팀과 캐릭터 4종을 한 창에서 고름), `teams.json`, `characters.json`; 유니폼은 저지 부분 재질 `Uniform`의 그림만 바꾼다(몸 위에 뜬 별도 옷 없음, 결정 13) — `character.js` | w1b → wi | b2의 `Uniform` 재질 자리 | 아니오 | 아니오 |
| BL-0004 밤·별·달·달빛 | `environment.js`(하늘·별·달·캐릭터 달빛, 지금보다 어둡게 — 결정 19); 정적 면의 달빛은 복사본 `.blend`의 달 조명 | w1c, b5·b6 | 예(배치) | 예 | 예(exterior·city) |
| BL-0005 바다 | `environment.js`. 걷는 면(`Walk_Plaza`, 서쪽 끝 x≈−180) 밖에 두고 해안선에 막는 면(`player.addBlocker`)을 둔다 | w1c | 아니오 | 아니오 | 아니오 |
| BL-0006 하늘 쇼 | `sky-show.js`, `sky-show.json`(빛줄기 3개, 결정 21); 큐 표는 vfx. 런타임은 설정 기본값으로 먼저 만들고 vfx의 큐는 wi가 넣는다(계획) | w1c → wi | 아니오 | 아니오 | 아니오 |
| BL-0007 티켓팅 | `ui/ticket.js` + `player.addBlocker`로 광장에서 처음 들어가는 입구(커튼월 개구부 x≈−95.6, F-15)를 막고 발급 시 해제. 이동 버튼은 `setTeleportGuard`로 막는다. 막는 면 좌표는 `ticket.json` 값(결정 30). 티켓 창은 애니메이션과 UI를 살린다(결정 16) | w1b | 아니오 | 아니오 | 아니오 |
| BL-0008 감정표현 4종 | 클립 4개·계란 소품(b3), 괴성 효과음(vfx), 재생은 `character.js` | b3, vfx → wi | 예(MCP 줄) | 아니오 | 아니오 |
| BL-0009 Alt 2x2 메뉴 | `ui/emote-menu.js`, `controls.json` | w1b → wi | 아니오 | 아니오 | 아니오 |
| BL-0010 16명 멀티 | `multiplayer.js`: 연결 중개는 PeerJS Cloud 그대로, 상태 메시지(팀·캐릭터·닉네임·감정표현·앉기), 정원 초과 안내(결정 25), 자동 닉네임 이름표 `nameplate.js`(결정 17) | net | 아니오 | 아니오 | 아니오 |
| BL-0011 뜬 사물·지지 기둥·계단 아래 | 복사본 `.blend`(g0가 목록, b5가 수정) | g0 → b5·b6 | 예(배치) | 예 | 예 |
| BL-0012 모니터 게임 화면 | `stage-monitors.js`: 런타임 UV(F-8)와 리그 오브 레전드와 비슷한 반복 화면(결정 22). 실제 게임 화면은 사용자가 파일을 주고 Riot 검토를 통과한 뒤 | w1b | 아니오 | 아니오 | 아니오 |
| BL-0013 프로게이머 랜덤 동작 | `stage-players.js`: 부위 관절 동작 + 고함 효과음(결정 2: 웹 런타임). 고함은 임시 소리로 먼저 만들고 진짜 효과음은 wi가 넣는다 | w1c → wi | 아니오 | 아니오 | 아니오 |
| BL-0014 관통·겹침 | 캐릭터 충돌은 `player-controller.js`, 오브젝트끼리 겹침은 복사본 `.blend` | w1a, g0 → b5·b6 | 예(배치) | 예 | 예 |
| BL-0015 먼 관중 텍스처 | `crowd-motion.js`: "멀리" = 2층 전체 + 보는 사람에서 경기장 중심 너머 반대편 관중석(결정 23). 셰이더가 정점 위치로 낮은 해상도 텍스처를 고른다. 수치는 perf | w1b, perf | 아니오 | 아니오 | 아니오 |
| BL-0016 스크린 유튜브 | `screen-video.js`, `vendor/CSS3DRenderer.js`, `screen.json`. 재방은 방의 회차 시작 시각으로 위치를 계산한다(결정 8, 5.4) | m | 아니오 | 아니오 | 아니오 |
| BL-0017 2층 진입 불가 | `player-controller.js`: `Walk_Tier1` 제외(F-6) | w1a | 아니오 | 아니오 | 아니오 |
| BL-0018 2층 마네킹 | `crowd-motion.js`: 2층 정점을 감추고 단순 마네킹을 인스턴스로, 환호 구간에만 움직임 | w1b | 아니오 | 아니오 | 아니오 |
| BL-0019 좌석 관람 | `seat-mode.js`, `seats.json`, 카메라 덮어쓰기 훅, 앉기 클립 | w1a → wi | b3의 `Sit` 클립 | 아니오 | 아니오 |
| BL-0020 Full Mode | `ui/full-mode.js` + `screen-video.js`의 API | m | 아니오 | 아니오 | 아니오 |
| BL-0021 초대 URL | `ui/invite.js`, `multiplayer.js`(주소의 방 코드로 입장, 들어온 사람은 그 방의 회차를 따른다) | net | 아니오 | 아니오 | 아니오 |
| BL-0022 방 서버 구조 설계 | 설계 문서만(5.2 경로). signaling = PeerJS Cloud, 서버 역할 = 방 id 목록과 회차별 배치, Vercel(필요하면 유료)은 방 id 목록·정적 호스팅의 후보, Cloudflare 임시 터널은 전제 아님, TURN은 후보 | r1 | 아니오 | 아니오 | 아니오 |
| BL-0023 드래그 중 커서·우클릭 메뉴 | `input.js` | w1a | 아니오 | 아니오 | 아니오 |
| BL-0024 휠 줌 | `camera-rig.js`, `camera.json` | w1a | 아니오 | 아니오 | 아니오 |

### 5.4 필수 두 항목의 방식 (BL-0016, BL-0020)

- **플레이어 하나.** 유튜브 공식 IFrame Player API로 플레이어 하나를 만든다(브리프의 "공식 임베드 플레이어"). 영상 픽셀을 WebGL 텍스처로 옮길 수 없으므로(교차 출처) DOM 그대로 3D에 놓는다.
- **3D 배치.** Three.js r170의 CSS3DRenderer로 플레이어 DOM을 스크린 면에 맞춰 놓는다. WebGL 쪽에는 그 자리를 투명하게 뚫는 판(색 0·알파 0, 섞기 없음)을 면 바로 앞에 둔다. 렌더러는 `alpha:true`(F2). 앞을 가리는 트러스·아바타는 깊이 검사로 영상 위에 그대로 그려진다. CSS 층은 캔버스 뒤에 두고 포인터를 받지 않는다(3D 조작을 막지 않게). 재생·소리·소스 전환은 앱 버튼으로 한다.
- **면.** 네 면 중 카메라를 가장 정면으로 향한 한 면에 영상을 놓고 나머지 면은 지금 그림을 둔다(결정 9). 면을 바꿀 때 DOM을 옮기지 않고 변환만 바꾸므로 재생이 끊기지 않는다.
- **비율.** 면이 3.4:1(F-4)이라 16:9 영상은 면 높이에 맞춰 가운데에 놓는다(결정 9).
- **소스.** `config/screen.json`에 VOD(`https://www.youtube.com/watch?v=rQTHR3aL0SE`)와 생방송(`https://www.youtube.com/watch?v=EacB7ADMGpY`) 두 칸을 둔다(결정 7). 생방송은 영상 ID와 채널 생방송 주소를 모두 받는다. 검증용 24시간 생방송은 받지 않았으므로 생방송 시험은 그 시각의 방송 상태를 따른다. 주소가 비었거나 임베드가 막혔거나 방송이 없으면 기존 그림을 두고 안내를 띄운다.
- **소리.** 브라우저 정책상 처음에는 소리 없이 재생하고, 입장 버튼을 누를 때 소리를 켠다(결정 9).
- **Full Mode.** 같은 플레이어 DOM에 Fullscreen API를 건다. 전체화면 요소는 최상위 층에 그려져 CSS3D 변환을 받지 않고, DOM을 옮기지 않으므로 재생 위치가 이어진다. 전체화면을 쓸 수 없는 환경(일부 자동 시험)에서는 창 전체를 덮는 방식으로 대신한다. Esc·F·닫기 버튼과 `fullscreenchange`로 끝내면 3D 화면과 원래 조작으로 돌아온다(결정 10).
- **시험.** `window.arena.screen`에 재생 상태·소스·현재 면·Full Mode 여부를 내놓는다. Playwright로 재생 상태, 스크린 면의 화면 투영 사각형과 플레이어 사각형의 겹침, Full Mode 진입·종료를 본다. 인터넷과 유튜브가 필요한 시험이므로 실패하면 원인(네트워크, 임베드 거부, 방송 없음)을 기록한다.
- **재방 회차(결정 8).** 재방은 10분 단위 회차로 돈다(매시 00·10·20·30·40·50분에 새 회차). 방 하나는 한 회차에 속하고, 방 안의 재생 위치 = 지금 시각 − 그 방의 회차 시작 시각이다. 화면 모듈이 이 값을 계산해 유튜브 주소의 시작 위치(`start`)로 넣어 강제로 맞추고, 중간에 들어온 사람도 같은 계산을 쓴다. 회차가 다른 사람끼리는 방이 달라 만나지 않는다. 방에 들기 전(혼자)은 방금 시작한 회차를 쓴다. 방을 만드는 사람이 회차를 고르고(기본: 방금 시작한 회차), 초대 링크로 들어온 사람은 방장이 알려 준 그 방의 회차를 따른다(`room:joined`의 `roundStart`). 회차 간격과 기본 회차는 설정값이다. 방의 영상이 끝나면 기존 스크린 그림과 안내를 보인다. 회차별 공개 방 찾기와 자동 배치는 BL-0022 문서에 담고 구현은 다음 단계다.
- **생방송.** 맞추지 않는다. 각자 자기 플레이어로 실시간 지점을 본다(결정 8).
- **각자 재생(결정 9·10).** 영상은 사용자마다 자기 화면의 플레이어로 본다. 한 사람의 영상을 다른 사람에게 보내지 않는다. Full Mode는 내 화면에만 유튜브 플레이어가 뜨는 것이며 캐릭터 앞에 스크린을 세우지 않는다.

### 5.5 자산 규칙

- **원본 보존.** 원본 `.blend`, `web/arena.glb`, `web/lightmaps/*.png`, 기존 텍스처·음원은 덮어쓰거나 옮기지 않는다. 경기장 수정은 복사본 `.blend`에서 하고 결과는 새 이름으로 낸다: `web/arena-<버전>.glb`, `web/lightmaps/<아틀라스>-<버전>.png`(`web/baked-lighting.js:27`의 경로 규칙 `./lightmaps/<이름>.png` 안). 앱이 읽는 경로만 바꾼다(wi).
- **이름 보존.** 다시 내보낼 때 런타임이 이름으로 찾는 것을 지킨다: `REF_Jumbotron_0`~`3`, `REF_Reused_Monitor_pixels__cyan`, `REF_Player*`, `Walk_*`, `Collide_*`, `Collide_TicketGate__silver`, `Audience_*`, 정점 속성 `_CM_*`·`_LIGHTMAP_UV`, extras `bakedLighting`·`crowdMotion`(`web/main.js:38-41`, `web/lighting.js:26-27`, `web/crowd-motion.js:58`).
- **새 자산 자리.** 원본은 `art/<종류>/<이름>/`, 웹용은 `web/assets/<종류>/<이름>.<확장자>`. 하네스의 `public/assets/`를 이 앱에 맞춘 것이며 정본은 A1의 자산 연동 규약이다.
- **팬 캐릭터 4종(결정 11·13).** 뼈대 하나(같은 뼈 이름·같은 기준 자세)에 몸 4종(여 2·남 2, 머리 모양·피부색·얼굴을 다르게)을 입혀 `web/assets/characters/fan.glb` 하나로 낸다. 클립 9개는 그 뼈대에 한 번만 만들어 `web/assets/characters/fan-anim.glb`로 따로 내고 4종이 함께 쓴다. 유니폼은 몸 메시의 저지 부분 재질 `Uniform`의 그림이다. 몸 위에 겹친 별도 옷 메시를 만들지 않는다.
- **압축.** Draco만 쓴다(F-10).
- **구하는 순서.** 소유자 자산 → `search_assets`(무료, 출처 기록) → 직접 제작. `generate_3d`와 Higgsfield는 쓰지 않는다(결정 28).
- **달 방향.** 값 하나를 자산 규약에 두고 굽기(b5의 달 조명)와 런타임(environment.js의 달·달빛)이 같이 읽는다.

### 5.6 약속의 출발값 (A1이 확정한다)

- **이벤트:** `team:changed {teamId}`, `character:changed {characterId}`, `emote:request {id}`, `emote:played {id}`, `emoteMenu:open`(티켓 창의 "응원하기"가 같은 메뉴를 연다, 결정 14), `ticket:issued {teamId}`, `seat:enter {seatId}`, `seat:exit`, `fullmode:enter`, `fullmode:exit`, `screen:state {source, playing, time, muted}`, `room:joined {code, host, roundStart}`, `room:left`, `peer:state {peerId, team, character, nickname, emote, emoteSeq, seated}`. 설계 승인 때의 `screen:remote`는 없앤다(재방 위치는 회차로 계산한다, 결정 8).
- **감정표현 ID와 클립 이름:** `cheer_clap`/`Emote_CheerClap`, `heart`/`Emote_Heart`, `angry`/`Emote_Angry`, `egg_throw`/`Emote_EggThrow`. 기본 클립 `Idle`, `Walk`, `Run`, `Jump`, `Sit`.
- **유니폼 자리:** 캐릭터 저지의 재질 이름 `Uniform` 하나. 팀별 그림은 `teams.json`이 가리킨다.
- **효과음:** `web/assets/audio/sfx/egg-scream_01.<확장자>`, `pro-shout_01`~`03`.
- **다른 참가자 상태(결정 11·17):** `pose`는 그대로 두고 `state {team, character, nickname, emote, emoteSeq, seated}`를 따로 보낸다. 방장은 들어온 사람에게 `room {roundStart}`를 보낸다.
- **캐릭터 ID:** `fan_f1`, `fan_f2`, `fan_m1`, `fan_m2`(GLB의 메시 이름과 같다). 닉네임은 들어올 때 자동으로 정한다(형식은 설정값).

## 6. 순서 제약 (창구 후보를 확인하고 고친 것)

### 6.1 Blender 한 줄

- **맞다.** Blender MCP는 실행 중인 Blender 하나를 함께 쓰고 점유 표시(`_workspace/graphicmodel/blender-lock.json`)로 한 Task만 쓴다(`blender-pipeline` 1절, `docs/harness/team-org.md:18`).
- **줄 순서:** g0(연결 확인·경기장 결함 조사, 읽기만) → b1(캐릭터 시트·블록아웃, 4종) → [ar1 아트 리뷰, Blender 안 씀] → b2(몸 4종·공용 뼈대 하나·`Uniform` 자리) → b3(공용 뼈대의 클립 9개·계란 소품). 캐릭터 사슬이 가장 길고 여섯 항목(BL-0002, BL-0003, BL-0007, BL-0008, BL-0009, BL-0019)이 기다리므로 먼저 선다. 4종이 뼈대와 클립을 함께 써서 b2·b3의 늘어남을 몸 2개(여·남)와 변형 4종 몫으로 줄인다(계획서). g0는 아트 디렉션(ad)과 같은 30분에 돌아 줄을 늦추지 않는다.
- **결정 6:** 그래픽 Blender Task는 모델 표대로 Codex로 먼저 띄운다. Codex가 Blender MCP에 붙지 못할 때만 `claude fable/max`로 바꿔 띄운다(사용자 예외).
- **줄 밖으로 뺀 것:** 아트 디렉션과 아트 리뷰, 이펙트 명세와 CC0 효과음, 성능 점검. 그리고 웹 런타임으로 옮긴 것: BL-0004의 하늘·별·달, BL-0005, BL-0006, BL-0012, BL-0018, BL-0015, BL-0013(결정 2).
- **결정 1(허용)에 따라** 경기장 수정(b5)과 굽기·내보내기(b6)는 MCP를 쓰지 않는 배치 Blender(`blender -b <복사본> -P <스크립트>`)로 줄 옆에서 돈다. 수정 목록은 g0가 MCP로 미리 뽑고, 수정·굽기·내보내기는 기존 파이프라인처럼 스크립트다(`web-export/export-web.py`, `web-lightmaps/bake-lightmaps.py`).
- 그래픽 팀의 동시 인원은 MCP 줄 1, 배치 1, graphic-leader 1, vfx 1로 4명 이하다.

### 6.2 GLB와 굽기: 1회씩

- **고쳐 씀.** 다시 굽기가 필요한 것은 정적 면을 바꾸는 BL-0011, BL-0014(자산 쪽), BL-0004(정적 면의 달빛) 셋뿐이다. 관중·선수는 라이트맵에서 빠져 있고(F-7, F-8), BL-0005·BL-0006·BL-0012·BL-0013·BL-0018은 런타임 추가물이므로 굽기와 내보내기가 필요 없다. BL-0002·BL-0003·BL-0008의 캐릭터는 별도 GLB다.
- 셋을 복사본 하나에 모두 반영한 뒤 **굽기 1회(7장 전부)·내보내기 1회**를 한다. 형상 수정이 끝나기 전에는 굽지 않는다. 지난 기록상 계산은 2~3분(F-9)이고, 시간은 옛 절대경로 정리와 검증에 든다.
- 내보낸 뒤 확인: glTF 검증 오류 0, 5.5의 이름 보존 목록 대조, `node .claude/skills/blender-pipeline/scripts/glb-inspect.mjs`의 수치, 기존 회귀 2개 통과.
- 굽기는 GPU 점유 표시를 잡는다(6.7).

### 6.3 기능 사슬

| 창구 후보 | 판정 | 근거와 처리 |
| --- | --- | --- |
| BL-0008 → BL-0009 → BL-0007 | 고침: 자산 의존만 | 메뉴와 티켓은 약속의 감정표현 ID·이벤트(5.6)로 먼저 만들고 임시 동작으로 시험한다. 진짜 클립은 wi에서 끼운다 |
| BL-0003 → BL-0007 | 맞음 | 티켓이 `team:changed`를 읽는다. 같은 흐름(w1b) 안의 차례 |
| BL-0002 → BL-0003 | 고침: 반쪽만 | 팀 선택 UI와 `teams.json`은 독립. 유니폼 입히기만 b2의 `Uniform` 자리에 의존 → wi |
| BL-0016 → BL-0020 | 맞음 | 같은 플레이어 DOM. 같은 흐름(m) 안의 차례 |
| BL-0016 → BL-0019 | 틀림 | 좌석 카메라는 GLB에 이미 있는 스크린 메시(F-4)만 본다 → w1a에서 병렬. 앉기 자세만 b3의 `Sit` 클립 → wi |
| BL-0010 → BL-0021 | 틀림(약함) | 방 기능은 이미 동작한다(F-11). 같은 파일이라 같은 흐름(net) 안의 차례일 뿐 |
| (추가) BL-0016 → 영상 동기화 | 없앰(결정 8) | 재방 위치는 화면 모듈이 방의 회차 시작 시각으로 계산한다. net은 `room:joined`의 `roundStart`만 알린다(이벤트 약속, 차례 의존 없음) |
| (추가) BL-0007 → 막는 면 API | 새로 | f2가 만드는 `player.addBlocker` |
| (추가) BL-0018 → BL-0015 | 새로 | 2층 마네킹이 곧 "멀리 있는 관중"의 낮은 텍스처다. 같은 흐름(w1b) |

**웹이 자산보다 먼저 출발할 수 있는가: 예.** 클립 이름·재질 이름·파일 경로·이벤트(5.6)를 A1이 W0에서 고정하고, 웹 흐름은 임시 자산으로 로직을 만든 뒤 wi에서 진짜 자산으로 바꾼다. 임시 자산은 제품에 남기지 않는다(`team-web-metaverse-develop`).

### 6.4 법무가 걸린 항목 (BL-0003, BL-0012, BL-0016)

l1(법무 기준) → l2(앞 검토, Riot 정책 ∥ 법률)는 W0~W1 초반에 끝난다(likely T+60~130). 구현 흐름은 기다리지 않고, 실제 콘텐츠를 붙이는 wi만 l2에 의존한다. 이번 phase는 배포·외부 게시가 없으므로(브리프) 공개 위험은 끝 검토(l3)에서 다시 본다. 이미 장면에 있는 GEN.G·BLG·Barclays Center·WORLDS 표지도 l1의 사실 표에 넣는다.

| 항목 | 법무 전에 해도 되는 것 | 앞 검토와 사용자 결정 뒤에 하는 것 |
| --- | --- | --- |
| BL-0016 | 플레이어·CSS3D·Full Mode·동기화 구현, 아무 공개 영상으로 로컬 시험 | 최종 영상·생방송 주소 고정, 앞 검토가 지적한 표시 방식(가림·최소 크기·브랜딩) 반영. l2는 BL-0016부터 본다 |
| BL-0003 | 팀 선택 UI, 유니폼 교체 구조, 로고 없는 팀 색 임시 유니폼 | 실제 팀 이름·로고·저지 그림 연결(wi) |
| BL-0012 | 모니터 재질·UV·반복 재생 구조, 게임 화면이 아닌 임시 반복 화면 | 실제 리그 오브 레전드 화면 소스 연결 |
| 공통 | 무료 CC0 자산과 효과음을 출처 표와 함께 사용 | 끝 검토에서 출처 대조 |

### 6.5 검증 토대 (누가, 언제)

- **f1**, 담당 `metaverse-web-developer`, W0 시작과 함께(likely T+60~95). 모든 구현 흐름은 f1 뒤다(`team-web-metaverse-develop`의 뼈대 Task 규칙).
- 담는 것: `package.json`(개발 의존성 Playwright만, 웹 결과물에 안 들어감), 잠금 파일, `.gitignore`의 `node_modules/`, 빈 포트에서 `web/`를 루트로 띄우는 서버 명령, 기존 `web/verify-tps.mjs`·`web/verify-jump.mjs`를 고정 주소 없이 돌리는 실행기(파일은 옮기지 않는다), 스모크 시험 1개(로드, `arena.ready`, 페이지 오류 0), GPU 점유 표시(6.7).
- **h1**이 f1이 실제로 돌린 명령을 `AGENTS.md`의 명령 절에 올린다(f1 직후, likely T+95~115). 이후 모든 완료 기준은 그 명령만 쓴다.

### 6.6 기준 문서 4개: 최소 범위와 시점

네 문서 모두 W0(코디네이터 기동 직후)에 함께 시작한다. 이번 범위에 필요한 절만 쓰고 나머지는 "이번 phase 밖"으로 둔다.

| 문서 | 흐름 | 최소 범위 | 기다리는 쪽 |
| --- | --- | --- | --- |
| `docs/live/web-metaverse-develop/architecture.md` | a1 | 5.1 모듈 표와 약속, 5.2 파일 소유, 설정 파일 목록, 점유 표시 규칙 | f2와 모든 웹 흐름 |
| `docs/live/web-metaverse-develop/asset-contract.md` | a1 | 5.5 자산 규칙과 이름 보존 목록, 5.6 클립·재질·효과음 이름, 캐릭터 예산 숫자, 달 방향 값, 새 GLB·라이트맵 버전 이름 | 그래픽 b1~b6, wi |
| `docs/live/graphicmodel/art-direction.md` | ad | 팬 캐릭터(결정 11), 기존 관중·선수와 같은 양식, 밤 색과 달빛 범위, 바다·하늘 쇼 색, 2층 마네킹 모양 | b1, b5, vfx, ar1, ar2 |
| `docs/live/legal-review/legal-baseline.md` | l1 | 서비스의 사실(개인 사용, 로컬만, 수익 없음 여부는 미결로), Riot 표지·게임 화면, 유튜브 임베드 조건, 팀·경기장 표지, CC0 출처, PeerJS로 오가는 정보 | l2, l3 |

### 6.7 GPU 하나

- 무거운 일: 라이트맵 굽기(b6), 브라우저 실행 검증(각 흐름의 시험과 끝 QA), 성능 실측(perf). Blender MCP의 `look`은 가벼워 제외한다.
- 점유 표시 `_workspace/gpu-lock.json`(git 밖)을 둔다. f1의 시험 실행기가 브라우저를 띄우기 전에 잡고 끝나면 놓는다. 기다림에는 상한을 두고 넘으면 ❌로 보고한다. b6과 perf도 같은 표시를 잡는다. 흐름이 몇 개든 무거운 일은 한 번에 하나다.
- 성능 실측은 다른 검증이 모두 끝난 뒤 혼자 돈다(`team-qa`).

## 7. 흐름과 시간

### 7.1 흐름 표

> 답 반영(2026-11-12): 이 절은 설계 승인 때의 흐름 단위 추정이다. 결정 1·2·3·4는 추천대로 받았다. 캐릭터 4종·닉네임·캐릭터 선택·재방 회차가 더해진 Task 단위 시간, 임계 경로, 기한 판정의 정본은 계획서의 `## DAG`와 `## 기한`이다. 그림 입력(`dag.json`, `waterfall.json`)은 계획 Task 단위로 바뀌었고, 이 표의 흐름 단위 사본은 `dag-design-v1.json`, `waterfall-design-v1.json`이다.

T+0 = 설계 승인. 시각 환산은 13:15 KST 승인 가정이며 기한 24:00 = T+645분이다. 승인과 답을 기다리는 시간(W1~W3)은 일정에서 뺐다. 시작~끝은 likely 일정이다. 흐름 id는 `dag.json`, `waterfall.json`과 같다.

| id | 흐름 | 팀·담당 | 항목 | 선행 | low / likely / high (분) | likely 시작~끝 | 자원 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| apr1 | 설계 승인 | 사용자 | — | — | W1 | 0 | — |
| plan | 계획서·Task DAG·배정 | planner | 23개 | apr1 | 35 / 50 / 80 | 0~50 | — |
| apr2 | 계획 승인 | 사용자 | — | plan | W2 | 50 | — |
| boot | 코디네이터 기동 | coordinator | — | apr2 | 5 / 10 / 15 | 50~60 | — |
| link | 백로그 연결(4단계) | product-manager | 23개 | boot | 10 / 15 / 25 | 60~75 | — |
| f1 | 검증 토대 | metaverse-web-developer | 전부 | boot | 25 / 35 / 60 | 60~95 | — |
| a1 | 아키텍처·자산 규약 | metaverse-develop-leader | 전부 | boot | 25 / 35 / 55 | 60~95 | — |
| ad | 아트 디렉션 | graphic-leader | BL-0002, BL-0004~0006, BL-0018 | boot | 20 / 30 / 45 | 60~90 | — |
| g0 | Blender 연결·경기장 조사 | graphic-model-designer | BL-0011, BL-0014 | boot | 20 / 30 / 50 | 60~90 | Blender |
| l1 | 법무 기준 | legal-leader | BL-0003, BL-0012, BL-0016 | boot | 25 / 35 / 50 | 60~95 | — |
| f2 | `main.js` 분할 | metaverse-3d-developer | 전부 | f1, a1 | 30 / 45 / 75 | 95~140 | — |
| h1 | 하네스 1차 | harness-engineer | — | f1 | 10 / 20 / 30 | 95~115 | — |
| r1 | 방 서버 구조 설계 문서 | metaverse-develop-leader | BL-0022 | a1 | 30 / 45 / 70 | 95~140 | — |
| l2 | 앞 검토(2명) | riot-policy-reviewer, legal-reviewer | BL-0016, BL-0003, BL-0012 | l1 | 25 / 35 / 55 | 95~130 | — |
| vfx | 이펙트 명세·효과음 | graphic-effect-vfx-designer | BL-0006, BL-0008, BL-0013 | ad | 25 / 40 / 60 | 90~130 | — |
| b1 | 캐릭터 시트·블록아웃 | graphic-character-designer | BL-0002 | ad, g0 | 30 / 45 / 75 | 90~135 | Blender |
| b5 | 경기장 수정(배치) | graphic-model-designer | BL-0011, BL-0014, BL-0004 | g0, ad | 50 / 75 / 120 | 90~165 | 배치 Blender |
| ar1 | 아트 리뷰 1 | graphic-leader | BL-0002 | b1 | 10 / 15 / 25 | 135~150 | — |
| b6 | 다시 굽기·내보내기 | graphic-model-designer | BL-0011, BL-0014, BL-0004 | b5 | 20 / 30 / 60 | 165~195 | GPU |
| m | **필수: 스크린 → Full Mode** | metaverse-3d-developer → metaverse-web-developer | BL-0016, BL-0020 | f2, h1 | 65 / 100 / 170 | 140~240 | — |
| w1a | 조작·충돌 → 좌석 | metaverse-3d-developer | BL-0023, BL-0024, BL-0017, BL-0014, BL-0019 | f2, h1 | 90 / 135 / 210 | 140~275 | — |
| w1b | 화면 흐름 → 무대·관중 | metaverse-web-developer → metaverse-3d-developer | BL-0003, BL-0009, BL-0007, BL-0012, BL-0018, BL-0015 | f2, h1 | 110 / 165 / 260 | 140~305 | — |
| w1c | 월드 연출 → 프로게이머 | metaverse-3d-developer | BL-0004, BL-0005, BL-0006, BL-0013 | f2, h1, vfx | 100 / 150 / 240 | 140~290 | — |
| net | 멀티 | metaverse-web-developer | BL-0021, BL-0010 | m | 50 / 75 / 110 | 240~315 | — |
| b2 | 캐릭터 모델·리그 | graphic-character-designer | BL-0002, BL-0003 | ar1 | 60 / 90 / 150 | 150~240 | Blender |
| cr1 | 중간 리뷰 1 | code-reviewer | BL-0016, BL-0020 | m | 15 / 25 / 40 | 240~265 | — |
| b3 | 캐릭터 클립 | graphic-character-designer | BL-0008, BL-0019 | b2 | 60 / 90 / 150 | 240~330 | Blender |
| wi | 진짜 자산 연결 | metaverse-3d-developer | BL-0002, BL-0003, BL-0007, BL-0008, BL-0009, BL-0019, BL-0004, BL-0011, BL-0014 | b3, b6, w1a, w1b, net, vfx, l2 | 40 / 60 / 100 | 330~390 | — |
| cr2 | 중간 리뷰 2(2명) | code-reviewer | 나머지 묶음, BL-0022 문서 | wi, r1 | 20 / 30 / 45 | 390~420 | — |
| l3 | 끝 검토(2명) | riot-policy-reviewer, legal-reviewer | BL-0003, BL-0012, BL-0016 | wi | 25 / 40 / 60 | 390~430 | — |
| ar2 | 아트 리뷰 2 | graphic-leader | BL-0002, BL-0004~0006, BL-0011~0013, BL-0018 | wi | 15 / 25 / 40 | 390~415 | — |
| qa | 끝 QA(4명) | qa-inspector | 23개 | cr2, cr1 | 45 / 70 / 110 | 420~490 | GPU |
| perf | 성능 점검 | graphic-performance-verifier | BL-0015, 전체 예산 | qa, l3, ar2 | 20 / 30 / 50 | 490~520 | GPU |
| fix | 수정 루프(High만, 최대 2회) | 원래 담당 | High | perf | 30 / 45 / 90 | 520~565 | — |
| recheck | 재검 | qa-inspector 등 | 고친 ID | fix | 15 / 25 / 40 | 565~590 | — |
| final | 최종 테스트 1회·정산 | coordinator | 23개 | recheck | 10 / 15 / 25 | 590~605 | — |
| close | 완료 처리(6단계) | product-manager | — | final, link | 10 / 15 / 25 | 605~620 | — |
| retro | 하네스 회고(7단계) | harness-engineer | — | final | 20 / 30 / 45 | 605~635 | — |
| apr3 | 커밋 승인 | 사용자 | — | close, retro | W3 | 635 | — |
| commit | 로컬 커밋 | coordinator | — | apr3 | 5 / 10 / 15 | 635~645 | — |

- 추정 근거: 코드 크기(F-1, `web/` 전체 약 45 KB), 지난 굽기·내보내기 실측(F-9), 앞 phase 워커의 소요(문서 Task 수 분~20분, 브라우저 검증 Task 약 20분). 캐릭터 줄(b1~b3)이 가장 불확실하다.
- 이 표는 결정 1(배치 Blender)·결정 2(BL-0013 런타임)를 추천대로 받는다고 가정한다.

### 7.2 임계 경로와 병렬 폭

- **임계 경로(likely):** apr1 → plan → apr2 → boot → ad → b1 → ar1 → b2 → b3 → wi → cr2 → qa → perf → fix → recheck → final → retro → apr3 → commit = **645분**. 그래픽의 캐릭터 줄이 길이를 정한다.
- **필수 흐름:** f1·a1 → f2 → m. 그래픽·법무·Blender를 기다리지 않는다. 끝: low T+160(15:55), **likely T+240(17:15)**, high T+400(19:55). 어떤 시나리오에서도 다른 구현 흐름보다 먼저 끝나고, 끝나자마자 cr1이 본다.
- **병렬 폭(작업 시간 합 ÷ 임계 경로):** low 1200 ÷ 425 = 2.82, likely 1815 ÷ 645 = 2.81, high 2925 ÷ 1065 = 2.75.
- **최대 동시 흐름:** 7(likely T+95~115: f2, h1, r1, l2, vfx, b1, b5). l2는 2명이므로 동시 워커는 8. 웹 개발 팀은 한때 4명 이하(T+140~305의 m·net, w1a, w1b, w1c).
- **추천 슬롯 수:** 8(결정 5).

### 7.3 기한 판정

| 시나리오 | 필수(m) 끝 | 23개 최종 테스트(final) 끝 | 커밋 끝 | 기한 24:00 |
| --- | --- | --- | --- | --- |
| low | 15:55 | 19:55 | 20:20 | 든다 |
| **likely** | **17:15** | **23:20** | **24:00** | 최종 테스트는 40분 남기고 들고, 커밋까지는 넘는다 |
| high | 19:55 | 다음 날 06:00 | 다음 날 07:00 | 넘는다 |
| likely, 결정 1·2 모두 거절(기준안) | 17:15 | 다음 날 02:05 | 다음 날 02:45 | 넘는다(최종 테스트 기준 +2시간 5분) |
| likely, 결정 1만 받음 | 17:15 | 다음 날 00:20 | 다음 날 01:00 | 넘는다 |
| likely, 결정 2만 받음 | 17:15 | 다음 날 01:05 | 다음 날 01:45 | 넘는다 |

**판정: 기한 안에 든다고 보장할 수 없다.** 필수 두 항목은 모든 시나리오에서 오늘 안(likely 17:15)에 끝난다. 23개 전부는 결정 1·2를 받아도 likely로 최종 테스트가 23:20이고, 이 값은 승인·답 대기를 뺀 것이라 여유가 거의 없다. high와 기준안은 넘는다.

**줄이는 방법** (모두 `## 사용자 결정 필요`에 추천과 함께 있다)

1. 경기장 수정·굽기·내보내기를 배치 Blender로(결정 1): 최종 테스트 −105분(likely, 결정 2를 받은 상태 기준).
2. BL-0013을 웹 런타임으로(결정 2): −60분(likely, 결정 1을 받은 상태 기준).
3. 기한의 기준을 "23개 최종 테스트 통과"로(결정 3): 완료 처리·회고·커밋 40분이 기한 밖으로 나간다.
4. 진행 점검과 미룰 순서(결정 4): 19:00, 21:30에 남은 임계 경로를 재고 넘칠 것 같으면 정해 둔 순서로 미룬다.
5. 그래픽 팀이 b2를 무료 CC0 리깅 캐릭터(`search_assets`)에서 시작하는 것은 `blender-pipeline` 3절 순서 안의 선택이라 사용자 결정 없이 아트 디렉션이 고른다. 줄면 임계 경로가 그만큼 준다.

## 8. 검증 흐름

| 시점 | 검증 | 담당 | 보는 것 |
| --- | --- | --- | --- |
| 각 구현 흐름 안 | 시험 먼저(실패 확인) → 구현 → `AGENTS.md` 명령 통과 | 구현 담당 | 자기 항목의 수락 기준 |
| b1 뒤 | 아트 리뷰 1(ar1) | graphic-leader | 캐릭터 시트·블록아웃의 형태(형태가 정해지는 지점, `team-graphicmodel`) |
| m 뒤(likely T+240) | 중간 리뷰 1(cr1) | code-reviewer | 필수 흐름의 변경. High면 m 담당이 바로 고쳐 필수가 끝 수정 루프를 기다리지 않게 한다 |
| wi 뒤 | 중간 리뷰 2(cr2, 2명: 3D 런타임 / UI·멀티) | code-reviewer | 나머지 묶음과 wi의 연결 변경. 같은 파일을 편집이 끝난 뒤 한 번만 본다(`team-qa`). BL-0022 문서의 네 요소 대조 |
| wi 뒤 | 끝 검토(l3), 아트 리뷰 2(ar2) | 법무 2명, graphic-leader | 실제 화면·문구·출처 / 최종 화면과 기준 문서 |
| 리뷰 뒤 | 끝 QA(qa, 4명) | qa-inspector | 영역 A 스크린·Full Mode·좌석(BL-0016, BL-0020, BL-0019) / B 캐릭터·팀·감정표현·티켓(BL-0002, BL-0003, BL-0008, BL-0009, BL-0007) / C 월드·무대·관중·경기장(BL-0004, BL-0005, BL-0006, BL-0011, BL-0012, BL-0013, BL-0014, BL-0017, BL-0018) / X 조작·멀티·횡단(BL-0023, BL-0024, BL-0010, BL-0021, 키보드·콘솔 오류·보안). 결함 ID 접두어 A-, B-, C-, X-. 16명 접속은 V01의 로컬 PeerJS 서버 방식을 다시 쓴다. 브라우저는 GPU 점유 표시로 차례대로 |
| 모든 검증 뒤 | 성능 점검(perf, 혼자) | graphic-performance-verifier | BL-0015 판정, BL-0018 삼각형 수, GLB·텍스처·드로 콜·데스크톱 FPS |
| 그 뒤 | 수정 루프(High만, 최대 2회) → 재검(고친 ID만) → 최종 테스트 1회 | 원래 담당, 찾은 검증자, coordinator | — |

아트·법무·성능·QA의 판정은 서로 대신하지 않는다. 각자 High가 0이어야 승인이다.

## 9. 하네스 문구 정리 (누가, 언제)

| 언제 | 누가 | 무엇 |
| --- | --- | --- |
| f1 직후(h1, likely T+95~115). 웹 구현 흐름보다 먼저 | harness-engineer | `AGENTS.md:11` 기술 스택을 "정적 Three.js r170 웹 앱(`web/`). Next.js 전환은 사용자 결정 전까지 하지 않는다"로. `AGENTS.md` 명령 절에 f1이 실제로 돌린 명령. `docs/harness/team-org.md:12-13` 편집 범위에 이 앱의 자리(`web/`, `web/assets/`, `art/`, 경기장 내보내기·굽기 스크립트, `package.json`·잠금 파일, `tests/`) |
| 7단계 회고(retro) | harness-engineer | 에이전트·스킬의 Next.js·`src/`·`public/` 전제 문구(22개 파일 31곳: `team-web-metaverse-develop`, `web3d-runtime`, `web-feature`, `web-architecture`, `blender-pipeline` 4절 출발값 등) |

회고까지 기다려도 되는 이유: 편집 범위를 막는 훅이 없고(F-13), 그동안은 코디네이터 spec의 편집 범위와 A1의 규약이 이긴다고 spec마다 적는다.

## 10. 설정값과 추천 기본값

값만 바꾸면 되는 것은 설정 파일로 두어 실행을 막지 않는다. 각 파일은 그 모듈의 흐름만 고친다.

| 파일 | 값 | 추천 기본값 | 결정 |
| --- | --- | --- | --- |
| `web/config/screen.json` | VOD, 생방송, 기본 소스, 회차, 면, 맞춤, 소리 | VOD `rQTHR3aL0SE`, 생방송 `EacB7ADMGpY`, 기본 소스 생방송, 회차 간격 10분, 기본 회차 = 방금 시작한 회차, 영상이 끝나면 기존 그림과 안내, 5초마다 계산값과 비교해 2초 넘게 어긋나면 다시 맞춤, 정면 한 면, 16:9 가운데, 처음 무음 → 입장 때 켬, 음량 70, 영상 소리 중 관중음 30% | 7, 8, 9 |
| `web/config/controls.json` | 키 배정 | 이동 WASD·화살표, 달리기 Shift, 점프 Space, 메뉴 Esc, 광장으로 R(지금 그대로), 감정표현 메뉴 Alt, 앉기 E, Full Mode F | 10, 15, 18 |
| `web/config/camera.json` | 거리 | 기본 5 m(지금 값), 최대 7.5 m, 최소 1인칭(눈높이), 휠 한 칸 0.5 m | 29 |
| `web/config/environment.json` | 별·달·달빛·바다·밤 밝기 | 별 3000개·은은한 반짝임, 달 고도 35°, 캐릭터 달빛 약하게, 밤은 지금보다 어둡게(하늘·별 밝기는 이 파일, 정적 면은 다시 굽기의 하늘 세기 — 자산 규약 값), 바다는 서쪽 광장 끝(x≈−180) 너머 | 19, 20 |
| `web/config/sky-show.json` | 빛줄기·폭죽 | 빛줄기 3개, 왕복 8초, ±25°, 기존 무대 빛줄기 수준의 투명도(`web/lighting.js:77`의 0.055), 폭죽 20~40초마다 1~3발 | 21 |
| `web/config/teams.json` | 팀 목록·유니폼 | GEN.G, BLG. 앞 검토 전에는 로고 없는 팀 색, 통과하면 기존 저지 그림을 저지 부분 재질 `Uniform`에 | 13 |
| `web/config/characters.json` | 캐릭터 4종 | `fan_f1`·`fan_f2`·`fan_m1`·`fan_m2`, 팀 선택 창에서 함께 고름, 기본은 첫 칸 | 11 |
| `web/config/ticket.json` | 막는 면·창이 뜨는 거리 | 막는 면 x −95.6, z −12.4~12.4, 높이 0~8.2(커튼월 개구부, F-15), 창은 3 m 안, 화면의 이동 버튼은 티켓 전 거부 | 16, 30 |
| `web/config/seats.json` | 앉을 자리·앉은 카메라 | 빈 좌석 목록(w1a가 조사), 눈높이에서 스크린을 향함, 시야각 45° | 18 |
| `web/config/stage-monitors.json` | 모니터 소스 | 리그 오브 레전드와 비슷한 반복 애니메이션(실제 게임 화면 아님, 파일 경로로 바꿀 수 있음) | 22 |
| `web/config/stage-players.json` | 선수 동작 | 선수마다 3~8초마다 다른 동작, 고함 확률 10% | 2 |
| `web/config/crowd.json` | 2층 기준·마네킹·먼 관중 | 2층 = 높이 5 m 위, 먼 관중 = 2층 전체 + 보는 사람에서 경기장 중심 너머 ±60° 안의 관중석, 먼 관중 텍스처 1/4, 마네킹 1/4 또는 단색, 환호 구간에만 움직임 | 23 |
| `web/config/network.json` | 정원·닉네임·회차 고르기 | 정원 16, 가득 참 안내 "방이 가득 찼습니다(16명)", 닉네임 = "팬" + 숫자 4자리(같은 방에서 겹치면 방장이 끝에 한 자리 더함), 방 만들 때 고를 회차 = 지난 2개·방금 시작한 회차·다음 2개 | 8, 17, 25 |

## 11. 위험

| # | 위험 | 줄이는 방법 |
| --- | --- | --- |
| R-1 | Codex 워커가 Blender MCP에 붙는지 아직 확인되지 않았다(작업 상태 메모 "첫 기동 확인") | g0가 W0 첫 30분에 확인. 실패하면 결정 6대로 그래픽 Blender Task를 `claude fable/max`로 다시 띄우고(사용자 예외), 그동안 Blender를 쓰지 않는 Task를 먼저 |
| R-2 | 캐릭터 줄(b1~b3)이 임계 경로이고 가장 불확실하다(high 375분) | 7.3의 5번(CC0 리깅 캐릭터에서 시작), 결정 4의 점검 |
| R-3 | 유튜브: 임베드가 막힌 영상, 방송이 없는 생방송, 자동 재생 정책, 헤드리스 재생. 검증용 24시간 방송은 받지 않았다(결정 7) | 안내 문구, 시험 실패 원인 기록. 생방송 판정은 그 시각의 `EacB7ADMGpY` 방송 상태를 따른다 |
| R-4 | 유튜브 이용 조건(플레이어 가림·최소 크기·브랜딩)에 3D 배치가 걸릴 수 있다 | l2가 BL-0016부터 본다. 걸리면 m이 표시 방식을 고친다 |
| R-5 | Alt 키가 브라우저 메뉴 막대(일부 브라우저)나 창 전환과 겹친다 | 기본 동작 막기, 결정 15, 끝 QA X에서 확인 |
| R-6 | 흐름들이 각자 브라우저 시험을 돌리면 GPU를 다툰다 | 점유 표시로 줄 세움(6.7). 기다림은 추정에 포함 |
| R-7 | 다시 내보내기에서 이름·정점 속성이 바뀌면 런타임이 깨진다 | 5.5의 이름 보존 목록 대조, 회귀 2개 |
| R-8 | 2층 관중을 정점 높이로 나누면 경계 좌석이 섞일 수 있다 | 높이 기준을 설정값으로, ar2가 대조 |
| R-9 | 법무 앞 검토가 실제 팀 표지·게임 화면을 막을 수 있다 | BL-0003·BL-0012는 임시 콘텐츠로 끝나고 결정 13·22의 대안을 쓴다 |
| R-10 | 다운로드가 이미 크다(GLB 120.6 MB + 라이트맵 약 151 MB)에 캐릭터·효과음이 더해진다 | perf가 예산 대조. 원본 라이트맵은 남기되 앱은 새 버전만 읽는다 |
| R-11 | 기한(계획서 `## 기한`) | 결정 1~4(받음), 계획서의 점검과 미룰 순서 |
| R-12 | 1층 좌석이 관중으로 차 있으면 사용자가 앉을 빈 좌석이 없다 | w1a가 먼저 조사한다. 없으면 통로 쪽 자리를 지정하거나 관중 한 줄을 비우는 방법을 코디네이터에 올린다(관중 파일은 w1b 소유) |
| R-13 | 개구부 바깥 유리면(`EXR_Entrance glazing`)에 충돌이 없어 캐릭터가 지나간다(F-16). 그대로 막으면 광장에서 건물로 못 들어갈 수 있다 | g0가 유리면에 문이 있는지 조사한다. 문이 있어 유리면이 첫 입구가 되면 `ticket.json`의 막는 면 값을 그 문으로 옮긴다. 문이 없으면 유리면을 막을지(문을 낼지)를 코디네이터가 사용자에게 묻는다 |
| R-14 | 재방 위치는 각자의 PC 시계로 계산한다. 시계가 틀린 PC는 그만큼 어긋난다 | 어긋남은 그 사람 화면에만 생긴다. 끝 QA A가 관찰로 적는다 |
| R-15 | 화면의 이동 버튼(lobby·arena)이 티켓 없이 입장을 건너뛴다(F-15) | `setTeleportGuard`로 막는다. 회귀 테스트의 `window.arena.go`는 그대로 둔다 |

## 사용자 결정 필요

없음. 설계 단계의 31개와 추가 질문은 모두 답을 받았다(2026-11-12, "설계승인"). 남은 미결은 계획서 끝 `## 사용자 결정 필요`에서 다룬다.

### 답 요약

출처는 브리프 `_workspace/_run/2026-11-12-requirements-build/brief.md`의 `## 사용자 결정` 표와 그 아래 "설계 결정 답 원문", "위 답의 적용", "추가 질문 답의 적용", "연결 구조에 대한 결정의 적용", "재방 구조의 적용"이다. 브리프와 이 표가 다르면 브리프가 맞다.

| # | 결정 | 답 | 원문 |
| --- | --- | --- | --- |
| 1 | 경기장 수정·굽기·내보내기를 배치 Blender로 | 허용(추천대로) | "나머진 추천대로" |
| 2 | BL-0013 프로게이머 동작 | A. 웹에서 부위 메시를 관절처럼 움직임(추천대로) | "나머진 추천대로" |
| 3 | 오늘 기한의 기준 | 23개 항목의 최종 테스트 통과. 완료 처리·회고·커밋은 그 뒤(추천대로) | "나머진 추천대로" |
| 4 | 진행 점검과 미룰 순서 | 19:00·21:30 점검, 설계의 순서대로 뒤쪽부터 미룸(추천대로) | "나머진 추천대로" |
| 5 | 슬롯 수 | 8(추천대로) | "나머진 추천대로" |
| 6 | Blender 연결 실패 때 배정 | 모델 표대로 Codex로 먼저, Codex가 Blender MCP에 붙지 못할 때만 그래픽 Blender Task를 `claude fable/max`로 | "6번 fable/max로 붙일것", 추가 질문 "Codex 실패 시에만" |
| 7 | 영상·생방송 주소 | 생방송 `https://www.youtube.com/watch?v=EacB7ADMGpY`, 재방 `https://www.youtube.com/watch?v=rQTHR3aL0SE`. 검증용 24시간 생방송 없음 | 원문 7, 추가 질문 |
| 8 | 재생 위치 맞추기 | 생방송은 각자. 재방은 10분 단위 회차, 방 하나 = 한 회차, 위치 = 지금 − 방의 회차 시작 시각을 주소의 시작 위치로 강제. 방 만드는 사람이 회차를 고르고(기본: 방금 시작), 초대로 들어온 사람은 그 방 회차. 영상이 끝나면 기존 그림과 안내. 회차별 공개 방 찾기는 BL-0022 문서 | 원문 8, "재방 구조의 적용"("1. 맞아 2. 맞아 3. 맞아 4. 맞아") |
| 9 | 스크린에 보이는 방식 | 각자 자기 화면의 플레이어로 본다. 그 밖은 추천대로(보는 사람 쪽 한 면, 면 높이에 맞춤, 처음 무음 → 입장 때 켬, 영상 소리 중 관중음 30%) | "9.각자 영상을 볼수있게할것." |
| 10 | Full Mode | 내 화면에만 유튜브 플레이어가 뜬다(캐릭터 앞 스크린 아님). 조작은 추천대로(버튼·F로 들어가고 Esc·F·닫기로 나옴) | 원문 10 |
| 11 | 새 캐릭터 | 여 2·남 2, 머리 모양과 인종을 다르게. 팀 선택 창에서 캐릭터도 함께 고르고, 고른 캐릭터가 같은 방 사람에게 보인다 | 원문 11, 추가 질문 "직접 선택 (Recommended)" |
| 12 | 기존 이동·응원 애니메이션 | 서기·걷기·달리기·점프·앉기 클립, 응원 = 감정표현 4종(추천대로) | "12. 추천대로" |
| 13 | 팀과 유니폼 | GEN.G·BLG(추천대로). 유니폼은 몸 위에 뜬 옷이 아니라 옷 자체의 그림 | 원문 13 |
| 14 | 응원하기와 Alt 메뉴 | 티켓 창의 "응원하기"가 같은 2x2 메뉴를 연다(추천대로) | "14. 그렇게해줘" |
| 15 | Alt 메뉴 닫기 | Alt로 열고 버튼·Alt·Esc로 닫음, 떼도 닫히지 않음(추천대로) | "15. 오케이" |
| 16 | 티켓 화면 | 추천대로, 애니메이션과 UI를 잘 살린다 | 원문 16 |
| 17 | 다른 참가자에게 보이는 것 | 유니폼·감정표현·앉은 상태(추천대로) + 자동으로 부여된 닉네임 | 원문 17 |
| 18 | 앉기·일어나기 | E 키·"앉기" 버튼, 카메라 눈높이·시야각 45°(추천대로) | "18.그렇게해줘" |
| 19 | 밤의 밝기 | 지금보다 어둡게. 값은 설정값 | "19. 좀어둡게해줘." |
| 20 | 바다 방향 | 광장에서 입구를 볼 때 등 뒤(서쪽) | "20. 맞음" |
| 21 | 하늘 쇼 | 빛줄기 3개, 나머지 추천대로(왕복 8초, 은은하게, 폭죽 20~40초마다 1~3발) | "21. 빚출기 3개" |
| 22 | 모니터 화면 | 리그 오브 레전드와 비슷한 반복 화면. 실제 게임 화면은 Riot 검토 통과가 조건 | "22. 롤비슷한화면으로" |
| 23 | 먼 관중 | 2층 전체와 보는 사람 기준 180도 반대편 관중석 | 원문 23 |
| 24 | TURN | 이번 phase는 하지 않음, 연결 실패 안내만(추천대로) | "24추천대로" |
| 25 | 정원 초과 | 17번째 사람에게 "방이 가득 찼습니다(16명)" 뒤 연결 닫음(추천대로). 무료 구간 크기 질문은 창구가 답함 | 원문 25 |
| 26 | 무료 구간 소진 | 감지 장치 없음, 다 쓰면 입장 불가(추천대로) | "나머진 추천대로" |
| 27 | BL-0022 뒤 구현 | 이번 phase는 설계 문서만(추천대로). 연결 구조는 PeerJS Cloud·방 id 목록·Vercel 후보 | "나머진 추천대로", 연결 구조 결정 |
| 28 | 유료 생성 도구 | 쓰지 않음(추천대로) | "나머진 추천대로" |
| 29 | 카메라 거리 | 줌아웃 7.5 m, 줌인 1인칭, 휠 한 칸 0.5 m(추천대로) | "나머진 추천대로" |
| 30 | 입구 위치 | 광장에서 건물로 처음 들어가는 입구. 좌표 확인(F-15): 커튼월 개구부 x≈−95.6이 첫 입구이고 기존 개찰구 줄은 그 안 4 m → 막는 면을 개구부로 옮김(자산은 그대로) | "30. 건물입구쪽. 그쪽 비슷한데 처음으로들어가지는 입구" |
| 31 | 완료 처리 배정 | 모델 표대로(`sonnet`), 예외 없음 | "31 모델표대로" |
| — | 연결 구조 | PeerJS Cloud, 방은 접속자가 만들고 방장, 운영자는 방 id 목록만. Cloudflare 임시 터널은 전제 아님. Vercel은 후보(이번 phase 사용·비용 없음) | 브리프 "연결 구조에 대한 결정의 적용" |
