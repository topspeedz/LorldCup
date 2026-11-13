# 하네스 변경 이력

| 날짜 | 변경 | 대상 | 근거 |
| --- | --- | --- | --- |
| 2026-11-12 | 명령 절에 시험 명령 4개, 기술 스택을 정적 Three.js r170(web/)로, 팀 편집 범위를 web/·tests/ 기준으로 | AGENTS.md, docs/harness/team-org.md | 사용자 결정(정적 앱 유지), T02가 돌린 명령 |
| 2026-11-12 | `register`에 `--edits`·`--resource`, 새 명령 `launchable`(준비된 Task 중 빈 슬롯 안에서 편집 경로·자원이 겹치지 않는 것만), 시험 41~43. 워커 기동 절: 실제 입력만 `--deps`, 깰 때마다 `launchable`, 슬롯이 반 넘게 비면 실제 입력 기준으로 당김 | .claude/scripts/orca-launch.mjs, .claude/scripts/orca-launch.check.mjs, .claude/skills/coordinator/SKILL.md | 사용자 지시로 창구가 직접 반영. docs/history/2026-11-12-requirements-build/ 브리프의 "회고에 넘길 것" |
| 2026-11-12 | 승인 전 점검에 한 줄: 구현 Task의 완료 검사에 전체 테스트가 없다 | .claude/skills/phase-planning/references/parallel-rules.md | 전체 테스트 계획 15분이 실측 44분. docs/history/2026-11-12-requirements-build/ 회고 진단 5 |
| 2026-11-13 | spec 양식에 `검증 환경값(설정값)` 칸: 검증 때의 설정값을 명시, 같은 값을 다르게 쓰는 기능은 함께 Fix 제시 | docs/harness/templates/spec.md | T50 fov 45→36 뒤 시험 9개 중 하나에 남은 45로 뒤 Task 넷 미달. 사용자 결정 |
| 2026-11-12 | 명령 절에 `report-check.mjs` 한 줄 (항상 로드되는 파일 +1줄, 같은 파일에서 줄일 곳은 찾지 못함) | AGENTS.md | Codex 워커가 완료 검사 명령을 써도 되는지 물음 2건. 회고 진단 8 |
| 2026-11-12 | 측정 명령의 `--waterfall`을 얼려 둔 승인 계획 `waterfall.plan.json`으로 | .claude/skills/harness-retro/SKILL.md | 재예측이 `waterfall.json`을 덮어써 계획 열이 승인 계획이 아니었음. 회고 진단 10 |
| 2026-11-12 | 설명의 "Next.js 앱"을 "정적 Three.js 앱(`web/`)"으로, Next.js 절에 "지금은 쓰지 않는다" 한 줄 | .claude/agents/metaverse-3d-developer.md, .claude/agents/metaverse-web-developer.md, .claude/skills/web3d-runtime/SKILL.md, .claude/skills/web-feature/SKILL.md, .claude/skills/team-web-metaverse-develop/SKILL.md, .claude/skills/web3d-runtime/references/patterns.md, .agents/skills/web-feature/SKILL.md | 사용자 결정(정적 앱 유지). 회고 진단 13 |
| 2026-11-12 | 블록아웃(정적 형태) 리뷰는 런타임 그림을 요구하지 않고, 런타임 조건의 승인은 장면 리뷰에서 | .claude/skills/art-direction/SKILL.md | 블록아웃 리뷰에서 런타임 그림 규칙이 걸림 2회. 회고 진단 12 |
| 2026-11-13 | 새 에이전트 ux-designer(기획 팀, UX 명세·UX 동행) | .claude/agents/ux-designer.md | 사용자 결정: UX·UI 디자이너 추가 |
| 2026-11-13 | 새 에이전트 ui-designer(그래픽 팀, UI 명세·토큰) | .claude/agents/ui-designer.md | 사용자 결정: UX·UI 디자이너 추가 |
| 2026-11-13 | 새 역할 스킬 ux-design | .claude/skills/ux-design/SKILL.md | 사용자 결정: UX·UI 디자이너 추가 |
| 2026-11-13 | 새 역할 스킬 ui-design | .claude/skills/ui-design/SKILL.md | 사용자 결정: UX·UI 디자이너 추가 |
| 2026-11-13 | Codex 포인터 ux-design | .agents/skills/ux-design/SKILL.md | 사용자 결정: UX·UI 디자이너 추가 |
| 2026-11-13 | Codex 포인터 ui-design | .agents/skills/ui-design/SKILL.md | 사용자 결정: UX·UI 디자이너 추가 |
| 2026-11-13 | product 팀원에 ux-designer, graphicmodel 팀원에 ui-designer와 편집 범위, 화면 phase의 UX→UI 순서 한 줄 | docs/harness/team-org.md | 사용자 결정: UX·UI 디자이너 추가 |
| 2026-11-13 | 에이전트 구성·작업 흐름 00·00b(UX 명세, UX 동행)·직접 소통 짝 | .claude/skills/team-product/SKILL.md | 사용자 결정: UX·UI 디자이너 추가 |
| 2026-11-13 | 에이전트 구성·작업 흐름 11(UI 명세)·최신 문서 docs/live/graphicmodel/ui/ | .claude/skills/team-graphicmodel/SKILL.md | 사용자 결정: UX·UI 디자이너 추가 |
| 2026-11-13 | 배정 절에 화면 phase는 UX 명세 먼저, 웹 구현 앞에 UI 명세 한 줄 | .claude/skills/phase-planning/SKILL.md | 사용자 결정: UX·UI 디자이너 추가 |
| 2026-11-13 | 규칙 6에 예외: 한 대뿐인 자원(GPU)을 쓰는 검증은 머지 뒤 한 줄로 한 번, 그 앞에 자원 없는 머지 확인. 승인 전 점검 2줄 | .claude/skills/phase-planning/references/parallel-rules.md | 사용자 결정(2026-11-13): 병렬 검증이 GPU 하나를 다퉈 대기 25~30분·시간 초과가 반복. "기능 구현은 병렬적으로 따로 하되 ... 합쳐서 한 번에 GPU를 써서 테스트하는 거는 한 번에" |
| 2026-11-13 | 구현 Task의 완료 기준에 GPU를 쓰는 시험을 넣지 않음(쓰기만, 실행은 머지 뒤 QA) | docs/harness/templates/spec.md | 사용자 결정(2026-11-13): 병렬 검증이 GPU 하나를 다퉈 대기 25~30분·시간 초과가 반복. "기능 구현은 병렬적으로 따로 하되 ... 합쳐서 한 번에 GPU를 써서 테스트하는 거는 한 번에" |
| 2026-11-13 | GPU를 쓰는 QA는 워커 하나가 한 줄로(전체 시험 → 걷기 → 성능), 결함은 모아 한 번에 수정·재검 | .claude/skills/team-qa/SKILL.md | 사용자 결정(2026-11-13): 병렬 검증이 GPU 하나를 다퉈 대기 25~30분·시간 초과가 반복. "기능 구현은 병렬적으로 따로 하되 ... 합쳐서 한 번에 GPU를 써서 테스트하는 거는 한 번에" |
| 2026-11-13 | 핵심 원칙 첫 줄에 덧붙임: GPU 없는 로직 시험은 실패 먼저 확인, 브라우저 시험은 쓰기만 하고 확인은 머지 뒤 QA 한 줄에서 (항상 로드되는 파일 +2문장, 줄일 곳은 찾지 못함) | AGENTS.md | 사용자 결정(2026-11-13) "응 넣어줘". 새 검증 규칙과 "실패를 확인한 뒤 구현"이 브라우저 시험에서 부딪힘 |
