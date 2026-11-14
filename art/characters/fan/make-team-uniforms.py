# Team jerseys in the GEN.G/BLG uniform layout (512², body trapezoid, V collar, name, WORLDS 2026, hem stripes),
# and stage backdrops cropped from the user's semifinal banners. Output: web/assets/characters/uniform-<id>.png,
# web/assets/screen/team-backdrop-<id>.jpg. Run from the repo root: python art/characters/fan/make-team-uniforms.py
from PIL import Image, ImageDraw, ImageFont
F = 'C:/Windows/Fonts/arialbd.ttf'
TEAMS = {  # id: (body, sides/accent, name colour, stripe colour, name)
    't1': ('#0d0e12', '#e2012d', '#e2012d', '#e2012d', 'T1'),
    'ig': ('#eef0f2', '#111317', '#111317', '#111317', 'IG'),
}
for tid, (body, side, ink, stripe, name) in TEAMS.items():
    im = Image.new('RGB', (512, 512), side); d = ImageDraw.Draw(im)
    d.polygon([(90, 0), (422, 0), (480, 512), (32, 512)], fill=body)
    for x in range(40, 480, 6): d.line([(x, 0), (x, 512)], fill=tuple(max(0, min(255, c + (8 if body < '#8' else -8))) for c in Image.new('RGB', (1, 1), body).getpixel((0, 0))))
    d.polygon([(90, 0), (422, 0), (480, 512), (32, 512)], outline=None)
    mask = Image.new('L', (512, 512), 0); ImageDraw.Draw(mask).polygon([(90, 0), (422, 0), (480, 512), (32, 512)], fill=255)
    im = Image.composite(im, Image.new('RGB', (512, 512), side), mask); d = ImageDraw.Draw(im)
    d.line([(172, 0), (256, 78), (340, 0)], fill=side, width=13)
    d.text((256, 190), name, font=ImageFont.truetype(F, 96), fill=ink, anchor='mm')
    d.text((256, 265), 'WORLDS 2026', font=ImageFont.truetype('C:/Windows/Fonts/arial.ttf', 24), fill=ink, anchor='mm')
    d.rectangle([(40, 425), (472, 435)], fill=stripe); d.rectangle([(40, 446), (472, 450)], fill=stripe)
    im.save(f'web/assets/characters/uniform-{tid}.png', optimize=True)
for tid, src, box in [('t1', 'temp/semifinal-banner-source.png', (0, 255, 760, 729)), ('ig', 'temp/semifinal-ig-geng-source.png', (0, 215, 760, 689))]:
    Image.open(src).convert('RGB').crop(box).resize((1200, 748), Image.LANCZOS).save(f'web/assets/screen/team-backdrop-{tid}.jpg', quality=86)
print('ok')
