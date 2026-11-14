# T75 작업 메모

Run `run_343411c14196`, Task `task_434c88da621f`, Dispatch `ctx_f009e1ca5542`.
워커 `term_95694eea-11cb-4844-989c-cdf00dd36bb8`, 코디네이터 `term_63d52870-bb28-4fb1-bca5-ecec967b6f07`.

## 현재 단계

승인 형상 수정과 변경 아틀라스 4장 통합 굽기 완료. 압축·웹 시점·걷기 검증 중이다.
원본 T68 blend와 기존 GLB/라이트맵은 `bak/T75/`에 SHA256 검증 사본이 있다(`temp/T75/backup-manifest.json`).
Blender 배치는 한 번에 하나였으며 사용자 Blender UI·8780 서버·사용자 브라우저는 건드리지 않았다.

## 이번 세션의 사용자 결정

- `msg_155432482f52`: "들어오는 입구 여기좀 없애봐" — 표시된 검은 양옆 구역 제거, 통로 폭 유지, 평평한 바닥 연결.
- `msg_69ee1b7d2384`: "계단지금보다 더넓히고 손잡이없애줘" — 입구 두 계단 양쪽 한 열씩 제거, 손잡이 제거.
- 질문 `msg_2de988461e60`, 답 `msg_2da85b511072`: 사용자 원문 "응". `temp/T75/ramp-locations-proposal.png`의 A/B 통로, 주황 제거 구역, 초록 보존 6석, 보라 구역, 계단 확장 승인.
- 메모 5a 정정: "아니 2/3남겨". 2층 원본 관중 수는 더 줄이지 않고 단순화만 했다. 런타임 density.upperKeepFraction=0.3333은 읽기만 한다.
- 메모 4: "응진행해줘". Draco 위치/법선/UV 1비트씩 감소, 내장 PNG→WebP, 최종 100,000,000 bytes 미만.
- 메모 6: "경기장안으로들어왔을떄, 경기장 바까깥벽돌 폴리컨 확낮춰줘 10%수준". 외벽 8개 원본 보존 + `__lod10` 쌍 추가. 전환은 T80.

## 만들어진 것

- `barclays-arena-t75.blend`: T68 복사본 기반 형상. 좌우 폭 6.766 m/길이 32 m/높이차 10 m 통로, 바닥·난간·충돌용 노드.
- `barclays-arena-t75-baked.blend`: 최종 굽기 복사본. `t75-bake.py` 1회, OPTIX 64 samples, 약 90초. stage/bowl/seats/interior 4장. 실내 RGBM 범위는 실측 peak 17.934 때문에 16→32.
- 2층 의자·팔걸이·받침 → 줄마다 연결한 단순 띠. 관중 속성 및 7,919개 원점 보존. 상부 난간·계단·기타 소품 단순화.
- 12개 지정 로고 면은 사용자 v1 `web-lightmaps/floor-fix/baked-export.blend`에서 UV·재질 복원. 이미지 사본 `t75-final-arena.png`, `t75-worlds-crest-alpha.png`.
- `temp/T75/runtime-handoff.json`: T83용 제거 좌석의 실제 원본 형상 min/max, 부품별 상자, 제거 관중 원점 530개, 가장자리 선분, 보호 좌석, T80 LOD 쌍.
- 마지막 리뷰에서 남은 기존 계단 발광 줄을 통로 전 깊이에서 잘랐다. 굽기를 다시 하지 않았으며 남은 면의 기존 라이트맵 UV를 유지했다. 최종 화면에서 바닥 조명도 확인할 것.

## 재현 순서

1. 백업의 T68 blend를 `temp/T75/source.blend`로 복사.
2. 그 사본에 `t75-build.py` → 새 geometry blend.
3. geometry blend에 `t75-finalize.py`, `t75-exterior-lod.py`, `t75-clearance.py` 순서로 각 1회. finalize는 새 노드를 추가하므로 반복하지 않는다.
4. `t75-check.py`/`t75-nav-export.py` + `t75-nav-check.mjs` 검사, `t75-handoff.py`는 원본 사본에서 읽기만.
5. `node tests/gpu-run.mjs --owner T75 -- <batch Blender t75-bake.py>` → 새 baked blend·staging PNG 4장. 이번 실행은 이미 1회 완료.
6. baked blend의 `t75-export.py` → geometry/quantized 크기 측정 사본. `python .../t75-webp.py` → lossless WebP 최종 staging GLB(픽셀 일치 assert).
7. 최종 대상 복사, glb-inspect/노드 이름/상부 삼각형, `t75-browser.mjs after`, `npm run walk -- temp/T75/ramps.walk.mjs`.

## 검증과 다음

- CPU 통로 바닥 1,926점, 머리 높이 1,914점, 보존 좌석 6개, 로고 12면, 외벽 LOD 8쌍 통과.
- 기존 player-controller로 CPU 실제 이동: A/B 각각 340번 이동과 기존 입구 양쪽 좌석 접근 통과.
- FPS 전 61.711, 12초 741프레임, 960×640. 전후 각 1회 조건을 지키며 전 수치는 다시 재지 않는다.
- 상부 전: 2,239,196 삼각형 / 236 primitives. 후 수치와 전체 용량 검증 대기.
- `tests/arena-v2.spec.mjs`는 현재 baked nodes=383, meshes/materials=425, interior range=16 고정. 새 모델은 nodes=394, interior=32이므로 담당자의 기대값 갱신이 필요하다. 이 워커 편집 범위 밖이다. 실제 런타임 개수까지 확인한 뒤 구체적인 수정안과 함께 Orca ask 예정. 요구된 npm test 1회는 아직 실행하지 않았다.
- 런타임의 기존 좌석 진입 각도 제한이 새 넓은 통로 가장자리와 확장 계단을 막을 수 있다. 실제 걷기 검사 뒤 T83 인계에 기록한다.
- 최종 리포트: `_workspace/graphicmodel/2026-11-13-ux-motion-rooms/20_graphic-model-designer_arena-bundle_v1.md`.

## 최종 반영 이후 상태

- `web/arena-v2.glb` 88,509,236 bytes, 2층 600,263 삼각형/191 primitives. 전체 4,112,544 삼각형/977 primitives; 외벽 양쪽 중 하나만 표시하면 937.
- 원래 로고 RGBA는 lossless WebP로 유지했고, RGB가 0인 crest alpha 텍스처를 동일한 발광 이미지 alpha와 공유해 GPU 이미지 메모리 증가를 5.3 MiB로 줄였다. 이미지 61장, 재질 121개.
- 최종 공개 대상은 GLB+stage/bowl/seats/interior PNG 4장이다. 원본 T68 blend와 나머지 라이트맵은 백업 해시와 같다.
- 노드 전839/후856, 빠짐0/추가17. bake metadata 노드394, 런타임 baked meshes/materials468, texture7.
- FPS 후63.7717, 전61.7114, p95는20.9→27.8ms. 각1회 수치이며 성능 향상을 단정하지 않는다.
- WASD는 새 통로에서 바닥·입구를 거쳐 선택 6석 연속 접근 통과. 클릭은 새 통로 양쪽 하강 통과. 좌석 접근은 카메라 가까운 바닥 선택을 진단한 뒤 최종 재검 중이다.
- 직접 진단: 1인칭 가까운 계단 바닥이 화면 아래로 나갔던 원인은 테스트의 내려다보기 각도였다. 실제 마우스 드래그로 1 rad 내려다보고 클릭하는 작은 검사에서 계단 가장자리까지 통과했다. 런타임 파일 변경 없음.
- 실제 런타임 후속: 새 통로 x±2의 기존 seatedArea 각도 금지, 기존 입구 중앙 REF_RunwayTransition 단차. T83 권고와 모든 실제 좌석 min/max·관중 원점·경계 선분은 지정 리포트 및 runtime-handoff.json.
- `temp/T75/arena-v2-expectations.patch`는 시험의 range16→32, nodes383→394, meshes/materials425→468 세 줄만 바꾸는 제안이다. `git apply --check --unidiff-zero`는 통과했으며 적용하지 않았다. `coordinator-question.txt` 질문 초안을 준비했지만 아직 보내지 않았다.
- 필수 arena-v2 npm test는 여전히 0회 실행. report-check는 draft에서 ok:false(이 시험 미실행과 report-check 미완료 두 줄)로 판정했다. worker_done은 아직 보내지 않았다.

## 질문 직전 최종 상태

걷기 A/B 클릭·WASD 4개 성공. A는 바닥부터 기존 입구 z=-2 차선, x=-60 열린 접속부를 거쳐 6석 연속 접근까지 두 방식 성공. 클릭 계단에서 휠 줌+아래보기 드래그를 사용했다. `walk-matrix.json`은 실제 통과 로그 두 개에서 결과를 모은 근거다. 최종 모델/라이트맵 변경은 끝났고 원본 해시 보존과 glb-inspect 예산 검사도 통과했다. 남은 필수 arena-v2 시험은 준비된 세 줄 패치 적용을 기다리며 아직 실행 0회다. 코디네이터 질문은 다음 Orca ask에서 보낼 예정이다. 답은 status/Re: Question 메시지로 오면 그것을 답으로 받아 진행한다.

## 최종 시험 범위 승인

질문 `msg_d0510c1e8e79`에 대한 답 `msg_86c68926c15d` (status / Re: Question): 코디네이터가 위임 범위 예외를 승인했다. `tests/arena-v2.spec.mjs`의 interior range16→32, baked nodes383→394, runtime meshes/materials425→468 세 줄만 변경하고 각 줄에 이유를 주석 한 줄로 적으라는 지시다. 이 파일의 기존 다른 워커 오디오 변경 두 줄은 보존했다. 수정 전 사본 `temp/T75/arena-v2.before-expectations.spec.mjs`와 비교해 변경 행이14/42/119 세 개뿐임을 단언했다.

`npm test -- tests/arena-v2.spec.mjs`를 1회 시작했다. 실행 세션13995, 로그 `temp/T75/arena-test.log`. 이 명령을 다시 시작하지 말고 현재 결과를 확인한다. 전 폭 각도 제한·입구 중앙 단차·가까운 바닥 클릭 제한은 승인 답에 따라 T83에 인계한다.

## 최종 완료 상태 (앞의 진행 기록보다 우선)

승인 답 `msg_86c68926c15d`의 세 시험 줄과 이유 주석을 적용했다. `npm test -- tests/arena-v2.spec.mjs`는 정확히 1회 실행해 4 passed (26.4s), 실패0, exit0이다. 최종 report-check는 ok:true, checked5, failed=[]이며 T83 런타임 후속만 notes에 남는다. GLB 88,509,236 bytes, 상부600,263삼각형, FPS63.772, 기존 노드 누락0이다. 주요 인계 파일33개와 모든 Task 파일173개의 목록은 `temp/T75/modified-files.json`이다. 최종 결과와 T80/T83 좌표 인계는 지정 리포트가 정본이며, 완료 신호 정산 상태는 Orca가 관리한다. 커밋·push·배포는 하지 않았다.
