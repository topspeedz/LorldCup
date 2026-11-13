# 실측하는 법

> 읽는 시점: `web3d-performance`의 성능 점검 3단계(실측)와 7단계(오래 돌리기). 고친 뒤 다시 잴 때.

이 프로젝트의 브라우저 규칙은 `.claude/skills/qa-verification/references/browser.md`가 정본이다. 아래는 그 규칙 위에서 3D를 재는 순서다.

## 1. 재기 전에

- **성능 수치는 다른 검증이 모두 끝난 뒤 혼자 잰다.** 다른 워커가 도는 동안 잰 값은 판정에 쓰지 않는다.
- **3D 실측은 Playwright MCP로 하지 않는다.** MCP의 창 없는 브라우저는 소프트웨어로 그려 프레임이 한 자릿수로 떨어진다. `.claude/scripts/browser/launch.cjs`로 잰다.
- 먼저 그래픽 카드를 쓰는지 확인한다.

  ```sh
  node .claude/scripts/browser/probe-fps.cjs
  node .claude/scripts/browser/probe-fps.cjs --no-gpu
  ```

  판정이 `HARDWARE`이고 `--no-gpu`와 프레임 차이가 나야 한다. `SOFTWARE`면 프레임 수치를 판정에 쓰지 못한다. 재고(자산 수치)만 하고 리포트의 `## 검증`에 ❌로 적는다. `launch.cjs`의 그래픽 설정 표는 고치지 않는다(`harness-engineer`의 일이다).

## 2. 조건 고정

리포트의 `## 측정 조건`에 전부 적는다. 하나라도 다르면 앞의 수치와 비교하지 않는다.

| 조건 | 적을 것 |
| --- | --- |
| 빌드 | 실제 빌드로 띄운 서버인지. 개발 서버의 수치는 쓰지 않는다 |
| 화면 | 가로 × 세로, 픽셀 비율 |
| 주사율 | 화면의 Hz |
| 브라우저 | `launch.cjs`가 찍는 Playwright 출처와 버전, 브라우저 종류 |
| 그래픽 | `probe-fps.cjs`의 renderer 문자열과 판정 |
| 시나리오 | 어느 화면에서, 카메라가 어디를 보고, 캐릭터가 몇 명이고, 무슨 효과가 도는가 |
| 준비 시간 | 측정에서 뺀 앞부분(셰이더 컴파일과 텍스처 올리기가 끝날 때까지) |
| 횟수 | 3번 이상 |

## 3. 프레임 시간 재기

작업 폴더(`_workspace/graphicmodel/<phase>/perf/`)에 스크립트를 두고 프로젝트 루트에서 돌린다. 아래는 뼈대다. 화면 크기와 시나리오는 Task에 맞춘다.

```js
// node _workspace/graphicmodel/<phase>/perf/frame-probe.cjs <url> [초]
const { launchWithMeta, log } = require(process.cwd() + '/.claude/scripts/browser/launch.cjs');

(async () => {
  const [url, seconds = '10'] = process.argv.slice(2);
  const { browser, meta } = await launchWithMeta();
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1.5 });
    await page.goto(url, { waitUntil: 'load' });
    await page.waitForTimeout(3000); // 준비 시간: 측정에서 뺀다
    const dt = await page.evaluate((ms) => new Promise((resolve) => {
      const out = []; let last = performance.now(); const t0 = last;
      const tick = (now) => { out.push(now - last); last = now; now - t0 < ms ? requestAnimationFrame(tick) : resolve(out); };
      requestAnimationFrame(tick);
    }), Number(seconds) * 1000);
    const s = [...dt].sort((a, b) => a - b);
    const q = (p) => Number(s[Math.min(s.length - 1, Math.floor(s.length * p))].toFixed(2));
    console.log(JSON.stringify({ ...meta, url, frames: dt.length, p50: q(0.5), p95: q(0.95), max: q(1) }, null, 2));
  } finally {
    await browser.close();
  }
})().catch((e) => { log('측정 실패:', e.message); process.exit(1); });
```

- 출력은 `log()`와 결과 JSON만 쓴다. 비밀 값을 찍지 않는다.
- 같은 명령을 3번 넘게 돌려 `p50`의 가운데 값을 쓰고, 최소와 최대를 함께 적는다.
- 두 측정의 차이가 같은 조건에서 되풀이해 잰 값의 흩어짐보다 작으면 개선이라고 적지 않는다.

## 4. 드로 콜, 삼각형, 자원 수

Three.js는 렌더러가 수치를 갖고 있다: 프레임마다의 드로 콜과 삼각형, 올라가 있는 지오메트리와 텍스처의 수. 이것을 읽으려면 앱이 측정용 통로를 내줘야 한다. 통로의 이름과 켜는 방법은 아키텍처 문서가 정한다.

- 통로가 있으면 `page.evaluate`로 읽어 기준선 표에 적는다.
- 없으면 프레임 시간만 재고, "측정용 통로 없음"을 `## 코드 권고`에 적는다. 코드를 직접 고쳐 통로를 만들지 않는다.

## 5. 한계 가르기

같은 시나리오를 픽셀 비율만 절반으로 내려 다시 잰다(`deviceScaleFactor`).

| 결과 | 뜻 | 볼 곳 |
| --- | --- | --- |
| 프레임 시간이 크게 준다 | GPU 한계 | 픽셀 비율, 반투명 층, 후처리, 재질의 무게 |
| 거의 그대로다 | CPU 한계 | 드로 콜, 뼈와 애니메이션 갱신, 프레임마다 도는 스크립트 |
| 처음 몇 초만 느리다 | 준비 비용 | 셰이더 컴파일, 텍스처 올리기. 준비 시간을 늘려 다시 잰다 |

## 6. 오래 돌리기

1. 장면에 들어가 자원 수(지오메트리, 텍스처)를 적는다.
2. 장면을 나갔다 들어오기를 N번 한다(3번 이상).
3. 다시 자원 수를 적는다. 처음과 같아야 한다. 늘었으면 해제 누락이다.
4. 탭을 숨겼다 돌아온 뒤 프레임이 이어지는지, 한꺼번에 건너뛰지 않는지 본다.

## 7. 모바일을 흉내 낼 때의 한계

- 화면 크기와 픽셀 비율은 흉내 낼 수 있다. 그래픽 칩의 성능과 메모리 한도, 발열은 흉내 낼 수 없다.
- 그래서 데스크톱에서 잰 "모바일 조건" 수치는 **통과의 증거가 아니라 실패의 증거로만** 쓴다. 여기서 예산을 넘으면 실기기에서도 넘는다. 여기서 통과했다고 실기기에서 통과하는 것은 아니다.
- 리포트에 "실기기 아님"이라고 적고, 실기기 확인이 필요한 항목을 `## 남은 것`에 적는다.

## 8. 다시 잴 때

- 고치기 전과 똑같은 조건, 똑같은 시나리오, 똑같은 횟수로 잰다.
- Playwright나 브라우저 버전이 바뀌었으면 기준선부터 다시 잰다.
- 변경 하나에 측정 한 묶음이다. 변경 이력 표의 줄마다 다시 잰 값이 있어야 한다.
