# 팀 명단

> 읽는 시점: 요청을 팀에 보낼 때(코디네이터, 창구), 계획에서 Task를 팀에 배정할 때(planner).
> 팀을 추가하면 이 표에 한 줄을 넣는다. 코디네이터는 팀 스킬 대신 이 표만 읽는다.
> 팀이 어떻게 일하는지는 각 팀 스킬에 있다. 새 팀 스킬은 `docs/harness/templates/team-skill.md`로 만든다.

| 팀 | 팀장이 되는 에이전트 | 팀원 | 팀 스킬 | 편집 범위 |
| --- | --- | --- | --- | --- |
| `product` | `product-manager` | `product-manager`, `ux-designer` | `team-product` | `docs/backlog.md`, `docs/backlog-archive.md`(이 둘은 `product-manager`만), `docs/live/product/ux/`(`ux-designer`), `_workspace/product/` |
| `qa` | `qa-inspector` | `qa-inspector`, `code-reviewer` | `team-qa` | 테스트 파일(`qa-inspector`만), `_workspace/qa/` |
| `harness` | `harness-engineer` | `harness-engineer` | `team-harness` | `.claude/`, `AGENTS.md`, `CLAUDE.md`, `docs/harness/`(모델 표 제외), `_workspace/harness/` |
| `graphicmodel` | `graphic-leader` | `graphic-leader`, `graphic-model-designer`, `graphic-character-designer`, `graphic-effect-vfx-designer`, `graphic-performance-verifier`, `ui-designer` | `team-graphicmodel` | `art/`(경기장 수정·굽기·내보내기 스크립트 포함), `web/assets/`, `docs/live/graphicmodel/`(`ui-designer`는 `docs/live/graphicmodel/ui/`만), `_workspace/graphicmodel/` |
| `web-metaverse-develop` | `metaverse-develop-leader` | `metaverse-develop-leader`, `metaverse-3d-developer`, `metaverse-web-developer` | `team-web-metaverse-develop` | `web/`(`web/assets/` 제외), 루트 설정 파일(`package.json`, 잠금 파일, `playwright.config.mjs`), `tests/`, `docs/live/web-metaverse-develop/`, `_workspace/web-metaverse-develop/` |
| `legal-review` | `legal-leader` | `legal-leader`, `riot-policy-reviewer`, `legal-reviewer` | `team-legal-review` | `docs/live/legal-review/`, `_workspace/legal-review/` |

- `planner`는 어느 팀에도 속하지 않는다. 창구가 띄운다.
- 팀 이름은 작업 폴더 `_workspace/<팀>/`의 이름과 같다.
- `graphicmodel` 팀에서 Blender를 쓰는 Task(모델, 캐릭터, 이펙트 제작과 다시 내보내기)는 동시에 하나만 돈다. Blender MCP가 실행 중인 Blender 하나를 함께 쓰기 때문이다. 계획에서는 의존으로 잇는다.
- 권리자의 것(Riot의 캐릭터, 이름, 로고, 데이터)이나 남의 자산을 쓰는 phase, 공개되는 문구나 이용자 정보의 수집을 바꾸는 phase는 계획에 `legal-review` 팀의 검토 Task를 넣는다. 만들기 전에 기획을 보는 앞 검토와, 공개하기 전에 결과물을 보는 끝 검토다. 이 팀은 고치지 않고 리포트만 쓴다.
- 화면이나 조작(버튼, HUD, 커서, 포인터 잠금, 키 안내, 첫 방문)에 닿는 phase는 계획 전에 `product` 팀 `ux-designer`의 UX 명세를, 웹 구현 전에 `graphicmodel` 팀 `ui-designer`의 UI 명세를 둔다. 둘은 만드는 앞단이며 검증 Task가 아니다.
