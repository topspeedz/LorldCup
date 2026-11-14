"""One dimensioned schematic of the implemented geometry, no approval pause."""
import json
from pathlib import Path
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import Rectangle

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / 'temp/T93'
r = json.loads((OUT / 'geometry-changes.json').read_text())
plt.rcParams.update({'font.family': 'Malgun Gothic', 'axes.unicode_minus': False})
fig, (ax, detail) = plt.subplots(1, 2, figsize=(15, 8), gridspec_kw={'width_ratios': [1.4, 1]})
fig.set_facecolor('#f1f4f6')
t = np.linspace(0, np.pi * 2, 721)
rx, ry = 55.86, 45.86 * .9950264096260071
n = np.array([np.cos(t) / rx, np.sin(t) / ry]); n /= np.linalg.norm(n, axis=0)
inner = np.array([rx * np.cos(t), ry * np.sin(t)])
outer = inner + 5 * n
ax.fill(*outer, color='#c7ded9')
ax.fill(*inner, color='#d2dbe3')
for curve, label in ((outer, '뒤 벽·충돌 경계 (5.0 m 평행 간격)'), (inner, None)):
    boundary = curve.copy()
    portal = ((boundary[0] < -53) & (abs(boundary[1]) < 3.45)) | ((abs(boundary[1]) > 43) & (abs(boundary[0]) < 3.45))
    boundary[:, portal] = np.nan
    ax.plot(*boundary, color='#db613f', lw=2, label=label)
old = np.array([60.6 * np.cos(t), 45.6 * .9950264 * np.sin(t)])
ax.plot(*old, color='#84919e', lw=1.4, ls='--', label='기존 바깥 LED 위치')
ax.add_patch(Rectangle((-61.5, -3.383), 32.5, 6.766, color='#738ba0'))
for sign in (-1, 1):
    ax.add_patch(Rectangle((-3.383, min(sign * 19, sign * 51.5)), 6.766, 32.5, color='#738ba0'))
new = np.array([s['blender'][:2] for s in r['new_seats']])
ax.scatter(new[:, 0], new[:, 1], s=9, c='#167c91', label=f"추가 좌석 {len(new)}석 (램프별 양옆 1열)")
reserved = r.get('handoff_seats', [s for s in r['new_seats'] if s['reserved']])
for i, s in enumerate(reserved, 1):
    x, _, z = s['position']
    y = -z
    ax.scatter(x, y, s=20, c='#ecb347', zorder=6)
    detail.scatter(-y, x, s=150, c='#ecb347', edgecolors='#463a22', zorder=4)
    detail.text(-y, x, s['id'].split('-')[-1], ha='center', va='center', fontsize=8, zorder=5)
    st = s['standPosition']
    detail.plot([-y, st[2]], [x, st[0]], c='#167c91', lw=1)
detail.add_patch(Rectangle((-3.383, -61.5), 6.766, 32.5, color='#738ba0', alpha=.65))
for sign in (-1, 1):
    detail.add_patch(Rectangle((min(sign * 3.45, sign * 4.08), -61.5), .63, 31, color='#c7ded9'))
    detail.annotate('복도에서 진입', xy=(sign * 3.77, -60.9), xytext=(sign * 6.1, -60), arrowprops={'arrowstyle':'->','color':'#167c91'}, ha='center', fontsize=9)
ax.set_title('T93 · 뒤 영역의 간격 통일과 램프 주변 좌석', fontsize=15, pad=15)
detail.set_title('108·109 구역 유저 16석 · 좌우 8석', fontsize=14, pad=15)
ax.set_xlim(-70, 70); ax.set_ylim(-58, 58)
detail.set_xlim(-8, 8); detail.set_ylim(-62, -43)
for a in (ax, detail):
    a.set_aspect('equal'); a.grid(alpha=.15); a.set_facecolor('#f8fafb')
ax.legend(loc='lower center', bbox_to_anchor=(.5, -.18), fontsize=9)
fig.text(.52, .055, '중앙 램프 폭 6.766 m 유지 · 뒤 테두리의 출입구 3곳 유지\n주황: 충돌 경계 / 금색: 유저석 / 청록: 추가 좌석·옆 계단\n형상 설명도이며 실제 보행 검증 결과가 아님', fontsize=10, ha='center')
fig.subplots_adjust(bottom=.22, top=.89, wspace=.18)
fig.savefig(OUT / 'top-view.png', dpi=140)
print('T93_PLAN', OUT / 'top-view.png')
