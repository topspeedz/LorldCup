# 입장·로딩 화면 명세

- 읽는 시점: 첫 페이지(방송·상영 시각·들어가기·고지), 초대 들어가기, 로딩 커버(`#loading`), 걷기 첫 화면의 다음 할 일 줄을 만들거나 고칠 때
- 역할과 소유 범위: 위 요소의 자리, 크기, 위계, 겹침, 컴포넌트 상태의 모양. 흐름과 문구는 UX 명세 `docs/live/product/ux/entry-loading.md`가, 값은 토큰 표 `tokens.md`가 소유한다. 경기장 안의 공용 자리와 알림은 `hud-controls.md`가 정본이다
- 소유 에이전트: `ui-designer`
- 마지막으로 갱신한 phase: 2026-11-13-ux-motion-rooms (T60 마우스 우선 개정, BL-0035 첫 페이지, T60c 다음 시각만·상영 대기)
- 입력: UX 명세 `docs/live/product/ux/entry-loading.md`(T59 개정, T59c 상영 대기 UX-E14~E16), 토큰 `tokens.md`, 아트 디렉션 `## 화면 UI`, T60c 메모(T59c 결정 필요 D1~D4 위임 채택: D1 시각 버튼 3개, D2 Full Mode 중 남은 시간은 막대 안 글, D3 대기 중 시각 바꾸기 없음, D4 이름 "상영 시각" 그대로)

## 규칙

- 값은 토큰 이름으로만 부른다. 이 문서의 px 값은 토큰 표에 없는 판 너비뿐이고 `## 토큰이 아닌 치수`에 모았다.
- 들어가기는 포인터를 잠그지 않는다. 입장 판(왼쪽 아래 `#panel`), 키 목록, "다시 걷기", 잠금 실패 안내 `#fallback`, 메뉴 상태는 없다.

## 상태별 배치

데스크톱 기준 1280×720.

| 상태 | 요소 | 자리(기준 모서리와 여백 토큰) | 크기 | 위계 | 겹침(z) | 보임 조건 |
| --- | --- | --- | --- | --- | --- | --- |
| 첫 페이지 | 바탕 | 화면 전체 `color-bg` | 100% | — | `z-loading` | 주소를 연 순간. 3D는 아직 그리지 않는다 |
| 첫 페이지 | 첫 페이지 열 | 화면 가운데(세로·가로) | 너비 `entry-width`, 덩어리 사이 `space-4` | — | `z-loading` | 같다 |
| 첫 페이지 | 꼬리표 "WORLDS 2026" + 제목 | 열 맨 위 | 꼬리표 `font-size-xs` `letter-spacing-label` `color-text-subtle`, 제목 `font-size-xl` `font-weight-bold` `letter-spacing-title` | 2 | | 제목은 묻는 말 한 줄(UX 문구 표에 없으면 `ux-designer`에게 넘긴 줄, `## 결정 필요` 1) |
| 첫 페이지 | 방송 카드 | 제목 아래 | 열 너비, 안쪽 `space-4`, 안 덩어리 사이 `space-3` | 2(골라진 것) | | 방송마다 하나. 지금은 하나라 골라진 채로 보인다 |
| 첫 페이지 | 카드 안: 방송 이름 + 생방송/재방 꼬리표 | 카드 맨 위 | 이름 `font-size-md` 굵게, 꼬리표 `font-size-xs` 테두리 `color-accent` | | | |
| 첫 페이지(재방) | 카드 안: "상영 시각" 이름 + 시각 묶음 | 이름 아래 | 이름 `font-size-xs` `color-text-muted`, 묶음은 한 줄 이어 붙은 칸(사이 선 `color-border`), 칸 높이 버튼 높이, 칸 셋이 묶음 너비를 똑같이 나눔 | 2 | | 재방만. 생방송 카드에는 없다. 칸은 **다음** 10분 회차 경계 셋(T59c "다음 시각만", D1), 가장 가까운 것이 골라져 있다. 지금 도는 회차·지난 시각의 칸은 만들지 않는다(흐린 칸도 없음). 골라진 시각이 지나면 그 칸이 빠지고 끝에 새 경계 칸이 붙는다: 칸은 늘 셋이라 묶음 너비·자리는 움직이지 않고, 칸 안 글자만 바뀐다(움직임 없음) |
| 첫 페이지 | 자동 연결 고지 + "자세히" | 카드 아래, 들어가기 바로 위 | 열 너비, 두 줄까지 | 3 | | 늘(`room-invite.md`) |
| 첫 페이지 | 들어가기 `#enter` | 열 맨 아래 | 열 너비, 높이 버튼 높이 + `space-3` | 1 강조(이 화면의 하나뿐인 주된 조작) | | 늘. 처음 초점이 여기 |
| 초대 들어가기 | 꼬리표 + 제목 "친구가 부른 방으로 들어가요" + 고지 + 들어가기 | 첫 페이지 열과 같은 자리·너비 | 같음 | 1 들어가기 | `z-loading` | `?room=` 링크로 와서 로딩이 끝난 뒤. 방송 카드는 없다 |
| 로딩 중 | 커버 바탕 + 카드(꼬리표, 제목, 진행 막대, 단계 글자) | 화면 가운데 | 너비 `cover-width` | 1 제목(`font-size-lg`), 2 막대, 3 단계 글자(`color-text-muted`) | `z-loading` | 들어가기 클릭 뒤(초대는 링크를 연 순간)부터 준비 완료까지. 커버 아래는 `inert` |
| 로딩 중 | 진행 막대 | 카드 안, 제목 아래 `space-4` | 카드 너비 × `bar-height` | 채움 `color-accent`, 바닥 `color-panel-raised` | `z-loading` | 조명 단계는 진행 없는 막대 |
| 로딩 실패 | 커버 카드(제목, 원인 한 줄, "다시 시도") | 화면 가운데 | 너비 `cover-width` | 1 "다시 시도"(강조) | `z-loading` | 실패 순간. 초점은 "다시 시도" |
| 걷기 | 다음 할 일 줄 | 왼쪽 위 가장자리(`hud-controls.md`) | 내용 너비 | 1 | `z-hud` | 티켓 전만 |
| 상영 대기(재방) | 남은 시간 줄 `#showtime-wait` "N분 뒤 시작해요" | 왼쪽 위 가장자리(위 `edge`, 왼쪽 `edge`). 다음 할 일 줄이 있으면 그 줄은 남은 시간 줄 아래 `space-2`로 내려간다 | 내용 너비 한 줄 | 2(상태. 주된 조작이 아니라 강조색을 쓰지 않는다) | `z-hud` | 들어간 뒤 ~ 시작 시각. 재방만. 생방송·이미 시작한 초대 링크에는 없다 |
| 상영 대기(재방) | 그 밖의 HUD | 걷기와 같다(`hud-controls.md`). 새 판·창·버튼·건너뛰기 없음 | | | | 대기는 새 `data-state`가 아니다(T59c) |
| 상영 대기(재방) | 스크린 | 재생 전 첫 화면. 그 위에 앱 요소 0개(LG-H-4) — 남은 시간 줄도 영상 사각형 밖 | | 주인공 | | |
| 상영 대기 + Full Mode | 남은 시간 글 `#full-mode-wait` | Full Mode 막대 판 안, 소리 버튼 왼쪽(같은 판, 새 판 없음) | 글 한 줄 | 막대 안 2 | Full Mode 층 | D2. 영상 칸 밖(막대는 영상 아래 칸) |
| 상영 대기 → 시작 | 남은 시간 줄 | — | — | — | — | 시작 시각에서 1초 안에 `motion-base`로 사라진다. 같은 순간 영상이 처음부터 소리와 함께 재생된다. 다음 할 일 줄은 위로 `motion-base`만큼 올라와 제자리(왼쪽 위 `edge`)로. 그 밖의 HUD, 앉음, Full Mode, 열린 메뉴는 그대로. 화면 전체 전환·알림·소리 효과 없음. 브라우저가 소리를 막으면 소리 버튼만 "소리 켜기" 모양(`hud-controls.md` 2.2) |
| 걷기 | 키 힌트, 설정 묶음, 행동 버튼 | `hud-controls.md` | | | | |

- 첫 페이지의 박스는 방송 카드 1 + 상영 시각 묶음 1 + 들어가기 1 = 3이다(고지는 판 없는 글). `counts.json`의 6은 시각 칸 셋을 하나씩 센 값이다(T60의 7에서 칸 하나 줆).
- 첫 페이지 → 로딩 → 경기장의 전환은 `motion-slow`(움직임 줄이기면 즉시).

## 컴포넌트

| 요소 | 기본 | 올림 | 누름 | 초점 | 비활성 | 진행 중 |
| --- | --- | --- | --- | --- | --- | --- |
| 들어가기·"다시 시도"(주된 조작) | 바탕 `color-accent`, 글자 `color-text-on-accent` `font-weight-bold`, `radius-sm` | 테두리 `color-text`, `motion-fast` | 아래로 1px 눌림 + 올림 테두리 | `focus-ring` | `opacity-disabled` | 누른 뒤 로딩 커버가 덮는다 |
| 방송 카드 | 바탕 `color-panel`, 테두리 2px `color-border`, `radius-md` | 테두리 `color-text-muted` | — | `focus-ring` | — | 골라짐: 테두리 2px `color-accent`(꼬리표와 함께라 색만으로 알리지 않음) |
| 상영 시각 칸 | 바탕 `color-panel-raised`, 글자 `color-text` | 바탕 `color-panel-hover` | 바탕 `color-panel-hover` | `focus-ring` | 없음(지난 시각은 칸을 만들지 않는다, T59c) | 골라짐: 바탕 `color-accent`, 글자 `color-text-on-accent` 굵게(하나만) |
| 남은 시간 줄 `#showtime-wait` | 판 `panel-alpha-hud`(`.panel-hud`, 강조 선 없음), 안쪽 `space-1` × `space-3`, 글자 `font-size-md` `font-weight-bold` `color-text` `text-shadow-hud`, 숫자 고정폭(`tabular-nums`, 초마다 바뀌어도 줄 너비가 떨지 않게) | — | — | — | — | 누를 것이 아니다(`role="status"`). 1분 안이 되어도 색·크기·깜빡임을 바꾸지 않는다(글만 "N초"). 시작 시각에 `motion-base`로 사라짐(움직임 줄이기면 즉시) |
| 자동 연결 고지 | `room-invite.md` | | | | | |
| 진행 막대 | 바닥 `color-panel-raised`, 채움 `color-accent`, `radius-sm` | — | — | — | — | 진행 없는 막대: 채움 조각 30%가 `motion-slow`×4 주기로 오감. 움직임 줄이기는 정지 |
| 다음 할 일 줄 | 판 `panel-alpha-hud`, 왼쪽 선 3px `color-accent`, 글자 `color-text` | — | — | — | — | 티켓을 받으면 `motion-base`로 사라짐 |

## 작은 창·모바일

390×844 기준(폭 800px 이하 공통).

| 요소 | 바뀌는 것 |
| --- | --- |
| 첫 페이지 열 | 너비 = 화면 − 가장자리 × 2. 세로는 아래 맞춤(엄지 자리): 아래 끝 = 가장자리 + `space-5` + `safe-inset`. 들어가기와 고지가 스크롤 없이 첫 화면 안(UX-E10, 시안 `m-first.png`) |
| 들어가기, 시각 칸 | 높이 ≥ `size-target-touch`. 시각 칸 셋이 열 너비를 나눠 한 줄(`m-first.png`) |
| 남은 시간 줄 | 왼쪽 위가 아니라 **왼쪽 아래**: 왼쪽 `edge`, 아래 = `edge` + `size-target-touch` × 3 + `space-2` × 2 + `space-3`(행동 버튼 두 줄과 앉기 버튼 줄의 한 줄 위). 세로 화면에서는 걸린 스크린이 왼쪽 위에 걸리기 쉬워(시안 `m-wait.png` 바탕) 왼쪽 위 자리는 영상과 겹친다(LG-H-4). 엄지 영역 위라 누를 것은 아니고 읽기만 |
| Full Mode 막대(대기 중) | 막대가 두 줄로 접힌다: 첫 줄 남은 시간 글(막대 너비), 둘째 줄 소리·음량·닫기. 판은 하나 그대로, 화면 안(`m-wait-full.png`) |
| 초대 들어가기 | 첫 페이지 열과 같다(`m-invite.png`) |
| 커버 카드 | 너비 = 화면 − `space-4` × 2 |
| 경기장 | `hud-controls.md` `## 작은 창·모바일` |

## 토큰이 아닌 치수

| 이름 | 값 | 근원 |
| --- | --- | --- |
| `entry-width` | 380px | 출발값(첫 페이지 열 너비) |
| `cover-width` | 420px | 출발값 |
| `bar-height` | 6px | 출발값 |
| `toast-ms` | 2500ms(`motion-hide-delay`와 같은 값) | UX "2초 넘게". 쓰는 곳은 `hud-controls.md` `## 알림(공용 정본)` |

## 시안

시안 폴더 `docs/live/graphicmodel/ui/preview/mouse/`(만드는 법은 `hud-controls.md` `## 시안`). 첫 페이지와 초대 들어가기는 3D가 그려지기 전이라 바탕이 `color-bg`다.

| 상태 | 그림 경로 | 장면 | 상자 · 글 |
| --- | --- | --- | --- |
| 첫 페이지(재방, 다음 경계 20:30·20:40·20:50, 20:30 골라짐, T60c) | `d-first.png` | `color-bg` 1280×720 | 6 · 99 (보이는 상자 3) |
| 첫 페이지 390×844 | `m-first.png` | 같음 | 6 · 99 |
| 상영 대기(티켓 전, 걷기) | `d-wait.png` | 경기장, 걸린 스크린 보임(영상 사각형 420,0–850,160 밖 확인) | 7 · 81 (걷기 대비 상자 +1 = 남은 시간 줄) |
| 상영 대기 390×844(티켓 뒤) | `m-wait.png` | 경기장, 스크린 왼쪽 위(0,0–195,170 밖 확인) | 9 · 39 (`m-walk` 대비 +1) |
| 상영 대기 + Full Mode | `d-wait-full.png` | Full Mode 화면 | 3 · 18 (Full Mode 대비 상자 +0) |
| 상영 대기 + Full Mode 390×844 | `m-wait-full.png` | 같음 | 3 · 17 (+0) |
| 초대 들어가기 | `d-invite.png` | 같음 | 1 · 78 |
| 초대 들어가기 390×844 | `m-invite.png` | 같음 | 1 · 78 |
| 걷기 첫 그림 | `d-walk.png`, `m-walk.png` | 광장 / 경기장 | `hud-controls.md` |

로딩 커버와 실패 화면은 모양이 그대로라 이전 시안(`_workspace/graphicmodel/2026-11-13-ux-motion-rooms/preview/ui/a/d-loading.png`, `d-load-fail.png`)을 쓴다.

## 결정 필요

3. (T60c) 모바일 걷기 시안 `m-walk.png`의 다음 할 일 줄(왼쪽 위)이 같은 바탕의 걸린 스크린(0,0–195,170)과 겹친다. 이번 대기 줄은 왼쪽 아래로 피했지만 다음 할 일 줄의 자리는 `hud-controls.md` 소유라 이 Task에서 바꾸지 않았다. 추천: 모바일의 다음 할 일 줄도 남은 시간 줄 바로 위(왼쪽 아래)로. `hud-controls.md` 정본 수정 Task가 필요하다.

1. 첫 페이지 제목 "어떤 경기를 볼까요?"는 UX 문구 표에 없다(표에는 "WORLDS 2026"만). 시안은 꼬리표 "WORLDS 2026" + 묻는 말 제목으로 그렸다. `ux-designer`가 문구 표에 넣거나 빼고, 빼면 제목 자리에 "WORLDS 2026"을 `font-size-xl`로 둔다.
2. 공간 재현 문구("제공 사진을 참고한 공간 재현 …")는 고지의 "자세히" 안으로 옮긴다(UX 결정 필요 3). 법무 표시 의무가 있는 문구면 T62가 자리를 정한다.
