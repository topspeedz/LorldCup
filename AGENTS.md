# 공통 지침

Claude와 Codex가 함께 읽는 공통 규칙이다. 값, 표, 이력, 긴 예시는 여기에 두지 않고 가리키기만 한다.

## 명령

저장소 루트에서 돌린다. 실제로 돌려 본 명령만 적는다.

- `npm test` — 모든 `tests/*.spec.mjs`. 빈 포트에서 `web/`를 띄우고, GPU 점유 표시(`_workspace/gpu-lock.json`)를 스스로 잡았다가 놓는다. 표시가 `GPU_LOCK_WAIT_MS`(기본 30분) 안에 풀리지 않으면 코드 1로 끝난다.
- `npm test -- tests/<이름>.spec.mjs` — 한 파일만.
- `node tests/gpu-lock.mjs acquire <Task ID>` / `node tests/gpu-lock.mjs release <Task ID>` — 시험 밖의 GPU 일(굽기, 성능 실측)에서 같은 표시를 잡고 놓는다. `npm test` 앞에서는 따로 잡지 않는다.
- `npx playwright install chromium` — 시험용 브라우저가 없는 PC에서 한 번.
- `node .claude/scripts/report-check.mjs <리포트 경로>` — 리포트의 `## 검증` 절 판정. 표준 출력 JSON의 `ok`를 본다.

## 기술 스택

정적 Three.js r170 웹 앱(`web/`). Next.js 전환은 사용자 결정 전까지 하지 않는다.

## 핵심 원칙

- 검증 명령으로 확인하지 않은 것은 완료라고 보고하지 않는다. 테스트를 먼저 쓰고 실패를 확인한 뒤 구현한다. GPU 없이 도는 로직 시험은 그대로 실패를 먼저 확인한다. 브라우저로 도는 시험(GPU)은 구현 Task가 쓰기만 하고, 실패와 통과의 확인은 구현이 모두 합쳐진 뒤 QA 한 줄에서 한 번에 한다.
- 워커는 사용자에게 직접 묻지 않고 `orca orchestration ask`로 올린다.
- 워커는 커밋하지 않는다.
- 승인이 필요한 명령을 훅이 거부하면 우회하지 않고 `orca orchestration ask`로 올린다.
- `rm -rf`와 force push(`git push -f`, `--force`)를 쓰지 않는다. 필요하면 `orca orchestration ask`로 올린다. Claude 워커는 설정과 훅이 막고, Codex 워커에게는 그 설정이 닿지 않으므로 이 줄이 규칙이다.

## 하네스

**역할 계층.** 사용자 세션이 창구다. 창구는 설문과 승인, 요청 분류, planner와 코디네이터 기동, 최종 보고를 맡는다. planner는 설계서와 계획서를 쓴다. 코디네이터는 창구가 띄운 별도 터미널에서 계획대로 워커를 띄우고, 보고를 정산하고, 장부를 갱신한다. 팀장은 팀 spec 하나를 팀원 Task로 나누고 감독한다. 계층은 코디네이터 아래 두 단까지이고, 팀원은 워커를 띄우지 않는다. Orca 워커로 시작됐다면 spec의 첫 줄과 "먼저 읽을 것"대로 역할 파일을 읽고 그 역할로만 행동한다.

**규모별 경로.**

| 요청 | 경로 |
| --- | --- |
| 단순 질문, 한 파일의 작은 수정 | 창구가 직접 한다. 테스트 먼저 쓰기와 검증 명령은 그대로 지킨다. |
| 답이 정해진 작은 작업 (한 팀의 Task 1~2개) | 코디네이터가 팀장 없이 워커를 직접 띄운다. |
| 한 팀의 Task가 3개 이상이거나 나누는 데 도메인 판단이 필요 | 코디네이터가 팀장을 띄우고, 팀장이 팀원을 띄운다. |
| 요구사항이 흐릿한 큰 작업 | 설문부터 시작하는 전체 흐름(`plan-orchestrate`)을 탄다. |

**작업별 라우팅.**

| 작업 | 먼저 볼 것 |
| --- | --- |
| 큰 작업 요청 | `plan-orchestrate` 스킬 |
| 실행 감독 | `coordinator` 스킬 |
| 팀장으로 뜬 워커 | `team-lead` 스킬과 자기 팀 스킬 |
| 백로그 | `backlog-management` 스킬 |
| 모델 배정 | `docs/harness/model-selection.md` |
| 팀 구성 | `docs/harness/team-org.md` |
| 팀과 에이전트 추가 | `docs/harness/templates/` |

## Compact Instructions

자동 압축이나 `/compact` 요약에 반드시 남긴다:
- Run ID와 진행 중인 Dispatch ID
- 추적 중인 대기 작업
- 현재 단계
- 이번 세션의 사용자 결정 — 원문 그대로

## Codex 전용

- `.agents/skills/<이름>/SKILL.md`는 포인터다. 그 포인터가 가리키는 원본 `.claude/skills/<이름>/SKILL.md`를 읽는다.
