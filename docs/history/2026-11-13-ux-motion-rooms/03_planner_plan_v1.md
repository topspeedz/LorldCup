# P03-plan 계획서와 Task DAG 리포트 (BL-0025~BL-0032, BL-0015·BL-0016 남은 것)

Task `task_eeee5a99a68a` · Dispatch `ctx_47b8362280a4` · planner(claude opus/max) · 2026-11-13

## 한 일

- 읽은 것: spec(`spec/P03-plan.md`), 브리프 전체(위임 범위와 `## 사용자 결정`의 마지막 줄), 설계서 전체, 설계 리포트, 백로그 대상 10행, 모델 표와 팀 명단, 팀 스킬 여섯(product, graphicmodel, web-metaverse-develop, legal-review, qa, harness), `phase-planning`과 두 참고 문서, `ux-design`, `ui-design`, `plan-orchestrate`, `coordinator`(기동·검증 절), spec 양식, `orca-launch.mjs`(register, launchable, fail, resolve), 지난 phase 계획서와 DAG 입력, 시험 파일이 단언하는 대상(`grep`). 메모(`spec/P03-plan.memo.md`)는 없었다.
- 할 일 1(설계서): `## 사용자 결정 필요`를 "없음." 한 줄과 채택 요약 표(1~18, 출처 "브리프 2026-11-13 · 창구 대행")로 바꿨다. 채택이 닿는 줄만 고쳤다: 머리의 상태 줄과 그림 입력 줄(설계 단계 사본 `dag-design-v1.json`·`waterfall-design-v1.json`을 가리키게), 1절 마지막 줄, 5.2의 흐름 이름 줄과 `room-keys.js`(결정 8)·`#host-room` 문장(결정 11), 5.4 제목, 7.1의 id 줄, 7.2 표의 결정 2 대안 줄.
- 할 일 2(계획서 `docs/superpowers/plans/2026-11-13-ux-motion-rooms.md`): 워커 Task 57개(조건부 4개 포함, 팀장 묶음 둘), 코디네이터 일 3개, 창구 대행 승인 2개. Task마다 백로그 항목, 의존과 읽는 산출물, 산출물과 리포트, 완료 검사, 편집 범위, 검증 환경값, low/likely/high와 likely 시각, 자원, 분할선, 배정을 적었다. `> 실행: Orca`, Task마다 커밋 단계 없음, 실행 방식 질문 없음.
- 정한 것(spec이 맡긴 범위 안):
  - 팀장: 규모별 경로대로 RM(방 T13~T16)과 QA(끝 QA T40~T43) 두 묶음에 팀장, 나머지는 직접. 다른 팀의 산출물을 기다리는 자리에서 등록 단위를 끊었다(지난 phase와 같은 읽기). 직접 띄우면 likely 13분(high 49분) 짧다는 계산을 함께 적었다(규칙의 예외는 요청하지 않음).
  - 분할선대로 처음부터 나눔: sv → T10(U-H-10 재현, 제품을 고치지 않아 W0에 돈다)·T11·T12, mp → T13~T16, a1 → T02·T03, ui → T20(토큰, UX 명세와 나란히)·T21·T22, 끝 리뷰 → T35~T37, 끝 QA 4영역, 수정·재검 두 줄, 2회차는 조건부 T49~T52. 설계서 5.2의 보강 Task는 T23으로 늘 돌린다(요구가 없으면 "변경 없음").
  - 파일 차례: `network.json` T14 → T15 → T32(`roundOffsets` 삭제를 T32로 옮겨 `tests/modules.spec.mjs:66`이 T27 → T32 차례가 되게), 시험 파일 주인 표, `--edits`에 팀 리포트 폴더를 넣지 않기(`launchable`의 접두어 겹침 검사).
  - BL-0025 막힘: Orca 의존은 등록 뒤 바꿀 수 없고 `fail`이 뒤 Task를 대기로 묶으므로(`orca-launch.mjs` 확인), T28은 T19가 completed일 때만, BL-0025에 기대는 끝 단계는 그 줄이 정산된 뒤 등록하게 했다.
  - 등록 순서 = 남은 임계 경로 순(`launchable`이 등록 순서로 고른다), T01만 4단계라 맨 앞.
  - UX 동행: T33 (가)가 T29·T32를, T34 (나)가 T30·T31과 T27 틀 줄을 걷는다. T27은 개발자 자기 걷기.
- 설계와 다르게 적은 곳과 이유: (1) U-H-10 단독 페이지 자리 `temp/` → `_workspace/web-metaverse-develop/<phase>/uh10/`(브리프 편집 범위 밖), (2) 이펙트 명세 자리 → `art/vfx/emotes/`(`vfx-design`의 자리, git에 남는다), (3) T28이 `character.js:133`의 앉기 보정 한 줄을 고칠 수 있게(새 클립이 요구할 때만, T18 뒤라 겹치지 않음), (4) 회고를 완료 처리 뒤로(`team-harness` 순서, 설계는 나란히였다), (5) UX 동행 한 명 → 둘(R-11, 화면 Task 넷이 25분 안에 몰려 끝남), (6) 중간 리뷰 방 T26은 `보안·돈이 걸린 변경 리뷰` 줄(남이 보낸 데이터를 받는 코드).
- 할 일 3(그림 입력): `tmp/plan-schedule.mjs`가 Task 표 하나로 일정을 계산하고 `dag.json`과 `waterfall.json`을 덮어쓴다. 계산 조건: 슬롯 8(팀장 터미널 포함), 한 팀 동시 팀원 4명, Blender·GPU 배타, Task마다 기동 3분, 등록 순서의 목록 일정. 결과: likely 657분(low 427, high 1,184), 작업 시간 합 2,250분, 폭 3.42, 최대 동시 8, BL-0025가 막히면 652분. 스윔레인 노드마다 `agent`·`model`·`effort`를 모델 표 조회값으로 넣었다(승인 노드 G1·G2 제외).

## 직접 소통

없음.

## 검증

- ✅ `git status --short -- docs/superpowers/plans/2026-11-13-ux-motion-rooms.md` → `?? docs/superpowers/plans/2026-11-13-ux-motion-rooms.md`
- ✅ `grep -c -E "^> 실행: Orca|^## DAG" docs/superpowers/plans/2026-11-13-ux-motion-rooms.md` → `2`
- ✅ `node -e "const t=require('fs').readFileSync('docs/superpowers/plans/2026-11-13-ux-motion-rooms.md','utf8');const s=new Set(t.match(/BL-00(15|16|2[5-9]|3[0-2])/g));console.log(s.size)"` → `10`
- ✅ `## DAG` 절 끝 `### 임계 경로와 병렬도`에 숫자로 있음: 임계 경로 likely 657분(Task 19단), 병렬 폭 2250 ÷ 657 = 3.42(low 3.27, high 3.37), 슬롯 수 8, 최대 동시 Task 수 8
- ✅ 계획서와 설계서의 `## 사용자 결정 필요` → 둘 다 "없음."으로 시작하고 번호 목록 0개(node로 절을 잘라 확인). 설계서는 그 아래에 채택 요약 표 1~18(출처 "브리프 2026-11-13 · 창구 대행")
- ✅ `node -e "for (const f of ['dag.json','waterfall.json']) JSON.parse(require('fs').readFileSync('_workspace/_run/2026-11-13-ux-motion-rooms/'+f,'utf8')); console.log('ok')"` → `ok`
- ✅ `node ~/.claude/skills/dag-swimlane/scripts/render.mjs _workspace/_run/2026-11-13-ux-motion-rooms/dag.json _workspace/_run/2026-11-13-ux-motion-rooms/tmp/dag-check.html` → `lanes 7 · columns 21 · nodes 62 · edges 92 · groups 2`, 종료 코드 0
- ✅ `node .claude/scripts/report-check.mjs _workspace/_run/2026-11-13-ux-motion-rooms/03_planner_plan_v1.md` → `"ok":true`
- (참고) `node ~/.claude/skills/waterfall-timeline/scripts/render.mjs _workspace/_run/2026-11-13-ux-motion-rooms/waterfall.json _workspace/_run/2026-11-13-ux-motion-rooms/tmp/waterfall-check.html` → 종료 코드 0(의존·슬롯·자원 검사 통과)
- (참고) `node _workspace/_run/2026-11-13-ux-motion-rooms/tmp/plan-consistency.mjs` → `consistent: ids, assignments, likely times, estimates, deps`(계획서의 `###` 항목과 그림 입력의 ID·배정·likely 시각·추정·의존이 같다)
- (참고) 계획서 `## 승인 전 점검`의 두 줄은 통과하지 못한 채로 이유를 적었다: 파일이 여럿인 Task(T05·T06·T21·T22·T29·T30, 대상 묶음 하나·완료 검사 하나), 4단을 넘는 사슬(임계 경로 19단, 뒤쪽은 단계 규칙이고 앞쪽은 웹 팀 4명 상한이 길이를 정함)
- (참고) 시간 값은 추정이다(설계서 7.1의 흐름 추정을 나눈 값과 지난 phase 비율). 렌더한 HTML을 브라우저로 열어 보지 않았고, 렌더러가 검사하지 않는 연결선끼리의 겹침은 확인하지 않았다. 게시는 창구 몫이라 하지 않았다
- (참고) 모델 표 조회(`node .claude/scripts/model-selection.mjs lookup`): `ux-designer`·`ui-designer`는 줄이 없어 기본 줄 claude opus/medium(결정 3), 팀장 두 묶음은 `리드` 줄 claude opus/high

## 남은 것

- 창구: 계획 승인을 대행해 브리프에 원문을 적고, 그림 둘(`dag.json`, `waterfall.json`)을 게시하고, `coordinator`의 `references/front-desk.md`대로 코디네이터를 띄운다. 승인 질문의 폭: 작업 시간 합 ÷ 임계 경로 = 3.42, 슬롯 8, 최대 동시 8.
- 코디네이터가 볼 곳: 계획서 `## 실행 방식`의 등록 순서와 늦게 등록하는 것 넷, `### BL-0025가 막힐 때`, `## UX 동행의 자리`(동행 Dispatch ID를 화면 Task 메모에 적기).
- 사용자 결정 필요: 계획서 0개, 설계서 0개.
- 작업용 파일(정본 아님): `_workspace/_run/2026-11-13-ux-motion-rooms/tmp/plan-schedule.mjs`(Task 표와 일정 계산, `--write`로 그림 입력을 다시 씀), `tmp/plan-consistency.mjs`(계획서와 그림 대조), `tmp/dag-check.html`, `tmp/waterfall-check.html`(검사용 렌더).
