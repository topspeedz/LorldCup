# 법무 기준

**참고용 기준이며 법률 자문이 아니다.** 이 문서는 조항과 판정 기준을 적는다. "된다", "안 된다"의 결론은 내지 않는다.

- 읽는 시점: 정책이나 법에 닿는 기획을 할 때, 법무 검토를 할 때, 검토 Task의 spec을 쓸 때
- 역할과 소유 범위: 이 서비스에 적용되는 정책과 법, 판정 기준
- 소유 에이전트: legal-leader
- 마지막으로 갱신한 phase: 2026-11-12-requirements-build
- 확인일: 이 문서의 모든 "확인일"은 2026-11-12다. 원문 페이지를 직접 받아 문장을 대조했다. 직접 받지 못한 것은 "확인 못 함"으로 적었다.
- 이번 범위: BL-0003(팀 유니폼), BL-0012(모니터 화면), BL-0016(유튜브 스크린)과 그에 딸린 BL-0020(Full Mode). 그 밖은 끝의 `## 이번 phase 밖`.

## 서비스의 사실

정본은 브리프 `_workspace/_run/2026-11-12-requirements-build/brief.md`의 `## 사용자 결정`이다. 아래와 다르면 브리프가 이긴다. "코드"는 2026-11-12에 `web/`을 검색해 본 것이다.

| ID | 사실 | 값 | 출처 | 상태 |
| --- | --- | --- | --- | --- |
| F-01 | 공개 범위 | 개인 사용, 로컬만. 배포·외부 게시·push가 없다 | 브리프 `## 금지`, 사용자 결정 표의 (4) | 확정(이번 phase) |
| F-02 | 앞으로의 방향 | 사용자 원문 "여러사람이 쓰게할서비스". 정적 파일을 올릴 호스팅은 다음 phase의 결정이다 | 브리프 사용자 결정 표, "연결 구조에 대한 결정의 적용" | 방향만 있음. 시점·범위는 미결(U-04) |
| F-03 | 운영 주체 | 개인(사용자 한 사람). 법인이나 사업체가 관여한다는 결정은 없다 | 브리프 | 가정(결정 필요 D-4) |
| F-04 | 수익(광고, 후원, 결제, 유료 재화) | 브리프에 결정이 없다. 이번 phase는 무료 도구만 쓰고 결제 코드가 없다 | 브리프, 코드 | **미결**(U-02) |
| F-05 | 연결 | PeerJS Cloud가 연결을 중개한다(`web/vendor/peerjs.min.js`, `web/multiplayer.js:52`). STUN은 `stun.l.google.com:19302`. TURN은 쓰지 않는다. Cloudflare 임시 터널은 전제가 아니다. 이번 phase는 PeerJS만 쓰고 Vercel은 쓰지 않는다 | 브리프, 코드 | 확정 |
| F-06 | 방 | 접속자가 직접 만들고 만든 사람이 방장이다. 방장의 peer id는 `'barclays-tps-' + 방 코드`다(`web/multiplayer.js:51`). 방당 최대 16명 | 브리프, 코드, 백로그 BL-0021 | 확정 |
| F-07 | 운영자 쪽 | 만들어진 방 id 목록만 관리해 사람을 방에 배치하는 데 쓴다. 목록을 둘 곳(서비스·DB)은 정하지 않았다. Vercel(필요하면 유료)은 방 id 목록과 정적 파일 호스팅의 후보일 뿐이다 | 브리프 | 구조 확정, 보관처 **미결**(U-03) |
| F-08 | PeerJS로 오가는 정보 | 위치(pose), 팀, 캐릭터, 닉네임(자동 부여), 감정표현, 앉은 상태. 영상과 소리는 보내지 않는다 | 브리프 결정 9·17, Task spec | 확정 |
| F-09 | 연결 과정에서 밖으로 드러나는 것 | WebRTC 구조상 접속자의 IP 주소와 peer id가 PeerJS Cloud, Google STUN, 같은 방의 상대에게 보인다 | 구조에서 추정. 패킷으로 확인하지 않았다 | 가정(T09가 확인) |
| F-10 | 계정·로그인·분석 도구·저장 | 코드에서 찾지 못했다(`web/`의 js·html에서 `riot`, `localStorage`, `analytics`, 외부 http 주소 검색 0건). 나이를 묻지 않는다. 글 채팅은 브리프의 사실 목록에 없다 | 코드 | 코드 기준 확정. 채팅 유무는 T09가 확인 |
| F-11 | Riot API | 쓰지 않는다 | 코드 | 확정 |
| F-12 | 유튜브 임베드 | 공식 IFrame 플레이어 하나. 재방(VOD) `https://www.youtube.com/watch?v=rQTHR3aL0SE`, 생방송 `https://www.youtube.com/watch?v=EacB7ADMGpY`. 각 사용자가 자기 플레이어로 본다. 한 사람의 영상을 다른 사람에게 보내지 않는다. 생방송은 맞추지 않는다 | 브리프 결정 7·8·9, 설계서 5.4 | 확정(주소는 설정값) |
| F-13 | 두 주소가 가리키는 영상(유튜브 oEmbed로 확인) | 재방: LCK 채널의 "BLG vs T1 매치 하이라이트 … 2026 월드 챔피언십". 생방송 주소: **SBS 뉴스 채널의 뉴스 영상**이다. e스포츠 방송이 아니다 | `https://www.youtube.com/oembed?url=<주소>&format=json` | 확인한 사실. 생방송 주소가 의도한 것인지는 **미결**(U-06) |
| F-14 | 재방 구조 | 10분 단위 회차(매시 00·10·20·30·40·50분에 새 회차). 방 하나는 한 회차. 방 안의 재생 위치 = 지금 시각 − 회차 시작 시각. 유튜브 주소의 시간 정보(`start`)로 강제로 맞춘다. 영상이 끝나면 기존 스크린 그림과 안내. 회차 간격과 기본 회차는 설정값 | 브리프 "재방 구조의 적용", 사용자 확인 "1. 맞아 2. 맞아 3. 맞아 4. 맞아" | 확정 |
| F-15 | 스크린에 놓는 방식 | CSS3DRenderer로 플레이어 DOM을 스크린 면에 맞춰 놓는다. CSS 층은 WebGL 캔버스 뒤에 있고 포인터를 받지 않는다. 앞에 있는 트러스·아바타는 영상 위에 그려진다. 재생·소리·소스 전환은 앱 버튼으로 한다. 처음에는 소리 없이 재생하고 입장 버튼을 누를 때 소리를 켠다. 16:9 영상을 3.4:1 면의 가운데에 놓는다 | 설계서 5.4 | 설계(구현 뒤 T08·끝 검토가 실제와 대조) |
| F-16 | Full Mode(BL-0020) | 내 화면에만 유튜브 플레이어가 브라우저 전체화면으로 뜬다. 같은 플레이어 DOM에 Fullscreen API를 건다. 버튼·F 키로 들어가고 Esc·F·닫기 버튼으로 나온다 | 브리프 결정 10, 설계서 5.4, 백로그 BL-0020 | 확정 |
| F-17 | 장면의 표지 | GEN.G, BLG(팀 선택·유니폼, BL-0003), Barclays Center, WORLDS. 코드에서 본 것: 페이지 제목 "WORLDS 2026 · Barclays Center"(`web/index.html:2`), 머리말 "WORLDS 2026", "BARCLAYS CENTER · GRAND FINAL"(`web/index.html:9`). `web/`의 js·html·json에 GEN.G·BLG 문자열은 아직 없다. `web/arena.glb` 안의 텍스처에 든 표지는 이 문서에서 눈으로 확인하지 않았다 | 설계서 6.4, 코드 | 확정(표지가 있다는 것). 그림 단위의 목록은 T08·T09가 만든다 |
| F-18 | 팀 유니폼(BL-0003) | 응원팀 GEN.G·BLG를 고르면 캐릭터 옷 자체의 그림이 그 팀 유니폼으로 바뀐다. 법무 앞 검토 전에는 로고 없는 팀 색 임시 유니폼을 쓴다 | 백로그 BL-0003, 설계서 6.4 | 확정. 실제 팀 이름·로고·저지 그림 연결은 앞 검토 뒤 |
| F-19 | 모니터(BL-0012) | 리그 오브 레전드와 비슷한 화면(반복 애니메이션). 실제 게임 화면이 아니다. 실제 게임 화면은 사용자가 파일을 주고 Riot 정책 검토를 통과한 뒤에만 쓴다 | 브리프 결정 22, 백로그 BL-0012 | 확정 |
| F-20 | 자산 | CC0 자산과 효과음. `web/audio-sources.md`: SFXMint의 효과음 3개, 제공자가 CC0 1.0과 AI 생성으로 표기. 출처 표 대조는 끝 검토 | 설계서 6.4, `web/audio-sources.md` | 확정(대조는 끝 검토) |
| F-21 | 배포 형태와 런타임 | 정적 Three.js r170 웹 앱(`web/`). 앱 장터에 내지 않는다. 런타임은 Three.js r170에 딸린 파일, PeerJS, 유튜브 공식 IFrame 플레이어뿐이다 | 브리프, Global Constraints | 확정 |
| F-22 | 게임으로 볼 요소(점수, 승패, 보상, 진행 목표) | 브리프와 백로그 BL-0003·0012·0016에는 없다. 감정표현, 앉기, 티켓 화면, 폭죽은 있다 | 브리프, 백로그 | 가정(T08·T09가 기능 목록으로 확인. U-01, U-16) |

## 적용 규범

법과 권리자의 정책은 다른 축이다. 정책이 허락해도 법이 막을 수 있고, 그 반대도 있다. "확인 수준"이 "확인 못 함"인 줄은 통과의 근거로 쓰지 않는다.

### Riot Games의 정책

| ID | 규범 | 필수 / 조건부 | 원문 URL | 문서에 적힌 개정일 | 확인일 | 확인 수준 | 걸리는 이유 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| N-R1 | 팬 제작물 정책 "Legal Jibber Jabber"(영어) | 필수 | https://www.riotgames.com/en/legal | Last Updated: August 2018 | 2026-11-12 | 전문 확인 | 모니터 화면(F-19), WORLDS 표지(F-17), 재방 영상(F-13) |
| N-R2 | 같은 정책의 한국어판 "지식재산 이용 정책" | 필수 | https://www.riotgames.com/ko/legal | 최종 갱신일: 2018년 8월 | 2026-11-12 | 전문 확인 | 위와 같음 |
| N-R3 | Riot 서비스 약관(영어) | 필수 | https://www.riotgames.com/en/terms-of-service | Last Modified: December 1, 2024 | 2026-11-12 | 지식재산 문장만 확인. 한국어판은 확인 못 함 | 상표·로고·게임 콘텐츠의 소유 |
| N-R4 | 개발자 포털 일반 정책 | 조건부(Riot API를 쓰면) | https://developer.riotgames.com/policies/general | LAST UPDATED: MAY 29, 2025 | 2026-11-12 | Core Policies와 Monetization 확인 | 지금은 API를 쓰지 않는다(F-11) |
| N-R5 | Riot API 약관 | 조건부(Riot API를 쓰면) | https://developer.riotgames.com/terms | LAST UPDATED: DECEMBER 9, 2013 | 2026-11-12 | 개정일만 확인. 조항은 확인 못 함 | 위와 같음 |
| N-R6 | LoL Esports 커뮤니티 대회 지침 | 조건부(대회를 열거나 공식 대회 브랜드를 쓰면) | https://lolesports.com/en-US/news/lol-esports-community-competition-guidelines | 게시일 August 3, 2026 | 2026-11-12 | 브랜드 문장만 확인 | "Worlds"를 공식 대회 브랜드로 든다. 이 서비스는 대회가 아니므로 직접 적용되는지는 미결(U-10) |
| N-R7 | 개발자 포털 게임별 정책, 리그 오브 레전드 게임 정책 | 조건부(Riot API를 쓰면) | https://developer.riotgames.com/policies/game-specific , https://developer.riotgames.com/docs/lol#game-policy | 확인 못 함 | - | **확인 못 함**(이번에 열지 않음) | 지금은 API를 쓰지 않는다 |
| N-R8 | e스포츠 방송의 공동 중계·다시 보기·하이라이트 규칙 | 조건부(대회 영상을 다루면) | 찾지 못함 | 확인 못 함 | - | **확인 못 함**(문서를 찾지 않았다) | 재방 영상이 LCK 채널의 대회 하이라이트다(F-13) |

### 유튜브의 조건

| ID | 규범 | 필수 / 조건부 | 원문 URL | 문서에 적힌 개정일 | 확인일 | 확인 수준 | 걸리는 이유 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| N-Y1 | YouTube API Services Terms of Service | 필수 | https://developers.google.com/youtube/terms/api-services-terms-of-service | 페이지 표시 "Last updated 2026-11-06 UTC". 개정 이력의 약관 본문 마지막 줄은 July 12, 2022 | 2026-11-12 | 정의와 7절 문장 확인 | IFrame 플레이어를 쓴다(F-12) |
| N-Y2 | YouTube API Services Developer Policies | 필수 | https://developers.google.com/youtube/terms/developer-policies | 페이지 표시 "Last updated 2026-11-06 UTC". 개정 이력의 마지막 줄은 June 1, 2026 | 2026-11-12 | 아래 표의 문장 확인 | 플레이어, 출처 표시, 과금, 개인정보 |
| N-Y3 | Required Minimum Functionality | 필수 | https://developers.google.com/youtube/terms/required-minimum-functionality | 페이지 표시 "Last updated 2026-11-06 UTC". 개정 이력의 마지막 줄은 July 7, 2025 | 2026-11-12 | "YouTube embedded player and video playback" 절 전문 확인 | 크기, 가림, 자동 재생, Referer(BL-0016의 핵심) |
| N-Y4 | IFrame Player API Reference | 필수 | https://developers.google.com/youtube/iframe_api_reference | Last updated 2026-10-15 UTC | 2026-11-12 | Requirements 문장 확인 | 플레이어를 만드는 방법과 최소 크기 |
| N-Y5 | Player Parameters | 필수 | https://developers.google.com/youtube/player_parameters | Last updated 2026-11-01 UTC | 2026-11-12 | `start`, `autoplay` 문장 확인 | 재방 위치를 `start`로 맞춘다(F-14) |
| N-Y6 | YouTube API Services Branding Guidelines | 필수 | https://developers.google.com/youtube/terms/branding-guidelines | Last updated 2025-08-20 UTC | 2026-11-12 | 로고 문장 확인 | 유튜브 로고와 출처 표시 |
| N-Y7 | YouTube 서비스 약관(한국) | 필수 | https://www.youtube.com/static?template=terms&gl=KR&hl=ko (약관이 가리키는 주소 https://www.youtube.com/t/terms) | 발효일: 2022년 1월 5일 | 2026-11-12 | "서비스 이용 시 허용되는 사항 및 제한사항" 문장 확인 | 보는 사람과 임베드하는 쪽의 조건 |
| N-Y8 | 개정 이력 | 참고 | https://developers.google.com/youtube/terms/revision-history | Last updated 2026-11-06 UTC | 2026-11-12 | 날짜 줄 확인 | 위 문서들의 개정일의 근거 |

### 외부 서비스와 자산의 조건

| ID | 규범 | 필수 / 조건부 | 원문 URL | 문서에 적힌 개정일 | 확인일 | 확인 수준 | 걸리는 이유 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| N-E1 | PeerJS Cloud(PeerServer Cloud)의 이용 조건과 개인정보 고지 | 필수 | https://peerjs.com/ , https://peerjs.com/peerserver | 없음 | 2026-11-12 | **확인 못 함.** 두 페이지에서 약관과 개인정보 문서를 찾지 못했다. 본 문장은 "By default, it connects to the free PeerJS Cloud server. For production, you can host your own."뿐이다 | 연결 중개(F-05) |
| N-E2 | Google STUN 서버의 이용 조건 | 필수 | 찾지 못함 | 확인 못 함 | - | **확인 못 함** | `stun.l.google.com:19302`(F-05) |
| N-E3 | CC0 1.0 Universal | 필수 | https://creativecommons.org/publicdomain/zero/1.0/legalcode.en | 판 1.0(개정일 표시 없음) | 2026-11-12 | 4.a 문장 확인 | CC0 자산(F-20) |
| N-E4 | SFXMint 라이선스 | 필수 | https://sfxmint.com/license | 표시를 보지 못함 | 2026-11-12 | 공개 목록의 문장 확인. 자산별 대조는 끝 검토 | 효과음 3개(F-20) |
| N-E5 | 팀과 경기장의 권리자(Gen.G, Bilibili Gaming, Barclays Center)가 공개한 이름·로고 이용 정책 | 조건부(실제 이름·로고·저지 그림을 쓰면) | 찾지 못함 | 확인 못 함 | - | **확인 못 함**(문서를 찾지 않았다) | BL-0003, 장면의 표지(F-17, F-18) |

### 한국 법

원문은 국가법령정보센터다. 법 이름, 시행일, 공포 번호와 아래 표에 옮긴 조문 문장을 확인했다. 시행령과 고시는 확인 못 함이다.

| ID | 법 | 필수 / 조건부 | 원문 URL | 시행일과 공포 | 확인일 | 걸리는 이유 |
| --- | --- | --- | --- | --- | --- | --- |
| N-L1 | 저작권법 | 필수 | https://www.law.go.kr/법령/저작권법 | 시행 2026. 10. 29. 법률 제21595호, 2026. 4. 28., 일부개정 | 2026-11-12 | 영상, 게임 화면, 그림, 음원 |
| N-L2 | 상표법 | 필수 | https://www.law.go.kr/법령/상표법 | 시행 2025. 11. 11. 법률 제21134호, 2025. 11. 11., 타법개정 | 2026-11-12 | 팀·경기장·대회의 이름과 로고 |
| N-L3 | 부정경쟁방지 및 영업비밀보호에 관한 법률 | 필수 | https://www.law.go.kr/법령/부정경쟁방지및영업비밀보호에관한법률 | 시행 2026. 5. 28. 법률 제21065호, 2025. 10. 1., 타법개정 | 2026-11-12 | 널리 알려진 표지, 사람의 이름과 초상, 남의 성과 |
| N-L4 | 개인정보 보호법 | 조건부(다른 사람이 쓰게 되면. U-12) | https://www.law.go.kr/법령/개인정보보호법 | 시행 2026. 9. 11. 법률 제21445호, 2026. 3. 10., 일부개정 | 2026-11-12 | 닉네임, 위치, IP 주소, 방 id 목록(F-07~F-09) |
| N-L5 | 정보통신망 이용촉진 및 정보보호 등에 관한 법률 | 조건부(영리 목적의 서비스가 되면) | https://www.law.go.kr/법령/정보통신망이용촉진및정보보호등에관한법률 | 시행 2026. 10. 2. 법률 제21988호, 2026. 9. 29., 일부개정 | 2026-11-12 | 제2조제1항제3호의 정의만 확인 |
| N-L6 | 게임산업진흥에 관한 법률 | 조건부(게임으로 볼 요소가 있으면. U-16) | https://www.law.go.kr/법령/게임산업진흥에관한법률 | 시행 2025. 10. 23. 법률 제20485호, 2024. 10. 22., 일부개정 | 2026-11-12 | 제2조제1호의 정의만 확인 |
| N-L7 | 약관의 규제에 관한 법률, 전자상거래 등에서의 소비자보호에 관한 법률, 표시·광고의 공정화에 관한 법률, 청소년 보호법 | 조건부(약관, 결제, 광고, 나이 제한이 생기면) | https://www.law.go.kr | 확인 못 함 | - | **확인 못 함**(이번에 열지 않음). 지금은 해당하는 기능이 없다 |

## 판정 기준

### 심각도

두 검토자(T08 Riot 정책, T09 법률)가 같은 기준으로 등급을 매긴다.

| 심각도 | 기준 |
| --- | --- |
| High | 원문 조항과 직접 어긋난다(조항에 공개나 공유의 조건이 없으면 로컬에서도 같다). 조건이 충족됐는데 반드시 표시하거나 받아야 하는 것(고지문, 동의)이 빠졌다. 출처와 이용 조건을 댈 수 없는 것을 공개해 쓴다. 공식으로 오인될 표시다 |
| Medium | 조건이 바뀌면(공개, 다른 사람과 공유, 수익, 호스팅) 어긋난다. 일부만 지켰다. 근거 조항의 문장을 확인하지 못했다("확인 못 함"인 규범에 기댄 판정) |
| Low | 어긋나지 않으나 더 분명히 할 수 있다 |
| `판단 필요` | 등급을 매기지 않는다. 해석이 갈리거나, 규범이 답하지 않거나, `## 미결`의 쟁점에 걸리거나, 사실이 미결(수익 여부 같은 것)이어서 등급이 갈린다. 사람에게 넘긴다 |

- 이번 phase는 로컬만이다(F-01). 줄마다 **지금(로컬)** 의 등급과 **공개하거나 다른 사람과 공유하면** 의 등급을 나란히 적는다.
- `판단 필요`인 줄에는 조심스러운 쪽으로 가정했을 때의 등급을 함께 적는다.
- "확인 못 함"인 규범은 통과로 쓰지 않는다. 그 규범에만 기대는 줄은 Medium 아래로 내리지 않는다.
- 수익 여부(F-04)가 미결인 동안, 비상업 조건이 붙은 줄은 "수익 없음"으로 가정하지 않고 `판단 필요`로 적는다.

### BL-0016 유튜브 표시 방식의 판정 (가림, 최소 크기, 브랜딩)

T08이 구현된 화면에서 아래를 재서 판정한다. 근거 조항은 다음 절의 YT 줄이다.

| 볼 것 | 무엇으로 판정하나 | 어긋나면 |
| --- | --- | --- |
| 최소 크기 | 플레이어 iframe의 배치 크기(CSS 폭과 높이)가 200×200px 이상인가. 권장은 480×270px 이상. 3D 변환 뒤 화면에 비친 사각형(`getBoundingClientRect`)의 크기도 함께 적는다 | 배치 크기가 200×200px 미만이면 High. 비친 크기만 미만이면 `판단 필요`(U-08) |
| 가림(DOM) | 플레이어의 사각형 위에 다른 DOM 요소(상태 표시, 버튼, 안내문, 닉네임 표지, Full Mode의 닫기 버튼)가 겹치는가. 사각형의 교차나 `elementsFromPoint`로 잰다. 3D 배치와 Full Mode 둘 다 잰다 | 겹치면 High(YT-05) |
| 가림(3D) | WebGL 캔버스가 플레이어 위에 놓이고 트러스·아바타가 영상 위에 그려지는 구조(F-15)다 | `판단 필요`(U-07). 조심스러운 쪽 가정에서는 High |
| 컨트롤과 링크 | 3D 배치에서 플레이어가 포인터를 받지 않아(F-15) 컨트롤, 제목 링크, 유튜브 로고를 누를 수 없다. Full Mode에서는 컨트롤과 링크가 보이고 눌리는가 | 3D 배치는 `판단 필요`(U-07). Full Mode에서 눌리지 않으면 High(YT-06, YT-07) |
| 브랜딩 | 플레이어 안의 유튜브 로고, 제목, 링크를 CSS·마스크·잘라내기로 숨기지 않았는가. iframe 전체가 스크린 면 안에 들어오는가(가장자리가 잘리지 않는가). 문서에 없는 방법으로 플레이어의 겉모습을 바꾸지 않았는가 | 숨기거나 잘랐으면 High(YT-06, YT-07) |
| 자동 재생 | 자동 재생이 시작될 때 플레이어가 화면에 보이고 절반 넘게 보이는가. 한 화면에서 자동 재생하는 플레이어가 하나뿐인가 | 어긋나면 High(YT-08). 카메라가 스크린을 등질 때 시작되는 경우는 `판단 필요`(U-07) |
| 배경 재생 | 플레이어가 화면에 보이지 않을 때(카메라가 스크린을 보지 않을 때, 기존 그림으로 바뀐 뒤) 소리가 계속 나는가 | `판단 필요`(U-07). 탭 안에 플레이어 DOM이 없는데 소리가 나면 High(YT-09) |
| 소리 | 영상의 소리를 다른 소리로 바꾸거나 따로 뽑아 가공하는가. 관중 효과음과 함께 나는 것은 사실로 적는다 | 바꾸거나 뽑으면 High(YT-10) |
| 광고 | 유튜브가 붙인 광고를 막거나, 가리거나, 건너뛰게 만드는 코드가 있는가 | 있으면 High(YT-11) |
| 플레이어 조작 | 문서에 있는 파라미터와 함수(`start`, `loadVideoById`의 `startSeconds`, `mute`, `unMute` 같은 것)만 쓰는가 | 문서에 없는 조작이면 High(YT-06) |
| Referer | 페이지가 `Referrer-Policy`나 `noreferrer`로 Referer를 지우지 않는가. `file://`로 열지 않고 서버 주소로 여는가 | 지우면 High(YT-13) |
| 영상의 전달 | 영상과 소리를 내려받거나, 캔버스로 복사하거나, PeerJS로 다른 사람에게 보내는 코드가 없는가 | 있으면 High(YT-03, LAW-01) |
| 막힌 영상 | 임베드가 막혔거나 방송이 없을 때 우회하지 않고 기존 스크린 그림과 안내를 보이는가(BL-0016 수락 기준 2·5) | 우회하면 High(YT-03) |

### 조항과 판정 기준

원문은 위 `## 적용 규범`의 주소에서 2026-11-12에 받은 문장이다. 담당: T08 = `riot-policy-reviewer`, T09 = `legal-reviewer`.

| 기준 ID | 종류 | 원문(문서, 위치) | 서비스에서 걸리는 지점 | 판정 기준 | 담당 |
| --- | --- | --- | --- | --- | --- |
| RIOT-01 | 허락 | "…grants you a personal, non-exclusive, non-sublicenseable, non-transferable, revocable, limited license for you to use, display and create derivative works based upon Riot’s IP, strictly for noncommercial (except as specifically provided below) community use." (N-R1, 1절) | Riot의 지식재산을 쓰는 모든 곳. 수익(F-04) | 수익·결제·법인의 관여가 없다는 사실이 확정돼야 허락의 범위 안이다. 수익이 미결인 동안은 `판단 필요` | T08 |
| RIOT-02 | 금지 | "You may not create commercial Projects, including any Project that crowdsources any portion of its funding, any Project that involves a business or legal entity, or any Project where you gate the content with a paywall (e.g., Patreon, YouTube Premium, etc.) without a written license agreement from us." (N-R1, 2절) | 수익(F-04), 운영 주체(F-03) | 결제 코드, 유료 입장, 크라우드펀딩, 법인 운영이 없다. 하나라도 생기면 High | T08 |
| RIOT-03 | 금지 | "We prohibit the use of our IP in games and apps. Please do not take any part of our IP (e.g., character appearance, character abilities, maps, icons, items, etc.) and use it in a game or app." (N-R1, 3절) | 웹 3D 공간 자체(F-21, F-22), 모니터 화면(F-19) | 먼저 Riot의 지식재산(캐릭터의 모습, 스킬, 맵, 아이콘, 아이템)이 장면·자산·모니터 화면에 들어 있는지를 자산 목록과 화면으로 본다. 없으면 이 줄은 걸리지 않는다. 있으면 "games and apps"에 드는지가 미결(U-01)이므로 `판단 필요` | T08 |
| RIOT-04 | 금지 | "Don’t just rip off or add some light commentary to existing content (e.g., esports matches, other players’ vods)." (N-R1, 4절) | 재방 영상이 LCK 채널의 대회 하이라이트다(F-13) | 영상을 내려받거나 다시 올리지 않고 유튜브 공식 플레이어로만 보인다는 것을 코드로 확인한다. 임베드해 트는 것이 이 문장에 드는지는 정책이 답하지 않는다(U-05) → `판단 필요` | T08 |
| RIOT-05 | 금지 | "You may not use a third party’s IP in your Project without their permission." (N-R1, 4절) | GEN.G·BLG의 이름·로고·유니폼(F-18), Barclays Center(F-17), SBS 뉴스 영상(F-13) | 제3자의 것마다 허락의 기록이 있는가. 기록이 없는 실제 로고·저지 그림을 연결하면 High. 이름 글자만 쓰는 것은 `판단 필요`(U-10) | T08, T09 |
| RIOT-06 | 금지 | "Unless you have a written license agreement with us, you may not use any of our logos or trademarks anywhere in your Project or on any website, advertising material, video, or other publication." 그리고 "You may not use our trademarks or names related to our IP as keywords or internet search tags." (N-R1, 5절) | "WORLDS 2026" 제목과 머리말(F-17), 장면 안의 WORLDS 표지, 모니터 화면의 글자 | Riot·리그 오브 레전드·공식 대회의 로고 그림이 화면·자산에 있으면 High(서면 허락의 기록이 없을 때). "WORLDS" 같은 글자 표지가 "trademarks"에 드는지는 `판단 필요`(U-10). 메타 태그와 검색 키워드에 상표가 있으면 High | T08 |
| RIOT-07 | 표시 | "If you share your Project with others, please conspicuously include the following notice (e.g., on your Project’s website):" (N-R1, 6절). 문구는 `## 반드시 표시할 문구` | 다른 사람과 공유하는 때(F-02). 초대 URL(BL-0021) | 지금(로컬, 혼자)은 조건이 충족되지 않는다. 다른 사람이 들어오게 되는 때에 고지문이 원문 그대로, 잘 보이는 자리에 있는가. 그때 없으면 High. 어디부터가 "share"인지는 U-04. Riot의 자산을 쓰지 않을 때 이 문구가 맞는지는 U-13 | T08 |
| RIOT-08 | 금지 | "If we deny you the right to use our IP, you must stop developing, publishing, or distributing your Project immediately." (N-R1, 1절) | 공개한 뒤의 운영 | 공개하게 되면, 중단 요구를 받았을 때 내리는 절차가 운영 문서에 있는가. 지금은 해당 없음 | T08 |
| RIOT-09 | 금지 | "You also agree that unless we grant you a license, in a written contract signed by us, you may never use any of our trademarks, service marks, trade names, logos, domain names, taglines, or trade dress." (N-R3, 지식재산 절. 절 번호는 확인하지 않았다) | RIOT-06과 같은 지점. "trade dress"는 모니터 화면의 닮음(F-19)에도 닿는다 | RIOT-06과 함께 본다. 모니터 화면이 게임의 겉모습을 얼마나 닮았는지는 `판단 필요`(U-11) | T08 |
| RIOT-10 | 금지(사용자 결정) | 브리프 결정 22: 실제 게임 화면은 사용자가 파일을 주고 Riot 정책 검토를 통과한 뒤에만 쓴다 | 모니터 화면의 소스(F-19) | 모니터 화면의 소스가 직접 만든 그림인가. 게임 화면의 캡처, 게임의 UI 자산, 아이콘, 맵 그림이 0건인가. 검토 통과 전에 하나라도 있으면 High | T08 |
| RIOT-11 | 조건부 | "Do not create or develop games utilizing Riot’s Intellectual Property (IP)", "Products cannot closely resemble Riot’s games or products in style or function" (N-R4, Core Policies) | Riot API를 쓰게 되면 | 코드에 Riot API 호출과 키가 없다(F-11). 없으면 해당 없음. 쓰게 되면 N-R4, N-R5, N-R7을 다시 열어 이 표에 줄을 더한다 | T08 |
| YT-01 | 허락 | "귀하는 개인적, 비영리적 용도로 콘텐츠를 보고 들을 수 있습니다. 귀하는 내장가능한 YouTube 플레이어를 통해 YouTube 동영상을 표시할 수도 있습니다." (N-Y7, 서비스 이용 시 허용되는 사항 및 제한사항) | 스크린과 Full Mode(F-12, F-16) | 유튜브 공식 임베드 플레이어로만 영상을 보인다 | T08 |
| YT-02 | 금지 | "개인적, 비영리적 용도 외의 목적으로 콘텐츠를 보거나 듣기 위해 서비스를 사용하면 안 됩니다(예를 들어, 공개적으로 서비스의 동영상을 상영하거나, 음악을 스트리밍하면 안 됩니다)." (N-Y7, 같은 절) | 같은 방 사람들이 같은 영상을 같은 위치로 본다(F-14). 수익(F-04) | 각자의 브라우저가 유튜브에서 직접 받는다는 것을 코드로 확인한다. 여럿이 가상 공간에서 함께 보는 것이 "공개적으로 상영"에 드는지는 약관이 답하지 않는다(U-09) → `판단 필요`. 수익이 생기면 다시 본다 | T08, T09 |
| YT-03 | 금지 | "(a) 서비스의 명시적 승인, 또는 (b) YouTube 및 해당하는 경우 각 권리 소유자의 사전 서면 승인을 받은 경우를 제외하고는, 서비스나 콘텐츠의 어떤 부분에 대해서도 액세스, 복제, 다운로드, 배포, 전송, 방송, 표시, 판매, 라이선스 부여, 변경, 수정 또는 그 밖의 사용을 금지합니다." (N-Y7, 같은 절) | 영상을 텍스처로 옮기거나 다른 사람에게 보내는 구현 | 내려받은 영상 파일, 프레임을 캔버스로 복사하는 코드, 영상·소리를 PeerJS로 보내는 코드가 0건이다. 있으면 High | T08 |
| YT-04 | 표시(크기) | "Embedded players must have a viewport that is at least 200px by 200px. If the player displays controls, it must be large enough to fully display the controls without shrinking the viewport below the minimum size. We recommend 16:9 players be at least 480 pixels wide and 270 pixels tall." (N-Y3, Embedded YouTube Player size. N-Y4에도 같은 문장) | 스크린 면의 플레이어(F-15) | 위 "최소 크기" 줄 | T08 |
| YT-05 | 금지(가림) | "You must not display overlays, frames, or other visual elements in front of any part of a YouTube embedded player, including player controls. Similarly, you must not use overlays, frames or other visual elements to obscure any part of an embedded player, including player controls." (N-Y3, Overlays and frames) | 캔버스가 플레이어 위(F-15), 상태 표시와 버튼, Full Mode의 닫기 버튼 | 위 "가림(DOM)", "가림(3D)" 줄 | T08 |
| YT-06 | 금지(변경) | "You must not make changes to the YouTube player that are not explicitly described by the API documentation." (N-Y3, YouTube Player attributes). "modify, build upon, or block any portion or functionality of a YouTube player;" (N-Y2, III.I의 금지 목록) | CSS3D 변환, 포인터 차단(F-15) | 위 "컨트롤과 링크", "브랜딩", "플레이어 조작" 줄. 3D 변환과 포인터 차단이 이 문장에 드는지는 U-07 | T08 |
| YT-07 | 표시(브랜딩) | "You and your API Clients must not, and must not encourage, enable or require others to, directly or indirectly, interfere with or obscure any attribution provided by YouTube, including attribution provided via or shown in embedded YouTube players. Your API Clients must display applicable YouTube Brand Features and any other YouTube-provided attribution on all types of devices." (N-Y2, III.F). "For example, you must not remove, obscure, alter, or disable any links that appear in YouTube players or in API Data." (N-Y2, III.I). "Make sure the logo is fully and clearly visible. It must not be altered or partially covered." (N-Y6) | 플레이어 안의 유튜브 로고·제목·링크 | 위 "브랜딩", "컨트롤과 링크" 줄 | T08 |
| YT-08 | 금지(자동 재생) | "However, an API Client must not initiate an automatic playback until the player is visible and more than half of the player is visible on the page or screen." 그리고 "A page or screen must not have more than one YouTube player that automatically plays content simultaneously." (N-Y3, Autoplay and scripted playbacks) | 처음에 소리 없이 자동 재생(F-15), 플레이어 하나(F-12) | 위 "자동 재생" 줄 | T08 |
| YT-09 | 금지(배경 재생) | "create, include, or promote features that play content, including audio or video components, from a background player, meaning a player that is not displayed in the page, tab, or screen that the user is viewing;" (N-Y2, III.I의 금지 목록) | 카메라가 스크린을 보지 않을 때의 소리 | 위 "배경 재생" 줄 | T08 |
| YT-10 | 금지(소리) | "separate, isolate, or modify the audio or video components of any YouTube audiovisual content made available as part of, or in connection with, YouTube API Services. For example, you must not apply alternate audio tracks to videos;" (N-Y2, III.I의 금지 목록) | 영상의 소리와 관중 효과음 | 위 "소리" 줄 | T08 |
| YT-11 | 금지(광고) | "modify, interfere with, replace, or block advertisements placed or served by YouTube or by YouTube API Services including in API Data, YouTube audiovisual content, or YouTube players;" (N-Y2, III.I의 금지 목록) | `start`로 위치를 강제로 맞춤(F-14), 가림 | 위 "광고" 줄 | T08 |
| YT-12 | 금지(수익) | "API Clients must not charge users to watch content in an embedded YouTube player." (N-Y2, III.F의 Playback Integrity). "sell advertising, sponsorships, or promotions that are placed on or within YouTube audiovisual content or the YouTube player without YouTube's prior written approval;" (N-Y2, III.G) | 수익(F-04) | 영상을 보는 데 돈을 받지 않는다. 플레이어나 영상 위에 광고·후원을 얹지 않는다. 수익이 미결인 동안은 `판단 필요`. 유료 입장이 생기면 High | T08 |
| YT-13 | 표시(식별) | "API Clients that use the YouTube embedded player (including the YouTube IFrame Player API) must provide identification through the HTTP Referer request header." 그리고 "… API Clients must not use the noreferrer feature, which suppresses the Referer value." (N-Y3, API Client Identity and Credentials) | 로컬 서버로 여는 페이지(F-21) | 위 "Referer" 줄 | T08 |
| YT-14 | 동의(조건부) | "Each API Client will provide and adhere to a published privacy policy that clearly and accurately describes to its users what user information you and your API Client access, collect and store, and how and why you and your API Client use, process, and share such information (including for advertising) with us and other third parties." (N-Y1, 7절). "Each API Client must require users to agree to a privacy policy before users can access the API Client's features and functionality." (N-Y2, III.A). "When your API Client loads, it collects and shares some basic user data with YouTube via the YouTube embedded player …" (N-Y2, III.E) | 다른 사람이 쓰게 되는 때(F-02). 플레이어가 뜨면 보는 사람의 기본 정보가 유튜브로 간다 | 지금(로컬, 혼자)은 Medium(조건이 바뀌면 어긋난다). 임베드 플레이어만 쓰는 사이트가 이 의무를 지는지는 U-15. 공개하면 처리방침과 동의 화면이 있는가 | T09 |
| YT-15 | 허락 | "This parameter causes the player to begin playing the video at the given number of seconds from the start of the video." (N-Y5, `start`) | 재방 위치 맞춤(F-14) | `start`나 문서에 있는 함수로만 위치를 맞춘다 | T08 |
| LAW-01 | 금지 | 저작권법 제18조 "저작자는 그의 저작물을 공중송신할 권리를 가진다." 제2조제7호 "“공중송신”은 저작물, 실연ㆍ음반ㆍ방송 또는 데이터베이스(이하 “저작물등”이라 한다)를 공중이 수신하거나 접근하게 할 목적으로 무선 또는 유선통신의 방법에 의하여 송신하거나 이용에 제공하는 것을 말한다." | 영상, 그림, 음원을 서버에 올리거나 남에게 보내는 쓰임. 다음 phase의 호스팅 | 서비스가 영상을 송신하지 않고 각자의 브라우저가 유튜브에서 받는 구조인지 코드로 확인한다. 남의 저작물(게임 화면, 로고 그림, 음원)을 `web/`에 넣어 호스팅하게 되면 다시 본다. 임베드의 법적 평가는 `판단 필요` | T09 |
| LAW-02 | 허락 | 저작권법 제30조 "공표된 저작물을 영리를 목적으로 하지 아니하고 개인적으로 이용하거나 가정 및 이에 준하는 한정된 범위 안에서 이용하는 경우에는 그 이용자는 이를 복제할 수 있다." | 로컬 개인 사용(F-01) | 남의 저작물을 복제해 쓴 곳마다, 근거가 이 조항뿐인지를 적는다. 근거가 이 조항뿐인 쓰임은 지금 Medium(공개하면 범위를 벗어난다), 공개하면 High | T09 |
| LAW-03 | 허락(사람이 판단) | 저작권법 제35조의5 제1항 "… 저작물의 일반적인 이용 방법과 충돌하지 아니하고 저작자의 정당한 이익을 부당하게 해치지 아니하는 경우에는 저작물을 이용할 수 있다." 제2항 각 호: 이용의 목적 및 성격, 저작물의 종류 및 용도, 이용된 부분이 저작물 전체에서 차지하는 비중과 그 중요성, 저작물의 이용이 그 저작물의 현재 시장 또는 가치나 잠재적인 시장 또는 가치에 미치는 영향 | 정책이 허락하지 않거나 답하지 않는 쓰임(모니터의 닮은 화면, 표지) | 네 칸을 사실로 채워 `판단 필요`로 올린다. 검토자는 결론을 내지 않는다 | T09 |
| LAW-04 | 금지 | 상표법 제108조제1항제1호 "타인의 등록상표와 동일한 상표를 그 지정상품과 유사한 상품에 사용하거나 타인의 등록상표와 유사한 상표를 그 지정상품과 동일ㆍ유사한 상품에 사용하는 행위" | GEN.G, BLG, Barclays Center, WORLDS, League of Legends의 글자와 로고(F-17~F-19) | 쓰이는 이름과 로고를 모두 목록으로 만든다. 등록 여부와 충돌은 이 검토에서 확정하지 않는다. "충돌 위험"으로 적고 `판단 필요` | T09 |
| LAW-05 | 금지 | 부정경쟁방지법 제2조제1호 가목 "… 국내에 널리 인식된 타인의 성명, 상호, 상표, 상품의 용기ㆍ포장, 그 밖에 타인의 상품임을 표시한 표지(標識)… 와 동일하거나 유사한 것을 사용하거나 이러한 것을 사용한 상품을 판매ㆍ반포(頒布) 또는 수입ㆍ수출하여 타인의 상품과 혼동하게 하는 행위". 나목(영업표지의 혼동)과 다목(식별력이나 명성의 손상)은 문장의 앞부분만 확인했다 | 공식으로 보일 표시: "WORLDS 2026", "GRAND FINAL", 팀 이름, 경기장 이름(F-17) | 공식이거나 제휴한 것으로 보일 표시를 목록으로 만든다. "비공식", "팬 제작"의 고지가 있는지 적는다. 공개 상태에서 공식으로 오인될 표시면 High, 로컬에서는 Medium | T09 |
| LAW-06 | 금지 | 부정경쟁방지법 제2조제1호 타목 "국내에 널리 인식되고 경제적 가치를 가지는 타인의 성명, 초상, 음성, 서명 등 그 타인을 식별할 수 있는 표지를 공정한 상거래 관행이나 경쟁질서에 반하는 방법으로 자신의 영업을 위하여 무단으로 사용함으로써 타인의 경제적 이익을 침해하는 행위" | 선수의 이름·초상(프로게이머 자리의 캐릭터, 유니폼의 이름) | 실제 사람의 이름, 사진, 닮게 만든 모습이 드러나는 곳을 목록으로 만든다. 0건이면 해당 없음. 있으면 근거(허락의 기록)를 옆에 적고, 없으면 발견이다. "자신의 영업을 위하여"는 수익(F-04)에 달려 `판단 필요` | T09 |
| LAW-07 | 금지 | 부정경쟁방지법 제2조제1호 파목 "그 밖에 타인의 상당한 투자나 노력으로 만들어진 성과 등을 공정한 상거래 관행이나 경쟁질서에 반하는 방법으로 자신의 영업을 위하여 무단으로 사용함으로써 타인의 경제적 이익을 침해하는 행위" | 대회 중계 영상을 서비스의 중심에 두는 쓰임(F-13), 경기장의 재현(F-17) | 사실만 정리해 `판단 필요`로 올린다. 해석의 폭이 넓은 조항이다 | T09 |
| LAW-08 | 동의(조건부) | 개인정보 보호법 제2조제5호 "“개인정보처리자”란 업무를 목적으로 개인정보파일을 운용하기 위하여 스스로 또는 다른 사람을 통하여 개인정보를 처리하는 공공기관, 법인, 단체 및 개인 등을 말한다." 제28조의8제1항 "개인정보처리자는 개인정보를 국외로 제공(조회되는 경우를 포함한다)ㆍ처리위탁ㆍ보관(이하 이 절에서 “이전”이라 한다)하여서는 아니 된다. 다만, 다음 각 호의 어느 하나에 해당하는 경우에는 개인정보를 국외로 이전할 수 있다." 제15조(수집ㆍ이용), 제17조(제공), 제26조(업무위탁), 제30조(처리방침)는 조 제목과 첫 문장만 확인했다 | 닉네임, 위치, IP 주소, peer id(F-08, F-09). 방 id 목록(F-07). PeerJS Cloud, Google STUN, 유튜브로 가는 정보 | 코드가 모으고, 저장하고, 밖으로 보내는 항목을 표로 만든다(저장 0건인지 포함). 로컬 개인 사용이 "업무를 목적으로"에 드는지는 U-12 → `판단 필요`. 다른 사람이 쓰게 되면 처리방침, 동의, 국외 이전의 고지가 있는가 | T09 |
| LAW-09 | 조건부 | 정보통신망법 제2조제1항제3호 "“정보통신서비스 제공자”란 「전기통신사업법」 제2조제8호에 따른 전기통신사업자와 영리를 목적으로 전기통신사업자의 전기통신역무를 이용하여 정보를 제공하거나 정보의 제공을 매개하는 자를 말한다." | 수익(F-04) | 영리 목적이 없으면 해당 없음으로 적고 그 근거(F-04)가 미결임을 함께 적는다 | T09 |
| LAW-10 | 조건부 | 게임산업법 제2조제1호 "“게임물”이라 함은 컴퓨터프로그램 등 정보처리 기술이나 기계장치를 이용하여 오락을 할 수 있게 하거나 이에 부수하여 여가선용, 학습 및 운동효과 등을 높일 수 있도록 제작된 영상물 또는 그 영상물의 이용을 주된 목적으로 제작된 기기 및 장치를 말한다." | 3D 공간의 기능(F-22) | 게임으로 볼 요소를 기능 목록에 표시한다. 결론을 내지 않고 `판단 필요`(U-16) | T09 |
| EXT-01 | 허락 | "No trademark or patent rights held by Affirmer are waived, abandoned, surrendered, licensed or otherwise affected by this document." (N-E3, 4.a) | CC0 자산 안에 든 남의 로고나 상표 | 자산마다 출처 표의 줄(무엇, 파일, 출처, 이용 조건, 확인 상태)이 있고 빈칸이 0이다. CC0여도 그 안의 상표는 따로 본다. 대조는 끝 검토 | T09 |
| EXT-02 | 허락 | "Every sound published on SFXMint is dedicated to the public domain under the Creative Commons CC0 1.0 Universal dedication." (N-E4) | `web/audio-sources.md`의 효과음 3개 | 세 효과음이 공개 목록의 것인지(계정으로 만든 소리가 아닌지) 주소로 대조한다. 대조는 끝 검토 | T09 |
| EXT-03 | 기록 | 이용 조건의 문서를 찾지 못했다(N-E1, N-E2) | PeerJS Cloud, Google STUN | 조건을 확인하지 못했으므로 통과로 쓰지 않는다. Medium으로 적고 U-14로 넘긴다 | T09 |

## 반드시 표시할 문구

원문 페이지에서 그대로 복사해 쓴다. 띄어쓰기와 따옴표의 모양도 원문을 따른다.

| 문구(원문 그대로) | 근거 | 표시할 조건과 자리 |
| --- | --- | --- |
| [The title of your Project] was created under Riot Games' "Legal Jibber Jabber" policy using assets owned by Riot Games. Riot Games does not endorse or sponsor this project. | N-R1, 6절 | 조건: "If you share your Project with others". 자리: "conspicuously", "(e.g., on your Project’s website)" |
| [본인 프로젝트의 이름]은 라이엇 게임즈의 “지식재산 이용 정책”에 따라 라이엇 게임즈 소유의 자산을 이용하여 제작되었습니다. 라이엇 게임즈는 이 프로젝트를 지지하거나 후원하지 않습니다. | N-R2, 6절 | 조건: "자신의 프로젝트를 타인과 공유하는 경우". 자리: "(프로젝트의 웹사이트 등에) 잘 보이게" |
| [Your product] isn't endorsed by Riot Games and doesn't reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties. Riot Games, and all associated properties are trademarks or registered trademarks of Riot Games, Inc. | N-R4, Core Policies | 조건: Riot API를 쓰는 제품일 때만. 지금은 해당 없음(F-11). 자리: "in a location that is readily visible to players" |

지금(로컬, 혼자)은 첫 두 문구의 조건이 충족되지 않는다. Riot의 자산을 쓰지 않을 때 이 문구를 붙이는 것이 맞는지는 U-13이다.

## 미결

규범이 뜻을 정하지 않았거나 사실이 정해지지 않은 것이다. 답을 지어내지 않는다. 걸린 줄은 `판단 필요`로 적는다.

| ID | 쟁점 | 왜 갈리는가 | 정해질 때까지의 처리 | 누가 정하나 |
| --- | --- | --- | --- | --- |
| U-01 | 웹 3D 공간이 Riot 팬 정책 3절의 "games and apps"에 드는가 | 정책이 두 말을 정의하지 않는다. 캐릭터가 돌아다니고 상호작용하는 웹 공간이 어디에 드는지 답이 없다 | 드는 것으로 보고 Riot의 지식재산(캐릭터의 모습, 스킬, 맵, 아이콘, 아이템)을 장면과 모니터 화면에 넣지 않는다 | 사용자, 전문가(필요하면 Riot에 문의할지는 사용자가 정한다) |
| U-02 | 수익 여부 | 브리프에 결정이 없다. 비상업 조건(RIOT-01·02, YT-02·12, LAW-06·07·09)의 판정이 여기에 달렸다 | "수익 없음"으로 가정하지 않는다. 걸린 줄은 `판단 필요`. 결제·광고·후원의 코드를 넣지 않는다 | 사용자 |
| U-03 | 방 id 목록을 둘 곳(서비스·DB) | 정하지 않았다. Vercel은 후보일 뿐이다. 무엇을 함께 저장하는지(닉네임, IP, 시각)에 따라 LAW-08이 달라진다 | 이번 phase는 저장하지 않는다. BL-0022 설계 문서에 후보를 적을 때 저장 항목을 방 id만으로 적는다 | 사용자 |
| U-04 | 공개와 공유의 시점과 범위 | 이번 phase는 로컬이지만 방향은 "여러사람이 쓰게할서비스"다. 초대 URL로 다른 사람이 들어오는 순간이 "share your Project with others"인지 정책이 말하지 않는다 | 다른 사람이 들어올 수 있게 되는 때를 공유의 시작으로 본다. 그 전에 법무 끝 검토의 "공개하면" 등급을 다시 본다 | 사용자 |
| U-05 | 대회 영상(LCK 채널의 하이라이트)을 임베드해 스크린에 트는 것이 팬 정책 4절에 드는가 | 4절은 기존 콘텐츠를 "rip off"하지 말라고 하지만 공식 채널의 영상을 공식 플레이어로 임베드하는 것은 말하지 않는다. 공동 중계와 다시 보기의 규칙(N-R8)은 확인 못 함이다 | 영상을 내려받거나 다시 올리지 않고 공식 플레이어로만 보인다. 주소는 설정값으로 두어 바꿀 수 있게 한다 | 사용자, 전문가 |
| U-06 | 생방송 주소가 가리키는 영상 | 2026-11-12에 oEmbed로 본 결과 SBS 뉴스 채널의 뉴스 영상이다. e스포츠 방송이 아니다. 시험용 주소인지 최종 주소인지 알 수 없다 | 시험용으로만 쓴다. 최종 주소를 고정하기 전에 사용자에게 확인한다. 권리자가 방송사이므로 Riot 정책이 아니라 유튜브 조건과 저작권법의 줄로 본다 | 사용자 |
| U-07 | 3D 배치가 유튜브의 플레이어 조건에 드는가: 캔버스가 플레이어 위에 놓임, 3D 물체가 영상을 가림, 원근 변환, 포인터 차단, 카메라가 스크린을 보지 않을 때의 재생 | Required Minimum Functionality와 Developer Policies는 평면 페이지를 전제로 쓰였다. 3D 공간에 놓는 것을 말하지 않는다. 문언("in front of any part", "block any portion or functionality", "not displayed in the page, tab, or screen")은 넓다 | 조심스러운 쪽: Full Mode에서는 플레이어 위에 아무것도 두지 않고 컨트롤과 링크가 눌리게 한다. 3D 배치의 구조는 `판단 필요`로 사용자에게 올린다 | 사용자, 전문가(필요하면 유튜브에 문의할지는 사용자가 정한다) |
| U-08 | 최소 크기 200×200px의 기준이 배치 크기인가, 3D 변환 뒤 화면에 비친 크기인가 | 문서는 "viewport"라고만 한다. 멀리서 보면 비친 크기가 작아진다 | 두 크기를 모두 재서 적는다. 배치 크기는 반드시 200×200px 이상으로 둔다. 비친 크기가 미만인 경우는 `판단 필요` | 사용자, 전문가 |
| U-09 | 같은 방 사람들이 같은 영상을 같은 위치로 함께 보는 것이 유튜브 약관의 "공개적으로 서비스의 동영상을 상영"에 드는가 | 약관은 각자의 플레이어로 맞춰 보는 것을 말하지 않는다 | 영상과 소리를 다른 사람에게 보내지 않는 구조를 지킨다. 걸린 줄은 `판단 필요` | 사용자, 전문가 |
| U-10 | GEN.G, BLG, Barclays Center, WORLDS의 글자 표지와 로고, 유니폼 그림을 써도 되는가 | 권리자의 공개 정책을 확인하지 못했다(N-E5). 글자 표지가 Riot 정책 5절의 "trademarks"나 상표법의 "사용"에 드는지 이 검토로 확정할 수 없다. 허락의 기록이 없다 | 실제 로고와 저지 그림은 연결하지 않는다(로고 없는 팀 색 임시 유니폼, 설계서 6.4). 이미 있는 글자 표지는 목록으로 만들어 `판단 필요`로 올린다. 바꿀지는 사용자가 정한다 | 사용자, 전문가 |
| U-11 | 모니터의 "리그 오브 레전드와 비슷한 화면"이 어디까지 닮아도 되는가 | 닮음의 기준이 정책에 없다. 팬 정책 3절은 맵·아이콘·아이템을 들고, 서비스 약관은 "trade dress"를 든다 | 게임의 캡처, UI 자산, 아이콘, 맵 그림을 쓰지 않고 직접 만든 그림만 쓴다. 닮음의 정도는 화면을 붙여 `판단 필요`로 올린다 | 사용자, 전문가 |
| U-12 | 로컬 개인 사용에서 이 서비스를 돌리는 사람이 "개인정보처리자"인가. PeerJS Cloud와 STUN으로 가는 IP 주소와 peer id가 국외 이전인가 | 정의는 "업무를 목적으로"를 요건으로 한다. 여러 사람이 쓰게 되면 달라질 수 있다. 두 서비스의 서버 위치와 보관 여부를 확인하지 못했다 | 닉네임은 자동 부여로 두고 사람을 알아볼 정보를 받지 않는다. 저장하지 않는다. 공개 전에 다시 본다 | 전문가 |
| U-13 | Riot의 자산을 쓰지 않는다면 팬 정책 6절의 고지문("using assets owned by Riot Games")을 붙이는 것이 맞는가 | 고지문은 Riot의 자산을 쓴 프로젝트를 전제로 한 문장이다 | 공유하게 되는 때에, T08의 자산 목록에 Riot의 지식재산이 있으면 붙인다. 없으면 `판단 필요` | 사용자 |
| U-14 | PeerJS Cloud와 Google STUN의 이용 조건 | 약관과 개인정보 문서를 찾지 못했다. PeerJS 문서는 "For production, you can host your own."라고 한다 | 통과로 쓰지 않는다. 여러 사람이 쓰게 되기 전에 조건을 다시 찾거나 직접 운영을 검토한다 | 사용자 |
| U-15 | 임베드 플레이어만 쓰는 사이트가 "API Client"로서 개인정보 처리방침과 동의의 의무(YT-14)를 지는가 | 약관의 정의는 Data API 같은 서비스를 예로 들고, Required Minimum Functionality는 임베드 플레이어를 쓰는 쪽을 API Client라고 부른다 | 공개하게 되면 지는 것으로 보고 준비한다. 지금은 Medium으로 적는다 | 전문가 |
| U-16 | 이 3D 공간이 게임산업법의 "게임물"인가 | 요소(점수, 승패, 보상)에 따라 갈린다. 지금은 그런 요소가 사실 표에 없다 | 점수·보상·경쟁을 더하게 되면 다시 본다 | 전문가 |

## 다시 확인할 때

| 규범 | 다시 확인할 조건 | 마지막 확인일 |
| --- | --- | --- |
| N-R1 ~ N-R3 | 페이지의 개정일이 바뀜. 실제 게임 화면이나 Riot의 자산을 쓰게 됨. 다른 사람과 공유하게 됨 | 2026-11-12 |
| N-R4, N-R5, N-R7 | Riot API를 쓰게 됨 | 2026-11-12(N-R7은 확인 못 함) |
| N-R6, N-R8 | 대회 영상의 주소를 고정함. 대회 기간이 시작됨. 대회를 열게 됨 | 2026-11-12(N-R8은 확인 못 함) |
| N-Y1 ~ N-Y7 | 개정 이력(N-Y8)에 새 줄이 생김. 플레이어의 배치 방식이 바뀜. 수익이 생김. 공개하게 됨 | 2026-11-12 |
| N-E1, N-E2 | 여러 사람이 쓰게 됨. 연결 방식이 바뀜(TURN, 직접 운영) | 확인 못 함 |
| N-E3, N-E4 | 새 자산이나 효과음을 더함. 끝 검토 | 2026-11-12 |
| N-E5 | 실제 팀 이름·로고·저지 그림을 연결하려 함 | 확인 못 함 |
| N-L1 ~ N-L6 | 법의 개정이 시행됨. 수익, 로그인, 결제, 채팅, 저장, 호스팅이 더해짐 | 2026-11-12 |
| N-L7 | 약관, 결제, 광고, 나이 제한이 생김 | 확인 못 함 |
| 사실 표 | 브리프의 `## 사용자 결정`이 바뀜. 영상 주소가 바뀜(F-13은 oEmbed로 다시 본다) | 2026-11-12 |

## 결정 필요

| ID | 정할 것 | 후보 | 추천 | 사용자 결정인가, 전문가 확인인가 |
| --- | --- | --- | --- | --- |
| D-1 | 수익 여부(U-02) | 없음 / 광고만 / 후원·결제 | 없음으로 정하면 비상업 조건의 줄이 `판단 필요`에서 풀린다 | 사용자 결정 |
| D-2 | 생방송 주소(U-06) | 지금 주소를 시험용으로만 씀 / 최종 주소를 새로 받음 | 최종 주소를 고정하기 전에 새로 받아 oEmbed로 채널을 확인한다 | 사용자 결정 |
| D-3 | 방 id 목록의 보관처와 저장 항목(U-03) | 저장 안 함 / 방 id만 / 방 id와 그 밖의 값 | 방 id만 | 사용자 결정 |
| D-4 | 공개의 시점, 범위, 운영 주체(U-04, F-03) | 로컬만 유지 / 아는 사람에게만 / 누구에게나 | 정해지면 이 문서의 "공개하면" 등급으로 끝 검토를 다시 한다 | 사용자 결정 |
| D-5 | 팀·경기장·대회의 표지(U-10) | 그대로 둠 / 권리자의 허락을 구함 / 지어낸 이름으로 바꿈 | 제안만 한다. 승인 전에는 아무것도 바꾸지 않는다 | 사용자 결정, 전문가 확인 |
| D-6 | 3D 배치와 유튜브 조건(U-07, U-08) | 지금 설계대로 / 3D에서는 그림만 두고 영상은 Full Mode에서만 / 유튜브에 문의 | T08의 측정 결과를 본 뒤에 정한다 | 사용자 결정, 전문가 확인 |
| D-7 | 확인하지 못한 규범(N-R7, N-R8, N-E1, N-E2, N-E5, N-L7, Riot 서비스 약관 한국어판, 시행령과 고시) | 다음 검토에서 연다 / 전문가에게 맡긴다 | 걸리는 일을 하게 되기 전에 연다 | 전문가 확인 |

## 이번 phase 밖

- 약관, 처리방침, 고지문의 작성. 이 문서는 무엇이 들어가야 하는지의 요건만 적는다.
- 결제·광고·후원의 법(N-L7), 청소년 보호, 이용자가 올리는 콘텐츠의 신고와 삭제. 해당하는 기능이 지금 없다.
- 코드 의존성(Three.js r170, PeerJS)의 이용 조건 대조와 자산 출처 표의 줄 단위 대조. 끝 검토에서 한다.
- 권리자나 기관에 문의하거나 신청하는 일. 필요하면 `## 결정 필요`에서 사용자가 정한다.
