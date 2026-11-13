# T69 팀 유니폼 원본

사용자 요청: “캐릭터들 응원하는 팀에 맞춰서 관중석 유니폼하고 같은걸로해줘 BLG랑 GENG”.

기존 `interior-detail/audience-jersey-geng.png`와 `audience-jersey-blg.png`를 그대로 복사했다. 두 원본은 현재 `web/arena-v2.glb`의 `AudienceDetail_GEN.G`·`AudienceDetail_BLG` 재질에 포함된 PNG와 바이트 단위로 같다.

| 팀 | 기존 원본 | 웹 사본 | 크기 | SHA-256 |
| --- | --- | --- | --- | --- |
| GEN.G | `interior-detail/audience-jersey-geng.png` | `web/assets/characters/uniform-geng.png` | 512×512 RGB PNG, 11,647바이트 | `44c4a2333d279aac2870f6b08cc505c3abb11e45590efccaeabc11669a914be8` |
| BLG | `interior-detail/audience-jersey-blg.png` | `web/assets/characters/uniform-blg.png` | 512×512 RGB PNG, 12,647바이트 | `b99625a8deca467b7f77cc45ba6055d4144dcfb549ca5f24b2959be8c86b94a4` |

GEN.G는 검정 바탕, 가는 세로줄, 금색 V넥·옆선·밑단과 `GEN.G`, `WORLDS 2026` 글자다. BLG는 흰 바탕, 가는 세로줄, 청록 V넥·옆선과 청록/분홍 사선, 짙은 `BLG`, `WORLDS 2026` 글자다. 기존 관중의 그림이며 공식 유니폼의 재현 여부를 새로 주장하지 않는다.

`build-rig.py:183-194`의 공용 앞판 UV는 이 원본 전체를 목선이 위로 오도록 사용한다. 등판·소매는 왼쪽 글자 없는 영역을 사용한다. T66은 여성 모델의 이 UV를 보존했다. 따라서 재굽기, 새 디자인, 팬 GLB/UV/리그/클립 변경 없이 재사용한다.

런타임 규격은 sRGB·`flipY=false`이다. 두 장의 GPU 메모리는 RGBA와 전체 밉맵을 보수적으로 계산해 2.667 MiB(512×512×4×4/3×2)로, 지정 여유 7.5 MiB 안이다. 기존 런타임의 같은 해상도 단색 맵 두 장을 대체한다. 새 의존성이나 유료 생성 도구는 사용하지 않았다.
