---
name: team-graphicmodel
description: "그래픽 팀이 일하는 절차. Blender로 3D 자산(사물과 환경, 캐릭터와 애니메이션, 이펙트와 효과음)을 만들어 GLB로 넘기고, 아트 디렉션 대조와 성능 점검을 거친다. '모델 만들어', '캐릭터 추가', '이펙트·효과음', '아트 디렉션 정리', '자산 성능 점검' 요청이나 코디네이터가 그래픽 Task를 띄울 때. 웹 코드 구현(team-web-metaverse-develop), 수락 기준의 흐름 검증과 코드 리뷰(team-qa), 각 역할의 세부 절차(blender-modeling, blender-character, vfx-design, web3d-performance, art-direction)에는 쓰지 않는다."
---

# team-graphicmodel

그래픽 팀은 웹 런타임이 읽을 3D 자산을 만든다. 만드는 사람(모델, 캐릭터, 이펙트)과 대조하는 사람(아트 리뷰, 성능 점검)이 다르다. 팀장은 spec 첫 줄이 `[역할: graphic-leader · 리드]`인 워커이며 `team-lead`와 이 스킬을 로드한다.

**Blender는 하나다.** Blender MCP는 실행 중인 Blender 하나를 함께 쓴다. Blender를 쓰는 Task는 동시에 하나만 띄운다. 이 팀의 병렬은 Blender를 쓰지 않는 일(문서, 효과음, 리뷰, 수치 세기)에서 나온다.

## 에이전트 구성

| 에이전트 | 맡는 일 | 역할 스킬 | 모델 표의 작업 단위 |
| --- | --- | --- | --- |
| `graphic-leader` | 기준 문서(아트 디렉션) 쓰기 | `art-direction` | 아트 디렉션 |
| `graphic-leader` | 산출물을 기준 문서와 대조. 고치지 않는다 | `art-direction` | 아트 리뷰 |
| `graphic-model-designer` | 사물, 조형물, 건물, 환경의 모델과 재질·조명 | `blender-pipeline`, `blender-modeling` | 3D 모델링 |
| `graphic-character-designer` | 캐릭터 시트, 모델, 리그 | `blender-pipeline`, `blender-character` | 캐릭터 모델링 |
| `graphic-character-designer` | 애니메이션 클립 | `blender-pipeline`, `blender-character` | 캐릭터 애니메이션 |
| `graphic-effect-vfx-designer` | 연출 명세, 큐 표, 효과 자산 | `vfx-design`, `blender-pipeline` | 이펙트 제작 |
| `graphic-effect-vfx-designer` | 효과음 | `vfx-design` | 효과음 |
| `graphic-performance-verifier` | 자산 수치와 예산 대조, 실측. 리포트만 쓴다 | `web3d-performance` | 성능 점검 |
| `graphic-performance-verifier` | 형태를 바꾸지 않는 범위의 자산 줄이기 | `web3d-performance`, `blender-pipeline` | 자산 최적화 |
| `ui-designer` | UX 명세를 받아 화면 명세, 시안, 토큰 표. 코드는 쓰지 않는다 | `ui-design` | UI 명세 |

- 작업 단위는 모델 표에 있는 이름만 쓴다. 없으면 표에 줄을 먼저 넣는다.
- 팀장으로 뜬 `graphic-leader`는 아트 디렉션과 아트 리뷰를 직접 하지 않는다. 같은 에이전트를 일반 Task로 따로 띄운다.

## 작업 흐름

| 순서 | 작업 | 담당 | 의존 | 산출물 파일 |
| --- | --- | --- | --- | --- |
| 01 | 아트 디렉션: 기준 문서를 쓰거나 이번 범위에 맞게 고친다 | `graphic-leader` | 브리프의 사용자 결정 | `01_graphic-leader_art-direction_v1.md` |
| 02 | 3D 모델: 참조 분석, 모델, 재질, GLB | `graphic-model-designer` | 01 | `02_graphic-model-designer_model-<대상>_v1.md` |
| 03 | 캐릭터 모델과 리그: 캐릭터 시트, 모델, 리그, GLB | `graphic-character-designer` | 01 | `03_graphic-character-designer_character-<이름>_v1.md` |
| 04 | 캐릭터 애니메이션: 클립과 클립 표 | `graphic-character-designer` | 03 | `04_graphic-character-designer_clips-<이름>_v1.md` |
| 05 | 이펙트: 연출 명세, 큐 표, 효과 자산 | `graphic-effect-vfx-designer` | 01. 클립에 붙는 효과면 04의 클립 표 | `05_graphic-effect-vfx-designer_vfx-<효과>_v1.md` |
| 06 | 효과음: 소리 파일과 효과음 표 | `graphic-effect-vfx-designer` | 05의 큐 표 | `06_graphic-effect-vfx-designer_sfx-<효과>_v1.md` |
| 07 | 아트 리뷰: 02~05의 산출물을 기준 문서와 대조 | `graphic-leader` | 대조할 Task | `07_graphic-leader_art-review_v1.md` |
| 08 | 성능 점검: 자산 재고와 예산 대조, 장면이 있으면 실측 | `graphic-performance-verifier` | 02~05의 GLB | `08_graphic-performance-verifier_perf_v1.md` |
| 09 | 자산 최적화: 08의 High 가운데 형태가 바뀌지 않는 것 | `graphic-performance-verifier` | 08 | `09_graphic-performance-verifier_optimize_v1.md` |
| 10 | 수정: 07의 High와 08에서 만든 담당에게 돌아온 것 | 원래 만든 에이전트 | 07, 08 | 02~05 리포트의 다음 버전 `_v<N+1>` |
| 11 | UI 명세: 화면에 닿는 phase만. 기획 팀의 UX 명세 뒤, 웹 개발 Task 전. Blender를 쓰지 않으므로 다른 Task와 함께 돈다. 아트 리뷰(07)의 대조 대상이 된다 | `ui-designer` | 01(있으면), 기획 팀의 UX 명세 | `11_ui-designer_ui-spec_v1.md` |

- 순서 `NN`은 산출물 파일 이름의 `NN`이다. 도착 순서가 아니다.
- **Blender를 쓰는 것은 02, 03, 04, 05와, 09와 10의 다시 내보내기다.** 이 Task들은 서로 의존으로 이어 한 번에 하나만 돌게 한다. 01, 06, 07, 08은 Blender를 쓰지 않으므로 함께 돌 수 있다.
- 새 캐릭터와 가까이 보는 주요 자산은 형태가 정해지는 지점(캐릭터 시트, 블록아웃)에서 Task를 나누고 그 사이에 07을 한 번 둔다. 틀린 형태 위에 리그와 재질이 쌓이지 않게 한다.
- 팀원 spec에는 예산(삼각형, 드로 콜, 재질, 텍스처, 뼈, 파일 크기)을 숫자로 적는다. 정본은 자산 연동 규약이고, 없으면 `web3d-performance`의 출발값을 적고 "출발값"이라고 표시한다. 완료 기준은 `glb-inspect.mjs`에 그 예산을 넣은 명령과 기대 출력으로 쓴다.
- 07과 08은 서로 다른 것을 본다. 한쪽의 통과가 다른 쪽의 통과가 아니다. 판정은 둘 다 High가 0이면 승인이다. 고치는 것은 High뿐이고 Medium 이하는 인박스로 보낸다.
- 08의 실측은 다른 검증 Task가 모두 끝난 뒤 혼자 돈다. 자산 재고와 예산 대조는 그 전에도 돌 수 있다.
- 수정 루프는 최대 2회다. 2회 뒤에도 High가 남으면 멈추고 통합 보고에 남은 High를 적는다.
- 웹 팀이 읽는 것은 리포트의 `## 넘기는 것`, `## 클립`, `## 효과`, `## 효과음` 표와 이펙트의 `spec.md`, `cues.json`이다. 이 표들이 빠진 리포트는 산출물이 있어도 미완으로 정산한다.

## 팀원 간 소통

- 기본은 팀장을 거친다. 팀원은 산출물 파일과 팀장의 `ask`/`reply`로 주고받는다.
- 아래 **직접 소통 짝 표**에 있는 짝만 서로 직접 메시지를 보낼 수 있다(`send --to dispatch:<상대 id>`). 팀장은 짝의 두 팀원을 띄운 뒤 서로의 Dispatch ID와 한도를 알려 준다.
- 받는 쪽은 알림(`You have N orchestration messages`)을 보면 `orca orchestration check`로 읽는다.
- 직접 주고받아 정한 내용은 보낸 쪽이 자기 리포트의 `## 직접 소통` 절에 적는다.

### 직접 소통 짝 표

| 짝 | 방향 | 용도 | 한도 |
| --- | --- | --- | --- |
| `graphic-character-designer` ↔ `graphic-effect-vfx-designer` | 양방향 | 클립의 큐 프레임과 붙일 자리의 이름 맞추기 | 효과 하나에 질문 2회, 넘으면 팀장에게 |

- **한도 칸은 비울 수 없다.** 짝을 더하면 한도를 함께 적는다.
- 이 짝은 둘이 같은 때에 떠 있을 때만 쓴다. Blender를 쓰는 Task는 동시에 돌지 않으므로, 한쪽이 끝난 뒤에는 리포트의 `## 클립` 표가 통로다.
- 뼈와 클립의 이름, 예산을 짝끼리 바꾸지 않는다. 그것은 자산 연동 규약의 일이다.

## 작업 규모별 모드

| 모드 | 언제 | 투입 |
| --- | --- | --- |
| 풀 | 새 캐릭터나 새 공간처럼 여러 종류의 자산이 함께 필요하다 | 01부터 전부. Task가 3개 이상이므로 팀장을 띄운다 |
| 축소 | 기준 문서가 있고 자산 한 종류만 더한다(소품 몇 개, 클립 몇 개, 효과 하나) | 01을 건너뛴다. 해당 제작 Task와 07, 08 |
| 단일 | 자산 하나 고치기, 효과음 하나, 예산 대조 한 번 | 해당 에이전트 Task 하나. 코디네이터가 팀장 없이 직접 띄운다 |

## 산출물

- 리포트 경로: `_workspace/graphicmodel/<phase>/NN_<에이전트>_<산출물>_v<N>.md`. 지시서는 `_workspace/graphicmodel/<phase>/spec/`. 미리보기 그림은 `_workspace/graphicmodel/<phase>/preview/`.
- 자산의 자리: 원본은 `art/`, 내보낸 것은 `public/assets/`. 폴더와 이름은 자산 연동 규약이 정본이고, 없으면 `blender-pipeline` 4절의 출발값이다.
- 이미 넘긴 리포트는 고쳐 쓰지 않는다. 다시 쓰면 다음 버전 `_v<N+1>`을 만든다. `final`, `fix1`, `-2` 같은 접미사를 쓰지 않는다.
- Blender의 점유 표시는 `_workspace/graphicmodel/blender-lock.json`이다. Task가 시작할 때 만들고 끝낼 때 지운다.
- 이 팀이 최신으로 유지하는 문서(`docs/live/graphicmodel/`, 현재 상태만 담는다):

| 문서 | 소유 에이전트 | 갱신하는 때 |
| --- | --- | --- |
| `docs/live/graphicmodel/art-direction.md` | `graphic-leader` | 01. 컨셉이나 스타일의 사용자 결정이 바뀐 phase |
| `docs/live/graphicmodel/ui/` (화면 명세, `tokens.md`) | `ui-designer` | 11. 화면에 닿는 phase |

## 오류 처리

| 상황 | 대응 |
| --- | --- |
| Blender가 연결되지 않았다 | 팀원이 `ask`로 올린다. 팀장은 코디네이터에게 올려 사용자가 Blender와 애드온을 켜게 한다. 그동안 Blender를 쓰지 않는 Task를 먼저 띄운다 |
| 점유 표시가 남아 있다고 팀원이 올렸다 | 표시의 Task가 정산됐는지 본다. 정산됐으면 지우고 진행하라고 답한다. 아직 돌고 있으면 기다리라고 답한다. 순서를 잘못 띄운 것이므로 회고 한 줄에 적는다 |
| 기준 문서가 없는데 제작 Task를 받았다 | 01을 먼저 띄운다. 컨셉의 사용자 결정이 브리프에 없으면 코디네이터에게 `ask` |
| 참조 자료로 형태의 핵심을 정할 수 없다 | 팀원이 추정으로 넘어가지 않고 올린다. 팀장은 자료를 요청한다 |
| 예산 안에서 만들 수 없다 | 줄일 후보와 잃는 것을 함께 코디네이터에게 올린다. 예산을 팀 안에서 바꾸지 않는다 |
| 비용이 드는 도구(`generate_3d`, 효과음 생성)가 필요하다 | spec에 허용이 없으면 코디네이터에게 `ask`. 사용자가 정한다 |
| 팀원 실패 | 원인을 새 spec에 적어 새로 띄워 1회 재시도. 그래도 실패하면 그 산출물 없이 통합 보고에 누락을 적는다 |

## 테스트 시나리오

- 정상: "새 캐릭터 하나와 인사 동작, 인사할 때 터지는 효과" → 풀 모드 → 01 기준 문서 고침 → 03을 캐릭터 시트와 블록아웃까지로 나눠 돌리고 07에서 실루엣과 고정값 대조(High 0) → 03의 나머지(모델, 리그) → 04 인사 클립과 클립 표 → 05가 클립 표의 접촉 프레임으로 큐 표와 효과 자산을 만들고, 그동안 Blender를 쓰지 않는 08이 03의 GLB를 센다 → 06 효과음 → 07 대조, 08에서 캐릭터 텍스처가 예산을 넘어 `P-H-1` → 09에서 텍스처를 줄이고 다시 셈 → 통합 보고.
- 기존 파일 활용: 기준 문서와 캐릭터가 이미 있고 "걷기 클립만 추가" → 축소 모드 → 01과 03을 건너뛰고, 04의 spec에 "먼저 읽을 것"으로 캐릭터 시트와 앞 리포트의 클립 표를 넣는다 → 07과 08은 새 클립만 본다.
- 오류: 02가 시작했는데 Blender가 연결되지 않았다 → 팀원이 `ask` → 팀장이 코디네이터에게 올리고, 기다리는 동안 06(효과음)과 08(이미 있는 자산의 재고)을 띄운다 → 사용자가 Blender를 켠 뒤 02를 새로 띄운다.
