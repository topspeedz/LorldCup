from pathlib import Path
from PIL import Image,ImageDraw
root=Path(__file__).parent
for i,skin in enumerate([(205,157,122),(150,100,72),(226,184,148)]):
    im=Image.new('RGB',(512,512),skin);d=ImageDraw.Draw(im)
    for x in [165,347]:
        d.ellipse((x-40,194,x+40,224),fill=(230,226,215))
        d.ellipse((x-11,193,x+11,225),fill=(48,35,29))
        d.ellipse((x-4,199,x+4,220),fill=(12,13,16))
        d.line([(x-43,176),(x-15,168),(x+35,175)],fill=(48,31,24),width=10)
        d.arc((x-40,191,x+40,228),180,360,fill=(80,49,33),width=4)
    shade=tuple(max(0,c-36) for c in skin)
    d.line([(256,226),(245,286),(265,289)],fill=shade,width=5)
    d.arc((220,320,294,354),0,180,fill=(104,57,48),width=6)
    d.line((238,344,276,344),fill=(137,80,65),width=4)
    im.save(root/f'audience-face-{i}.png')
