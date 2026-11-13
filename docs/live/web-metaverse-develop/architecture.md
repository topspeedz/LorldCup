# 아키텍처

- 읽는 시점: 웹 코드(`web/`)의 Task를 받았을 때, 웹 Task의 spec을 쓸 때
- 역할과 소유 범위: 정적 Three.js 웹 앱의 구조, 모듈 경계, 모듈 사이의 약속, 방 구조, 상태의 소유, 고정 ID, 파일 소유, 설정 파일, 점유 표시
- 소유 에이전트: metaverse-develop-leader
- 마지막으로 갱신한 phase: 2026-11-13-ux-motion-rooms

자산의 형식·이름·예산은 `docs/live/web-metaverse-develop/asset-contract.md`가 정본이다. 이 문서는 그것을 가리키기만 한다. 이 문서의 Task 번호(T02, T11, …)는 모두 계획서 `docs/superpowers/plans/2026-11-13-ux-motion-rooms.md`의 번호다. T46b(화면 수정 구현)와 T59~T62(마우스 우선 개정, BL-0034·BL-0035)는 계획서 뒤에 더해진 Task다.

## 한눈에

앱은 빌드 단계가 없는 정적 ES 모듈 앱이다. `web/index.html`이 import map으로 `three`를 `web/vendor/three.module.js`(r170)에 잇고 `web/main.js` 하나를 부른다. PeerJS는 `web/vendor/peerjs.min.js`가 전역 `window.Peer`로 올린다. 서버 코드는 없다.

```
index.html ─▶ ui/loading.js (첫 페이지와 불러오기 가림막. main.js와 따로 뜬다)
           ─▶ main.js (부트스트랩)
               ├─ 뼈대      events.js · input.js · player-controller.js · camera-rig.js
               ├─ 기존 파일  lighting.js(→ baked-lighting.js) · crowd-motion.js · multiplayer.js(→ avatar.js, room-keys.js)
               └─ modules.js ─▶ 기능 모듈 14개 (각자 create(ctx))

기능 모듈 ─▶ ctx(뼈대가 내놓는 API)와 이벤트만 안다

ops.html ─▶ ops.js(→ room-keys.js)   운영자 화면. 앱 화면에서 잇지 않는 별도 페이지
```

의존의 방향은 한쪽이다.

- 뼈대는 기능 모듈을 모른다. `modules.js`의 목록을 돌 뿐이다.
- 기능 모듈은 다른 기능 모듈을 import하지 않는다. 서로 이벤트로 말한다. 예외는 둘이다: Full Mode 화면 요소가 화면 API(`window.arena.screen`)를 직접 부르고, 계란 이펙트(`character.js`)와 좌석(`seat-mode.js`)이 `window.arena.screen.faces`를 읽는다.
- 규칙은 화면과 통신 없이 부를 수 있게 둔다: `validPose`, `roundPosition`은 순수 함수다. 이동과 충돌은 `player-controller.js` 안에 있고 UI와 통신을 모른다. 방 찾기(`room-keys.js`)는 Peer 생성자와 설정값을 인자로 받아 가짜 Peer로 시험한다.
- 웹 런타임 라이브러리는 Three.js r170에 딸린 파일, PeerJS, 유튜브 공식 IFrame 플레이어뿐이다. `web/vendor/`에 넣는 파일은 원본을 고치지 않고 복사한다. 새 런타임 라이브러리를 더하지 않는다.

## 모듈

### 뼈대 (ctx에 실린다. 모듈 목록에는 없다)

| 파일 | 맡는 것 | 맡지 않는 것 |
| --- | --- | --- |
| `web/main.js` | 렌더러(`alpha:true`)·장면·카메라 만들기, GLB와 조명 불러오기, 설정 파일 읽기, `ctx` 만들기, 기존 파일 부르기, 모듈 등록, 프레임 루프, `window.arena`, 준비 알림(`app:ready`), 캔버스 클릭의 광선 판정(`world:click`) | 기능의 동작. 기능은 모듈 파일에 둔다 |
| `web/events.js` | 이벤트 이름 상수와 버스(`EventTarget`) 하나 | 상태 보관 |
| `web/modules.js` | 기능 모듈 목록(아래 표의 순서) | 모듈의 동작 |
| `web/input.js` | 키·마우스(드래그로 둘러보기, 드래그와 클릭 가르기), 드래그 중 커서, 우클릭 메뉴 막기, 키를 동작 이름으로 바꿔 이벤트로 내기. 포인터를 잠그지 않는다 | 동작이 일으키는 일(각 모듈이 듣는다), 클릭한 자리의 3D 판정(`main.js`) |
| `web/player-controller.js` | 이동·점프·충돌, 걷는 면 필터, 막는 면, 이동 잠금, 순간이동, 클릭한 자리로 걷기(`walkTo`), 좌석으로 날기(`flyTo`) | 카메라, 캐릭터의 겉모양과 애니메이션 |
| `web/camera-rig.js` | TPS 카메라, 장애물 피하기, 휠 줌, 1인칭, 덮어쓰기 훅 | 앉은 카메라의 값(좌석 모듈이 훅으로 준다) |

### 기능 모듈 (`web/modules.js`에 이 순서로 등록한다)

`tests/modules.spec.mjs`는 이 표의 첫 칸과 `web/modules.js`의 목록을 견준다. 순서는 `update`가 불리는 순서일 뿐 다른 뜻은 없다.

| 파일 | 맡는 것 | 맡지 않는 것 | 이번 phase에 고치는 Task(차례) | 담당 에이전트 |
| --- | --- | --- | --- | --- |
| `web/character.js` | 캐릭터 GLB·믹서·클립 전환·유니폼 그림 바꾸기·감정표현 재생과 그 이펙트, 계란의 비행과 스크린 명중(내 캐릭터와 원격 캐릭터) | 팀·캐릭터를 고르는 화면, 원격 상태 주고받기, 스크린 면의 위치 계산(`screen.faces`를 읽는다) | T18 → T28(클립에 딸린 앉기 보정 줄만) | metaverse-3d-developer |
| `web/screen-video.js` | 유튜브 플레이어 하나, CSS3D로 스크린 면에 놓기, 편성(생방송/재방을 정하는 규칙), 재방 회차 위치 계산, 상영 전 기다림, 소리 상태(켬·끔)와 설정 음량, 거리 음량, 화면 API(Full Mode 포함) | Full Mode 버튼과 키, 방의 회차를 정하는 일(`multiplayer.js`가 알린다) | T11 → T12 → T31(조작 막대와 Full Mode 버튼의 화면 부분만) | metaverse-3d-developer |
| `web/seat-mode.js` | 좌석에 앉기·일어나기, 앉은 카메라(덮어쓰기 훅), 빈 좌석 클릭의 판정과 날아가 앉기 | 앉기 클립 재생(`character.js`가 이벤트를 듣는다) | T30 | metaverse-3d-developer |
| `web/environment.js` | 밤하늘·별·달, 움직이는 대상의 달빛, 바다와 해안선 막는 면 | 정적 면의 달빛(라이트맵), `lighting.js` 수정 | 없음 | metaverse-3d-developer |
| `web/sky-show.js` | 빛줄기·레이저·폭죽 | 큐 값의 결정(`art/vfx/arena-show/cues.json`이 준다) | 없음 | metaverse-3d-developer |
| `web/stage-monitors.js` | 선수 모니터 화면(런타임 UV와 반복 화면) | 실제 게임 화면의 사용 판단(법무 검토) | 없음 | metaverse-3d-developer |
| `web/stage-players.js` | 프로게이머의 랜덤 동작과 고함 | 선수 메시의 수정 | 없음 | metaverse-3d-developer |
| `web/nameplate.js` | 머리 위 닉네임 이름표 | 닉네임을 정하는 일(`multiplayer.js`) | 없음 | metaverse-web-developer |
| `web/ui/hud.js`(새) | 틀의 동작: `#hud`의 `data-state`와 `body`의 `data-hud`, 알림(`hud:toast`를 받아 `#hud-toast`에 띄우고 쌓고 지우기), 키 힌트의 누름 반응 | 알림의 글과 낼 때(내는 모듈이 정한다), 조작 막대(`screen-video.js`), 다른 모듈이 틀의 자리에 붙인 요소, 정적 요소의 자리와 모양(`index.html`, `tokens.css`) | `## 결정 필요`의 첫 줄 | metaverse-web-developer |
| `web/ui/team-select.js` | 팀과 캐릭터 4종을 한 창에서 고르기 | 유니폼과 캐릭터를 실제로 바꾸는 일 | T29 | metaverse-web-developer |
| `web/ui/emote-menu.js` | Alt 2x2 감정표현 메뉴 | 감정표현 재생 | T30 | metaverse-web-developer |
| `web/ui/ticket.js` | 티켓 창, 입구 막는 면 | 팀 선택 화면, 감정표현 재생 | T29 | metaverse-web-developer |
| `web/ui/full-mode.js` | Full Mode 버튼·키·닫기 | 플레이어와 전체화면 전환(화면 API를 부른다) | T31 | metaverse-web-developer |
| `web/ui/invite.js` | '같이 보기' 버튼(초대 URL 복사·공유)과 그 결과 한 줄, 사람 수 줄(`#network-status`), 방 알림 | 연결과 메시지(`multiplayer.js`), 방 찾기(`room-keys.js`) | T15 → T32 | metaverse-web-developer |

UI 명세가 요구한 새 기능 모듈은 `web/ui/hud.js` 하나다. T27이 그 파일을 만들어 `web/modules.js`에 위 표의 자리(다른 UI 모듈 앞)로 등록한다. 다른 UI 모듈보다 먼저 만들어져야 그 모듈들이 내는 알림을 놓치지 않는다. 표가 14줄이 되므로 `tests/modules.spec.mjs`의 모듈 수 기대값도 T27이 맞춘다.

### 모듈 목록 밖의 파일 (`create(ctx)` 모양이 아니다)

| 파일 | 지금 부르는 모양 | 이번 phase에 고치는 Task(차례) |
| --- | --- | --- |
| `web/multiplayer.js` | `createMultiplayer(scene, getPose, ctx)`, `validPose(p)`, `uniqueNickname(name, taken)` | T14 → T15 → T32(화면 글자와 버튼 연결만) |
| `web/room-keys.js`(새) | 순번 방 키로 방을 찾고 자리를 잡는 함수. `multiplayer.js`와 `ops.js`가 import한다. Peer 생성자와 설정값을 인자로 받고 `network.json`을 직접 읽지 않는다. 함수 이름과 인자는 T13 리포트의 `## 넘기는 것`이 정본이다 | T13 |
| `web/ops.html`, `web/ops.js`(새) | 운영자 화면. 따로 여는 페이지이고 `main.js`를 부르지 않는다(`## 방 구조`의 `### 운영자 화면`) | T16 |
| `web/ui/loading.js` | `index.html`이 모듈 스크립트로 직접 부른다. 첫 페이지(`#panel`, `#broadcasts`, `#showtimes`)를 채우고, `#enter`의 `click`과 `app:ready`를 맞춰 `app:enter`를 내고, 그 사이 가림막(`#loading`, `#status`)을 보인다. `broadcasts.json`과 `screen.json`을 스스로 읽는다 | T29. 마우스 우선 개정은 `## 파일 소유` |
| `web/screen-mesh.js` | `createScreenMesh`. `screen-video.js`가 부른다 | 없음(읽기만) |
| `web/crowd-motion.js` | `createCrowdMotion(root, ctx)`. 버튼 인자(`audioButton`)를 없앤다. 관중 소리는 소리 상태를 따른다(`### 소리와 음량`) | 마우스 우선 개정은 `## 파일 소유` |
| `web/avatar.js` | `createAvatar(color)` | 없음 |
| `web/lighting.js` | `createHybridLighting(root, renderer, scene)` | 없음 |
| `web/baked-lighting.js` | `lighting.js`가 부른다 | 없음 |

`main.js`가 지금 이름의 팩토리를 지금 순서로 부른다. `createMultiplayer`에는 지금 인자 뒤에, `createCrowdMotion`에는 `root` 뒤에 `ctx`를 넘긴다.

## 약속

약속은 Task로만 바꾼다. 구현하다가 이름이나 모양이 맞지 않으면 코드를 맞춰 고치지 않고 `ask`로 올린다.

### 고정 약속 (바꾸지 않는다)

| 약속 | 지금 모양 | 누가 기대나 |
| --- | --- | --- |
| `window.arena`의 속성 | `ready, camera, player, avatar, multiplayer, crowd, lighting, go, attempt, groundAt, state`. `player`는 위치 `THREE.Vector3`, `state`는 `{x, y, z, walking, airborne, drawCalls, triangles}`. `walking`은 `input.walking`과 같은 값이다 | 회귀 시험 `web/verify-tps.mjs`, `web/verify-jump.mjs` |
| `window.arena.go(name)` | `plaza`, `lobby`, `arena`로 옮긴다. 화면에는 이 이동을 부르는 버튼이 없다 | 회귀 시험 |
| `createAvatar(color)` | 인자 색 하나, 반환 `THREE.Group`, `userData.material` | `web/multiplayer.js` |
| 위치 메시지 `pose` | `{type: 'pose', pose: [x, y, z, yaw]}` | 방장과 참가자 |
| `validPose(p)` | 길이 4, 모두 유한한 수, 위치 절댓값 1000 미만, yaw 절댓값 π 이하 | 회귀 시험(`validPose([0,0,0,0])`) |
| `window.arena.multiplayer`의 속성 | `leave, count, positions, connected, update` | 회귀 시험, QA |
| `window.arena.screen.faces` | 읽기 전용. 스크린 네 면의 배열 `[{name, position: [x, y, z], normal: [x, y, z], width, height}, …]`. 월드 좌표, 길이 m. `name`은 `screen.face`가 돌려주는 이름과 같다 | `web/seat-mode.js`, `web/character.js`(계란의 목표), 시험 |
| 고정 ID | `## 고정 ID와 index.html`의 남는 ID와 새 ID | 뼈대, UI 모듈, 시험 |

마우스 우선 개정이 `window.arena`에 닿는 곳은 아래가 전부다. 없애는 속성은 없다. `faces`, `pose`, `validPose`, `createAvatar`는 닿지 않는다.

| 속성 | 바뀌는 것 |
| --- | --- |
| `state.walking` | 이름과 형(불리언)은 그대로다. 참이 되는 때가 바뀐다: 포인터가 잠긴 동안 → 들어간 뒤 이동 입력을 받는 동안(`### 조작 모델 (마우스 우선)`) |
| `go(name)` | 그대로다. 이것을 부르던 화면 버튼(`#quick`)만 없어진다 |
| `crowd` | 객체와 `sounding`은 그대로다. 켜고 끄는 길이 `#crowd-sound`에서 소리 상태로 바뀐다(`### 소리와 음량`) |
| `multiplayer` | 고정 속성 다섯은 그대로다. `leave()`는 화면 버튼 없이 남는다. `join(key)`를 더한다(`### 멀티 손잡이`) |
| `screen` | `faces`는 그대로다. `state`에 `userVolume`을 더하고 `status`의 값에 `waiting`을 더한다(`### 이벤트`) |

### 모듈 약속

- 모듈은 `export function create(ctx)`를 내보내고 `{update?(dt, now), dispose?()}`를 돌려준다.
- `create`는 GLB와 조명이 준비된 뒤 한 번 불린다. 곧바로 돌려준다(Promise를 돌려주지 않는다). 네트워크처럼 오래 걸리는 준비는 뒤에서 하고 상태로 알린다. 유튜브가 막혀도 앱은 뜬다.
- `window.arena.ready`는 모든 모듈의 `create`가 끝난 뒤 참이 된다.
- `update(dt, now)`는 프레임마다 플레이어 이동 뒤, 카메라 배치와 렌더 앞에 등록 순서대로 불린다. `dt`는 초, `now`는 `requestAnimationFrame`의 밀리초다.
- 모듈은 시험용 손잡이를 `window.arena.<이름>`에 더할 수 있다. 위 고정 약속의 속성 이름을 덮어쓰지 않는다. 화면 모듈의 손잡이 이름은 `screen`이다.
- UI 모듈은 자기 DOM과 스타일을 실행 중에 `ctx.uiRoot`에 붙인다. `web/index.html`을 고치지 않는다. 이번 phase의 예외와 지켜야 할 요소는 `## 고정 ID와 index.html`에 있다. 틀이 자리를 내준 요소(`#dock`, `#settings`, `#network`에 붙는 것)는 `ctx.uiRoot`가 아니라 그 자리에 붙인다.
- 잠깐 뜨는 알림은 모듈이 직접 그리지 않고 `hud:toast`로 낸다. 알림 요소는 `#hud-toast` 하나다.
- 글자를 치는 중(`input`, `textarea`에 포커스)에는 이동 키와 동작 이벤트를 내지 않는다.
- 들어가기에 걸린 일(자동 배치, 소리 켜기, 걷기 입력 켜기, HUD 보이기)은 `#enter`의 `click`이 아니라 `app:enter`를 듣는다. 클릭이 경기장 준비보다 먼저일 수 있다.

### ctx

| 키 | 무엇 |
| --- | --- |
| `THREE` | three r170 모듈 |
| `scene`, `camera`, `renderer` | 장면, 원근 카메라, WebGL 렌더러 |
| `root` | 경기장 GLB의 `gltf.scene` |
| `cssLayer` | CSS3D용 DOM 층. 캔버스 뒤에 있고 포인터를 받지 않는다 |
| `uiRoot` | UI DOM을 붙이는 자리. 캔버스 위에 있다 |
| `events` | 버스. `web/events.js`의 `EventTarget` 하나 |
| `config(name)` | `web/config/<name>.json`을 읽은 객체를 곧바로 돌려준다. `main.js`가 `create`와 기존 팩토리를 부르기 전에 모두 읽어 둔다 |
| `player` | 아래 플레이어 API |
| `cameraRig` | 아래 카메라 API |
| `input` | 아래 입력 API |
| `multiplayer` | `window.arena.multiplayer`와 같은 객체 |

### 플레이어·카메라·입력 API

| API | 동작 |
| --- | --- |
| `player.position` | 위치 `THREE.Vector3`. `window.arena.player`와 같은 객체다. 모듈은 읽기만 한다 |
| `player.avatar` | 내 아바타 `THREE.Group`. `window.arena.avatar`와 같은 객체다 |
| `player.addBlocker(mesh)`, `player.removeBlocker(mesh)` | 메시를 막는 면에 더하고 뺀다. 보이지 않는 메시도 된다 |
| `player.setLocked(bool)` | 참이면 이동과 점프 입력을 듣지 않는다 |
| `player.teleport(target)` | 순간이동은 이것 하나다. `target`은 자리 이름(`plaza`, `lobby`, `arena`) 또는 `[x, y, z, yaw]`(`pose`와 같은 모양) |
| `player.walkTo([x, y, z])` | 그 자리를 향해 걷기 시작한다. 첫 클릭은 키로 걷는 것과 같은 속도와 충돌로 곧게 가고, 닿거나 더 가까워지지 못하면 멈춘다. 막힌 자리에서 같은 쪽을 다시 클릭하면 정지점 반경 8m 안의 고정 후보 49개에서 기존 이동 검사를 통과하여 목표에 더 가까워지는 곳까지 국소 우회한 뒤 직선 걷기를 잇는다. 후보가 없으면 그대로 멈추며 전역 길 찾기는 하지 않는다. 이동 키·터치 버튼·이동 잠금·순간이동·`flyTo`가 걸리면 그만둔다 |
| `player.flyTo([x, y, z, yaw], seconds)` | 그 자리까지 포물선으로 날고, 착지하면 풀리는 `Promise`를 돌려준다. 나는 동안 충돌을 보지 않고 이동 입력을 듣지 않으며 `airborne`이 참이다. `seat-mode.js`만 부른다 |
| `cameraRig.setOverride(fn)` | `fn(camera, dt)`가 프레임마다 카메라를 직접 놓는다. `null`을 주면 TPS 카메라와 기본 시야각으로 돌아간다 |
| `input.releasePointer()`, `input.capturePointer()` | 이동 입력을 끄고(눌린 키를 지운다), 다시 켠다. 이름은 지키고 포인터는 건드리지 않는다. 어느 코드도 `requestPointerLock`을 부르지 않는다 |
| `input.down(action)`, `input.keys` (Set) | 동작 키가 눌렸는지 읽고, 눌린 키 집합을 읽거나 복원한다(`seat-mode.js`) |
| `input.walking` | 읽기 전용. 이동 입력을 받는 중이면 참이다. `app:enter`에서 참이 되고 위 두 함수가 끄고 켠다. `body`의 `walking` 클래스, `window.arena.state.walking`과 같은 값이다. 바뀔 때 이벤트를 내지 않으므로 `update`에서 읽는다 |

### 조작 모델 (마우스 우선)

사용자 결정이다(UX 명세 `hud-controls.md`의 H-D1, H-D2). 흐름과 문구는 UX 명세가 정본이고, 이 절은 뼈대와 모듈 사이의 약속만 정한다.

- 포인터를 잠그지 않는다. 커서는 늘 보이고, 화면의 버튼은 들어간 뒤 어느 상태에서나 눌린다. `walking` 값으로 화면 요소를 숨기지 않는다.
- 둘러보기는 캔버스 위에서 왼쪽 버튼을 누르고 끄는 것이다(지금 `input.js`의 드래그 길). 놓으면 커서가 그대로 남는다.
- 키보드 이동은 그대로다. 이동 입력을 끌 때만 눌린 키를 지우고, 걷는 중의 클릭은 눌린 키를 지우지 않는다(`web/input.js:9`의 지금 동작). 달리기(Shift)도 그대로다.
- Esc는 `input.js`에서 아무 일도 하지 않는다. `controls.json`의 `menu`를 없앤다. 자기 창을 Esc로 닫는 모듈(팀 창, 티켓 창, 감정표현 메뉴, Full Mode)은 지금처럼 자기가 듣는다.
- 클릭: 캔버스를 누른 뒤 시점을 돌리지 않고 뗀 것이 클릭이다. `input.js`가 드래그와 가르고(끈 거리의 문턱은 구현이 정한다), `main.js`가 그 자리로 광선을 쏴 `world:click`을 낸다. 듣는 쪽이 `preventDefault()`를 부르지 않았고 `point`가 있으면 `main.js`가 `player.walkTo(point)`를 부른다.
- 바닥 클릭 걷기: 지금의 충돌(벽, 의자, 막는 면)과 미끄러짐을 그대로 쓴다. 못 가는 곳을 누르면 갈 수 있는 데까지 가서 멈춘다. 막힌 뒤 같은 쪽 재클릭만 위의 8m·49후보 국소 우회를 시도하며 중간에는 잠시 목표와 멀어질 수 있지만 도착 후보는 정지점보다 목표에 가까워야 한다. 티켓 전의 입구는 막는 면 앞에서 멈추고, 티켓 창은 지금처럼 거리로 뜬다.
- 빈 좌석 클릭: `seat-mode.js`가 `world:click`의 `ray`로 빈 좌석의 표시를 맞혔는지 본다. 맞혔으면 `preventDefault()`를 부르고 `player.flyTo`로 그 좌석까지 날린 뒤, 착지하면 지금의 앉기를 그대로 한다(`seat:enter`. 그 사이 자리가 찼으면 지금의 앉기 실패 알림). 나는 동안 `player.airborne`이 참이라 `character.js`가 `Jump` 클립을 튼다.
- 다른 사람의 화면: 새 메시지를 만들지 않는다. 나는 위치는 `pose`로, 앉은 것은 `state`의 `seated`로 간다. 원격 캐릭터의 `Jump`는 지금처럼 `character.js`가 받은 위치의 높이로 판정한다. `pose`와 `validPose`의 모양은 바뀌지 않는다.
- 터치는 지금처럼 `#touch`의 방향 버튼과 드래그다. 탭은 클릭과 같은 약속을 탄다.
- 날아가는 시간과 포물선의 높이는 `seats.json`에 둔다(설정 파일 절의 표).

### 이벤트

이름은 `web/events.js`의 상수로 쓴다. 버스는 표준 `EventTarget`이다: `events.dispatchEvent(new CustomEvent(name, {detail}))`로 내고 `events.addEventListener(name, e => e.detail)`로 듣는다. 버스는 마지막 값을 갖고 있지 않다. 늦게 듣기 시작한 쪽은 주인에게서 읽는다(`## 상태의 소유`).

| 이벤트 | 담는 것 | 내는 쪽 | 듣는 쪽 |
| --- | --- | --- | --- |
| `app:ready` | 없음. `window.arena.ready`가 참이 된 바로 뒤에 한 번 낸다 | `main.js` | `ui/loading.js`(늦게 듣기 시작했으면 `window.arena.ready`를 읽는다) |
| `app:enter` | `{broadcastId, showtime, roomKey}`. `broadcastId`는 `broadcasts.json`의 `id`, `showtime`은 고른 상영 시각(epoch 밀리초) 또는 `null`(생방송, `t` 없는 초대), `roomKey`는 초대받은 방 키 또는 `null`. 한 번만 낸다: 들어가기 클릭과 `app:ready` 가운데 늦은 쪽에서. 준비가 먼저였으면 클릭 처리 안에서 곧바로 낸다 | `ui/loading.js` | `input.js`(이동 입력 켬), `multiplayer.js`(자동 배치), `screen-video.js`(플레이어 만들기, 소리 켬, 상영 시각), `ui/hud.js`, `ui/invite.js`, `ui/team-select.js`, `character.js`·`stage-players.js`(오디오 풀기) |
| `world:click` | `{ray: {origin: [x, y, z], direction: [x, y, z]}, point: [x, y, z] 또는 null}`. `point`는 광선이 걷는 면과 만난 자리다. 취소할 수 있는 이벤트다(`cancelable: true`). 아무도 취소하지 않으면 `main.js`가 `point`로 걷게 한다 | `main.js` | `seat-mode.js`(빈 좌석을 맞혔으면 취소한다) |
| `input:action` | `{action, down}`. `action`은 `web/config/controls.json`의 동작 이름(`emoteMenu`, `sit`, `fullMode`), `down`은 누르면 참·떼면 거짓 | `input.js` | `ui/emote-menu.js`, `seat-mode.js`, `ui/full-mode.js` |
| `team:changed` | `{teamId}`. `web/config/teams.json`의 id | `ui/team-select.js` | `character.js`, `ui/ticket.js`, `multiplayer.js` |
| `character:changed` | `{characterId}`. `fan_f1`, `fan_f2`, `fan_m1`, `fan_m2` | `ui/team-select.js` | `character.js`, `multiplayer.js` |
| `emote:request` | `{id}`. `cheer_clap`, `heart`, `angry`, `egg_throw` | `ui/emote-menu.js` | `character.js` |
| `emote:played` | `{id}` | `character.js` | `ui/ticket.js`, `multiplayer.js` |
| `emoteMenu:open` | 없음 | `ui/ticket.js`("응원하기") | `ui/emote-menu.js` |
| `teamSelect:open` | 없음 | `ui/ticket.js`("팀 고르기") | `ui/team-select.js` |
| `ticket:issued` | `{teamId}` | `ui/ticket.js` | 정해진 쪽 없음 |
| `seat:enter` | `{seatId}`. `web/config/seats.json`의 id | `seat-mode.js` | `character.js`, `multiplayer.js`, `screen-video.js`(거리 음량), `ui/hud.js` |
| `seat:exit` | 없음 | `seat-mode.js` | `character.js`, `multiplayer.js`, `screen-video.js`(거리 음량), `ui/hud.js` |
| `fullmode:enter`, `fullmode:exit` | 없음 | `screen-video.js`(Full Mode 상태의 주인) | `ui/full-mode.js`, `ui/hud.js` |
| `screen:state` | `{source, playing, time, muted, status, error, volume, userVolume}`. `time`은 초. `status`는 재생 상태 이름이고, 이 문서가 고정하는 값은 `playing`, `ended`(재방이 그 회차의 끝에 닿음), `waiting`(고른 상영 시각이 아직 오지 않음)이다. `muted`는 소리 상태다(거짓이 켬). `volume`은 플레이어에 건 음량(0~100, 거리 비율을 곱한 값), `userVolume`은 설정 음량(0~100, 거리 비율을 곱하기 전)이다 | `screen-video.js` | `ui/full-mode.js`, `multiplayer.js`(방장이 `status: 'ended'`를 보고 회차를 넘긴다), `crowd-motion.js`(관중 소리), `character.js`·`stage-players.js`(효과음) |
| `room:joined` | `{code, host, roundStart}`. `code`는 방 키(`"01"`), `host`는 내가 방장인지(불리언), `roundStart`는 그 방의 회차 시작 시각(epoch 밀리초). 방에 처음 들 때 한 번 낸다. 방장 넘기기에서는 다시 내지 않는다 | `multiplayer.js` | `screen-video.js`, `ui/invite.js`, `nameplate.js` |
| `room:left` | 없음. `multiplayer.leave()`가 불려 방에서 나갈 때만 낸다. 화면에는 나가는 버튼이 없다. 방장이 끊기거나 혼자 남을 때는 내지 않는다 | `multiplayer.js` | `screen-video.js`, `ui/invite.js`, `nameplate.js`, `character.js` |
| `room:state` | `{key, count, host, phase}`. `key`는 방 키 또는 `null`, `count`는 방장을 포함한 지금 인원(방이 없으면 1), `host`는 내가 방장인지, `phase`는 아래 표의 값. 네 값 가운데 하나라도 바뀔 때마다 낸다 | `multiplayer.js` | `ui/invite.js`, `screen-video.js` |
| `room:round` | `{roundStart}`. 방이 다음 회차로 넘어갔다. 새 `roundStart`는 앞의 값보다 크다 | `multiplayer.js` | `screen-video.js` |
| `peer:state` | `{peerId, team, character, nickname, emote, emoteSeq, seated}`. 다른 참가자 한 명의 상태. `emoteSeq`는 감정표현마다 하나씩 오른다 | `multiplayer.js` | `character.js`, `nameplate.js` |
| `hud:toast` | `{text, tone, ms}`. `text`는 보일 글(글자로만 넣는다. HTML로 넣지 않는다), `tone`은 `info`(없으면 이것) 또는 `warning`, `ms`는 보이는 시간(밀리초, 없으면 UI 명세의 기본 시간) | `ui/ticket.js`(막힘), `ui/emote-menu.js`(앉아서 보낸 감정표현), `seat-mode.js`(앉기 실패), `ui/invite.js`(들어옴, 친구 방이 가득 참) | `ui/hud.js` |

`room:state`의 `phase`:

| 값 | 뜻 |
| --- | --- |
| `idle` | 방이 없다. `app:enter` 전, `leave()` 뒤, 들어갈 방을 끝내 찾지 못했을 때 |
| `connecting` | 자동 배치나 초대 링크 입장으로 방을 찾는 중 |
| `room` | 방 안. 둘 이상이 있다 |
| `handoff` | 방장이 끊겨 새 방장에게 다시 잇는 중 |
| `solo` | 방장이고 혼자다(혼자 시청). 방 키를 쥐고 있고 빈자리가 있는 방이다 |

- 마우스 우선 개정이 `web/events.js`에 더할 상수는 `APP_READY = 'app:ready'`, `APP_ENTER = 'app:enter'`, `WORLD_CLICK = 'world:click'` 셋이다. 나머지는 들어가 있다.
- `phase`의 값은 화면 글자가 아니다. 화면은 사람 수 줄만 보인다(`## 고정 ID와 index.html`의 `#network-status`).
- 알림은 한 번에 `#hud-toast`에 둘까지 쌓인다. 셋째가 오면 가장 오래된 것을 지운다. 쌓는 수와 기본 시간의 값은 UI 명세가 정본이다.
- 감정표현의 이펙트와 계란은 새 메시지 없이 `peer:state`의 `emoteSeq`로 원격 아바타에서 재생한다. `emoteSeq`가 앞에 본 값보다 클 때만 재생하고, 원격 아바타를 다시 만들 때는 마지막 감정표현을 다시 재생하지 않는다.
- 코드에 팀 id와 좌석 id를 적지 않는다. 설정 파일에서 읽는다.

### 화면 API

`window.arena.screen`은 `screen-video.js`가 만든다.

| 손잡이 | 무엇 |
| --- | --- |
| `state` | `screen:state`와 같은 객체를 그때 만들어 돌려준다 |
| `source` | 지금 플레이어에 건 소스. `vod`(재방) 또는 `live`(생방송) |
| `schedule` | 편성 상태(읽기 전용). `{source, slot, fallback}`. `source`는 편성 규칙이 지금 정한 소스, `slot`은 지금 걸린 시간표 칸 `{from, to, source}` 또는 `null`(시간표 밖), `fallback`은 생방송 칸인데 생방송이 나오지 않아 재방으로 넘어가 있으면 참. T11이 만든다 |
| `face`, `faces` | 지금 영상을 놓은 면의 이름, 네 면(고정 약속). T11·T12·T31은 `faces`의 모양을 바꾸지 않는다 |
| `roundStart` | 지금 재방 위치의 기준인 회차 시작 시각 |
| `fullMode`, `enterFullMode()`, `exitFullMode()` | Full Mode 상태와 전환 |
| `setSource(value)` | 시험 손잡이다. 화면에는 소스를 고르는 요소가 없다. 부르면 그 소스로 바꾸고, 편성이 다음 칸 경계에서 다시 정한다(그때까지 `source`와 `schedule.source`가 다를 수 있다) |
| `play()`, `pause()`, `setMuted(bool)`, `setVolume(0~100)` | 조작 막대와 시험이 부른다. `setVolume`은 설정 음량이고 거리 비율은 그 위에 곱해진다 |
| `element`, `fullModeElement`, `controlsElement` | 플레이어, Full Mode, 조작 막대의 DOM |

순수 함수 `roundPosition(nowMs, roundStartMs, durationSec)` → `{seconds, ended}`.

편성(BL-0026). 값은 `web/config/screen.json`에 있다.

- 생방송/재방을 사용자도 방장도 고르지 않는다. 시간표 칸 안이면 그 칸의 소스, 밖이면 시간표 밖 소스(재방)다.
- 생방송 칸에서 생방송이 오류, 방송 없음, 대기 상한에 걸리면 그 칸이 끝날 때까지 재방으로 넘어간다(`schedule.fallback`).
- 모두가 같은 설정을 읽으므로 같은 방 사람은 같은 소스를 본다. 소스는 방 메시지로 보내지 않는다.

### 소리와 음량

소리는 들어가면 켜져 있다(사용자 결정, BL-0034). 켜는 버튼을 누를 일이 없다. 거리 음량은 BL-0027이다.

- 소리 상태(켬·끔)와 설정 음량은 하나씩이고 주인은 `screen-video.js`다. `screen:state`의 `muted`(거짓이 켬)와 `userVolume`으로 나간다. 관중 소리, 감정표현 효과음, 선수 고함은 이 상태를 따른다. 따로 켜는 버튼(`#crowd-sound`)은 없다.
- 켜는 때: `app:enter`를 받을 때 한 번. `screen.json`의 `unmuteOnEnter`가 참이면 소리를 켠다(`setMuted(false)`).
- 자동 재생 정책: 브라우저는 사용자 동작 없이 소리 나는 재생을 막는다. 소리를 켜는 근거는 들어가기 클릭이다.
  - 관중 소리와 효과음: 경기장이 클릭보다 먼저 준비됐으면 `app:enter`가 클릭 처리 안에서 곧바로 나간다. 듣는 쪽은 그 자리에서 재생과 오디오 풀기를 건다. `await`나 타이머 뒤로 미루지 않는다.
  - 영상: 유튜브 플레이어는 `app:enter` 뒤에 만들어지므로(`## 방 구조`의 `### 방송과 상영 시각`) 소리 나는 재생은 늘 클릭 처리 밖에서 걸린다. 클릭이 준비보다 먼저였을 때의 관중 소리도 같다. 브라우저가 앞선 클릭을 근거로 허락하면 켜지고, 아니면 아래 실패 상태가 된다.
- 실패 상태(브라우저가 막음): 소리 상태를 끔으로 되돌린다(`muted`가 참). 영상은 음소거로 계속 재생한다. 관중 소리는 멈춰 있다(`window.arena.crowd.sounding`이 거짓). 조작 막대의 소리 버튼이 "소리 켜기"로 보이고, 한 번 누르면(새 사용자 동작) 켜진다. 안내 상자와 알림을 띄우지 않는다.
  - 영상이 막힌 것은 소리를 풀고 건 재생이 시작되지 않는 것으로 안다(지금 `screen-video.js`의 `blocked` 판정). 관중 소리가 막힌 것은 `audio.play()`가 거절되는 것으로 안다.
  - 영상은 켜졌는데 관중 소리만 막혔으면 소리 상태는 켬으로 두고, `crowd-motion.js`가 다음 사용자 동작(`pointerdown`이나 `keydown`)에서 한 번 다시 건다.
- 관중 소리(`crowd-motion.js`): `muted`가 거짓이면 재생하고 참이면 멈춘다. 음량 = `crowdVolume` × (`userVolume` ÷ `screen.json`의 `volume`), 1을 넘지 않게 한다. 설정 음량이 처음 값이면 지금과 같은 `crowdVolume`이다. 거리 비율은 곱하지 않는다. 음원을 받지 못했으면 조용히 두고 콘솔에만 적는다.
- 감정표현 효과음(`character.js`)과 선수 고함(`stage-players.js`)은 소리 상태가 켬일 때 난다(`window.arena.screen.state.muted === false`). 지금 `#crowd-sound`의 클릭에 걸린 오디오 풀기는 `app:enter`와 소리 상태가 켬으로 바뀌는 때에 건다.
- 설정 음량을 바꾸는 곳은 조작 막대의 음량 막대 하나다(`setVolume`). 영상과 관중 소리가 함께 바뀐다. 소리를 껐다 켜면 앞의 설정 음량으로 돌아온다.
- 조작 막대(`#arena-screen-controls`)는 `screen-video.js`가 지금처럼 만들고, 붙는 곳만 설정 묶음(`#settings`)으로 바뀐다. Full Mode의 막대는 그대로다.
- 시험이 읽는 값: `window.arena.screen.state.muted`, `window.arena.screen.state.userVolume`, `window.arena.crowd.sounding`.
- 경기장 안(`arenaBounds`)이면 스크린이 보이지 않아도 재생한다. 경기장 밖에서는 보일 때만 재생한다(`minimumVisiblePixels`).
- 영상 음량 = 설정 음량 × 거리 비율. 거리는 내 위치와 스크린 중심 사이다. `nearMeters` 안은 1, `farMeters`에서 `farRatio`까지 직선으로 줄고 그 밖은 `farRatio`다. 앉은 상태와 Full Mode는 거리와 상관없이 1이다. 유튜브 플레이어의 `setVolume`만 쓴다.

### 멀티 손잡이

`window.arena.multiplayer`(= `ctx.multiplayer`)의 고정 속성 밖에서 모듈과 시험이 읽는 것이다.

| 손잡이 | 무엇 |
| --- | --- |
| `avatarOf(peerId)` | 그 참가자의 아바타 `THREE.Group`, 없으면 `null`. `character.js`와 `nameplate.js`가 `peer:state`를 받아 이 손잡이로 원격 아바타를 찾는다 |
| `room` | `{code, host, roundStart}` 또는 `null`. `room:joined`의 마지막 값이고, 방장 넘기기와 회차 넘김에 따라 `host`와 `roundStart`가 바뀐다 |
| `roomState` | `{key, count, host, phase}`. `room:state`의 마지막 값. T14가 만든다 |
| `nickname`, `peerId`, `peers` | 내 닉네임, 내 원래 peer id, 다른 참가자의 상태 목록 |
| `join(key)` | 방에 든다. 인자가 없으면 자동 배치, 방 키를 주면 그 번호다. `app:enter` 전에는 아무 일도 하지 않는다(그 전에는 연결 중개에 닿지 않는다). `#host-room`·`#join-room`을 대신하고, `ui/invite.js`(`idle`에서 '같이 보기')와 시험이 부른다 |

회차 고르기 손잡이(`rounds`, `roundOffset`)는 T15가 회차 고르기 상자와 함께 없앤다.

### 자산 이름 (정본은 `asset-contract.md`)

코드가 이름으로 찾는 캐릭터 메시·재질 `Uniform`·클립·효과음 파일과 경기장의 이름 보존 목록은 자산 연동 규약에 있다. 이 문서의 이벤트 표에 있는 감정표현 id와 캐릭터 id는 그 규약의 클립 이름·메시 이름과 짝이다.

## 상태의 소유

상태마다 주인이 하나다. 주인이 마지막 값을 갖고, 다른 모듈은 이벤트로 받아 자기 사본을 둔다.

| 상태 | 주인 | 누가 읽나 | 얼마나 자주 바뀌나 |
| --- | --- | --- | --- |
| 내 위치, 발 높이, 공중 여부, 이동 잠금, 막는 면 | `player-controller.js` | 모든 모듈(`player.position`), 회귀 시험(`window.arena.state`) | 프레임마다 |
| 카메라 방향, 줌 거리, 덮어쓰기 | `camera-rig.js` | `screen-video.js`(정면 면 고르기), `crowd-motion.js` | 프레임마다 |
| 키 상태, 이동 입력을 받는지(`walking`), 드래그 | `input.js` | `player-controller.js`, `camera-rig.js` | 입력마다 |
| 고른 방송과 상영 시각, 들어갔는지 | `ui/loading.js` | `app:enter`를 듣는 쪽 | 한 번 |
| 내 팀, 내 캐릭터 | `ui/team-select.js` | `character.js`, `ui/ticket.js`, `multiplayer.js` | 드물게 |
| 티켓 발급 여부 | `ui/ticket.js` | 입구 막는 면 | 한 번. 새로고침하면 처음부터 |
| 앉은 좌석 | `seat-mode.js` | `character.js`, `multiplayer.js`, `screen-video.js` | 드물게 |
| 재생 상태, 소스와 편성, 면, 소리 켬·끔, 설정 음량, 거리 음량, Full Mode | `screen-video.js` | `ui/full-mode.js`, `multiplayer.js`(`status: 'ended'`), `crowd-motion.js`·`character.js`·`stage-players.js`(소리 상태), 시험(`window.arena.screen`) | 드물게. 위치 비교는 5초마다, 음량은 걸을 때 |
| 방 키, 방장 여부, 인원, `phase`, 들어온 순서 목록, 방의 회차 시작 시각, 내 닉네임, 다른 참가자의 위치와 상태 | `multiplayer.js` | `screen-video.js`, `ui/invite.js`, `nameplate.js`, `character.js` | 위치는 0.1초마다, 나머지는 드물게 |
| 캐릭터의 클립과 믹서, 이펙트와 날아가는 계란 | `character.js` | 없음 | 프레임마다 |
| 화면에 적는 지금 상태(`#hud`의 `data-state`), 떠 있는 알림 | `ui/hud.js` | 틀의 스타일(`data-state`로 상태별 요소를 가른다), 시험 | 드물게 |

프레임마다 바뀌는 값은 이벤트로 내지 않는다. 필요한 모듈이 `update`에서 `ctx`로 읽는다.

## 서버와의 통신

이 앱에는 자기 서버가 없다. 브라우저끼리 직접 잇는다. 방의 흐름은 `## 방 구조`에 있다.

| 항목 | 지금 |
| --- | --- |
| 연결 중개 | PeerJS Cloud(공개 중개 서비스). 주소 찾기는 Google STUN(`stun.l.google.com:19302`). TURN 없음 |
| 방 | 접속자의 브라우저가 방장이다. 방 키는 방송마다 정해진 순번이고, 방장의 peer id는 `barclays-tps-room-<방송 id>-<방 키>`다 |
| 모양 | 방장 중심. 참가자는 방장과만 잇는다 |
| 정원 | 16명(방장 포함). 값은 `web/config/network.json` |
| 채널 | PeerJS 데이터 연결, `reliable: false`, JSON |
| 메시지 | `pose`, `world`, `state`, `room`, `full`, `members`, `handoff`, `hello`, `info`. 모양은 `## 방 구조`의 `### 방 메시지` |
| 방장이 나가면 | 들어온 순서의 다음 사람이 방장을 이어받는다. 혼자 남으면 혼자 시청으로 이어진다 |
| 영상 | 주고받지 않는다. 각자 자기 플레이어로 본다. 재방 위치는 방의 `roundStart`로 각자 계산한다 |

- 받은 메시지는 모양을 검사한 뒤에만 쓴다(`validPose`와 같은 방식). 객체가 아닌 데이터(`null` 포함)와 모르는 종류는 버린다. 다른 참가자가 보낸 닉네임은 글자로만 넣는다(HTML로 넣지 않는다).
- 채널이 `reliable: false`라 메시지가 빠질 수 있다. 한 번만 보내면 안 되는 것(`state`, `room`, `members`)은 바뀔 때와 1초마다 다시 보내고, 닫기 직전에 보내는 것(`full`, `handoff`, `info`)은 세 번 보낸다.
- 운영자는 방송마다의 방 키 목록과 방 개수만 본다(`web/ops.html`). 방 목록을 두는 서비스는 없다. 방이 있는지는 signaling이 그 번호의 peer id를 쥐고 있는지로 안다. 호스팅, TURN, signaling 이전은 `docs/superpowers/specs/2026-11-12-room-service-design.md`가 후보로 담고 있고 정해지지 않았다.
- Cloudflare 임시 터널은 전제로 삼지 않는다.

## 방 구조

BL-0032와 BL-0035의 약속이다. 값은 `web/config/network.json`에 있다(키는 아래 설정 파일 절).

### 방송과 상영 시각

방은 (방송, 상영 시각)마다 나뉜다(사용자 결정). 같은 방송의 같은 상영 시각을 고른 사람끼리 한 방에 든다.

- 방송 목록은 `web/config/broadcasts.json` 하나다. 모양은 `{"broadcasts": [{"id": "final", "name": "결승전"}]}`이다. `id`는 영문 소문자와 숫자만 쓴다(방장 peer id에 들어간다). `name`은 카드에 보이는 이름이다. 첫 항목이 처음 골라져 있다. 지금은 한 항목이다.
- 영상 주소와 편성은 지금처럼 `screen.json`이 갖는다. 방송이 둘이 되면 방송마다의 주소를 둘 자리를 그때 정한다(`## 결정 필요`).
- 그 방송이 지금 생방송인지 재방인지는 편성이 정한다(`### 화면 API`의 편성). 첫 페이지는 그 값을 카드에 보인다. 사용자가 고르지 않는다.
- 상영 시각은 재방의 회차 시작 시각이다. 따로 목록을 두지 않는다. `screen.json`의 `roundIntervalMinutes` 경계가 곧 상영 시각이고(지금 값이면 10분마다), 첫 페이지는 다가오는 경계 몇 개를 버튼으로 보인다. 몇 개를 보이고 어느 것이 골라져 있는지는 UX 명세와 UI 명세가 정본이다. 생방송이면 상영 시각을 고르지 않는다.
- 첫 페이지와 화면 모듈이 같은 식을 쓰도록 순수 함수 둘을 `web/screen-video.js`가 `roundPosition` 곁에 내보내고 `ui/loading.js`가 import한다: `scheduledSource(nowMs, screenConfig)` → `'live'` 또는 `'vod'`, `upcomingRounds(nowMs, intervalMinutes, count)` → 다가오는 경계의 epoch 밀리초 배열.
- 고른 값은 `app:enter`의 `{broadcastId, showtime}`으로 한 번 나간다. `showtime`은 epoch 밀리초의 정수이고 생방송이면 `null`이다. 고른 방송과 음량을 브라우저 저장소에 남기지 않는다.
- 들어가기 전에 지키는 것(법무 T62 리포트의 `## 넘기는 것`):
  - 들어가기 클릭 전에는 연결 중개(PeerJS Cloud)와 STUN에 한 번도 닿지 않는다. 초대 링크로 왔을 때도, 첫 페이지가 떠 있는 동안 경기장을 미리 받을 때도 같다.
  - 유튜브 플레이어는 `app:enter` 뒤에 만든다. 그 전에는 플레이어가 0개이고 유튜브에 닿지 않는다(IFrame API 스크립트도 받지 않는다). `window.arena.screen`의 손잡이는 그 전에도 있다.
  - 첫 페이지에 방송별·방별 사람 수를 보이지 않는다. 보이려면 들어가기 전에 방을 두드려야 한다.
  - `broadcasts.json`의 `name`에 새 표지를 넣지 않는다(무엇이 표지인지는 법무 기준이 정본이다).
- 방의 상영 시각은 방의 `roundStart`다. 방 키 이름에도 메시지에도 따로 싣지 않는다.
  - 자동 배치는 `room`으로 받은 `roundStart`가 고른 `showtime`과 같은 방에만 든다(`### 자동 배치`). `showtime`이 `null`이면 가리지 않는다.
  - 빈 번호를 잡아 방장이 되면 방의 `roundStart`를 고른 `showtime`으로 둔다. `null`이면 지금처럼 방금 시작한 회차다.
- 상영 전: 고른 상영 시각이 아직 오지 않았어도 방에는 먼저 든다. 화면 모듈은 재생을 시작하지 않고 `screen:state`의 `status`를 `waiting`으로 낸다. `roundPosition`의 `seconds`가 음수인 동안이 상영 전이다. `roundStart`에 닿으면 처음부터 재생한다. 안내 글은 UX 명세가 정한다("N분 뒤 시작해요"). 걷기와 관중 소리는 기다리는 동안에도 된다.
- 끝난 뒤: 지금의 회차 넘김 그대로다(`### 회차 넘김`). 방은 방 키를 지킨 채 방금 시작한 회차로 넘어간다.
- 초대 URL은 `?b=<방송 id>&t=<상영 시각>&room=<방 키>`다. `ui/invite.js`가 만든다. `t`는 그 방의 지금 `roundStart`이고, 상영 시각을 고르지 않고 들어간 사람(생방송)의 링크에는 없다.
- 밖에서 받은 값은 검사한 뒤에만 쓴다. 검사 함수는 `web/room-keys.js`에 `parseRoomKey`와 함께 둔다.
  - `room`: `### 방 키`의 검사를 지나야 쓴다. 쓸 수 있는 값이면 첫 페이지를 건너뛴다. 아니면 초대가 아닌 것으로 보고 첫 페이지를 보인다.
  - `b`: 없으면 첫 방송이다(방송 id가 들기 전의 링크). 있는데 `broadcasts.json`에 없는 `id`면 그 링크를 쓰지 않고 첫 페이지를 보인다.
  - `t`: `room` 메시지의 `roundStart`와 같은 검사(안전한 정수, 회차 간격의 배수, 지금 시각과 하루 안)를 지나야 쓴다. 아니면 `null`이다.

### 방 키

- 방 키는 방송마다 따로 세는 순번 문자열이다. 1부터 `maxRooms`까지의 번호를 `roomKeyDigits` 자리로 0을 채워 쓴다(`"01"` ~ `"50"`).
- 그 방의 지금 방장이 peer id `roomKeyPrefix + 방송 id + "-" + 방 키`(`barclays-tps-room-final-01`)를 쥔다. 손님의 peer id는 signaling이 주는 임의의 값이다(아래에서 "원래 peer id"). 상영 시각은 peer id에 넣지 않는다.
- 방 키는 방에 붙어 있고 방장이 바뀌어도 그대로다. 무작위 코드의 비공개 방은 없다. 모든 방이 자동 배치 대상이다.
- `room:joined`의 `code`, `room:state`의 `key`, 초대 URL의 `room`이 모두 이 문자열이다. 밖에서 받은 값은 숫자 `roomKeyDigits` 자리이고 1 이상 `maxRooms` 이하일 때만 쓴다.
- 찾기와 자리 잡기는 `web/room-keys.js`가 맡는다.

### 자동 배치

`app:enter`를 받으면 한 번 시작한다. 그 전에는(첫 페이지와 불러오는 동안에도) 연결 중개에 닿지 않는다. 고른 방송의 번호를 앞에서부터 차례로 잇는다.

| 받은 것 | 뜻 | 하는 일 |
| --- | --- | --- |
| `connectTimeoutSeconds` 안에 데이터 채널이 열리고 방장의 `room`을 받음. `roundStart`가 고른 상영 시각과 같거나, 상영 시각을 가리지 않음 | 빈자리가 있는 방 | 그 방에 든다(`room:joined`). 끝 |
| 방장의 `room`을 받았는데 `roundStart`가 고른 상영 시각과 다름 | 다른 상영 시각의 방 | 연결을 곧바로 닫고 다음 번호 |
| `full` | 16명이 찼다 | 다음 번호 |
| `peer-unavailable` | 그 번호에 방장이 없다 = 빈 번호 | 그 번호의 peer id로 자리를 잡고 방장이 된다(새 방, `solo`). 방의 `roundStart`는 고른 상영 시각이고, 고르지 않았으면 방금 시작한 회차다 |
| `unavailable-id`(자리를 잡다가) | 같은 순간 다른 사람이 먼저 잡았다 | 그 번호에 손님으로 다시 잇는다 |
| 시간 넘김 | 직접 연결이 안 된다(TURN 없음), 또는 끊긴 방장의 id가 아직 풀리지 않았다 | 다음 번호 |
| `maxRooms`까지 모두 실패 | 들어갈 방이 없다 | 방 없이 본다(`idle`). 화면에 글을 띄우지 않는다 |

- 정원은 방장이 최종 판정한다. 17번째 연결에는 `full`만 주고 닫는다.
- `probeParallel`이 1보다 크면 그 수만큼 나란히 두드린다. 결과는 번호 순으로 쓴다(앞 번호의 빈자리가 이긴다).
- 마지막 사람이 나가면 peer id가 풀려 그 번호는 다음 사람에게 빈 번호가 된다. 따로 지우는 목록이 없다.
- 방 키를 지정한 입장(초대 URL, `multiplayer.join(key)`)은 먼저 그 번호 하나만 잇는다. 빈자리가 있으면 그 방의 상영 시각이 무엇이든 든다. `full`이면 알림을 내고(`hud:toast`, 문구는 UX 명세) 자동 배치로 넘어간다. `peer-unavailable`이면 그 번호의 방장이 된다(같은 링크를 받은 사람이 그 번호로 모인다). 그때 방의 `roundStart`는 링크의 `t`이고, 없으면 방금 시작한 회차다. 시간 넘김이면 `idle`로 둔다.
- `idle`에서 `multiplayer.join()`이 불리면 자동 배치를 한 번 다시 한다.
- 연결 실패와 방 상태를 화면 글로 쓰지 않는다. `multiplayer.js`는 화면 요소를 잡지 않는다.

### 방 메시지

지금 있는 `pose`, `world`, `state`, `full`의 모양은 그대로다. 손님은 방장이 아닌 peer가 보낸 것을 버린다.

| 종류 | 방향 | 모양 | 언제 | 받는 쪽 검사 |
| --- | --- | --- | --- | --- |
| `pose` | 손님 → 방장 | `{type: 'pose', pose}` | 0.1초마다 | `validPose` |
| `world` | 방장 → 손님 | `{type: 'world', players: [[peerId, pose], …]}` | 0.1초마다 | 길이 `capacity` 이하, id는 80자 이하 문자열이고 겹치지 않음, `validPose` |
| `state` | 손님 → 방장 `{type: 'state', state}`, 방장 → 손님 `{type: 'state', peerId, state}` | `state`는 `{team, character, nickname, emote, emoteSeq, seated}` | 바뀔 때와 1초마다 | 지금의 `cleanState` 그대로 |
| `room` | 방장 → 손님 | `{type: 'room', roundStart}` | 바뀔 때와 1초마다 | 안전한 정수, 회차 간격의 배수, 지금 시각과 하루 안. 방에 들기 전이면 `room:joined`, 방 안이고 값이 지금보다 크면 회차 넘김(`room:round`), 같거나 작으면 버린다 |
| `full` | 방장 → 들어오려는 사람 | `{type: 'full'}` | 정원이 찼을 때 세 번 보내고 닫는다 | 없음 |
| `members` | 방장 → 손님 | `{type: 'members', members: [peerId, …]}`. 들어온 순서의 손님 원래 peer id. 방장 자신은 넣지 않는다 | 바뀔 때와 1초마다 | 배열, 길이 `capacity − 1` 이하, 80자 이하 문자열, 겹치지 않음 |
| `handoff` | 방장 → 손님 | `{type: 'handoff', to}`. `to`는 `members`의 첫 사람 | 방장이 탭을 닫을 때(`pagehide`) 세 번 | 80자 이하 문자열이고 내가 마지막으로 받은 `members` 안에 있음. 아니면 버리고 끊김으로 다룬다 |
| `hello` | 운영자 화면 → 방장 | `{type: 'hello', role: 'ops'}` | 채널이 열린 뒤 `info`를 받을 때까지 1초마다 | `role === 'ops'` |
| `info` | 방장 → 운영자 화면 | `{type: 'info', count, capacity}`. `count`는 방장을 포함한 인원 | `hello`를 받으면 세 번 보내고 닫는다 | 정수, 1 ≤ `count` ≤ `capacity` ≤ 설정의 `capacity` |

- 회차 넘김은 새 종류를 만들지 않는다. `room`의 `roundStart`가 커지는 것으로 알린다.
- 방장은 연결의 첫 메시지로 상대를 가른다. `hello`면 운영자 화면이고, 그 연결은 인원·정원·`members`·`world`에 넣지 않는다. 사람에 대한 정보(닉네임, 팀, 캐릭터, 위치, peer id)는 `info`에 담지 않는다.
- 운영자 화면이 `full`을 받으면 그 방을 정원이 찬 방으로 적는다.

### 방장 넘기기

지켜야 하는 것은 넷이다. 넘기기 동안 `room:left`를 내지 않는다. 방의 `roundStart`는 바뀌지 않는다. 방 키는 바뀌지 않는다. 새 방장도 정원을 판정한다.

1. 방장은 `members`를 1초마다 다시 보낸다. 손님은 마지막으로 받은 목록을 갖고 있다.
2. 방장이 탭을 닫으면(`pagehide`) `handoff {to}`를 세 번 보내고 Peer를 닫는다. 방 키의 peer id가 곧 풀린다.
3. 손님은 `handoff`를 받거나 방장 연결이 닫히면 `phase`를 `handoff`로 바꾼다. 목록의 첫 사람이 새 방장이다.
4. 새 방장은 자기 원래 peer id로 오는 연결을 곧바로 받고(`room:state`의 `host`가 참이 된다), 동시에 방 키의 peer id를 두 번째 Peer로 다시 잡는다. 인원은 두 Peer의 손님을 합쳐 센다. 앞 방장이 비정상으로 끊겨 id가 아직 풀리지 않았으면(`unavailable-id`) 풀릴 때까지 다시 시도한다. 그동안 새로 오는 사람은 그 번호에서 시간 넘김을 받고 다음 번호로 간다.
5. 남은 손님은 새 방장의 원래 peer id로 곧바로 다시 잇는다. 새 방장은 자기가 방장이 된 것을 알기 전에 온 같은 방 손님의 연결을 닫지 않는다.
6. `handoffTimeoutSeconds` 안에 새 방장의 `room`을 받지 못하면 목록의 다음 사람으로 넘어간다. 자기 차례가 오면 자기가 방장이 된다.
7. 새 방장은 손님이 다시 이어 오는 순서와 상관없이 앞 목록의 순서를 지켜 `members`를 만들고, 처음 보는 사람은 뒤에 붙인다.

다시 시도하는 간격처럼 이 절이 정하지 않은 값은 T14가 PeerJS Cloud에서 재어 정하고 리포트의 `## 넘기는 것`에 적는다. 설정값으로 둘 것이 생기면 `ask`로 올린다.

### 혼자 시청

- 다른 사람이 모두 나가도 남은 사람은 방장으로 남고 방 키를 쥔다(`phase`가 `solo`). 손님이었으면 위 넘기기로 방장이 된다.
- 그 방은 자동 배치와 운영자 화면에 1/16 방으로 보인다.
- `room:left`를 내지 않고 "방이 끊겼다"는 안내를 내지 않는다. 혼자라는 글도 띄우지 않는다. 사람 수 줄이 비어 있을 뿐이다.

### 영상 끊김 없음

- 재생 위치를 옮기는 때는 둘뿐이다: 방에 처음 들어 그 방의 회차가 지금 보던 회차와 다를 때(`room:joined`), 방이 다음 회차로 넘어갈 때(`room:round`).
- 화면 모듈은 지금 보던 회차와 같은 `roundStart`의 `room:joined`를 받으면 `syncToleranceSeconds` 안에서는 재생 위치를 옮기지 않는다.
- `room:state`(넘기기, 혼자 시청, 인원 변화)와 `room:left`(직접 나감)에는 재생 위치와 회차를 바꾸지 않는다. 직접 나간 사람은 보던 회차를 그대로 이어 본다.
- 방 밖에서 회차 경계마다 새 회차로 되감는 일은 재생을 한 번 시작한 뒤에는 하지 않는다.

### 회차 넘김

- 재방이 그 회차의 끝에 닿으면 화면 모듈이 `screen:state`의 `status`를 `ended`로 낸다.
- 방장(혼자 시청 포함)의 `multiplayer.js`가 그것을 듣고 방의 `roundStart`를 방금 시작한 회차(지금 시각을 회차 간격으로 내림한 값)로 바꾼다. 그 값이 지금 값보다 크지 않으면(영상이 회차 간격보다 짧다) 다음 경계가 지난 뒤에 바꾼다. 바꾸면 자기 버스에 `room:round`를 내고 손님에게 `room`을 보낸다.
- 손님은 더 큰 `roundStart`의 `room`을 받으면 `room:round`를 낸다. 손님의 화면은 그때까지 끝난 상태로 기다린다.
- 방이 없는 사람(`idle`)은 화면 모듈이 스스로 방금 시작한 회차로 넘어간다.
- "다른 회차의 방을 선택해 주세요" 안내는 쓰지 않는다. 회차를 고르는 화면 요소는 없다.

### 운영자 화면

- `web/ops.html`은 앱 화면에서 잇지 않는 별도 페이지다. `vendor/peerjs.min.js`, `config/network.json`, `config/broadcasts.json`, `room-keys.js`를 쓴다. `main.js`와 기능 모듈을 부르지 않는다.
- 열려 있는 동안 `opsRefreshSeconds`마다 방송마다 1 ~ `maxRooms`를 두드려 방 키 목록, 방마다의 인원과 정원, 방 개수를 방송별로 보인다. 번호를 차지하지 않는다(방 키의 peer id로 Peer를 만들지 않는다). 한 번 갱신에 두드리는 수는 방송 수 × `maxRooms`다.
- 방송이 하나면 방 키 목록과 방 개수는 지금과 같다. 상영 시각이 달라도 방 번호를 함께 쓰므로 모든 방이 이 목록에 든다. `info`는 지금처럼 `count`와 `capacity`만 싣는다. 상영 시각과 방송 id를 싣지 않고, 화면에도 상영 시각을 보이지 않는다.
- `info`나 `full`을 준 번호가 방이다. `peer-unavailable`은 방이 없는 번호다. 시간 넘김은 확인하지 못한 번호로 따로 적는다.
- 사람에 대한 정보를 받지도 보이지도 않는다.

## 렌더 설정

| 항목 | 값 | 근거 |
| --- | --- | --- |
| 렌더러 | `WebGLRenderer`, `antialias: true`, `powerPreference: 'high-performance'`, `alpha: true` | `alpha`는 CSS3D 영상이 캔버스 뒤에서 보이게 하려고 켜 둔다 |
| 톤 매핑 | AgX, 노출 1 | `web/main.js` |
| 픽셀 비율 상한 | 1.5 | `web/main.js` |
| 카메라 | 시야각 68°, near 0.08, far 650 | `web/main.js` |
| 층 | 뒤에서부터 `cssLayer` → 캔버스 → `uiRoot` | 영상 자리는 WebGL 쪽에 투명하게 뚫는 판을 둔다 |
| 압축 디코더 | Draco만(`web/vendor/draco/`). KTX2·Meshopt 디코더 없음 | `web/main.js` |
| 측정용 통로 | `window.arena.state`의 `drawCalls`, `triangles` | `web/main.js` |

정적 조명은 라이트맵이고 실시간 빛은 그 위에 더해지지 않는다. 품질 단계는 없다. 감정표현 이펙트는 자산이 아니라 런타임에서 Three.js로 그린다(입자와 canvas 텍스처). 그 예산은 자산 연동 규약이 정본이다.

## 고정 ID와 index.html

마우스 우선 개정(BL-0034, BL-0035)으로 고정 ID가 바뀐다. 이 절은 화면 수정 구현(T46b)이 끝난 뒤의 모양이고, 지금 코드에는 없애는 ID가 아직 있다. 흐름과 문구는 UX 명세(`docs/live/product/ux/hud-controls.md`, `entry-loading.md`, `room-invite.md`)가, 자리와 모양은 UI 명세(`docs/live/graphicmodel/ui/`)가 정본이다. 이 절은 ID와 뜻, 요소의 종류, `[data-key]`·`[data-broadcast]`·`[data-showtime]`의 값만 고정한다.

### 남는 ID (`web/index.html`의 정적 요소)

| ID | 뜻 | 요소 | 채우거나 잇는 쪽 |
| --- | --- | --- | --- |
| `#enter` | **뜻이 바뀐다.** "들어가기". 첫 페이지와 초대받은 사람의 화면에 하나 있다. 누르면 고른 방송과 상영 시각으로 들어간다(`app:enter`). 포인터를 잠그지 않는다. 경기장이 준비되기 전에도 눌린다(`disabled`로 두지 않는다). 들어간 뒤에는 화면에 없다("다시 걷기"가 없다) | `button` | `ui/loading.js`만 `click`을 듣는다. 다른 파일은 `app:enter`를 듣는다 |
| `#status` | 불러오기와 준비 상태의 글자. 가림막이 이 글을 읽어 보인다 | 글자 요소 | `main.js`가 쓰고 `ui/loading.js`가 읽는다 |
| `#loading` | **뜻이 바뀐다.** 불러오는 동안의 가림막. 들어가기를 눌렀는데 경기장이 아직 준비되지 않았을 때, 그리고 초대 링크로 온 사람에게 준비될 때까지 보인다. 주소를 처음 연 사람에게는 가림막이 아니라 첫 페이지가 먼저 보인다 | 묶는 요소 | `ui/loading.js` |
| `#panel` | **뜻이 바뀐다.** 첫 페이지(방송 카드, 상영 시각, 들어가기, 고지). 초대받은 사람에게는 초대 안내 한 줄과 들어가기, 고지. `app:enter` 뒤에는 보이지 않는다. 팀 버튼과 키 목록을 여기에 두지 않는다 | 묶는 요소 | `ui/loading.js` |
| `#network` | **뜻이 바뀐다.** 설정 묶음(`#settings`) 안의 '같이 보기' 자리. 따로 뜬 방 패널이 아니고, 걷는 동안 숨지 않는다 | 묶는 요소 | `ui/invite.js`가 `#watch-together`와 `#watch-together-note`를 붙인다 |
| `#network-status` | **뜻이 바뀐다.** 사람 수 한 줄(`role="status"`). 방에 둘 이상이면 "N명 같이 보는 중", 아니면 비어 있고 보이지 않는다. 연결 상태, 방 번호, 실패 글을 쓰지 않는다 | 글자 요소 | `ui/invite.js`만 쓴다(`room:state`). `multiplayer.js`는 화면에 글을 쓰지 않는다 |
| `#touch`와 그 안의 `[data-key]` | 터치 이동 버튼. 값은 키 코드(`KeyW` 등) | `button` | `input.js` |
| `#hud` | 틀의 상태를 싣는 요소. `data-state`가 지금 상태다 | 묶는 요소 | `ui/hud.js`가 `data-state`와 `body`의 `data-hud`를 쓴다 |
| `#hud-keys` | **뜻이 바뀐다.** 오른쪽 위 키 힌트 상자. 키마다 한 줄이다. Esc와 R의 줄이 없다 | 묶는 요소 | 정적 글자. `seat-mode.js`가 "E 앉기"·"E 일어나기" 줄을 맨 위에 넣고 켜고 끈다 |
| `#hud-toast` | 알림 자리. `role="status"` | 묶는 요소 | `ui/hud.js`만 쓴다. 다른 모듈은 `hud:toast`를 낸다 |
| `#hud-objective` | 다음 할 일 줄. 비어 있으면 보이지 않는다 | 묶는 요소 | `ui/ticket.js` |
| `#dock` | 행동 버튼 묶음. 들어간 뒤에는 Full Mode 말고 늘 보인다 | 묶는 요소 | `ui/emote-menu.js`(`#emote-open`), `ui/full-mode.js`(`#full-mode-open`), `ui/team-select.js`(`#team-select-open`), `seat-mode.js`(`#seat-toggle`) |

### 새 ID

| ID | 뜻 | 요소 | 만드는 쪽 | 채우거나 잇는 쪽 |
| --- | --- | --- | --- | --- |
| `#settings` | 오른쪽 설정 묶음. 같이 보기, 소리, 음량이 이 안에 모인다 | 묶는 요소 | `index.html`(정적) | `#network`가 정적으로 들어 있고, `screen-video.js`가 조작 막대(`#arena-screen-controls`)를 붙인다 |
| `#broadcasts` | 첫 페이지의 방송 카드 묶음. 카드는 `button[data-broadcast="<방송 id>"]`이고 고른 카드는 `aria-pressed="true"`다 | 묶는 요소 | `index.html`(정적) | `ui/loading.js`가 `broadcasts.json`으로 채운다 |
| `#showtimes` | 첫 페이지의 상영 시각 묶음. 버튼은 `button[data-showtime="<epoch 밀리초>"]`이고 고른 것은 `aria-pressed="true"`, 고를 수 없는 것은 `disabled`다. 생방송이면 묶음이 `hidden`이다 | 묶는 요소 | `index.html`(정적) | `ui/loading.js` |
| `#entry-notice` | 자동 연결 고지. `#enter` 곁에 있다. `#enter`가 눌릴 수 있는 때에는 이미 화면에 있어야 하므로 모듈이 실행 중에 붙이지 않는다. 문구는 UX 명세와 법무 확인(T62)이 정한다 | 묶는 요소 | `index.html`(정적) | 없음 |
| `#watch-together` | '같이 보기' 버튼. 누르면 초대 URL을 복사한다(공유 창이 있으면 공유 창). 방이 없으면(`idle`) `multiplayer.join()`으로 자동 배치를 한 번 다시 건다 | `button` | `ui/invite.js`(실행 중) | `#network`에 붙는다 |
| `#watch-together-note` | '같이 보기'를 누른 뒤의 결과 한 줄(`role="status"`). 비어 있으면 보이지 않는다 | 글자 요소 | `ui/invite.js`(실행 중) | `#network`에 붙는다 |

`#hud`의 `data-state`(`body`의 `data-hud`도 같은 값이다):

| 값 | 뜻 | `ui/hud.js`가 아는 길 |
| --- | --- | --- |
| `entry` | 들어가기 전(첫 페이지, 가림막) | `app:enter`를 아직 받지 않았다 |
| `walking` | 들어간 뒤의 기본 상태 | `app:enter`를 받았고 앉음도 Full Mode도 아니다 |
| `seated` | 앉음 | `seat:enter` ~ `seat:exit` |
| `full` | Full Mode | `fullmode:enter` ~ `fullmode:exit` |

겹치면 `full`, `seated`, `walking`의 차례로 앞의 것이 이긴다. `free`(커서 풀림)는 없다.

모듈이 실행 중에 만드는 ID:

| ID | 만드는 모듈 | 붙는 곳 | 바뀌는 것 |
| --- | --- | --- | --- |
| `#emote-open`, `#full-mode-open` | `ui/emote-menu.js`, `ui/full-mode.js` | `#dock` | 이름과 뜻은 그대로. 걷는 동안에도 보인다 |
| `#team-select-open` | `ui/team-select.js` | `#dock` | 들어가기 전에는 붙이지 않는다(`#panel`에 넣지 않는다). `app:enter` 뒤에 `#dock`에 붙인다 |
| `#seat-toggle` | `seat-mode.js` | 지금 그대로 | **뜻이 바뀐다.** 걷는 중에도 좌석 가까이면 "앉기"로 보인다. 앉으면 "일어나기"다 |
| `#arena-screen-controls` | `screen-video.js` | `#settings`(지금은 `ctx.uiRoot`) | 소리 버튼, 음량 막대, 지금 소스 글은 그대로 이 안에 만든다. 안쪽 ID는 고정하지 않고 `window.arena.screen.controlsElement`로 찾는다 |
| `#watch-together`, `#watch-together-note` | `ui/invite.js` | `#network` | 새로 만든다(위 표). `.room-copy`, `.room-copy-note` 클래스를 대신한다 |
| `#emote-menu`, `#emote-menu-title`, `#arena-screen-notice`, `#team-select`, `#ticket` | 지금 만드는 모듈 | 지금 그대로 | 이름과 뜻은 그대로 |

- **이번 개정의 예외.** `index.html`의 정적 요소는 T46b만 고친다. 모듈 약속의 "UI 모듈은 `index.html`을 고치지 않는다"는 그대로다.
- `#dock`과 `#settings` 안의 순서는 틀의 스타일이 ID로 정한다. 모듈이 붙이는 순서에 기대지 않는다.
- `body`의 `walking` 클래스로 화면 요소를 숨기는 스타일을 두지 않는다(`### 조작 모델 (마우스 우선)`).
- 검사(T46b 뒤): `node -e "const h=require('fs').readFileSync('web/index.html','utf8');console.log(['enter','status','loading','panel','network','network-status','touch','hud','hud-keys','hud-toast','hud-objective','dock','settings','broadcasts','showtimes','entry-notice'].filter(i=>h.includes('id=\"'+i+'\"')).length)"` → `16`
- 검사(T46b 뒤): `grep -rnE "#(quick|crowd-sound|zone|hud-state|room-code|host-room|join-room|leave-room|hud-room|fallback|walk-resume|menu-open|cross)([^-a-z]|$)|data-location" web tests --include=*.js --include=*.mjs --include=*.html --exclude-dir=vendor` → 0줄

### 없애는 ID와 대신할 것

T46b가 제품 코드와 시험을 함께 고친다. 줄 번호는 이 절을 쓴 때의 작업 트리 기준이다. 고치기 전에 위 검사의 `grep`으로 다시 뽑는다. `tests/`의 파일은 이름만 적었다(`full-mode` = `tests/full-mode.spec.mjs`).

| 없애는 것 | 대신할 것 | 제품 코드(`web/`) | 시험 |
| --- | --- | --- | --- |
| `#quick`과 그 안의 `[data-location]`(이동 버튼) | 없다. 이동은 걷기뿐이다(키, 바닥 클릭, 터치). 시험이 자리를 옮길 때는 `window.arena.go(name)`을 쓴다. 이동 버튼을 막던 `player.setTeleportGuard`와 `teleportFromUI`도 부르는 곳이 없어져 함께 없앤다. 티켓 전의 입구는 지금처럼 막는 면이 막는다. `ticket.json`의 `guardLocations`는 읽는 곳이 없어진다 | `index.html:18,35,37,46,47,56`, `input.js:54`, `main.js:41`, `player-controller.js:10,152,153`, `ui/ticket.js:47,48,59,134`, `ui/team-select.js:88` | `full-mode:55,57,101`, `ui-entry:77,275`, `ui-frame:92`, `modules:112`, `qa-b:83,85,119`, `ticket:67,69,102,110` |
| `#crowd-sound`(관중 소리 켬·끔) | 따로 켜는 버튼이 없다. 소리 상태 하나를 따른다(`### 소리와 음량`). 들어가면 켜져 있고, 끄고 켜는 것은 설정 묶음의 소리 버튼이다. 시험은 `#enter`를 누른 뒤 `window.arena.crowd.sounding`을 기다리거나, 조작 막대(`window.arena.screen.controlsElement`)의 소리 버튼을 누른다. `createCrowdMotion`의 버튼 인자를 없앤다 | `index.html:56`, `main.js:100`, `crowd-motion.js:373,374,379,380,381,389`, `character.js:20`, `stage-players.js:53` | `arena-v2:164,206`, `character-clips:13,45,174,231`, `qa-b:134`, `stage-players:164,165,195,196,208,209,220` |
| `#zone`(위치 이름) | 없다 | `index.html:59`, `main.js:70,73` | `ui-frame:126,128,129,130` |
| `#hud-state`(상태 글자) | 없다. 상태는 `#hud`의 `data-state`로 읽는다 | `index.html:22,59`, `ui/hud.js:5,8`, `ui/loading.js:29,30` | `ui-emote-seat:132`, `ui-frame:46,53,61,70` |
| `#room-code`(방 번호 입력) | 없다. 방 키는 `window.arena.multiplayer.room.code`로 읽는다. 방 키를 지정한 입장은 초대 URL(`?b=&t=&room=`)이나 `multiplayer.join(key)`다 | `index.html:64`, `multiplayer.js:18,26,35,262`, `ui/invite.js:33,55,56`, `room-keys.js:6`, `verify-jump.mjs:12,13,14,44`, `verify-tps.mjs:28,29,30` | `modules:162`, `multiplayer:60`, `qa-x:118,124`, `seat:376,379` |
| `#host-room`(자동 배치로 다시 들어가기) | `multiplayer.join()` | `index.html:64`, `multiplayer.js:19,288`, `ui/invite.js:33,57`, `verify-jump.mjs:11`, `verify-tps.mjs:27` | `multiplayer:62,63`, `ui-room:48` |
| `#join-room`(이 방으로 옮기기) | `multiplayer.join(key)`, 초대 URL | `index.html:64`, `multiplayer.js:19,263,288`, `ui/invite.js:33,57`, `room-keys.js:103`, `verify-jump.mjs:14`, `verify-tps.mjs:30` | `multiplayer:61`, `room-keys:138` |
| `#leave-room`(방 나가기) | 화면에 없다. 시험은 `window.arena.multiplayer.leave()`를 부른다 | `index.html:64`, `multiplayer.js:19,287,289`, `ui/invite.js:33,58`, `verify-tps.mjs:39,41` | `multiplayer:62,64,137` |
| `#hud-room`(HUD의 방 줄) | `#network-status` 하나로 합친다 | `index.html:30,31,36,55`, `ui/invite.js:4,16,17,18,19,20,32` | `ui-room:22` |
| `#fallback`(포인터 잠금 실패 안내) | 없다. 잠그지 않는다 | `index.html:16,57`, `input.js:19,29`, `ui/loading.js:32,33` | `controls:7`, `full-mode:54,58` |
| `#walk-resume`("다시 걷기") | 없다 | `index.html:27,60`, `ui/hud.js:37` | `ui-frame:65` |
| `#menu-open`(터치 ☰) | 없다. 버튼이 늘 보인다 | `index.html:28,39,61`, `ui/hud.js:38` | 없음 |
| `#cross`(조준점) | 없다 | `index.html:26,35,39,58` | `full-mode:54,55,57,101`, `screen-video:52,54,725,813,826,969,981`, `ui-frame:56` |
| `.room-copy`, `.room-copy-note`(클래스) | `#watch-together`, `#watch-together-note` | `ui/invite.js:13,51,52` | `multiplayer:104`, `ui-room:43,108,109,113,131`("초대 링크" 글자로 찾는다) |

`web/verify-tps.mjs`와 `web/verify-jump.mjs`는 `tests/regression.spec.mjs`가 돌리는 회귀 시험이다. 방 버튼 넷을 눌러 방을 만들고 들고 나가므로 위 표대로 `multiplayer.join`·`leave`와 `room.code`로 바꾼다. 고정 약속(`window.arena`, `pose`, `validPose`)을 보는 줄은 고치지 않는다.

### 뜻이 바뀌어 시험이 닿는 곳

| 바뀌는 것 | 시험 |
| --- | --- |
| `#enter`: 잠그지 않는다, 준비 전에도 눌린다, 글자가 "들어가기"다 | 글자: `loading:16`, `qa-u1:22`, `ui-entry:50,53,54`. 누르는 곳은 20개 파일(`grep -n "#enter" tests/*.mjs`)이다. 지금은 `disabled`가 준비를 기다려 줬다. `#enter`를 누르기 전에 `window.arena.ready`를 기다리지 않는 곳에는 기다림을 넣는다 |
| 포인터 잠금이 없다 | `character-clips:305`, `controls:54,66,74,85,89,124,128,133,135,148,151,160,183`, `emote-menu:12,13,14,15`, `full-mode:14,15,16,135,146,172`, `qa-a:17,18,19`, `qa-u1:12`, `qa-u2:18,19,20`, `seat:29`, `ui-emote-seat:15,16,17,18,131`, `ui-entry:86,87` |
| `walking`의 뜻(`body`의 `walking`, `window.arena.state.walking`) | `character-clips:167,305`, `collision:119`, `controls:55,75,91,95,101,130,138,161,163,171`, `emote-menu:97`, `full-mode:55,135,146,172`, `live-load:83,88`, `qa-a:163,173,178,193,198,269`, `qa-u:28`, `qa-u1:13,26,33,64`, `qa-u2:49,169`, `qa-x:95,115`, `screen-video:294,777,1004`, `seat:29`, `ui-emote-seat:35,131`, `ui-entry:23` |
| Esc가 화면 요소를 바꾸지 않는다, `controls.json`의 `menu`가 없다. 커서를 풀려고 누르던 Esc만 지우고, 창을 닫는 Esc는 그대로 둔다 | `modules:46`, `controls:94`, `character-clips:304`, `multiplayer:103`, `qa-a:190,192,267`, `qa-b:146,209,229,352`, `qa-u2:168,184`, `qa-x:114`, `seat:28`, `ui-entry:58,145,169,213,228`, `ui-frame:59,87`, `ui-hud:69`, `ui-room:104,145`, `emote-menu:66`, `full-mode:185,198`, `team-select:102`, `ui-emote-seat:76,116` |
| `data-state`·`data-hud`에 `free`가 없다, `walking`이 들어간 뒤의 기본이다 | `ui-frame:15`, `ui-hud:19,46,68,70` |
| `#hud-keys`가 오른쪽 위 상자다 | `ui-emote-seat:108`, `ui-frame:49` |
| `#seat-toggle`이 걷는 중에도 보인다 | `character-clips:290,306`, `qa-a:245`, `seat-back:61`, `seat:396`, `ui-emote-seat:115,136,173,177` |
| `#panel`이 첫 페이지다 | `full-mode:58`, `perf-fps:25,170`, `qa-p:95,161`, `screen-video:1051,1063,1072,1076`, `ui-frame:92`, `ui-room:29,32,36,38` |
| 가림막(`#loading`)이 처음에는 보이지 않는다 | `character-clips:284`, `character:193`, `controls:126,150`, `emote-menu:30`, `loading:4`, `qa-b:59,60,61`, `qa-u1:17`, `team-select:24`, `ticket:27,118`, `ui-emote-seat:34`, `ui-entry:24,25,26,305` |
| `#network`, `#network-status`의 뜻과 글 | `multiplayer:180,185`, `qa-x:50,51,271`, `room-handoff:155`, `ui-entry:156,157,161,275`, `ui-frame:92`, `ui-room:23,122,123,146,147` |
| 없애는 글자(위치 이름, 상태 글자, 방 패널의 글, "관중 소리 …") | `full-mode:57`, `multiplayer:104`, `qa-x:50,129,158`, `ui-entry:50,60,62`, `ui-frame:53,61,62,128,129,130`, `ui-room:43,44,47,77,103,105,108,113,120,121,122,128,131,146,148` |
| 조작 막대(`#arena-screen-controls`)가 `#settings` 안에 있다 | `qa-a:173`, `qa-u:102`, `qa-u2:130`, `screen-audio:84`, `screen-video:237,322,508,632,969,1032,1063,1071,1076`, `ui-hud:71,80,82` |
| 관중 소리가 소리 상태를 따른다(`crowd.sounding`) | `character-clips:44,45,240,241,242`, `crowd:72,73,74,179,253,254,259`, `emote-fx:28`, `qa-b:135` |
| 방장 peer id에 방송 id가 든다, 초대 URL에 `b`와 `t`가 든다 | `character:190`, `multiplayer:53,55,106,172,176,201,262,265`, `ops:12`, `qa-a:52`, `qa-b:348`, `qa-x:47,49,213,241,269`, `room-handoff:10,53,78,116,118,146,173,175,185,213,215,242,266,277,301`, `room-keys:7,22,91`, `screen-video:457,499,591,623,704,956`, `ui-room:27,86,110,115` |
| 설정 파일이 14개다(`broadcasts.json`) | `modules:38` |
| 유튜브 플레이어를 `app:enter` 뒤에 만든다 | `#enter`를 누르기 전에 플레이어나 재생을 기대하는 줄. 줄은 뽑지 않았다. `screen-video`, `screen-audio`, `full-mode`, `seat-back`, `stage-monitors`, `qa-a`, `qa-u`, `qa-u2`, `modules:54`에서 가른다 |

## 파일 소유

같은 때에 두 Task가 같은 파일을 고치지 않는다. 화살표는 시간 순 차례이고, 뒤 Task는 앞 Task가 정산된 뒤에만 그 파일을 연다. 각 Task의 정확한 편집 범위는 계획서의 그 Task 절이 정본이고, 이 표는 그것을 파일 쪽에서 본 것이다.

| 파일 | 고치는 Task(차례) |
| --- | --- |
| `docs/live/web-metaverse-develop/architecture.md` | T02 → T23 → T61. 그 뒤에 약속을 바꾸려면 아키텍처 Task를 새로 띄운다 |
| `docs/live/web-metaverse-develop/asset-contract.md` | T03. 위와 같다 |
| `docs/superpowers/specs/2026-11-12-room-service-design.md` | T02(상태 줄, R-5, 후보 E를 가리키는 절만) |
| `web/screen-video.js` | T11 → T12 → (T25 리뷰) → T31(조작 막대와 Full Mode 버튼의 화면 부분만) |
| `web/config/screen.json` | T11 → T12 |
| `web/room-keys.js`(새) | T13 |
| `web/multiplayer.js` | T14 → T15 → (T26 리뷰) → T32(화면 글자와 버튼 연결만) |
| `web/config/network.json` | T14(새 키를 더하기만) → T15(`probeParallel`의 값만) → T32(`roundOffsets` 삭제만) |
| `web/ui/invite.js` | T15 → T32 |
| `web/ops.html`, `web/ops.js`(새) | T16 |
| `art/vfx/emotes/`(새) | T17 |
| `web/character.js` | T18 → T28(클립에 딸린 앉기 보정 줄만, 새 클립이 요구할 때) |
| `web/config/characters.json` | T18(키를 옮겨 둠) → T28(값만) |
| `web/assets/characters/fan-anim-v2.glb`, `art/characters/fan/fan-anim-v2.blend`(새) | T19 |
| `web/index.html`, `web/ui/tokens.css`(새), `web/main.js`(화면 글자만), `web/modules.js`(T23이 적은 빈 자리만) | T27 |
| `web/input.js`, `web/config/controls.json` | T27(UX 명세가 새 키를 요구할 때만) |
| `web/ui/loading.js`, `web/ui/team-select.js`, `web/ui/ticket.js` | T29 |
| `web/ui/emote-menu.js`, `web/seat-mode.js` | T30 |
| `web/ui/full-mode.js` | T31 |
| `web/ui/hud.js`(새) | 등록은 T27(`web/modules.js`의 빈 자리). 내용을 쓰는 Task는 `## 결정 필요`의 첫 줄 |
| `web/events.js` | 계획서의 편집 범위에 없다. `HUD_TOAST` 한 줄을 더할 Task는 `## 결정 필요`의 첫 줄 |
| `tests/<이름>.spec.mjs` | 계획서 `## 공용 약속`의 "시험 파일의 주인" 줄이 정본이다 |

고치지 않는 것: `web/arena.glb`, `web/arena-v2.glb`, `web/lightmaps/`의 PNG, 원본 `.blend`, `web/assets/characters/fan.glb`와 `fan-anim.glb`, 기존 텍스처와 음원, `web/vendor/`의 지금 파일, 위 표에 없는 `web/`의 파일. 덮어쓰거나 옮기거나 지우지 않는다.

끝 QA 뒤의 수정 Task(T45·T46·T46b, 조건부 T49·T50)는 코디네이터가 파일 단위로 나눠 준다.

마우스 우선 개정(T61이 이 문서에 적은 변경)이 닿는 파일은 아래다. 화면 쪽은 T46b가 맡고, 3D 런타임 쪽을 어느 Task가 맡는지는 `## 결정 필요`에 있다. 같은 파일을 두 Task가 같은 때에 고치지 않는다.

| 묶음 | 파일 |
| --- | --- |
| 화면(고정 ID, 첫 페이지, 설정 묶음, 방 패널, 소리 따르기) | `web/index.html`, `web/ui/hud.js`, `web/ui/loading.js`, `web/ui/invite.js`, `web/ui/team-select.js`, `web/ui/ticket.js`, `web/ui/emote-menu.js`, `web/ui/full-mode.js`, `web/multiplayer.js`, `web/room-keys.js`, `web/ops.js`, `web/crowd-motion.js`, `web/stage-players.js`, `web/screen-video.js`(조작 막대의 자리, `userVolume`, `waiting`, 순수 함수 둘), `web/character.js`(효과음 조건 줄만), `web/events.js`, `web/config/controls.json`, `web/config/broadcasts.json`(새), `web/verify-tps.mjs`, `web/verify-jump.mjs` |
| 3D 런타임(잠그지 않는 입력, 바닥 클릭 걷기, 좌석으로 날기) | `web/input.js`, `web/main.js`, `web/player-controller.js`, `web/seat-mode.js`, `web/config/seats.json` |
| 시험 | `## 고정 ID와 index.html`의 두 시험 표 |

## 설정 파일

값만 바꾸면 되는 것은 `web/config/`에 모듈마다 JSON 한 파일로 둔다. 키와 강도·속도·빈도를 바꿀 때 코드를 고치지 않는다.

- 파일 이름이 `ctx.config(name)`의 `name`이다(`web/config/screen.json` → `ctx.config('screen')`).
- 값의 정본은 파일 자신이다. 이번 phase가 더하는 키의 처음 값은 설계서(`docs/superpowers/specs/2026-11-13-ux-motion-rooms-design.md`) 10절의 추천 기본값이고, 아래 표에 함께 적었다.
- 파일은 아래 "고치는 Task"만 고친다. 다른 모듈의 값이 필요하면 그 값을 가진 모듈의 이벤트나 손잡이로 받는다.
- JSON에는 값만 둔다. 주석과 코드를 넣지 않는다. 시간은 초, 거리는 m로 적고 키 이름에 단위를 붙인다.

| 파일 | 읽는 모듈 | 담는 값 | 고치는 Task |
| --- | --- | --- | --- |
| `web/config/controls.json` | `input.js` | 키 배정: 이동, 달리기, 점프, 광장으로(R, `## 결정 필요`), 감정표현 메뉴(Alt), 앉기(E), Full Mode(F). 메뉴(Esc, `menu`)는 없앤다. F는 이미 있는 배정이다 | T27 → 마우스 우선 개정(`menu` 삭제만) |
| `web/config/camera.json` | `camera-rig.js` | 기본 거리, 최대 거리, 1인칭, 휠 한 칸 | 없음 |
| `web/config/screen.json` | `screen-video.js`, `multiplayer.js`(`roundIntervalMinutes`), `crowd-motion.js`(`crowdVolume`, `volume`), `ui/loading.js`(`roundIntervalMinutes`, 편성. 스스로 읽는다) | VOD와 생방송 주소, 편성, 회차 간격, 반복 실패, 면, 맞춤, 소리, 거리 음량, 경기장 경계 | T11 → T12 |
| `web/config/seats.json` | `seat-mode.js` | 앉을 자리 목록, 앉은 카메라, 클릭해 앉기의 비행(`clickSit.flightSeconds`, `clickSit.arcHeightMeters`. 처음 값은 구현 Task가 화면을 보고 정해 리포트의 `## 넘기는 것`에 적는다) | 마우스 우선 개정(`clickSit` 더하기만) |
| `web/config/teams.json` | `ui/team-select.js`, `character.js` | 팀 목록, 팀 색, 유니폼 그림 경로 | 없음 |
| `web/config/characters.json` | `ui/team-select.js`, `character.js` | 캐릭터 4종과 기본 캐릭터, 클립 파일, 큐 프레임, 이펙트 값 | T18 → T28(값만) |
| `web/config/ticket.json` | `ui/ticket.js` | 막는 면 좌표, 창이 뜨는 거리 | 없음 |
| `web/config/stage-monitors.json` | `stage-monitors.js` | 모니터 소스 | 없음 |
| `web/config/crowd.json` | `crowd-motion.js` | 2층 기준, 먼 관중 기준, 마네킹 | 없음(T09가 먼 관중이 눈에 띈다고 판정할 때만 T45) |
| `web/config/environment.json` | `environment.js` | 별, 달, 달빛, 바다, 밤 밝기 | 없음 |
| `web/config/sky-show.json` | `sky-show.js` | 빛줄기와 폭죽 | 없음 |
| `web/config/stage-players.json` | `stage-players.js` | 선수 동작 간격, 고함 확률 | 없음 |
| `web/config/network.json` | `multiplayer.js`, `ui/invite.js`, `nameplate.js`, `ops.js` | 정원, 가득 참 안내, 닉네임 형식, 방 키, 연결과 넘기기의 시간, 운영자 화면 갱신 | T14 → T15 → T32 |
| `web/config/broadcasts.json` | `ui/loading.js`(스스로 읽는다), `multiplayer.js`, `ui/invite.js`, `ops.js` | 방송 목록(`id`, `name`). 모양은 `## 방 구조`의 `### 방송과 상영 시각` | T46b |

방송 목록 `broadcasts.json`(새, BL-0035)은 T46b가 파일을 만들 때 위 표에 한 줄로 더한다. `tests/modules.spec.mjs`가 이 표의 줄과 `web/config/`의 파일을 견주므로 파일보다 먼저 줄을 더하지 않는다. 그 줄의 내용: 읽는 모듈 `ui/loading.js`(스스로 읽는다), `multiplayer.js`, `ui/invite.js`, `ops.js` · 담는 값 방송 목록(`id`, `name`) · 모양은 `## 방 구조`의 `### 방송과 상영 시각`. 그때 `main.js`의 설정 이름 목록에도 `broadcasts`를 더한다.

`teams.json`과 `characters.json`은 두 모듈이 읽는다. 굽기와 런타임이 함께 읽는 값(달 방향, 정적 면의 하늘 세기)은 이 폴더가 아니라 자산 연동 규약에 있다.

### `screen.json`의 키 (이번 phase)

| 키 | 뜻 | 처음 값 | 넣는 Task |
| --- | --- | --- | --- |
| `schedule` | 편성 시간표. 칸의 배열 `[{from, to, source}]`. `from`·`to`는 시간대가 붙은 ISO 8601 문자열(`"2026-11-14T18:00:00+09:00"`), `from` ≤ 지금 < `to`인 칸이 걸린다. `source`는 `live` 또는 `vod` | `[]` | T11 |
| `source` | **뜻이 바뀐다.** 시간표 밖의 소스(앞에서는 기본 소스) | `"vod"`(지금 `"live"`) | T11 |
| `liveFallback` | 생방송 칸에서 생방송이 나오지 않을 때의 소스 | `"vod"` | T11 |
| `ended` | 재방이 회차의 끝에 닿았을 때 | `"next-round"`(지금 `"poster-and-notice"`) | T11 |
| `retry.noticeFromFailure` | 몇 번째 실패부터 "다시 연결 중"을 보이나 | `1` | T11 |
| `retry.waitLimitSeconds` | 재생되지 않은 채 이 시간이 넘으면 스크린 그림과 계속 시도 안내를 보인다. 자동 재연결은 계속 돈다 | `60` | T11 |
| `retry.maxIntervalSeconds` | 재시도 간격의 상한(지금 코드의 30초) | `30` | T11 |
| `distanceVolume.nearMeters`, `.farMeters`, `.farRatio` | 거리 음량(`### 화면 API`의 소리) | `25`, `90`, `0.4` | T12 |
| `arenaBounds.minX`, `.maxX`, `.maxAbsZ` | 경기장 안으로 보는 범위. 지금 코드의 숫자를 옮긴다 | `-61`, `94`, `70` | T12 |

`vod`, `live`, `roundIntervalMinutes`, `defaultRound`, `syncIntervalSeconds`, `syncToleranceSeconds`, `face`, `aspectRatio`, `fit`, `mesh`, `playerWidth`, `playerHeight`, `minimumVisiblePixels`, `muted`, `unmuteOnEnter`, `volume`, `crowdVolume`은 이름과 값을 바꾸지 않는다.

### `network.json`의 키 (이번 phase)

| 키 | 뜻 | 처음 값 | 넣는 Task |
| --- | --- | --- | --- |
| `roomKeyPrefix` | 방장 peer id의 접두어. 그 뒤에 `<방송 id>-<방 키>`가 붙는다 | `"barclays-tps-room-"` | T14 |
| `roomKeyDigits` | 방 키의 자리수 | `2` | T14 |
| `maxRooms` | 방 번호의 상한 | `50` | T14 |
| `connectTimeoutSeconds` | 방 하나에 잇는 시간의 상한 | `8` | T14 |
| `handoffTimeoutSeconds` | 넘기기에서 새 방장의 응답을 기다리는 시간 | `10` | T14 |
| `opsRefreshSeconds` | 운영자 화면의 갱신 간격 | `30` | T14 |
| `probeParallel` | 자동 배치가 나란히 두드리는 번호의 수 | `1` | T14(키) → T15(T13이 재어 권고한 값) |
| `roundOffsets` | 없앤다. T15가 읽지 않게 하고 T32가 키를 지운다 | — | T32 |

`capacity`, `fullMessage`, `nickname`은 이름과 값을 바꾸지 않는다. T13의 `room-keys.js`는 이 값들을 인자로 받는다.

### `characters.json`의 키 (이번 phase)

| 키 | 뜻 | 처음 값 | 넣는 Task |
| --- | --- | --- | --- |
| `clipFile` | 클립 GLB의 경로 | `"./assets/characters/fan-anim.glb"`. BL-0025가 되면 T28이 `fan-anim-v2.glb`로 | T18 |
| `clipFps` | 큐 프레임을 세는 fps | `30` | T18 |
| `cues.<클립 이름>.<큐 이름>` | 그 클립에서 큐가 걸리는 프레임 번호. 큐 이름의 정본은 자산 연동 규약의 클립 표다 | `cues.Emote_EggThrow.egg_release` `34`, `.egg_scream` `40`. 그 밖의 큐는 T17의 큐 표 | T18 → T28(값만) |
| `fx.<감정표현 id>.maxParticles`, `.seconds`, `.size` | 감정표현마다의 입자 수 상한, 지속 시간, 크기 | T17의 큐 표(`art/vfx/emotes/cues.json`) | T18 |
| `fx.egg_throw.flightSeconds` | 계란이 손에서 스크린 면까지 나는 시간 | `1.2` | T18 |
| `fx.egg_throw.splatSeconds` | 자국이 생긴 뒤 다 사라질 때까지의 시간 | `1.5` | T18 |
| `fx.egg_throw.target` | 목표 면을 고르는 법. `"facing"` = 던진 사람을 가장 바로 보는 면(`screen.faces`의 `normal`로 고른다) | `"facing"` | T18 |

`ids`, `names`, `default`는 이름과 값을 바꾸지 않는다. T17의 큐 표가 위에 없는 이펙트 값을 요구하면 `fx.<감정표현 id>` 아래에 큐 표의 이름 그대로 둔다.

## 점유 표시

PC 한 대, GPU 하나, 실행 중인 Blender 하나를 여러 Task가 나눠 쓴다. 점유 표시는 `_workspace/` 아래의 파일이고 git에 들어가지 않는다.

| 표시 | 누가 잡나 | 잡는 법 |
| --- | --- | --- |
| `_workspace/gpu-lock.json`(혼자 쓰기), `_workspace/gpu-lock.slot-<i>.json`(함께 쓰기) | 라이트맵 굽기, 브라우저 시험, 걷기·진단, 성능 실측 | 입구 셋 중 하나로만 잡는다. 입구가 한 프로세스 안에서 잡고 일이 어떻게 끝나든 놓는다. 시험 = `npm test`. 걷기·진단 = `npm run walk -- <폴더>/<이름>.walk.mjs`(Playwright 시험 형식, 걷기 파일은 작업 폴더나 `temp/<Task>/`에, 시험 하나 150초 상한(afterAll 포함), 전체 상한은 일 20분 + GPU 기다림 상한 `GPU_LOCK_WAIT_MS`(기본 30분) = 50분. Playwright는 GPU 기다림(globalSetup)도 전체 상한에 넣는다). 그 밖의 GPU 일(굽기, 성능 실측) = `node tests/gpu-run.mjs [--shared] [--max-min <분>] --owner <Task ID> -- <명령…>`(상한을 넘으면 자식 나무를 끝내고 124). `node tests/gpu-lock.mjs acquire|release` 직접 잡기는 쓰지 않는다 |
| `_workspace/graphicmodel/blender-lock.json` | Blender MCP를 쓰는 Task | `.claude/skills/blender-pipeline/SKILL.md` 1절이 정본이다 |

- 무거운 일은 몇 개의 Task가 돌든 한 번에 하나다. 표시가 남의 것이면 그 자원을 건드리지 않는다.
- GPU 표시는 기다림에 상한이 있다(값은 `tests/gpu-lock.mjs`가 갖는다). 상한을 넘으면 그 검사를 ❌로 보고한다. 표시를 지우고 진행하지 않는다.
- Blender 표시가 남의 것이면 기다리지 않고 `ask`로 올린다.
- 지우는 것은 자기 Task의 표시뿐이다.
- Blender MCP의 `look`은 가벼워 GPU 표시를 잡지 않는다. 배치 Blender(경기장 수정·굽기·내보내기)는 MCP를 쓰지 않으므로 Blender 표시를 잡지 않고, 굽기에서만 GPU 표시를 잡는다.
- 성능 실측은 다른 검증이 모두 끝난 뒤 혼자 돈다.

## 검증 명령

`AGENTS.md`의 `## 명령` 절이 정본이다. 완료 기준에는 그 절에 올라간 명령만 쓴다.

| 명령 | 보증하는 것 |
| --- | --- |
| `npm test` | 빈 포트에서 `web/`를 띄우고 `tests/*.spec.mjs` 전부를 돌린다. 스모크(로드, `window.arena.ready`, 페이지 오류 0)와 회귀 2개가 든다 |
| `npm test -- tests/<이름>.spec.mjs` | 그 시험 파일 하나 |

Playwright는 개발 의존성이다. `package.json`과 잠금 파일은 `web/` 밖에 있고 웹 결과물에 들어가지 않는다. 여러 사람 방 시험은 git 밖 `_workspace/qa/2026-11-12-webrtc-20-validation/V01/`의 로컬 PeerServer를 `tests/qa-x.spec.mjs`처럼 불러 쓴다. 저장소에 패키지를 더하지 않으며, 그 폴더가 있는 PC에서만 돈다.

## 유효한 결정

| 결정 | 맥락 | 고르지 않은 것과 이유 | 잃는 것 |
| --- | --- | --- | --- |
| 정적 Three.js r170 앱(`web/`) 위에서 만든다 | 사용자 결정. 지금 도는 앱이 이 모양이다 | Next.js로 옮기기: 옮기는 일이 기한 안에 들지 않는다 | 서버 기능, 페이지 이동, 빌드 도구가 없다. 하네스 문서의 Next.js 경로와 다르다 |
| `main.js`를 뼈대와 기능 모듈(`create(ctx)`)로 나눈다 | 거의 모든 항목이 `main.js` 한 파일에 닿아 Task가 한 줄로 선다 | 한 파일에 이어 쓰기: 같은 파일을 여러 Task가 동시에 고치게 된다 | 간접 층(`ctx`, 이벤트)이 하나 생긴다 |
| 모듈 사이는 `EventTarget` 버스로 말한다 | 모듈마다 담당 Task가 다르다 | 모듈끼리 import: 파일 소유가 엉킨다. 상태 저장소 라이브러리: 런타임 라이브러리를 늘리지 않는다 | 이름이 틀려도 실행 전에는 모른다(상수와 시험으로 막는다). 마지막 값을 각자 갖고 있어야 한다 |
| 설정은 모듈마다 JSON 한 파일 | 값은 사용자가 화면을 보고 바꾼다 | 설정 파일 하나: 여러 Task가 같은 파일을 고친다 | 파일이 13개로 흩어진다 |
| 영상은 유튜브 IFrame 플레이어를 CSS3D로 스크린 면에 놓는다 | 유튜브 영상 픽셀은 교차 출처라 WebGL 텍스처로 옮길 수 없다 | 비디오 텍스처: 위 이유로 되지 않는다 | 영상에 3D 조명과 톤 매핑이 닿지 않는다. 렌더러 `alpha: true`와 뚫는 판이 필요하다. 소리를 가공할 수 없어 거리 음량은 `setVolume`뿐이다 |
| 생방송/재방은 설정의 편성 시간표가 정한다 | 사용자 결정: 방장도 사용자도 고르지 않는다 | 선택 상자: 사용자 결정으로 없앤다. 방장이 소스를 방에 알리기: 메시지가 늘고 같은 설정을 읽으면 필요 없다 | 사용자가 소스를 바꿀 수 없다. 시간표를 바꾸려면 설정 파일을 다시 올려야 한다. 생방송이 안 나오면 그 칸 동안 재방이다 |
| 재방 위치는 방의 회차 시작 시각으로 각자 계산하고, 재방이 끝나면 방장이 다음 회차를 알린다 | 중간에 들어온 사람도 같은 식을 쓴다. 회차를 고르는 사람이 없다 | 방장이 재생 위치를 보내 맞추기: 메시지와 방장 의존이 늘어난다. 각자 끝나면 스스로 넘어가기: 경계 근처에서 같은 방 사람이 서로 다른 회차로 갈린다 | 기기 시계가 틀린 사람은 위치가 어긋난다. 방장의 플레이어가 영상 길이를 모르면(유튜브가 막힘) 그 방은 다음 회차로 넘어가지 않는다 |
| 연결 중개는 PeerJS Cloud, 방장 중심, 정원 16명 | 사용자 결정. 지금 앱의 방식이다 | Cloudflare 임시 터널: 여러 사람이 쓰는 서비스의 전제로 삼지 않는다. 자기 서버·Vercel·TURN: 비용 없이 간다 | TURN이 없어 일부 네트워크에서 연결되지 않는다. 무료 중개 서비스의 가용성과 한도에 기댄다(공식 수치 없음) |
| 방 키는 정해진 순번이고, 방이 있는지는 signaling이 그 peer id를 쥐고 있는지로 안다(방 구조 문서의 후보 E) | 사용자 결정: 16명씩 자동으로 짝짓고 운영자는 방 키와 개수만 안다. 무료, 새 계정 없음 | A 서버 함수와 저장소·B 관리형 DB: 비용, 계정, 런타임 라이브러리. C 운영자 로비 peer: 운영자 브라우저가 늘 켜져 있어야 한다. D 손으로 고치는 목록: 빈자리와 종료를 모른다 | 가득 찬 방 수만큼 찾는 시간이 든다. 방은 방송마다 `maxRooms`개까지다. 번호를 누구나 차지할 수 있다. 비공개 방이 없다. 운영자 화면은 열려 있는 동안만 본다 |
| 방장이 나가면 들어온 순서의 다음 사람이 이어받고, 혼자 남으면 혼자 시청으로 이어진다 | 사용자 결정: 방장 넘기기, 혼자 시청, 보던 영상 끊김 없이 | 방장이 나가면 방이 끝남: 사용자 결정에 어긋난다. 모두가 서로 잇는 모양: 연결 수가 늘고 지금 구조를 바꾼다 | 넘기는 몇 초 동안 다른 사람이 멈춰 보인다. 비정상으로 끊기면 방 키의 id가 풀릴 때까지 새 사람이 그 방에 들지 못한다 |
| 다른 참가자의 상태는 `pose`와 따로 `state`로 보낸다 | 회귀 시험이 `pose`와 `validPose`의 지금 모양을 쓴다 | `pose`에 칸을 더하기: 회귀 시험과 옛 검사가 깨진다 | 메시지 종류가 늘고 방장의 중계가 는다 |
| 포인터를 잠그지 않고, 둘러보기는 드래그다 | 사용자 결정: 마우스만으로 모든 버튼에 닿아야 하고, Esc로 화면이 바뀌면 안 된다 | 잠금을 두고 Esc로 풀기: 잠긴 동안 마우스만 쓰는 사람이 버튼에 닿지 못한다 | 마우스를 움직이기만 해서는 시점이 돌지 않는다. `releasePointer`·`capturePointer`는 이름과 하는 일이 어긋난 채 남는다(부르는 모듈 여섯을 고치지 않으려고) |
| 바닥 클릭 걷기는 길 찾기 없이 곧게 간다 | 사용자 결정: 지금의 충돌과 막힘을 지키고, 못 가는 곳은 가까운 데까지 | 길 찾기(내비 메시): 새 자산과 코드가 필요하고 요구에 없다 | 벽이나 의자 뒤를 누르면 돌아가지 않고 그 앞에서 멈춘다 |
| 빈 좌석은 클릭하면 충돌을 보지 않고 날아가 앉는다 | 사용자 결정: 빈 좌석까지 걸어갈 길이 관중과 좌석에 막혀 있다 | 통로를 넓히기: 경기장 자산을 고치는 큰 일이다. 곧바로 옮겨 앉기: 사용자가 날아가 착지하는 것으로 바꿨다 | 나는 동안 관중과 구조물을 지나간다. 걸어서는 여전히 닿지 못하는 좌석이 남는다 |
| 상영 시각은 방의 `roundStart`로 맞추고 방 키 이름에는 방송 id만 넣는다. 상영 시각은 지금의 회차 경계다 | 사용자 결정: (방송, 상영 시각)마다 방, 10분 회차 그대로 | 방 키 이름에 상영 시각까지: 운영자 화면이 지난 상영 시각의 방을 찾지 못하고, 회차 넘김 뒤 방 이름과 상영 시각이 어긋난다. 방송마다의 시각 목록: 시각 값과 시간대가 새로 필요하고 회차 계산을 다시 써야 한다 | `maxRooms`가 상영 시각마다가 아니라 방송마다다. 다른 상영 시각의 방 수만큼 찾는 시간이 는다. 특정 시각의 시간표를 짤 수 없다 |
| 들어가기에 걸린 일은 `app:enter` 하나로 알린다(클릭과 준비 가운데 늦은 쪽) | 첫 페이지가 생겨 들어가기 클릭이 경기장 준비보다 먼저일 수 있다 | 모듈마다 `#enter`의 `click`을 듣기(지금): 모듈이 만들어지기 전의 클릭을 놓친다 | 클릭이 먼저면 소리 켜기가 사용자 동작 밖에서 걸려 브라우저가 막을 수 있다(`### 소리와 음량`의 실패 상태) |
| 소리 상태는 하나이고 주인은 `screen-video.js`다. 관중 소리와 효과음은 그것을 따른다 | 사용자 결정: 소리는 기본 켬, 관중 소리 버튼은 없앤다, 음량은 한곳에서 | 소리 모듈을 새로 두기: 파일과 약속이 늘고 지금 조작 막대와 손잡이(`setMuted`, `setVolume`)를 옮겨야 한다 | 관중 소리가 화면 모듈의 상태에 기댄다. 관중 소리만 켜거나 끌 수 없다 |

## 결정 필요

| 정할 것 | 후보 | 추천 | 사용자 결정인가 |
| --- | --- | --- | --- |
| `web/ui/hud.js`의 내용과 `web/events.js`의 `HUD_TOAST` 한 줄을 쓸 Task(계획서의 어느 편집 범위에도 없다) | T27이 모두 씀, T27은 빈 자리만 두고 T31이 씀 | T27의 편집 범위에 `web/ui/hud.js`(새)와 `web/events.js`(한 줄 더하기만)를 더한다. T29·T30·T32가 같은 때에 알림을 내고 `data-state`에 기대므로 그 앞에 있어야 하고, `hud.js`가 만지는 것은 T27의 정적 요소뿐이다. T31은 `hud.js`를 고치지 않는다 | 아니오(코디네이터) |
| `tests/modules.spec.mjs`가 이 문서를 읽는 자리 | T27이 고침(그 파일의 주인) | `:6`의 끝 표시 `'### 기존 파일'`을 지금 제목 `'### 모듈 목록 밖의 파일'`로 바꾸고(지금은 끝을 못 찾아 뒤의 다른 표까지 센다) `:37`의 모듈 수를 14로, `:52`의 `screen` 기대값을 새 값(`'vod'`, `'next-round'`)으로 맞춘다 | 아니오(코디네이터) |
| 3D 런타임 쪽 변경(`input.js`의 잠금 제거와 클릭 가르기, `main.js`의 `world:click`, `player.walkTo`·`flyTo`, `seat-mode.js`의 좌석 클릭)을 맡을 Task | T46b가 모두, 3D 런타임 수정 Task(T45 쪽)가 따로 | 따로 둔다(`metaverse-3d-developer`). `## 파일 소유`의 두 묶음은 파일이 겹치지 않는다. `app:enter`와 `walking`의 뜻은 두 묶음이 함께 기대므로 3D 쪽이 먼저거나 같은 때에 약속대로 간다 | 아니오(코디네이터) |
| R 키(`plaza`, 광장으로 순간이동) | 없앰, 동작은 두고 키 힌트에만 없음 | 없앤다. UX 명세 `hud-controls.md`의 수락 기준 제안이 "동작하는 키는 모두 힌트에 적혀 있다"이고 힌트에 R이 없다. `window.arena.go('plaza')`는 남는다 | 예(사용자가 말한 것은 힌트에 넣을 키뿐이다) |
| 첫 페이지가 떠 있는 동안 3D를 그릴지 | 지금처럼 준비되면 곧 그림, 들어간 뒤에 그리기 시작 | 지금처럼 둔다. 불러오기는 주소를 열 때 시작하고 `window.arena.ready`는 클릭과 상관없이 참이 된다(시험이 이 순서에 기댄다). 그리기를 미루는 것은 UX 명세 `entry-loading.md`의 결정 필요 1이고, 성능 실측(T44)이 첫 페이지의 부하를 문제로 보면 다시 올린다 | 아니오(코디네이터) |
| 재방 상영 시각의 기본 선택과 기다림 | UX 명세대로 지난 시각은 못 고르고 다음 경계가 골라짐, 지금 도는 회차도 고를 수 있게 함 | UX 명세가 정한다. 이 문서는 어느 쪽이든 맞는다. 알릴 것: 다음 경계만 고를 수 있으면 새로 온 사람은 영상이 시작할 때까지 평균 5분(간격의 절반)을 기다리고, 재방이 끝나 넘어간 방(방금 시작한 회차)은 새로 고르는 사람과 맞지 않는다 | 예(기다림은 사용자가 보는 동작이다) |
| 방송이 둘 이상일 때 방송마다의 영상 주소와 편성을 둘 자리 | `broadcasts.json`의 항목 안, 방송마다 `screen-<id>.json` | 둘째 방송을 넣는 Task에서 정한다. 지금은 방송이 하나라 `screen.json`을 그대로 쓴다 | 아니오 |
| `broadcasts.json` 줄을 설정 파일 절의 표에 더하는 일 | T46b의 편집 범위에 이 문서의 그 한 줄을 넣음, T46b 뒤에 아키텍처 Task를 한 번 더 띄움 | T46b의 편집 범위에 넣는다(더할 내용은 그 절의 표 아래에 적혀 있다). 지금 더하면 `tests/modules.spec.mjs`가 파일이 생기기 전에 깨진다 | 아니오(코디네이터) |
| 넘기기에서 새 방장이 방 키의 peer id를 다시 잡기 전에 새로 온 사람이 그 번호로 새 방을 연 경우 | 넘겨받은 방이 빈 번호를 새로 잡음(방 키가 바뀜), 두 방을 합침 | 빈 번호를 새로 잡고 `room:state`의 `key`를 바꿔 낸다. 합치면 정원을 넘을 수 있다. T14가 얼마나 자주 생기는지 재어 리포트에 적는다 | 아니오. 방 키가 바뀌는 드문 경우라 최종 보고에 적는다 |
| 정적 파일을 올릴 호스팅 | Vercel(필요하면 유료), 그 밖의 정적 호스팅 | 이번 phase에는 정하지 않는다(배포 없음) | 예(비용, 외부 게시) |
| TURN을 쓸지 | 쓰지 않음, 유료 TURN | 쓰지 않는다. 연결 실패가 실제로 보이면 다시 올린다 | 예(비용) |
| 대상 기기와 성능 목표 숫자 | 요구에 없다. 가정: 데스크톱 브라우저(검증은 PC 한 대의 Playwright) | 성능 점검(T44)의 실측을 본 뒤 정한다 | 예 |
