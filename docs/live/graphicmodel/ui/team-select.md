# 팀·캐릭터 선택 화면 명세

- 읽는 시점: 팀·캐릭터 선택 창(`web/ui/team-select.js`, `#team-select`)과 여는 버튼(`#team-select-open`)을 만들거나 고칠 때(T29 화면 적용, T33 UX 동행, T24 아트 대조)
- 역할과 소유 범위: 창과 버튼의 자리, 크기, 위계, 겹침, 컴포넌트 상태의 모양. 흐름과 문구는 UX 명세 `docs/live/product/ux/team-select.md`, 값은 `tokens.md`
- 소유 에이전트: `ui-designer`
- 마지막으로 갱신한 phase: 2026-11-13-ux-motion-rooms (T60 마우스 우선 개정)
- 입력: UX 명세 `docs/live/product/ux/team-select.md`, 토큰 `docs/live/graphicmodel/ui/tokens.md`, 팀 데이터 `web/config/teams.json`

## T60 마우스 우선 개정

- 여는 버튼 "팀·캐릭터"는 오른쪽 위 설정 묶음의 줄 버튼이다(`hud-controls.md` 설정 묶음 셋째 줄, 오른쪽 끝에 지금 팀 색 점). 걷기·앉기 어느 상태에서도 보이고 클릭 한 번에 창이 열린다(Full Mode에서만 숨음). 390×844도 같은 자리(줄 높이 `size-target-touch`), ☰ 뒤에 숨지 않는다.
- 창이 열린 동안 뒤의 HUD는 걷기 HUD(상자 6 안팎)뿐이라 창이 묻히지 않는다. 창 자체의 배치·모양은 아래 표 그대로.
- 이 절이 아래 표보다 이긴다. 아래 표의 "커서 풀림", "메뉴 버튼(☰)", "키 안내 줄", "아래 1단/2단", "조작 막대", "Esc → 메뉴" 줄은 이 절의 자리로 읽는다. 공용 자리는 `hud-controls.md`(T60), 시안은 `preview/mouse/`.

## 규칙

- 창은 화면 가운데를 덮지 않는다. 가운데의 내 캐릭터(3인칭 카메라)가 창이 열린 채 보여야 한다(UX-T02, UX 결정 1 추천 채택: 미리보기 3D 없음).
- 고른 것은 색 말고 "✓ 선택됨" 글자로도 보인다(UX-T03, WCAG 1.4.1).

## 상태별 배치

데스크톱 1280×720 기준.

| 상태 | 요소 | 자리(기준 모서리와 여백 토큰) | 크기 | 위계 | 겹침(z) | 보임 조건 |
| --- | --- | --- | --- | --- | --- | --- |
| 첫 방문·커서 풀림 | 여는 버튼 "팀·캐릭터" | 메뉴 버튼 무리 안(`hud-controls.md`의 커서 풀림 버튼 자리) | 높이 ≥ `size-target-min` | 보조 | `z-hud` | 걷기·앉기·Full Mode에서 숨음 |
| 창 열림 | 창 | 오른쪽 가운데: 오른쪽 `space-5`, 세로 가운데 | 너비 `dialog-width`, 최대 높이 = 화면 − 2×`space-5`(넘치면 창 안 세로 스크롤) | 1 지금 고를 줄, 2 제목(`font-size-md`), 3 줄 이름 | `z-menu` | 버튼·티켓 창 "팀 고르기"로 엶. 뒤를 어둡게 하지 않는다(장면이 보임) |
| 창 열림 | 창 안 순서(위→아래) | 제목 "팀·캐릭터 선택" → 줄 이름 "응원팀"(꼬리표) → (미선택 "아직 고르지 않음", `color-text-muted` `font-size-xs`) → 팀 버튼 2열 → 줄 이름 "캐릭터" → 캐릭터 버튼 2열 | 덩어리 사이 `space-4`, 버튼 사이 `space-2` | — | — | — |
| 창 열림 | 닫기 "✕" | 창 오른쪽 위 `space-3` | `close-size` 정사각 | 보조 | `z-menu` | 항상 |
| 창 열림 | 팀 버튼 | 응원팀 줄 2열 | 높이 `team-height`, 왼쪽 띠 6px = 팀 `accent`, 바탕 = 팀 `color` | 고를 줄의 주된 조작(고르면 강조 윤곽) | `z-menu` | — |
| 창 열림 | 캐릭터 버튼 | 캐릭터 줄 2열 | 두 줄: 1줄 이름, 2줄 선택 표식 자리(고르지 않으면 비움). 높이 `team-height`(고르기 전후 같음, 고를 때 버튼이 커지지 않는다) | 보조 | `z-menu` | — |
| 창 열림 | 창 밖 | 창 밖 클릭은 창만 닫는다(UX 결정 2 추천 채택). 걷기로 가지 않는다 | — | — | — | — |
| 걷기·앉기·Full Mode | 창·여는 버튼 | 숨음 | — | — | — | Esc → 메뉴 → 버튼으로 찾는다 |

## 컴포넌트

| 요소 | 기본 | 올림 | 누름 | 초점 | 비활성 | 진행 중 |
| --- | --- | --- | --- | --- | --- | --- |
| 창 | 판 `panel-alpha` + `panel-blur`, 테두리 `color-border-subtle`, `radius-md`, `shadow-panel`, 안쪽 `space-5` | — | — | — | — | 나타남 `motion-base` `ease-out`(오른쪽에서 `space-4` 미끄러짐 + 불투명도), 사라짐 `motion-base` `ease-in`. 움직임 줄이기는 불투명도만 |
| 팀 버튼(고르지 않음) | 바탕 팀 `color`, 왼쪽 띠 팀 `accent`, 글자는 팀 바탕과 대비 4.5:1 이상인 쪽(아래 표) `font-weight-bold`, 테두리 `color-border` | 테두리 `color-text` | 아래로 1px | `focus-ring` | — | — |
| 팀 버튼(고름, `aria-pressed=true`) | 기본 + 윤곽 2px `color-accent`(안쪽) + 오른쪽 위 "✓ 선택됨"(`font-size-xs` 굵게, 버튼 글자색). 이름은 아래 줄(바닥 맞춤)이라 둘이 겹치지 않는다 | 같음 | 같음 | `focus-ring`(바깥) | — | — |
| 캐릭터 버튼(고르지 않음) | 바탕 `color-panel-raised`, 테두리 `color-border`, 글자 `color-text` | 바탕 `color-panel-hover`, `motion-fast` | 바탕 `color-panel-hover` + 아래로 1px | `focus-ring` | — | — |
| 캐릭터 버튼(고름) | 기본 + 윤곽 2px `color-accent` + 2줄 "✓ 선택됨"(`font-size-xs` 굵게, 버튼 글자색). 이름(1줄)과 같은 줄에 두지 않는다 | 같음 | 같음 | `focus-ring` | — | 캐릭터 모델을 불러오는 동안: "✓ 선택됨" 대신 회전 표시(로딩 꼬리표와 같은 모양) |
| 닫기 | 바탕 없음, 테두리 `color-border`, 글자 `color-text`, `radius-sm` | 바탕 `color-panel-hover` | 같음 | `focus-ring` | — | — |

### 팀 버튼 글자색(토큰이 아닌 값의 대비 확인)

| 팀 | 바탕(`color`) | 글자 | 대비 |
| --- | --- | --- | --- |
| GEN.G | `#10131a` | `color-text` | 17.01:1 |
| BLG | `#e9f1f4` | `color-text-on-accent` | 14.03:1 |
| GEN.G 카드 작은 글 | `#10131a` | 팀 `accent` `#d6b45a` | 9.32:1 |

새 팀이 더해지면 바탕 밝기로 둘 중 대비가 큰 쪽을 고른다(T29 코드가 계산, 손으로 고르지 않는다).

## 작은 창·모바일

360×640 기준(800px 이하 공통).

| 요소 | 바뀌는 것 |
| --- | --- |
| 창 | 아래 시트: 왼쪽·오른쪽·아래 `space-4` + `safe-inset`, 안쪽 `space-4`, 최대 높이 58%(위쪽 42%에 내 캐릭터가 보인다), 넘치면 창 안 세로 스크롤 |
| 팀·캐릭터 버튼 | 높이 `team-height`(≥ `size-target-touch`), 2열 그대로. 이름과 "✓ 선택됨"은 서로 다른 줄(360px에서 버튼 폭 ≈ 140px라 한 줄에 둘이 들어가지 않는다). 이름이 한 줄을 넘으면 말줄임(…) |
| 닫기 | `size-target-touch` 정사각 |
| 여는 버튼 | 메뉴 버튼(☰) 뒤 메뉴 안(`entry-loading.md` 모바일) |

## 시안

경로 앞부분: `_workspace/graphicmodel/2026-11-13-ux-motion-rooms/preview/ui/a/`.

| 상태 | 그림 경로 | 장면(밝음/어두움/영상 재생) |
| --- | --- | --- |
| 창 열림, 팀 미선택 | `d-team-open.png` | 밝음(광장) |
| 창 열림, BLG·남성 팬 1 고름 | `d-team-picked.png` | 어두움 + 영상 재생(경기장, 평균 26·최대 204) |
| 모바일 창(옛 배치, 이름·표식 겹침 — A-H-5로 대체) | `m-team.png` | 밝음(광장) 360×640 |
| 모바일 창, 고르기 전 | `../fix/m-team-360-before.png` | 밝음(광장) 360×640 |
| 모바일 창, GEN.G·여성 팬 1 고른 뒤 | `../fix/m-team-360-after.png` | 밝음(광장) 360×640 |

## 토큰이 아닌 치수

| 이름 | 값 | 근원 |
| --- | --- | --- |
| `dialog-width` | 360px | 출발값. 1280 화면에서 가운데 560px(캐릭터 자리)를 비운다. `ticket.md`와 같은 값 |
| `team-height` | 64px | 출발값(이름 + 선택 표시 두 줄). 팀 버튼과 캐릭터 버튼이 함께 쓴다 |
| `close-size` | 32px | `size-target-min` 이상 출발값 |

## 결정 필요

- 없음. 창 위치와 창 밖 닫기는 UX 명세 결정 1·2의 추천을 채택했다(메모 위임).
