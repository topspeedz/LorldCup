# 최종 보고 — phase 2026-11-12-requirements-build

> 이 사본의 `_workspace/` 경로는 로컬 작업 폴더(git이 추적하지 않음)를 가리킨다. 근거 원본은 그 폴더에 남아 있다.

코디네이터(4~8단계). 브랜치 `phase/2026-11-12-requirements-build`. 기준 커밋 `1bd8742`(22:4x 중간 스냅샷, 창구가 커밋·ec2 push). 이 보고의 "바뀐 파일"은 그 커밋 뒤의 변경이다.

## 결과 한눈에

- 백로그 BL-0002~BL-0024: 21개 완료 보관(`docs/backlog-archive.md`), 2개 부분(BL-0015, BL-0016) — T55 판정 `_workspace/product/2026-11-12-requirements-build/02_product-manager_closeout_v1.md`.
- 필수 BL-0016(유튜브 스크린·생방송): 생방송·재방 항상 재생, 경기장 안이면 안 보여도 재생(사용자 B), 오류 5·버퍼링 반복 자동 회복까지 재검 통과. 남은 것은 U-H-10(아래).
- 필수 BL-0020(Full Mode): 실제 앱 세 화면 크기에서 버튼·F·Esc 진입/복귀 통과(T71).
- 성능: 경기장 117.77~123.27 FPS, 로비 120.87~122.98 FPS(목표 60), 텍스처 하한 491.485 MiB(상한 500, 여유 8.5 MiB).
- **전체 시험(T54) 미실행** — 사용자 지시 "전체시험패스하자" → "건너뛰기". 02:41:08 시작 → 중단, 중단 전 42줄 ok·실패 0(186개 중 앞 5파일, `temp/T54/full.log`). 각 Task의 지정 시험과 재검만 통과했고, 여러 수정이 겹쳐 생긴 회귀는 확인하지 못했다.

## 수정 루프와 재검 (결함 ID)

| 묶음 | 수정 | 재검(다른 담당) | 결과 |
| --- | --- | --- | --- |
| A | T50 | T52 | 해결 |
| X·B | T51 | T53 | 해결(X-L-1·B-M-1·B-M-2는 Medium 이하, 인박스) |
| P (성능) | T59, T60 | T61 | P-H-1·P-H-2 해결 |
| U1 (사용자 직접 테스트: 커서·좌석 표시·로딩) | T63, T64, T65 | T69 | 해결 |
| U (생방송·스크린·앉은 카메라) 1회차 | T62, T67, T68 | T66 | 해결, 새 High U-H-8 |
| U 2회차 | T70(U-H-8), T72(사용자 B 항상 재생) | T71 | 해결, 새 High U-H-9 |
| U 3회차(사용자 승인 "A") | T73(U-H-9) | T74 | 해결, 새 High U-H-10 |
| U-H-10 | 고치지 않음 — 사용자 "걍넘어가도록하고, 어차피 재방 생방 방장이던유저던 선ㄴ택하게할게 아니야" | — | 인박스(다음 phase) |

## 바뀐 파일 (기준 커밋 1bd8742 뒤)

제품:
- `web/screen-video.js`(T62·T67·T70·T72·T73), `web/screen-mesh.js`(새, T67), `web/config/screen.json`(T67), `web/seat-mode.js`·`web/config/seats.json`(T64·T68), `web/index.html`(T65), `web/arena-v2.glb`(T60 라이트맵 참조)
- 시험: `tests/screen-video.spec.mjs`, `live-load`, `modules`, `seat`, `loading`, `perf-fps`, `full-mode`(카메라 고정값, T71), `qa-a`, `qa-b`, 새 `qa-p`, `qa-u`, `qa-u1`, `qa-u2`
- 백로그: `docs/backlog.md`, `docs/backlog-archive.md`

하네스(사용자 하나씩 점검 중 — 아래 "사용자 결정 필요"):
- T57이 고친 15개(M4·M5·M6·M8 문구·M9·M10·M11·M12), 목록 `_workspace/_run/2026-11-12-requirements-build/tmp/t57-changes.txt`. 사용자 승인은 M1(보강)·M4뿐.
- T57 목록 밖: `.claude/scripts/orca-launch.mjs`·`orca-launch.check.mjs`의 M8 코드(exec-run이 `waterfall.plan.json` 사본을 만듦, 00:04 수정) — 사용자 미승인, 되돌리지 않고 둠.
- 창구가 사용자 지시로 만든 것: `.claude/agents/ux-designer.md`·`ui-designer.md`, `.claude/skills/ux-design/`·`ui-design/`, `.agents/skills/ux-design/`·`ui-design/`, `docs/harness/team-org.md`, team-product·team-graphicmodel·phase-planning SKILL.md, `docs/harness/changelog.md`.
- 플러그인 원본 `D:/Projects/orca-teamagent-harness-kit`: 브랜치 `phase/2026-11-12-requirements-build`에 로컬 커밋 `c866257`(M1~M9·M13, 코디네이터, 사용자 "플러그인에는 지금넣어줘", run-checks 16 passed)과 `2434156`(M1 보강, 창구). push 없음.

커밋에서 뺄 것: `temp/`, `test-results/`(작업 기록. `.gitignore`에 없고 `temp/` 일부는 이미 추적됨 — 아래 결정).

## 검증

- 각 Task: `report-check` ok:true와 지정 시험(장부 `ledger.md` Task 표).
- 재검 리포트: `_workspace/qa/2026-11-12-requirements-build/` 03~06번(T52·T53·T61·T66·T69·T71·T74).
- 전체 시험: 미실행(위).
- 알려진 실패(회귀 아님): qa-x "X multi: 16 people"(X-L-1), qa-b B-M-1·B-M-2 재현 시험.

## 화면 (스크린샷)

`D:\Projects\lorldcup-metaverse\_workspace\_run\2026-11-12-requirements-build\screens\`
- 스크린 상시 재생·16:9: `T67-default-before.png`·`-after.png`, `T67-upper-*`, `T67-controls-*`
- 앉은 카메라: `T68-lower-west-01-before.png`·`-after.png`, `T68-lower-north-01-*`
- 도착 즉시 재생: `T72-arrival-before.png`·`-after.png`, `T71-arrival-playing.png`, `T71-back-turned-playing.png`, `T71-seated-playing.png`
- Full Mode: `T71-fullmode-*`
- 커서·좌석 표시·로딩: `T69-*`
- 버퍼링 회복: `T74-held-buffering.png`, `T74-after-release.png`

## 미룬 것 (인박스, 다음 phase)

- U-H-10: 재방 오류 5 반복 2.5~3분 미재생(외부 일시 상태 가능성) — 원인 가리기, 반복 실패 때 상태·대기 상한.
- 생방송/재방을 사용자·방장이 고르지 않는 방식(편성).
- BL-0015 (2) 멀리 있는 관중 품질 차이 눈 확인.
- 다음 phase 후보 3건: EC2 Blender 병렬, 캐릭터 동작 Mixamo, 경기장 소리 생동감.
- 그 밖 T55i·T55가 넣은 인박스 줄(메모 후보, P-L-1·P-L-2, 텍스처 여유 8.5 MiB, GPU 잠금 순서 등).

## 남은 것

- 하네스 수정 T57: 사용자 하나씩 점검 중(멈춤). M2·M3·M5~M13과 회고의 새 후보 M14~M16. 스크래치 사본 스크립트는 적용 안 함.
- 법률·Riot 리뷰와 T39·T40 리뷰의 Medium·Low: T55가 원문을 다시 읽지 않아 인박스에 넣지 않았다.
- 전체 시험 1회(공유 전).

## 사용자 결정 필요

1. 커밋 승인: 제품 커밋(위 제품 파일 + `docs/history/2026-11-12-requirements-build/`)과 하네스 커밋(점검을 끝낸 것만, 또는 점검 뒤로 미룸).
2. ec2 push 여부.
3. `.gitignore`에 `temp/`·`test-results/`를 넣을지(이미 추적된 `temp/` 파일 처리 포함).
4. 회고가 올린 것: 전역 waterfall 스킬 사본 한 줄, "질문에 스크린샷" 상시 규칙, spec 양식에서 자기 변경이 깬 기존 시험 기대값 허용, M14~M16.

## 공유 전 결정

- 경기장 안 "안 보일 때도 재생"(사용자 B로 법무 추천 U3 제거) — 유튜브 정책 J-2·J-3 위험 재검토. 배치 크기 200px 이상·가림 없음은 지킴.
- 전체 시험 1회.
- 앞서 정한 공유 전 항목: J-10, 티켓 문구(T55i 인박스 "공유 전 결정 묶음").
- 생방송 주소는 시험용(사용자 U1).

## 끝낸 상태 (02:50)

사용자 원문(코디네이터 세션): "여기서이제 끝내자". 여기서 phase를 닫는다.
- 커밋: 하지 않았다. 8단계 커밋 승인 질문(G2, 4개)은 답 없이 닫았다 — 이 프로젝트의 변경은 브랜치 `phase/2026-11-12-requirements-build` 작업 트리에 커밋 안 된 채 남아 있다. push 없음.
- 플러그인 원본: 로컬 커밋 `c866257`, `2434156`만 있다(push 없음).
- T57(하네스 수정): 멈춘 채 끝냈다. 이 프로젝트의 하네스 15개 파일 변경과 M8 코드는 사용자 미점검(M1·M4만 승인)으로 남았다. 점검과 하네스 커밋은 다음에 한다.
- T54 전체 시험: 미실행.
