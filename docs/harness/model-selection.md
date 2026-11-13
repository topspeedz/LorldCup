# 모델 선택 표

> 읽는 시점: Task를 배정할 때(planner, 팀장). 워커 기동은 `.claude/scripts/orca-launch.mjs`가 이 표를 조회한다.
> 소유: 사용자. 에이전트는 사용자 승인 없이 이 표를 고치지 않는다.
> 작업 단위 칸에는 쉼표로 여러 이름을 적을 수 있다. 형식 검사: `node .claude/scripts/model-selection.mjs check`
> 값을 정할 때의 참고: 사용자가 어떤 모델을 쓸지 묻거나 추천을 원할 때, 추천 표를 만들어 줄 때는 [revfactory/harness의 모델 선택 가이드](https://github.com/revfactory/harness/blob/main/skills/harness/references/model-selection-guide.md)의 기준(복잡도, 예상 기간, 필요한 자율성, 응답 속도)을 참고한다. 표에는 사용자가 정한 값만 넣는다.

| 에이전트 | 작업 단위 | 런타임 | model | effort | 메모 |
| --- | --- | --- | --- | --- | --- |
| `coordinator` | 실행 감독 | claude | opus | high | 100만 토큰 창 전제 |
| `planner` | 설계, 계획 | claude | opus | max | effort는 세팅에서 고른 값. 작업량이 매우 방대하면 띄우기 전에 `fable`로 띄울지 사용자에게 묻는다 |
| `product-manager` | 수락 기준, 항목화 | claude | opus | medium | |
| `product-manager` | 장부 정리, 완료 처리 | claude | sonnet | medium | |
| `qa-inspector` | 흐름 검증 | claude | opus | medium | |
| `qa-inspector` | 재검 | claude | opus | medium | 재현 확인만 한다 |
| `code-reviewer` | 일반 변경 리뷰 | claude | opus | medium | |
| `code-reviewer` | 보안·돈이 걸린 변경 리뷰 | claude | opus | high | |
| `harness-engineer` | 회고, 구조 변경 | claude | fable | high | |
| `graphic-leader` | 아트 디렉션, 아트 리뷰 | codex | gpt-6-astra | medium | 기준 문서 작성과 일관성 대조. 팀장으로 띄울 때는 `리드` 줄 |
| `graphic-model-designer` | 3D 모델링 | codex | gpt-6-astra | max | 사물·조형물·환경. 재질·셰이더·조명 포함 |
| `graphic-character-designer` | 캐릭터 모델링, 캐릭터 애니메이션 | codex | gpt-6-astra | max | |
| `graphic-effect-vfx-designer` | 이펙트 제작, 효과음 | codex | gpt-6-astra | max | |
| `graphic-performance-verifier` | 성능 점검, 자산 최적화 | codex | gpt-6-astra | max | 점검은 측정과 리포트, 최적화는 자산 변경 |
| `metaverse-develop-leader` | 아키텍처 | claude | fable | high | 아키텍처와 자산 연동 규약 문서. 팀장으로 띄울 때는 `리드` 줄 |
| `metaverse-3d-developer` | 3D 런타임 구현 | codex | gpt-6-astra | max | |
| `metaverse-web-developer` | UI·기능 구현 | claude | opus | medium | |
| `legal-leader` | 법무 기준 | claude | fable | high | 적용되는 정책·법의 목록과 판정 기준 문서. 팀장으로 띄울 때는 `리드` 줄 |
| `riot-policy-reviewer` | Riot 정책 검토 | claude | fable | high | Riot 공개 정책 원문과 서비스의 대조. 리포트만 쓴다 |
| `legal-reviewer` | 법률 검토 | claude | fable | high | 지식재산과 서비스 운영 관련 법. 리포트만 쓴다 |
| `*` | 리드 | claude | opus | high | 팀장으로 띄울 때 |
| `*` | 기본 | claude | opus | medium | 표에 없는 조합 |
