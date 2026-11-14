# T87 유니폼 등판 UV 수정

T69의 PNG 재사용은 맞지만, 기존 팬 UV의 글자 없는 왼쪽 영역은 GEN.G 금색 / BLG 청록색 띠였다. 관중은 앞판에 PNG를 쓰고 등판·소매에는 `AudienceDetail_Black` / `AudienceDetail_White` 바탕 재질을 쓴다. 따라서 원본 PNG가 같다는 검사만으로 뒷면 일치가 보장되지 않았다.

`fan-uniform-t87.blend`는 T66의 `fan-female-t66.blend`를 이어받은 모델 원본이다. `fix-uniform-t87.py`는 각 팬의 기존 등판·소매 106면(448루프)을 원본 PNG의 글자 없는 바탕으로 옮긴다. 앞판과 나머지 UV, 형태, 가중치, 뼈, 중립 텍스처는 보존한다. `fan.glb`의 유니폼 프리미티브 4개만 달라지고 나머지 바이너리 버퍼와 JSON 메타데이터는 같다.

| UV | 수정 전 | 수정 후 |
| --- | --- | --- |
| Blender U | 0.025–0.125 | 0.20–0.30 |
| Blender V | 0.30–0.65 | 0.40–0.44 |
| glTF V | 0.35–0.70 | 0.56–0.60 |
| PNG 영역 | 금색/청록색 왼쪽 띠 | x=102–154, y=287–307의 검정/흰색 바탕 |

기존 PNG와 `teams.json` 경로를 유지했다. GEN.G 등판은 검정, BLG 등판은 기존 관중처럼 흰색이다. 클립 GLB에는 몸 메시가 없으므로 수정하지 않았다. 다음 모델 편집은 T87 원본을 사용해야 이 UV 수정이 보존된다.

재현: 깨끗한 `fan-female-t66.blend`를 열고, T87 백업을 확보한 상태에서 `fix-uniform-t87.py`를 실행한다. 스크립트는 기존 T87 원본 덮어쓰기를 거부하며 후보 GLB를 `temp/T87/fan-candidate.glb`에 만든다.

검사: `node temp/T87/check-uniform-uv.mjs`, `node temp/T87/check-preservation.mjs`, `npm run walk -- temp/T87/uniform-back.walk.mjs`.
