from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

root = Path(__file__).parent
font = ImageFont.truetype('C:/Windows/Fonts/arialbd.ttf', 94)
small = ImageFont.truetype('C:/Windows/Fonts/arial.ttf', 24)
for team, base, accent in [('GEN.G', '#10131a', '#d6b45a'), ('BLG', '#e9f1f4', '#00bcd4')]:
    im = Image.new('RGB', (512,512), base)
    d = ImageDraw.Draw(im)
    for x in range(0,512,8):
        d.line((x,0,x,512), fill='#151923' if team=='GEN.G' else '#e2eaed',width=1)
    d.polygon([(0,0),(90,0),(30,512),(0,512)],fill=accent)
    d.polygon([(512,0),(422,0),(482,512),(512,512)],fill=accent)
    d.line([(167,0),(256,80),(345,0)],fill=accent,width=14)
    if team=='BLG':
        d.polygon([(0,330),(0,370),(512,480),(512,440)],fill='#df348f')
        d.polygon([(0,295),(0,322),(512,432),(512,405)],fill=accent)
    else:
        d.line((40,430,472,430),fill=accent,width=10)
        d.line((40,449,472,449),fill=accent,width=3)
    d.text((256,190),team,font=font,anchor='mm',fill=accent if team=='GEN.G' else '#101b2a')
    d.text((256,265),'WORLDS 2026',font=small,anchor='mm',fill=accent if team=='GEN.G' else '#162531')
    im.save(root/('audience-jersey-'+team.replace('.','').lower()+'.png'))
