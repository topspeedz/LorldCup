# 자산 연동 규약

- 읽는 시점: 자산을 만들거나 내보낼 때, 자산을 불러오는 코드를 쓸 때, 자산을 검사할 때
- 역할과 소유 범위: 그래픽 팀의 자산이 웹 런타임(`web/`, 정적 Three.js r170)에 들어오는 형식, 이름, 예산
- 소유 에이전트: metaverse-develop-leader
- 마지막으로 갱신한 phase: 2026-11-13-ux-motion-rooms

값 옆의 표시는 두 가지다. **고정**은 코드가 그 문자열로 찾는 것이라 바꾸려면 이 문서를 고치는 Task가 필요하다. **출발값**은 실측(성능 점검, 화면 확인)으로 고치는 값이다. 하네스 스킬에 적힌 `public/assets/`는 이 앱에서 `web/assets/`다.

Task 번호는 phase마다 새로 센다. 번호 뒤에 `(11-13)`이 붙은 것은 phase 2026-11-13-ux-motion-rooms의 Task이고, 붙지 않은 것은 2026-11-12-requirements-build의 Task다.

## 파일 위치와 이름

| 종류 | 원본 | 웹용 (고정) | 만드는 Task |
| --- | --- | --- | --- |
| 팬 캐릭터 4종 | `art/characters/fan/fan.blend` | `web/assets/characters/fan.glb` | T30 |
| 팬 클립·계란 소품 | `art/characters/fan/fan-anim.blend` | `web/assets/characters/fan-anim.glb` | T35 |
| 팬 클립·계란 소품 v2(Mixamo 리타깃) | `art/characters/fan/fan-anim-v2.blend` | `web/assets/characters/fan-anim-v2.glb` | T19(11-13) |
| Mixamo 원본 FBX | `_workspace/graphicmodel/2026-11-13-ux-motion-rooms/mixamo/`(git 밖) | 없음. 저장소에 넣지 않는다 | T08(11-13) |
| 경기장 v2 | `art/environment/arena/barclays-arena-v2.blend` | `web/arena-v2.glb`, `web/lightmaps/<아틀라스>-v2.png` | T31, T32 |
| 이펙트 명세·큐 표(하늘 쇼) | `art/vfx/arena-show/spec.md`, `cues.json` | 없음(값은 T38이 `web/config/`로 옮긴다) | T33 |
| 이펙트 명세·큐 표(감정표현, 계란) | `art/vfx/emotes/spec.md`, `cues.json` | 없음(`## 이펙트 런타임`) | T17(11-13) |
| 효과음 | 출처 표 `web/assets/audio/sfx/sources.md` | `web/assets/audio/sfx/<이름>_<NN>.mp3` | T34, FX1(11-13) |

- 그 밖의 새 자산: 원본 `art/<종류>/<이름>/`, 웹용 `web/assets/<종류>/<이름>.<확장자>`. 파일 이름은 소문자, 숫자, 하이픈만 쓴다.
- 원본 보존: `barclays-worlds-2026.blend`, `web/arena.glb`, `web/lightmaps/*.png`(v1 7장), `web/*-reflections.hdr`, `web/world-background.png`, `web/lighting-config.json`, `web/crowd-performance.mp3`, `web/assets/characters/fan.glb`, `web/assets/characters/fan-anim.glb`, `art/characters/fan/`의 `fan.blend`·`fan-rigged.blend`·`fan-anim.blend`는 덮어쓰거나 옮기거나 지우지 않는다. 새 결과는 새 이름으로 낸다.

## 단위, 축, 원점

- 1 = 1 m. 실제 크기로 만든다. 오브젝트 스케일 1, 회전 0으로 적용한 뒤 내보낸다.
- Blender는 Z가 위, 정면이 −Y다. GLB와 런타임은 Y가 위, 정면이 +Z다. 좌표 변환: 런타임 (x, y, z) = Blender (x, z, −y).
- 캐릭터 원점은 두 발 사이의 바닥(y = 0)이다. GLB의 캐릭터는 +Z를 본다. 지금 `createAvatar`의 정면은 로컬 −Z(`web/avatar.js:11`)이므로 런타임이 반 바퀴 돌려 넣는다(T36).
- `Prop_Egg`의 원점은 계란의 중심이다.
- 경기장 v2는 v1과 같은 좌표에 둔다. 통째로 옮기거나 돌리거나 키우지 않는다. 런타임의 이동 지점, 티켓 막는 면, 좌석 목록이 v1 좌표에 묶여 있다(`web/main.js:27`).

## 형식과 압축

- GLB(glTF 2.0 바이너리) 한 파일. 텍스처는 PNG나 JPEG로 GLB 안에 넣는다.
- 지오메트리 압축은 Draco(`KHR_draco_mesh_compression`)만 쓴다. 디코더는 `web/vendor/draco/`에 이미 있다(`web/main.js:31`). Meshopt와 KTX2는 디코더가 없으므로 쓰지 않는다.
- Draco 값은 v1 내보내기와 같게 둔다: 단계 6, 위치 20, 노멀 12, UV 16, 그 밖 24비트(`web-export/export-web.py:114-116`).
- 경기장 v2가 쓰는 glTF 확장은 v1의 다섯 개(`KHR_draco_mesh_compression`, `KHR_materials_clearcoat`, `KHR_materials_transmission`, `KHR_materials_emissive_strength`, `KHR_materials_ior`) 안이다. 캐릭터 GLB는 Draco 하나만 쓴다.

## 재질

- 금속·거칠기 PBR. 색 텍스처는 sRGB, 노멀과 금속·거칠기 텍스처는 선형이다.
- 캐릭터에는 투과, 겉칠, 반투명을 쓰지 않는다. 머리카락처럼 오려 내야 하면 알파 자르기(glTF `MASK`)만 쓴다.
- 경기장 v2에서 새로 넣는 형상은 v1의 재질을 다시 쓴다. v1 재질의 이름과 extras는 바꾸지 않는다.
- 텍스처 크기와 장수는 `## 예산`이 정본이다.

## 이름 보존

경기장을 다시 내보낼 때(T31, T32) 지키는 것이다. 아래는 런타임이 이름으로 찾는 것 전부이며, 개수는 v1 `web/arena.glb`의 실측이다.

| 찾는 것 | glTF의 이름(고정) | v1 개수 | 찾는 코드 | 쓰는 곳 |
| --- | --- | --- | --- | --- |
| 중앙 스크린 네 면 | 노드 `REF_Jumbotron_0`~`REF_Jumbotron_3` | 4 | 스크린 모듈(T13) | BL-0016 |
| 선수 모니터 화면 | 노드 `REF_Reused_Monitor_pixels__cyan` | 1 | 모니터 모듈(T22) | BL-0012 |
| 선수 몸 부위 | 노드 `REF_Player*` | 49 | 선수 동작 모듈(T26) | BL-0013 |
| 걷는 면 | 노드 `Walk_*`, `REF_CircularStage*`, `REF_TrophyIsland*`, `REF_RunwayTransition*`, `REF_CenterStairs*`, `REF_TeamRiser*` | 8 + 7 | `web/main.js:40` | 이동 |
| 막는 면 | 노드 `Collide_*`(`Collide_TicketGate__silver` 포함), 그리고 이름에 `Player_desks`, `Player_PC`, `Player_chair`, `Plaza_bench`, `Bollards`, `REF_DeskBody`, `REF_CenterBackdrop`, `REF_WingMainFrame`, `CCR_Counter`, `CCR_Timber`, `CCR_Refrigerator`, `CCR_Lounge`, `CCR_Banquette`가 든 노드 | 11 + 34 | `web/main.js:41` | 충돌 |
| 천장 | 노드 `Roof*`, `Atrium_ceiling*` | 6 | `web/main.js:39` | 카메라 |
| 관중과 응원봉 | 노드 `Audience_*`, `REF_FanLightsticks*` (extras `crowdMotion`, `crowdDuration`, `crowdCoordinates`) | 11 + 3 | `web/crowd-motion.js:58` | 관중 동작, BL-0015, BL-0018 |
| 관중 정점 속성 | `_CM_ORIGIN`, `_CM_RIGHT`, `_CM_FRONT`, `_CM_PART`, `_CM_SIDE`, `_CM_SEED`, `_CM_STYLE` | 7종 | `web/crowd-motion.js:4-10` | 관중 동작 |
| 구운 조명 | 노드 extras `bakedLighting = {texture, range, uvAttribute}`, 정점 속성 `_LIGHTMAP_UV` | 375 노드 | `web/baked-lighting.js:20-32` | 라이트맵 |
| 얇은 유리 | 재질 extras `thinGlassIOR` | 1 | `web/lighting.js:34` | 유리 반사 |
| 반사 고르기 | 노드 이름의 앞머리 `EXR_`, `City`, `Collide_City`, `Walk_Plaza`, `Road`, `Crosswalk`, `Plaza`, `Bollards`, `Bench`, `Event_`는 야외 반사, `CCR_`, `Walk_Concourse`, `Walk_Atrium`, `Walk_EntryBridge`, `Collide_Lobby`, `Collide_Columns`, `Atrium_ceiling`은 복도 반사, 나머지는 실내 반사 | — | `web/lighting.js:26-27` | 반사 |

규칙:

- 위 표의 이름을 가진 v1 노드는 v2에 같은 이름으로 모두 있어야 한다. 이름을 바꾸거나, 합치거나, 지우지 않는다. 위 표에 없는 노드는 고치거나 지울 수 있고, 지운 것은 리포트에 목록으로 적는다.
- 위 표의 노드를 꼭 지워야 하면(예: 뜬 선수 의자) 지우지 말고 `orca orchestration ask`로 올린다.
- 새로 넣는 오브젝트의 이름: 캐릭터를 막아야 하면 `Collide_<이름>__<재질>`, 막지 않아도 되면 `Fix_<이름>__<재질>`. 야외에 놓는 것은 `EXR_`로 시작한다(야외 반사를 받는다). `Walk_`와 위 표의 다른 낱말은 새 이름에 쓰지 않는다. 걷는 면을 늘리면 갈 수 있는 곳이 바뀌므로 Task로 올린다.
- `Walk_Tier1__concrete`는 그대로 둔다. 2층 진입은 런타임이 막는다(BL-0017).
- 런타임이 보는 이름은 로더가 바꾼 것이다. 공백은 `_`가 되고 `[ ] . : /`는 사라진다(`web/vendor/three.module.js:49723`). 같은 이름이 둘이면 뒤에 `_1`이 붙는다. 새 이름에는 공백과 이 글자들을 쓰지 않고, `.001` 같은 꼬리를 남기지 않는다.
- 관중 메시는 라이트맵에 넣지 않는다(`web/baked-lighting.js:26`이 오류를 낸다).

## 캐릭터

`fan.glb` 하나에 뼈대 하나와 몸 4종이 든다. 4종은 같은 뼈대, 같은 기준 자세, 같은 관절 위치를 쓴다.

| 것 | 이름(고정) | 비고 |
| --- | --- | --- |
| 뼈대 오브젝트 | `FanRig` | `fan.glb`, `fan-anim.glb`, `fan-anim-v2.glb`에서 같다 |
| 몸 메시 노드 4개 | `fan_f1`, `fan_f2`, `fan_m1`, `fan_m2` | 캐릭터 ID와 같다. 머리카락, 옷, 신발을 그 캐릭터의 메시 하나로 합친다 |
| 저지 재질 | `Uniform` | 4종이 함께 쓰는 재질 하나. 몸 메시의 저지 부분에 건다 |

뼈 이름(고정, 23개). 왼쪽·오른쪽 꼬리는 `_L`, `_R`이다. 점(`.L`)은 로더가 지우므로 쓰지 않는다.

```text
root → hips → spine → chest → neck → head
chest → shoulder_L → upper_arm_L → forearm_L → hand_L        (오른쪽은 _R)
hips  → thigh_L → shin_L → foot_L → toe_L                    (오른쪽은 _R)
hand_R → prop_R                                              (소품 자리, 가중치 없음)
```

- 더할 수 있는 뼈는 `thumb_L`, `thumb_R`, `fingers_L`, `fingers_R` 넷뿐이다(손의 자식). 그 밖의 뼈(조종용, 비틀림, IK)는 GLB에 남기지 않는다.
- `prop_R`은 오른손 손바닥 가운데에 두고 GLB의 관절로 남긴다. 내보내기의 "변형 뼈만" 옵션이 지울 수 있다.
- `root`는 원점 바닥에 두고 회전을 주지 않는다. 뼈는 스케일하지 않는다.
- 기준 자세는 팔을 45° 내린 A 자세다. 머리 꼭대기는 1.60~1.84 m 사이다(1.84 m가 지금 아바타의 높이, `web/avatar.js:10`).
- 정점 하나에 영향을 주는 뼈는 4개까지, 가중치 없는 정점은 0이다.
- 재질이 여럿인 메시는 런타임에서 `fan_f1` 그룹과 그 아래 메시 여러 개가 된다. 런타임은 자식 순서가 아니라 재질 이름 `Uniform`으로 저지를 찾는다.

유니폼(결정 13):

- 유니폼은 `Uniform` 재질의 색 그림 한 장이다. 몸 위에 겹친 옷 메시를 만들지 않는다. 런타임은 이 그림만 팀 그림으로 바꾼다.
- 4종의 저지 UV는 같은 배치다. 그림 한 장이 4종 모두에 맞아야 한다.
- UV의 기준 그림은 v1 경기장에 든 `audience-jersey-geng`, `audience-jersey-blg`(512 × 512)다. 위 가운데가 V 목선, 가운데가 팀 글자, 아래가 밑단 줄, 좌우 가장자리가 소매 색이다. 앞판은 그림 전체에 똑바로 편다(목이 위, 좌우를 뒤집지 않는다). 등판과 소매는 글자가 없는 곳에 편다.
- `fan.glb`에 넣는 기본 그림은 글자와 로고가 없는 중립 색 저지다. 실제 팀 그림을 쓸지는 법무 앞 검토(T08, T09)의 판정을 따른다.
- 팀 그림의 규격: 512 × 512 PNG, sRGB. T30은 저지 UV 틀을 `art/characters/fan/uniform-uv.png`로 내고 리포트의 `## 넘기는 것`에 적는다.

삼각형, 재질, 텍스처, 뼈, 파일 크기는 `## 예산`이 정본이다.

## 클립

클립 파일은 `fan-anim.glb`와 `fan-anim-v2.glb` 둘이고 이 절의 같은 규칙을 따른다(차이는 `### 클립 파일 두 개`). 어느 파일이든 `FanRig`(같은 뼈 이름, 같은 기준 자세)와 클립 9개, 소품 `Prop_Egg`가 든다. 몸 메시는 넣지 않는다. 클립 9개나 `Prop_Egg` 가운데 하나라도 없으면 런타임이 오류를 낸다(`web/character.js:216-217`).

| 클립(고정) | 감정표현 ID(고정) | 재생 | 길이(출발값) | 시작과 끝 | 런타임의 사실 |
| --- | --- | --- | --- | --- | --- |
| `Idle` | — | 반복 | 2~4초 | 끝 프레임 = 첫 프레임 | |
| `Walk` | — | 반복 | 한 주기(두 걸음) | 끝 프레임 = 첫 프레임 | 이동 속도 4 m/s(`web/main.js:118`) |
| `Run` | — | 반복 | 한 주기(두 걸음) | 끝 프레임 = 첫 프레임 | 이동 속도 8 m/s(`web/main.js:118`) |
| `Jump` | — | 한 번 | 0.72초 | `Idle` 첫 프레임에서 시작하고 끝남 | 뜨는 높이는 런타임이 준다(처음 속도 6.5 m/s, 중력 18 m/s², 떠 있는 시간 0.72초, `web/main.js:65,101`) |
| `Sit` | — | 한 번, 끝 프레임에서 멈춤 | 0.5~1초 | `Idle` 첫 프레임 → 앉은 자세 | 원점은 좌석 앞 바닥에 그대로 있다. 엉덩이 높이 0.45 m(출발값). 좌석 실측과 다르면 런타임이 높이를 맞춘다(T18) |
| `Emote_CheerClap` | `cheer_clap` | 한 번 | 2~4초 | `Idle` 첫 프레임에서 시작하고 끝남 | |
| `Emote_Heart` | `heart` | 한 번 | 2~4초 | 같음 | |
| `Emote_Angry` | `angry` | 한 번 | 2~4초 | 같음 | |
| `Emote_EggThrow` | `egg_throw` | 한 번 | 2~4초 | 같음 | 계란은 `prop_R`에 붙어 있다가 놓는 프레임에 런타임이 떼어 던진다 |

- 30 fps. 모든 클립은 제자리다. `root` 뼈에는 키가 없다. `Jump`는 몸을 위로 띄우지 않는다(띄우면 런타임의 높이와 겹쳐 두 배가 된다).
- 트랙은 위 뼈 목록의 회전과 `hips`의 위치뿐이다. 스케일 트랙과 `Prop_Egg` 트랙을 넣지 않는다.
- `Prop_Egg`는 스킨이 없는 메시 노드 하나다. 재질 하나, 텍스처 없음. 런타임이 `prop_R`의 자식으로 붙인다.
- 클립을 만든 Task의 리포트 `## 클립` 표는 이 열을 갖는다: `클립 | 프레임 범위 | 길이(초) | 재생 | 이벤트 프레임`. 이벤트 프레임 칸에는 `### 이벤트 프레임`의 이름을 `이름 = 프레임` 꼴로 적는다.
- 여·남 몸 둘 다에서 팔이 몸을 뚫지 않는지 본다(박수, 하트).

### 클립 파일 두 개

| 것 | `fan-anim.glb` | `fan-anim-v2.glb` |
| --- | --- | --- |
| 만든 방법 | 손으로 키를 잡았다(T35) | Mixamo 동작을 `FanRig`에 리타깃해 굽는다(T19(11-13), BL-0025) |
| 원본 | `art/characters/fan/fan-anim.blend` | `art/characters/fan/fan-anim-v2.blend` |
| 다루는 법 | 그대로 둔다. 덮어쓰거나 옮기거나 지우지 않는다 | 새로 낸다 |
| 앱이 읽는 때 | 기본값 | T28(11-13)이 설정을 바꾼 뒤 |

- 앱이 읽는 클립 파일은 하나다. 지금은 경로가 코드에 박혀 있고(`web/character.js:214`), T18(11-13)이 `web/config/characters.json`의 값으로 옮긴다(키 이름은 아키텍처 문서). 기본값은 `./assets/characters/fan-anim.glb`다. `./assets/characters/fan-anim-v2.glb`로 바꾸는 것은 T28(11-13)뿐이고, 법무 앞 검토(T07(11-13))가 Mixamo 이용 조건을 통과로 본 뒤다(BL-0025 수락 기준 3). 두 파일을 함께 불러오지 않는다.
- `fan-anim-v2.glb`는 `fan-anim.glb`와 뼈 이름, 기준 자세, 클립 이름 9개, `Prop_Egg`, 예산이 같다. 그래서 런타임은 경로와 이벤트 프레임 값만 바꾼다.
- v2에서 Mixamo 동작으로 바꾸는 클립은 `Walk`, `Run`, `Jump`, `Sit`, 감정표현 4종이다. `Idle`은 `fan-anim.glb`의 클립을 옮겨 넣는다. 맞는 Mixamo 동작이 없는 클립도 `fan-anim.glb`의 것을 옮겨 넣고 리포트에 적는다. `Prop_Egg`는 `fan-anim.glb`의 것을 옮겨 넣는다(같은 메시, 같은 원점).
- 리타깃한 클립도 이 절의 규칙 그대로다: 30 fps, 제자리(Mixamo의 뿌리 이동은 굽기 전에 없앤다), `root` 키 없음, 스케일 트랙 없음, 기준 자세는 A 자세의 `FanRig`, `Jump`는 0.72초이고 몸을 띄우지 않음, `Sit`은 앉은 자세에서 멈춤.
- `Sit`에서 `hips`가 앞뒤로 움직인 만큼은 런타임이 상쇄한다(`web/character.js:133`). 좌우 이동은 상쇄하지 않으므로 넣지 않는다.
- GLB에 Mixamo 뼈대와 그 뼈 이름(`mixamorig:*`)을 남기지 않는다. 가져온 Mixamo 뼈대는 굽고 나서 `fan-anim-v2.blend`에서도 지운다(결정 15).
- Mixamo 원본 FBX는 `## 파일 위치와 이름`의 git 밖 자리에만 둔다(결정 15. `_workspace/`는 `.gitignore`에 있다). `art/`와 `web/`에 FBX를 두지 않는다. 받는 형식은 FBX, 스킨 없음, 30 fps, 이동 동작은 제자리다. 법무 앞 검토가 자리를 다르게 판정하면 그 판정을 따른다.

### 이벤트 프레임

이벤트는 클립 안의 이름 붙은 순간이다. 런타임의 소리와 이펙트는 이 이름으로 프레임을 찾는다. 이름은 고정이고 프레임은 클립 파일마다 다르다.

| 클립 | 이벤트(고정) | 뜻 | `fan-anim.glb`의 프레임 |
| --- | --- | --- | --- |
| `Emote_CheerClap` | `cheer_windup` | 환호 앞의 예비 동작 | 8 |
| `Emote_CheerClap` | `cheer_raise` | 환호하며 팔을 든 프레임 | 20 |
| `Emote_CheerClap` | `clap_contact` | 두 손이 맞닿는 프레임(여러 번) | 32, 44, 56, 68 |
| `Emote_Heart` | `heart_open` | 팔을 벌린 프레임 | 16 |
| `Emote_Heart` | `heart_form` | 머리 위 하트가 다 만들어진 프레임 | 34 |
| `Emote_Heart` | `heart_release` | 하트를 푸는 프레임 | 76 |
| `Emote_Angry` | `angry_raise` | 손을 든 프레임 | 15 |
| `Emote_Angry` | `angry_swing` | 손을 휘두르는 프레임(여러 번) | 26, 37, 49 |
| `Emote_EggThrow` | `egg_windup` | 팔을 뒤로 당기기 시작하는 프레임 | 30 |
| `Emote_EggThrow` | `egg_scream` | 괴성이 시작하는 프레임 | 34 |
| `Emote_EggThrow` | `egg_release` | 계란이 손을 떠나는 프레임 | 40 |

- 프레임은 0부터 세고 시간은 프레임 ÷ 30이다. 1부터 센 값으로 다시 풀지 않는다.
- 넷째 열은 T35가 `fan-anim.glb`에서 잰 값이다. `egg_scream` 34와 `egg_release` 40은 지금 런타임의 값과 같다(`web/character.js:8`).
- `fan-anim-v2.glb`의 프레임은 T19(11-13) 리포트의 `## 클립` 표가 정본이다. 위 이벤트 11개 모두에 프레임을 적는다. 여러 번인 이벤트는 한 번 이상이면 되고 횟수가 v1과 달라도 된다. `clap_contact`와 `egg_release`는 맞닿거나 손을 떠나는 바로 그 프레임이다(멈춘 프레임이 아니다). 동작에 그 순간이 없으면 가장 센 박자의 프레임을 고르고 리포트에 적는다.
- 런타임이 쓰는 값은 `web/config/characters.json`에 둔다(T18(11-13)이 코드에서 옮긴다. 키 이름은 아키텍처 문서). 클립 파일 경로와 이벤트 프레임은 한 짝이다. T28(11-13)이 둘을 함께 바꾸고, 한쪽만 바꾸지 않는다.
- 이벤트 이름을 더하거나 바꾸려면 이 문서를 고치는 Task가 필요하다. 이 표에 없는 순간에 붙는 이펙트는 표의 이벤트에서 몇 프레임 떨어졌는지(오프셋)로 적는다.

## 효과음

| 큐 이벤트(고정, `cues.json`의 `sound`) | 파일(고정) | 길이(출발값) | 쓰는 곳 |
| --- | --- | --- | --- |
| `egg_scream` | `web/assets/audio/sfx/egg-scream_01.mp3` | 2.5초 이하 | BL-0008 계란 던지기 |
| `pro_shout` | `web/assets/audio/sfx/pro-shout_01.mp3`, `pro-shout_02.mp3`, `pro-shout_03.mp3` | 3초 이하 | BL-0013 선수 고함(셋 중 하나를 고른다) |
| `cheer_clap` | `web/assets/audio/sfx/cheer-clap_01.mp3`, `cheer-clap_02.mp3`, `cheer-clap_03.mp3` | 실측 0.09~0.17초 | 감정표현 환호·박수. 박수가 맞닿을 때(`clap_contact`)마다 셋 중 하나 |
| `heart_send`, `heart_pop` | `web/assets/audio/sfx/heart-pop_01.mp3`, `heart-pop_02.mp3`, `heart-pop_03.mp3` | 실측 0.55초 | 감정표현 하트. 하트가 손을 떠날 때(`heart_send`)와 스크린 면에 닿을 때(`heart_pop`). 두 이벤트가 같은 세 파일을 쓴다 |
| `angry_voice` | `web/assets/audio/sfx/angry-voice_01.mp3`, `angry-voice_02.mp3`, `angry-voice_03.mp3` | 실측 0.20~0.75초 | 감정표현 화남. 첫 휘두름에 한 번, 셋 중 하나 |
| `egg_impact` | `web/assets/audio/sfx/egg-impact_01.mp3`, `egg-impact_02.mp3`, `egg-impact_03.mp3` | 실측 0.37~0.40초 | 계란이 스크린 면에 맞을 때, 셋 중 하나 |

- 표의 마지막 네 줄(`cheer_clap`~`egg_impact`)의 파일 12개는 FX1(11-13)이 넣었다. 큐 이벤트 이름은 `art/vfx/emotes/cues.json`의 `sounds` 키와 같고, 길이는 상한이 아니라 `sources.md`에 적힌 디코드 길이(실측)다.
- 형식: MP3, 모노, 48 kHz, 128 kbps 이상. 고른 이유: 앱이 이미 MP3를 쓰고(`web/crowd-performance.mp3`), 디코더를 더하지 않아도 모든 브라우저가 풀며, 지금 쓰는 CC0 출처가 MP3로 준다. 잃는 것: 파일 앞에 수십 ms의 인코더 지연이 붙고 끊김 없는 반복이 안 된다. 한 번 나는 소리라 받아들인다.
- 소리는 파일 시작 50 ms 안에 시작한다. 피크는 −1 dBFS 이하다. 좌우 위치와 잔향을 파일에 넣지 않는다(위치와 음량은 런타임이 정한다).
- 무료 출처(CC0)만 쓴다. 같은 폴더의 `sources.md`에 파일마다 출처 주소, 라이선스, 받은 날을 적는다(`web/audio-sources.md`와 같은 방식).
- 큐 표 `art/vfx/arena-show/cues.json`은 `vfx-design`의 `references/timing-and-cues.md` 4절 형식을 따르고 이벤트 `sky_beam`, `firework`, `pro_shout`, `egg_release`, `egg_scream`을 갖는다. `egg_release`와 `egg_scream`의 프레임은 큐 표에 어림해 적지 않는다(`## 클립`의 T35 표가 정본).

## 이펙트 런타임

감정표현 4종의 이펙트와 계란의 비행·명중·자국(BL-0028, BL-0029)은 자산이 아니다(결정 13). 웹 런타임이 Three.js만으로 그린다: 입자와, 코드로 그린 그림(canvas 텍스처). 하늘 쇼와 같은 방식이다.

- 만들지 않는 것: 이펙트용 GLB, `.blend`, 그림 파일. Blender와 이미지 생성 도구를 쓰지 않는다. 그래서 이 절에는 파일 형식과 노드 이름 규칙이 없다.
- 소리는 파일이다. 감정표현과 계란 명중의 효과음 12개(FX1(11-13))는 `## 효과음` 표가 정본이고 형식도 그 절을 따른다.
- 날아가는 계란은 `Prop_Egg`(자산)다. 껍데기 조각과 노른자 자국은 런타임이 그린다.
- 계란 자국은 스크린 면 앞에 그리고 영상 플레이어는 건드리지 않는다. 면의 자리는 `window.arena.screen.faces`에서 읽는다(읽기 전용. 정본은 아키텍처 문서).

| 것 | 자리(고정) | 만드는 Task |
| --- | --- | --- |
| 연출 명세 | `art/vfx/emotes/spec.md` | T17(11-13) |
| 큐 표 | `art/vfx/emotes/cues.json` | T17(11-13) |
| 재생 코드 | `web/character.js` | T18(11-13) |
| 런타임 값(입자 수 상한, 지속 시간, 크기, 계란 비행 시간, 자국이 남는 시간) | `web/config/characters.json`(키 이름은 아키텍처 문서) | T18(11-13) |

큐 표의 형식:

- `vfx-design`의 `references/timing-and-cues.md` 4절 형식이다. 감정표현 넷을 한 파일에 담으므로 `art/vfx/arena-show/cues.json`처럼 맨 위에 `cues` 배열 하나를 두고 큐마다 `clip`을 적는다.
- 클립에 붙는 큐는 `clip`에 `## 클립`의 클립 이름을, `event`에 `### 이벤트 프레임`의 이벤트 이름을 적는다. `frame`은 `fan-anim.glb`에서의 프레임(이벤트의 프레임 + 오프셋)이다. 클립 파일이 `fan-anim-v2.glb`로 바뀌어도 `event`와 오프셋은 그대로이고 이벤트의 프레임만 바뀐다.
- 클립이 아니라 시간에 붙는 큐(계란이 면에 맞음, 자국이 사라짐)는 `clip`을 `null`로 두고 `frame`을 `egg_release`부터 센다.
- `sound`는 `null`이거나 `## 효과음` 표의 큐 이벤트 이름이다.
- `art/vfx/arena-show/cues.json`은 고치지 않는다.

예산(런타임이 만드는 것이라 `## 예산`의 자산 표가 아니라 이 표가 정본이다):

| 값 | 상한 | 세는 법 | 판정 |
| --- | --- | --- | --- |
| 이펙트 텍스처 합 | 2 MiB(2,097,152바이트) 이하. 출발값 | 이펙트 코드가 만든 텍스처마다 가로 × 세로 × 4바이트(밉맵을 만들면 × 4/3). 16명이 함께 감정표현을 한 때에 있는 것을 모두 더한다. 그림을 종류마다 한 장만 만들어 아바타들이 함께 쓰면 사람 수에 따라 늘지 않는다 | T44(11-13) 성능 점검 |
| 장면 텍스처 메모리 | 500 MiB 이하 | `tests/qa-p.spec.mjs`의 집계 | `npm test -- tests/qa-p.spec.mjs` |
| 동시에 보이는 입자 수 | `web/config/characters.json`의 값(T17(11-13)이 명세에서 정한다) | — | `npm test -- tests/emote-fx.spec.mjs` |
| FPS | 60 이상(이펙트 넷과 계란을 낸 상태의 경기장) | — | T44(11-13) 성능 점검 |

- 2 MiB의 근거: 장면 텍스처 메모리의 여유가 8.52 MiB다(지난 phase 실측, 설계서 F-13). 그 4분의 1쯤을 이펙트에 준다. 256 × 256 그림 한 장이 0.25 MiB다.

## 경기장 버전

v2는 원본의 복사본에서 만들고 `-v2` 이름으로 낸다. 앱이 읽는 경로는 T38만 바꾼다.

| 것 | v1(그대로 둔다) | v2(고정) |
| --- | --- | --- |
| 원본 장면 | `barclays-worlds-2026.blend` | `art/environment/arena/barclays-arena-v2.blend` |
| GLB | `web/arena.glb` | `web/arena-v2.glb` |
| 라이트맵 7장 | `web/lightmaps/stage.png`, `bowl.png`, `seats.png`, `concourse.png`, `interior.png`, `exterior.png`, `city.png` | 같은 폴더의 `stage-v2.png`, `bowl-v2.png`, `seats-v2.png`, `concourse-v2.png`, `interior-v2.png`, `exterior-v2.png`, `city-v2.png` |
| extras의 라이트맵 경로 | `./lightmaps/<아틀라스>.png` | `./lightmaps/<아틀라스>-v2.png` |

- 런타임은 라이트맵 경로를 GLB의 `bakedLighting.texture`에서 읽는다(`web/baked-lighting.js:25-27`). T32가 extras에 `-v2` 경로를 쓰면 `baked-lighting.js`는 고칠 것이 없다. 경로는 `./lightmaps/` 아래의 영문, 숫자, `.`, `_`, `-`와 `.png`만 된다.
- 라이트맵의 형식은 v1과 같다: RGBM PNG, `range`는 아틀라스별(extras `bakedLighting.range`, 값은 굽기 리포트), `uvAttribute` `_lightmap_uv`, 아틀라스별 해상도도 v1과 같다(`## 예산`).
- 굽기 설정은 v1과 같다: Cycles, 직접광 + 간접광, 색 제외, 64샘플, 노이즈 제거(`web-lightmaps/bake-lightmaps.py:20-24`). 검토용 낮 조명 `EXR_Review sun`은 끈 채로 굽는다.
- v2가 바꾸지 않는 것: `web/*-reflections.hdr`, `web/world-background.png`, `web/lighting-config.json`. v1 것을 그대로 읽는다. 그래서 반사에는 새 달빛이 들어가지 않는다(받아들인 한계).

달 방향(고정, 굽기와 런타임이 같은 값을 쓴다):

| 좌표계 | 장면에서 달을 향하는 단위 벡터 |
| --- | --- |
| 런타임(Y 위) | (−0.7094, 0.5736, 0.4096) |
| Blender(Z 위) | (−0.7094, −0.4096, 0.5736) |

- 고도 35°(설계 기본값). 방위는 서쪽(−X, 바다 쪽)에서 런타임 +Z 쪽으로 30° 돌린 곳이다.
- 고른 이유: 광장에서 보는 건물 입구 면이 서쪽을 향하므로 달빛이 그 면과 야외 조형물을 비추고, 30° 비껴서 형태에 그늘이 생기며, 바다 위에 달이 뜬다. 잃는 것: 광장 출발 시야(동쪽)에는 달이 없고 뒤로 돌아야 보인다.
- 굽기(T31): 복사본 장면에 SUN 조명 `EXR_MoonLight`를 넣는다. 조명의 +Z가 위 Blender 벡터를 향하게 돌린다: `ob.rotation_euler = Vector((-0.7094, -0.4096, 0.5736)).to_track_quat('Z', 'Y').to_euler()`.
- 런타임(T24): 하늘의 달과 캐릭터 달빛에 위 런타임 벡터를 글자 그대로 옮겨 쓴다. 옮겨 적은 자리가 어디든 정본은 이 절이다.

하늘 세기와 달 조명(출발값, 결정 19 "지금보다 어둡게"):

| 값 | v1 | v2 출발값 | 자리 |
| --- | --- | --- | --- |
| 하늘 세기 | 0.018 | 0.009 | 복사본 장면의 월드 `REF_NightArena`의 배경 세기 |
| 달 조명 세기 | 없음 | 0.012 W/m² | `EXR_MoonLight` |
| 달 조명 색 | — | (0.72, 0.82, 1.0) 옅은 청백색 | `EXR_MoonLight` |
| 달 조명 각 크기 | — | 1° | `EXR_MoonLight` |

- 근거: v1의 하늘 그림(`web/world-background.png`) 위쪽 절반의 평균 밝기는 0.468(선형)이다. 하늘 세기를 반으로 내리면 그늘진 면은 v1의 절반이 되고, 달 조명 0.012를 더하면 달을 받는 바닥은 v1의 약 0.76배, 달을 마주 보는 벽은 약 1.14배가 된다. 전체는 어두워지고 달 쪽 면과 그늘의 차이로 윤곽이 남는다. 월드가 이 그림에 세기를 곱한 것이라는 가정 위의 계산이며 굽기로 확인한 값이 아니다.
- 판정은 굽기 뒤 화면이다(BL-0004 수락 기준 3, 아트 디렉션 `## 밤`): 광장 출발점의 같은 시점에서 v1보다 어둡고, 손전등 없이 야외 조형물의 윤곽이 보인다. 맞지 않으면 달 조명 세기부터 고치고, 고친 값을 이 표에 올린다.
- 런타임 하늘과 별의 밝기는 이 표가 아니라 `web/config/environment.json`의 값이다.

## 예산

데스크톱 기준이다. 한 화면의 최대 캐릭터 수는 16명(방 정원, BL-0010)이다.

| 종류 | 삼각형 | 드로 콜 | 재질 | 텍스처(수, 최대 변) | 뼈 | 파일 크기 | 근거 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 팬 캐릭터 1종 | 15,000 | 3 | 3(하나는 `Uniform`) | 자기 것 1장 1024 + 공용 `Uniform` 1장 512 | 23~27 | — | `web3d-performance` 출발값(가까이 보는 캐릭터 15,000, 드로 콜 2~3). 텍스처는 출발값 2048에서 내렸다(아래 장면 합계) |
| `fan.glb`(4종 합) | 60,000 | 12 | 9 | 6장, 1024, 메모리 추정 30 MB | 27 | 10,240 KB | 1종 예산 × 4. 파일 크기는 `web3d-performance` 출발값(자산 하나 5 MB)의 절반 × 4 |
| `fan-anim.glb` | 300 | 1 | 1 | 0장 | 27 | 2,048 KB | 클립 9개와 `Prop_Egg`. 출발값 |
| `fan-anim-v2.glb` | 300 | 1 | 1 | 0장 | 27 | 2,048 KB | `fan-anim.glb` 줄과 같다. 리타깃으로 키가 늘어도 이 크기 안이다(`fan-anim.glb` 실측: 삼각형 240, 관절 23, 276.5 KB) |
| `Prop_Egg` | 300 | 1 | 1 | 0장 | 0 | — | 출발값 |
| 효과음 1개 | — | — | — | — | — | 100 KB | 3초 × 128 kbps의 두 배. 출발값 |
| 팀 저지 그림 1장 | — | — | — | 512 | — | — | v1의 저지 그림 크기 |
| `arena-v2.glb` | 5,866,000 | 939 | 125 | 이미지 62장, 2048 | 0 | 120,200 KB | v1 실측(5,808,498 / 919 / 120 / 62장 2048 / 117,824 KB)에 삼각형 1%, 드로 콜 20, 재질 5, 크기 2%를 더한 값. 더하는 것이 기둥과 막음판 같은 단순 형상이라서다. 출발값 |
| 라이트맵 v2 | — | — | — | 7장. `bowl`, `seats`, `concourse`, `exterior`는 4096, `stage`, `interior`, `city`는 2048 | — | 7장 합 151 MB | v1 실측과 같은 해상도. v1 합은 144.5 MB |

장면 합계(추정):

- 캐릭터 16명: 삼각형 240,000, 드로 콜 48.
- 텍스처 메모리: v1 경기장 159.3 MB(`glb-inspect` 추정) + 라이트맵 304 MB(밉맵 없음, 4096 넉 장과 2048 석 장) + `fan.glb` 30 MB + 팀 그림 두 장 2.8 MB = 약 496 MB. `web3d-performance` 출발값의 상한 500 MB 바로 아래다. 그래서 캐릭터 텍스처를 1024로, 팀 그림을 512로 잡았다.
- 경기장은 삼각형과 드로 콜이 이미 출발값(100만, 200)을 넘는다(581만, 919). 이 phase에서 줄이지 않는다. 실측은 성능 점검(T49)이 한다.
- 앱은 v2 라이트맵만 읽는다. v1 7장은 파일로만 남는다.
- 클립 파일은 한 번에 하나만 읽고 텍스처가 없다. `fan-anim-v2.glb`로 바꿔도 텍스처 메모리와 드로 콜은 그대로다.

런타임이 만드는 것은 자산이 아니다. 2층 마네킹, 먼 관중의 낮은 텍스처, 바다, 별의 값은 `web/config/crowd.json`과 `web/config/environment.json`이 정본이다(기본값은 설계서 10절). 감정표현 이펙트와 계란 자국의 예산은 `## 이펙트 런타임`이 정본이다.

## 검사

명령은 저장소 루트에서 Git Bash로 돌린다.

| 항목 | 명령 | 통과 |
| --- | --- | --- |
| `fan.glb` 예산 | `node .claude/skills/blender-pipeline/scripts/glb-inspect.mjs web/assets/characters/fan.glb --names --max-tris 60000 --max-draws 12 --max-materials 9 --max-textures 6 --max-texture-px 1024 --max-texmem-mb 30 --max-joints 27 --max-kb 10240` | 코드 0, `예산: OK` |
| `fan.glb` 이름 | 위 출력에 `\| grep -o -w -E "fan_f1\|fan_f2\|fan_m1\|fan_m2\|Uniform\|FanRig" \| sort -u \| wc -l` | `6` |
| 뼈 이름, 이름의 글자 | 아래 "뼈대 검사"에 `web/assets/characters/fan.glb` | `skins` 1, `badNames` 0, `joints`가 위 23개와 같거나 허용된 4개만 더 있음 |
| `fan-anim.glb` 예산 | `node .claude/skills/blender-pipeline/scripts/glb-inspect.mjs web/assets/characters/fan-anim.glb --names --max-tris 300 --max-draws 1 --max-materials 1 --max-textures 0 --max-joints 27 --max-kb 2048` | 코드 0, `예산: OK`, 노드에 `Prop_Egg` |
| 클립 9개, 두 파일의 뼈 | "뼈대 검사"에 `web/assets/characters/fan-anim.glb` | `clips`가 `Emote_Angry`, `Emote_CheerClap`, `Emote_EggThrow`, `Emote_Heart`, `Idle`, `Jump`, `Run`, `Sit`, `Walk`. `joints`가 `fan.glb`의 것과 같음 |
| `fan-anim-v2.glb` 예산 | `node .claude/skills/blender-pipeline/scripts/glb-inspect.mjs web/assets/characters/fan-anim-v2.glb --names --max-tris 300 --max-draws 1 --max-materials 1 --max-textures 0 --max-joints 27 --max-kb 2048` | 코드 0, `예산: OK`, 노드에 `Prop_Egg` |
| v2 클립 9개, 뼈, Mixamo 이름 | "뼈대 검사"에 `web/assets/characters/fan-anim-v2.glb` | `clips`가 위 9개, `joints`가 `fan.glb`의 것과 같음, `badNames` 0(`mixamorig:`은 `:` 때문에 여기에 걸린다) |
| v2 이벤트 프레임 | 아래 "이벤트 검사"에 T19(11-13) 리포트 | `11` |
| v2 원본에 Mixamo 뼈대 없음 | T19(11-13) 리포트에 `fan-anim-v2.blend`에서 돌린 `[o.name for o in bpy.data.objects if o.type == "ARMATURE" and any("mixamorig" in b.name for b in o.data.bones)]`의 bpy 출력을 적는다 | `[]` |
| 지금 클립 파일이 그대로 | `git status --porcelain web/assets/characters/fan-anim.glb art/characters/fan/fan-anim.blend \| wc -l` | `0` |
| Mixamo FBX가 저장소 밖 | `git ls-files --cached --others --exclude-standard \| grep -ci "\.fbx$"` | `0` |
| 이펙트가 자산을 만들지 않음 | `ls art/vfx/emotes/ \| grep -c -i -E "\.(glb\|blend\|fbx)$"` | `0` |
| 큐 표의 이벤트 이름 | 아래 "큐 표 검사" | `0` |
| 이펙트 텍스처 합 | T44(11-13) 리포트에 이펙트 텍스처의 목록(가로 × 세로, 밉맵 여부)과 합을 적는다 | 합 2,097,152바이트 이하 |
| 이펙트를 낸 장면의 텍스처 메모리 | `npm test -- tests/qa-p.spec.mjs` | 실패 0 |
| 효과음 형식 | `ffprobe -v error -show_entries stream=codec_name,sample_rate,channels -of csv=p=0 web/assets/audio/sfx/egg-scream_01.mp3` (`.mp3` 16개 각각) | `mp3,48000,1` |
| 효과음 크기와 출처 | `ls -l web/assets/audio/sfx/` | `.mp3` 16개가 각각 102,400바이트 이하, `sources.md` 있음 |
| `arena-v2.glb` 예산 | `node .claude/skills/blender-pipeline/scripts/glb-inspect.mjs web/arena-v2.glb --max-tris 5866000 --max-draws 939 --max-materials 125 --max-texture-px 2048 --max-kb 120200` | 코드 0, `예산: OK` |
| 이름 보존 | 아래 "이름 보존 검사" | `missing`, `lostExtras`, `lostAttrs`가 모두 `[]`, `crowdMotion` 14, `thinGlassIOR` 1, `lightmaps`가 `./lightmaps/<아틀라스>-v2.png` 7개 |
| 라이트맵 v2 파일 | `ls web/lightmaps/*-v2.png \| wc -l` | `7` |
| 달 방향(런타임) | `grep -rn -F -e "-0.7094" web/environment.js web/config/environment.json` | 한 줄 이상 |
| 달 방향·하늘 세기(굽기) | T31 리포트에 `EXR_MoonLight`의 방향 벡터, 세기, 월드 `REF_NightArena`의 세기를 bpy 출력으로 적는다 | 이 문서의 값과 같음 |
| 유니폼 UV | 기준 그림 두 장을 `Uniform`에 넣은 4종의 앞·뒤 화면(T36 시험, 아트 리뷰 2) | 앞판에 글자가 똑바로, 등판과 소매에 뒤집힌 글자 없음 |
| 밤의 밝기 | 광장 출발점 같은 시점의 v1·v2 화면(T38, 아트 리뷰 2) | v2가 어둡고 조형물 윤곽이 보임 |

뼈대 검사:

```sh
node --input-type=module -e '
import {parseGlb} from "./.claude/skills/blender-pipeline/scripts/glb-inspect.mjs";
import {readFileSync} from "node:fs";
const g=parseGlb(readFileSync(process.argv[1])).json;
const bad=g.nodes.map(n=>n.name||"").filter(n=>n===""||/[\s.:\[\]\/]/.test(n));
const joints=[...new Set((g.skins||[]).flatMap(s=>s.joints.map(i=>g.nodes[i].name)))].sort();
console.log(JSON.stringify({skins:(g.skins||[]).length,badNames:bad.length,joints,clips:(g.animations||[]).map(a=>a.name).sort()}));
' web/assets/characters/fan.glb
```

이벤트 검사(클립 리포트의 `## 클립` 표에 이벤트 이름 11개가 모두 있는지):

```sh
grep -o -w -E "cheer_windup|cheer_raise|clap_contact|heart_open|heart_form|heart_release|angry_raise|angry_swing|egg_windup|egg_scream|egg_release" _workspace/graphicmodel/2026-11-13-ux-motion-rooms/04_graphic-character-designer_clips-fan-v2_v1.md | sort -u | wc -l
```

큐 표 검사(클립에 붙는 큐 가운데 `event`가 이벤트 이름이 아닌 것의 수):

```sh
node -e "const ok=new Set('cheer_windup cheer_raise clap_contact heart_open heart_form heart_release angry_raise angry_swing egg_windup egg_scream egg_release'.split(' '));console.log(require('./art/vfx/emotes/cues.json').cues.filter(q=>q.clip&&!ok.has(q.event)).length)"
```

이름 보존 검사:

```sh
node --input-type=module -e '
import {parseGlb} from "./.claude/skills/blender-pipeline/scripts/glb-inspect.mjs";
import {readFileSync} from "node:fs";
const [a,b]=process.argv.slice(1).map(f=>parseGlb(readFileSync(f)).json);
const keep=/^(REF_Jumbotron_[0-3]$|REF_Reused_Monitor_pixels__cyan$|REF_Player|REF_FanLightsticks|Walk_|Collide_|Audience_|Roof|Atrium_ceiling|REF_(CircularStage|TrophyIsland|RunwayTransition|CenterStairs|TeamRiser))|Player_desks|Player_PC|Player_chair|Plaza_bench|Bollards|REF_DeskBody|REF_CenterBackdrop|REF_WingMainFrame|CCR_(Counter|Timber|Refrigerator|Lounge|Banquette)/;
const names=g=>g.nodes.map(n=>n.name||"");
const have=new Set(names(b));
const kept=names(a).filter(n=>keep.test(n));
const missing=kept.filter(n=>!have.has(n));
const ex=(g,k)=>g.nodes.filter(n=>n.extras&&n.extras[k]!==undefined);
const lostExtras=["bakedLighting","crowdMotion"].flatMap(k=>{const inB=new Set(ex(b,k).map(n=>n.name));return ex(a,k).filter(n=>have.has(n.name)&&!inB.has(n.name)).map(n=>k+":"+n.name);});
const attrs=g=>new Set(g.meshes.flatMap(m=>m.primitives.flatMap(p=>Object.keys(p.attributes))).filter(k=>k.startsWith("_")));
const lostAttrs=[...attrs(a)].filter(k=>!attrs(b).has(k));
const lightmaps=[...new Set(ex(b,"bakedLighting").map(n=>n.extras.bakedLighting.texture))].sort();
const thinGlassIOR=(b.materials||[]).filter(m=>m.extras&&m.extras.thinGlassIOR).length;
console.log(JSON.stringify({checked:kept.length,missing,lostExtras,lostAttrs,crowdMotion:ex(b,"crowdMotion").length,thinGlassIOR,lightmaps}));
' web/arena.glb web/arena-v2.glb
```

## 결정 필요

| 정할 것 | 후보 | 추천 | 사용자 결정인가 |
| --- | --- | --- | --- |
| 달의 방위와 굽기의 세기(하늘 0.009, 달 0.012)는 계산으로 잡은 출발값이다 | 그대로 굽고 화면으로 확정 / 굽기 전에 값을 받음 | 그대로 굽고 T38과 아트 리뷰 2의 화면으로 확정한다. 밝기는 결정 19가 설정값으로 두었다 | 아니오. 화면을 본 사용자가 바꾸라고 하면 바꾼다 |
| 이동 속도가 걷기 4 m/s, 달리기 8 m/s라 보통 걸음(약 1.4 m/s)의 클립은 발이 미끄러져 보인다 | 클립을 빠른 걸음과 전력 달리기로 만든다 / 런타임의 속도를 낮춘다 | 클립이 맞춘다. 속도를 바꾸면 지금의 조작감이 바뀐다 | 속도를 바꾸는 쪽을 고를 때만 예 |
| 모바일 예산이 없다. 이 문서의 수치는 데스크톱 기준이다(`web/README.md:54`가 데스크톱 GPU만 검증했다고 적는다) | 데스크톱만 / 모바일 예산을 따로 둠 | 이 phase는 데스크톱만 | 예(대상 기기) |
| 텍스처 메모리 추정이 상한 바로 아래(496 / 500 MB)다 | T49 실측 뒤 그대로 / 라이트맵 해상도를 내림 / 캐릭터 텍스처를 512로 | T49가 재고, 넘으면 캐릭터 텍스처부터 내린다 | 아니오 |
| 아트 디렉션(`## 마네킹`)이 2층 마네킹의 삼각형 예산을 이 문서에 맡겼는데 정해진 값이 없다 | T23이 만들고 T49가 재서 올림 / 지금 수치를 정함 | 수락 기준(1층 관중보다 단순, 삼각형 수로 확인)만 지키고 수치는 T49 실측 뒤 이 문서에 올린다 | 아니오 |
| 이벤트 이름 11개 가운데 9개는 이 문서가 T35 표의 순간에 새로 붙인 이름이다(`egg_scream`, `egg_release`만 전부터 있었다) | 그대로 / T17(11-13)이 명세를 쓰며 필요한 이름을 더 올림 | 그대로 쓰고 없는 순간은 오프셋으로 적는다. 이름이 더 필요하면 `orca orchestration ask`로 올린다 | 아니오 |
| 이펙트 텍스처 합 2 MiB는 재기 전의 출발값이다 | T44(11-13) 실측 뒤 그대로 / 내림 | T44(11-13)가 재고, 장면 텍스처 메모리가 500 MiB를 넘으면 이펙트 그림 크기부터 내린다 | 아니오 |
| 실제 팀 저지 그림(`audience-jersey-geng`, `audience-jersey-blg`)을 `Uniform`에 쓸지 | 쓴다 / 로고 없는 팀 색 | 법무 앞 검토(T08, T09)의 판정을 따른다. 이 문서는 자리와 규격만 정했다 | 판정이 "사용자 결정 필요"로 나오면 예 |
