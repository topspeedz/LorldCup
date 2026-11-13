# Full Mode 화면 명세

- 읽는 시점: Full Mode를 여는 버튼, Full Mode 화면(영상, 아래 막대, 닫기 버튼)을 만들거나 고칠 때.
- 역할과 소유 범위: Full Mode에 닿는 화면 요소의 자리, 크기, 위계, 겹침, 상태별 모양. 흐름은 UX 명세, 조작 막대 안 요소의 모양은 `hud-controls.md`가 정본이다.
- 소유 에이전트: `ui-designer`
- 마지막으로 갱신한 phase: 2026-11-13-ux-motion-rooms (T60 마우스 우선 개정)
- 입력: UX 명세 `docs/live/product/ux/full-mode.md`, 토큰 `docs/live/graphicmodel/ui/tokens.md`, 공용 자리 `docs/live/graphicmodel/ui/hud-controls.md` `## 공용 자리`

## T60 마우스 우선 개정

- 여는 길: 걷기·앉기의 오른쪽 아래 "Full Mode" 버튼(앉기면 강조)과 키 힌트 "F Full Mode"(F는 지금 있는 바인딩 그대로, 힌트 자리만 오른쪽 위로). 커서 풀림 상태가 없으므로 버튼은 늘 보인다(예외: 걷는 중 영상이 그 자리에 오면 `hud-controls.md` 「'늘 보인다'의 예외」).
- Full Mode 막대: 오른쪽 아래 한 판 안에 소리 줄 버튼(아이콘) + 음량 막대(`space-5` × 4) + "Full Mode 닫기" 강조 버튼(데스크톱은 키캡 `F`). 소스 글은 빼서 상자 3·글 11자(지금 7·35, 시안 `d-full.png`, `m-full.png`). 닫으면 나온 상태(걷기/앉기)로 돌아오고 포인터를 잠그지 않는다.
- 이 절이 아래 표보다 이긴다. 아래 표의 "커서 풀림", "메뉴 버튼(☰)", "키 안내 줄", "아래 1단/2단", "조작 막대", "Esc → 메뉴" 줄은 이 절의 자리로 읽는다. 공용 자리는 `hud-controls.md`(T60), 시안은 `preview/mouse/`.

## 규칙

- 현재 상태만 담는다. 갱신은 소유 에이전트의 Task로 한다.
- 모든 값은 토큰 이름으로 부른다. 문구는 UX 명세 `## 6. 문자열`이 정본이다. "Full Mode"는 어디서나 영문 그대로.

## 상태별 배치

| 상태 | 요소 | 자리(기준 모서리와 여백 토큰) | 크기 | 위계 | 겹침(z) | 보임 조건 |
| --- | --- | --- | --- | --- | --- | --- |
| 걷기 | 키 안내 "F Full Mode" | 키 안내 줄 안(`hud-controls.md`) | 키캡 `size-keycap` | 1 | `z-hud` | 늘 |
| 커서 풀림 | "Full Mode (F)" 버튼 `#full-mode-open` | 행동 버튼 묶음(아래 1단 오른쪽) 가운데 | 버튼 높이 | 2(그 상태의 강조는 입장 판의 `#enter` "다시 걷기", `hud-controls.md` 「커서 풀림의 통합 배치」) | `z-hud` | 스크린이 있을 때(`window.arena.screen`) |
| 앉기 | "Full Mode (F)" 버튼 | 행동 버튼 묶음 맨 오른쪽 | 버튼 높이 | 1 강조 버튼 | `z-hud` | 앉은 직후부터 |
| 터치 | "Full Mode" 버튼 | 행동 버튼 묶음(아래 2단 왼쪽). 서 있으면 둘째 칸, 앉으면 둘째 줄 첫 칸 | `size-target-touch` | 서 있으면 2, 앉으면 1 강조 | `z-hud` | 늘 |
| 입장 전 | "Full Mode (F)" 버튼 | (가) 묶음의 입장 화면 배치(`entry-loading.md`)가 정한다 | | | | 스크린이 준비되면 |
| Full Mode | 영상 | 아래 막대 위의 남는 칸 가운데, 16:9로 칸 안에 가득(남는 곳 바탕 `color-bg`) | 폭 = min(화면 폭, 남는 높이 × 16/9) | 주인공 | Full Mode 층 | 늘 |
| Full Mode | 아래 막대 `#arena-screen-controls`(Full Mode 모양) | 아래 가장자리에 붙어 화면 폭 전체 | 높이 `size-target-touch` + 위아래 `space-1`, 좌우 안쪽 `space-4` | 2 | Full Mode 층 안 맨 위 | 늘(사라지지 않는다, UX-F-R03·R04) |
| Full Mode | 막대 왼쪽 | 소리 버튼 → 음량 막대(`space-5` × 5) → 지금 소스 → 연결 안내 | 소리 버튼 `size-target-touch` 정사각 | 2 | | |
| Full Mode | 상태 표시 "Full Mode" | 막대 오른쪽, 닫기 버튼 왼쪽 `space-2` | `hud-controls.md` 상태 표시 | 3 | | |
| Full Mode | "Full Mode 닫기 (Esc)" 버튼 | 막대 오른쪽 끝 | 높이 `size-target-touch`, 폭은 글자 한 줄 + 좌우 `space-4`. 막대 안에서 가장 먼저 자리를 잡고 줄지 않는다(줄바꿈 없음, 다른 요소가 남는 폭을 나눈다) | 1 강조 버튼, 들어오면 초점 | | 늘. 영상 안을 누른 뒤에도 그대로 |
| Full Mode | 3D HUD(키 안내 줄, 행동 버튼 묶음, 조준점, 좌석 표시, 감정표현 버튼) | — | | | | 없음(Full Mode 층 뒤) |

- 영상 위에 겹치는 앱 요소는 없다. 막대는 영상 칸 밖(아래)에 있다. 유튜브 자체 조작은 영상 칸 안에서 유튜브가 그린다(F-D2 채택: 끄지 않는다).
- 지금 연결 안내를 Full Mode에서 왼쪽 위에 따로 띄우는 것(지금 앱)을 그만두고 막대 안에 둔다. 영상 위에 글이 뜨지 않는다.
- 남는 칸 바탕: 지금 앱의 검정(`#000`)은 토큰이 아니다. `color-bg`를 쓴다(밤 경기장 톤, 영상 가장자리와 갈림).

## 컴포넌트

막대 안 요소(소리 버튼, 음량 막대, 지금 소스, 연결 안내)는 `hud-controls.md` `## 컴포넌트`를 따른다.

| 요소 | 기본 | 올림 | 누름 | 초점 | 비활성 | 진행 중 |
| --- | --- | --- | --- | --- | --- | --- |
| 아래 막대 | 바탕 `color-panel` + `panel-alpha`, 위 테두리 `border-width` `color-border-subtle` | — | — | Tab은 막대 안에서 돈다(소리 → 음량 → 닫기) | — | — |
| "Full Mode 닫기 (Esc)" | 강조 버튼 + 키캡 `Esc`(터치는 키캡 없음) | 강조 버튼 | 강조 버튼 | `focus-ring`, 들어오면 여기 | — | — |
| "Full Mode (F)" 여는 버튼 | 앉기면 강조 버튼, 아니면 보통 버튼, 키캡 `F` | 버튼을 따름 | 누른 그 프레임에 창 가득 | `focus-ring`, 나오면 여기로 돌아옴(커서 풀림) | 스크린이 없으면 보이지 않는다 | — |

- 들어가기·나오기: 창 가득 화면은 누른 그 프레임에 바뀐다(옮겨 가는 움직임 없음). 막대는 `motion-base`로 나타난다. `prefers-reduced-motion`에서는 바로.
- 손을 놓아도 막대와 닫기 버튼을 흐리게 하지 않는다(`opacity-overlay-idle`을 쓰지 않는다). 막대가 영상 밖에 있어 가리지 않고, UX가 "늘 보인다"를 요구한다(UX-F-R03·R04).

## 작은 창·모바일

터치(`body.touch`)나 폭 650px 이하. 시안 `fix/m-full-360.png`(360×640), `fix/m-full-390.png`(390×844).

| 줄 | 요소(왼쪽부터) | 크기 |
| --- | --- | --- |
| 막대 윗줄(보조) | 상태 표시 "Full Mode" → 지금 소스 글 → 연결 안내(바뀔 때만) | 높이 `size-keycap`, 사이 `space-2`. 넘치면 지금 소스 글이 말줄임(…)으로 줄고, 상태 표시와 연결 안내는 줄지 않는다 |
| 막대 아랫줄(조작) | 소리 버튼 → 음량 막대 → 닫기 버튼 | 높이 `size-target-touch`, 사이 `space-2`. 자리 잡는 순서: ① 닫기 버튼("Full Mode 닫기", 키캡 없음, 글자 한 줄 + 좌우 `space-4`, 줄지 않음) ② 소리 버튼(`size-target-touch` 정사각) ③ 음량 막대가 남는 폭 전부(최소 `space-5` × 2) |

- 막대 높이 = 윗줄 + `space-1` + 아랫줄 + 위아래 `space-1`. 영상 칸은 그만큼 줄어든다(영상 위에 겹치지 않는다).
- 360px 폭 안쪽(화면 − 좌우 `space-4`) 328px에 닫기 버튼 전체와 글자가 한 줄로 들어감을 `fix/checks.json`으로 확인했다.
- 데스크톱(넓은 창)은 위 「상태별 배치」의 한 줄 막대 그대로이고, 닫기 버튼이 줄지 않는 규칙만 같다.
- 안전 영역: 막대 아래 안쪽 여백에 `safe-inset`(아래)을 더한다.

## 시안

시안 폴더 `_workspace/graphicmodel/2026-11-13-ux-motion-rooms/preview/ui/b/`(만드는 법은 `hud-controls.md` `## 시안`). 바탕은 지금 앱의 Full Mode 캡처(영상 재생)다.

| 상태 | 그림 경로 | 장면(밝음/어두움/영상 재생) | 가장 낮은 글자 대비 |
| --- | --- | --- | --- |
| Full Mode(앉기에서 들어옴, 닫기에 초점) | `d-full.png` | 영상 재생 1280×720 | 10.39:1 |
| 터치 Full Mode(옛 한 줄 막대, 닫기 잘림 — A-H-4로 대체) | `m-full.png` | 영상 재생 390×844 | 10.39:1 |
| 터치 Full Mode 360 | `../fix/m-full-360.png` | 영상 재생 360×640 | `fix/contrast.json` |
| 터치 Full Mode 390 | `../fix/m-full-390.png` | 영상 재생 390×844 | `fix/contrast.json` |
| 앉기, Full Mode 버튼이 강조로 보임 | `d-seated.png` | 앉은 시야, 영상 재생 | 6.34:1 |
| 커서 풀림의 Full Mode 버튼 | `d-hud-free.png` | 무대 앞, 영상 재생 | 6.71:1 |

## 결정 필요

- 없음. 여는 버튼과 닫기 버튼의 ID(`#full-mode-open`)는 그대로, 닫기 버튼은 지금 `full-mode.js`가 만드는 버튼의 글자와 모양만 바뀐다.
