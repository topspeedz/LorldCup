"""Plot the measured arena mesh as a plan; annotations are proposals, not geometry."""
import json
from pathlib import Path

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.collections import PolyCollection
from matplotlib.patches import Patch, Polygon, Rectangle
import numpy as np

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / 'temp/T75'
plt.rcParams.update({'font.family': 'Malgun Gothic', 'axes.unicode_minus': False})
faces = sorted(json.loads((OUT / 'plan-geometry.json').read_text()), key=lambda face: face[1])
seats = json.loads((ROOT / 'web/config/seats.json').read_text())['seats']
colors = dict(floor='#dce4e8', tiers='#b1bdc4', seats='#516675', entry='#9eb1c0', stage='#718b9b')
vertices = [np.array(face[2])[:, ::-1] * [-1, 1] for face in faces]
facecolors = [colors[face[0]] for face in faces]
assert len(seats) == 6

fig = plt.figure(figsize=(13, 14), facecolor='#f5f7f9')
ax = fig.add_axes([.04, .18, .64, .75])
detail = fig.add_axes([.73, .34, .24, .42])
for pane in (ax, detail):
    pane.add_collection(PolyCollection(vertices, facecolors=facecolors, edgecolors='none'))
    pane.set_aspect('equal')
    pane.set_facecolor('#edf1f4')
    pane.set_xticks([])
    pane.set_yticks([])
    for spine in pane.spines.values():
        spine.set_color('#c5d1d8')
ax.set_xlim(-77, 77)
ax.set_ylim(-89, 89)
detail.set_xlim(-11, 11)
detail.set_ylim(-65, -27)
detail.set_title('기존 입구 확대', fontsize=14, pad=12, fontweight='bold')

# Incoming direction is +X in Blender: plan up = +X, plan right = -Y.
for side, center, label in ((-1, -35, 'A · 들어올 때 왼쪽'), (1, 35, 'B · 들어올 때 오른쪽')):
    start, finish = sorted((side * 51, side * 19))
    ax.add_patch(Rectangle((start, -3.383), finish - start, 6.766,
        facecolor='#3fb8d0', edgecolor='#08798f', linewidth=2, alpha=.85, zorder=5))
    ax.annotate('', xy=(side * 20, 0), xytext=(side * 49, 0),
        arrowprops=dict(arrowstyle='-|>', color='white', lw=2), zorder=6)
    for edge in (-5, 3.383):
        ax.add_patch(Rectangle((start + 3, edge), finish - start - 5, 1.617,
            facecolor='#efb75d', edgecolor='#c4790b', hatch='///', linewidth=1, alpha=.85, zorder=5))
    ax.annotate(label, (center, 0), (center, 12), fontsize=11, fontweight='bold',
        ha='center', color='#065b70', arrowprops=dict(arrowstyle='-', color='#065b70'), zorder=7)
    ax.text(side * 57, 0, '복도', ha='center', va='center', fontsize=9, rotation=90, zorder=7)

for pane in (ax, detail):
    pane.add_patch(Rectangle((-3.388, -61), 6.766, 32, fill=False,
        edgecolor='#3c647f', linewidth=2, zorder=6))
    pane.annotate('', xy=(0, -31), xytext=(0, -59),
        arrowprops=dict(arrowstyle='-|>', color='#284f6a', lw=2), zorder=6)
    for sign in (-1, 1):
        pane.add_patch(Rectangle((sign * 5.2 - .65, -55), 1.3, 25.5, facecolor='#efb75d',
            edgecolor='#c4790b', hatch='///', linewidth=1, alpha=.9, zorder=7))
        pane.add_patch(Polygon([(sign * 3.4, -61), (sign * 7.9, -61),
            (sign * 5.2, -55.5), (sign * 3.4, -55.5)], closed=True,
            facecolor='#bc86c8', edgecolor='#714584', hatch='\\\\', alpha=.8, zorder=7))
    for seat in seats:
        x, _, z = seat['position']
        pane.add_patch(Rectangle((z - .65, x - .48), 1.3, .96,
            facecolor='#e8f3ed', edgecolor='#32a770', linewidth=.4, zorder=8))
    pane.scatter([s['position'][2] for s in seats], [s['position'][0] for s in seats],
        s=36 if pane is detail else 18, c='#32a770', edgecolors='white', linewidths=.5, zorder=9)

ax.text(0, -73, '현재 입구 / 로비\n여기서 위쪽으로 들어옴', ha='center', va='center',
        fontsize=11, color='#284f6a', fontweight='bold')
ax.annotate('', xy=(0, -63), xytext=(0, -69), arrowprops=dict(arrowstyle='-|>', color='#284f6a', lw=2))
ax.text(0, 0, '중앙 무대', ha='center', va='center', color='white', fontsize=10, zorder=8)
detail.text(0, -62.7, '로비', ha='center', fontsize=10, color='#284f6a')
detail.text(0, -28.8, '아레나 바닥', ha='center', fontsize=10, color='#284f6a')
detail.text(0, -54.3, '● 6석 보존', ha='center', fontsize=10, color='#137848', zorder=10,
    bbox=dict(facecolor='white', edgecolor='none', alpha=.85, pad=2))
fig.text(.06, .97, 'T75  |  새 통로 두 곳 · 위치 승인안', fontsize=23, fontweight='bold', color='#183949')
fig.text(.06, .942, '기존 모델 좌표로 그린 톱뷰 · 입구가 아래 · 표시만 했으며 형상은 변경하지 않았습니다', fontsize=11, color='#536b79')
fig.legend(handles=[Patch(facecolor='#3fb8d0', label='A·B: 새 넓은 경사 통로 후보'),
    Patch(facecolor='#efb75d', hatch='///', label='좌석·관중 제거 구역 (통로 옆 한 열 + 끝부분)'),
    Patch(facecolor='#32a770', label='기존 지정 빈 좌석 6석: 보존'),
    Patch(facecolor='#bc86c8', hatch='\\\\', label='입구 검은 경사판 제거 구역')],
    loc='lower left', bbox_to_anchor=(.06, .075), frameon=False, fontsize=11)
fig.text(.73, .27, 'A·B 제안 치수\n폭 약 6.77 m · 길이 32 m\n기존 입구 통로와 같은 폭·경사\n외곽 복도 → 아레나 바닥', fontsize=11,
    linespacing=1.7, color='#284f6a')
fig.text(.06, .034, '주황·보라 영역은 위치 확인용입니다. 실제 좌석 경계와 판 형상에 맞춰 제거하며, 보존 6석은 제외합니다.\n지붕·관중·상부 구조물을 생략한 형상 도면입니다. 완성 모습이나 조명 비교 그림이 아닙니다.',
    fontsize=10, color='#536b79', linespacing=1.7)
fig.savefig(OUT / 'ramp-locations-proposal.png', dpi=130)
plt.close(fig)
(OUT / 'ramp-locations-proposal.json').write_text(json.dumps(dict(
    coordinates='Blender X,Y,Z; glTF X,Y,Z = Blender X,Z,-Y',
    proposed=[dict(id='A', label='left when entering', top=[0, 51, 0], bottom=[0, 19, -10], width=6.766),
              dict(id='B', label='right when entering', top=[0, -51, 0], bottom=[0, -19, -10], width=6.766)],
    protected_seats=seats, geometry_changed=False), indent=2), encoding='utf-8')
print('T75_PLAN', OUT / 'ramp-locations-proposal.png')
