"""Deterministic tileable PBR maps, authored locally without external assets."""
import json
from pathlib import Path
import numpy as np
from PIL import Image

ROOT=Path(__file__).resolve().parent/'materials'
ROOT.mkdir(exist_ok=True)
N=512
y,x=np.mgrid[0:N,0:N].astype(float)/N
rng=np.random.default_rng(26)

def noise(frequency,octaves):
    value=np.zeros((N,N));weight=0
    for octave in range(octaves):
        for _ in range(5):
            angle=rng.uniform(0,2*np.pi);f=frequency*2**octave
            a=round(f*np.cos(angle));b=round(f*np.sin(angle));amplitude=.55**octave
            value+=amplitude*np.sin(2*np.pi*(a*x+b*y)+rng.uniform(0,2*np.pi));weight+=amplitude
    return value/weight

cloud=noise(2,5);grain=noise(45,3);fine=rng.random((N,N))-.5
families={
 'corten': {'height':cloud*.5+grain*.18+fine*.07,'variation':1+cloud*.9+grain*.18,'rough':.78+cloud*.15,'metal':.32,'tile':(2,2),'normal':2.8},
 'concrete': {'height':grain*.3+fine*.12,'variation':1+cloud*.13+grain*.23+fine*.12,'rough':.84+grain*.16,'metal':0,'tile':(2,2),'normal':1.5},
 'paving': {'height':grain*.12+fine*.05,'variation':1+cloud*.13+grain*.1,'rough':.8+grain*.12,'metal':0,'tile':(4,4),'normal':1.7},
 'asphalt': {'height':grain*.5+fine*.3,'variation':1+grain*.45+fine*.4,'rough':.92+grain*.07,'metal':0,'tile':(2,2),'normal':1.9},
 'steel': {'height':grain*.06+np.sin(2*np.pi*y*200)*.02,'variation':1+cloud*.08+grain*.06,'rough':.36+grain*.16,'metal':.82,'tile':(1,1),'normal':.7},
 'silver': {'height':np.sin(2*np.pi*y*160)*.05+fine*.02,'variation':1+cloud*.04,'rough':.28+np.sin(2*np.pi*y*160)*.065,'metal':.92,'tile':(.6,.6),'normal':.5},
 'seat': {'height':fine*.09+grain*.15,'variation':1+cloud*.07+fine*.04,'rough':.57+grain*.15,'metal':.02,'tile':(.45,.45),'normal':.9},
 'wood': {'height':np.sin(2*np.pi*(y*40+cloud*.5))*.13,'variation':1+np.sin(2*np.pi*(y*40+cloud*.5))*.17+cloud*.22,'rough':.46+cloud*.15,'metal':0,'tile':(3,.5),'normal':.75},
 'glass': {'height':grain*.004,'variation':1+cloud*.025,'rough':.09+np.maximum(cloud,0)*.12,'metal':.18,'tile':(3,3),'normal':.1},
 'stage': {'height':np.sin(2*np.pi*x*200)*.005,'variation':1+cloud*.035,'rough':.23+cloud*.10,'metal':.12,'tile':(3,3),'normal':.2},
 'black': {'height':grain*.06,'variation':1+cloud*.06,'rough':.43+grain*.1,'metal':.18,'tile':(2,2),'normal':.5},
 'green': {'height':cloud*.35+grain*.4+fine*.15,'variation':1+cloud*.5+grain*.3,'rough':.94+grain*.04,'metal':0,'tile':(4,4),'normal':1.8},
}
# Four-by-four slab layout, with narrow recessed joints and subtle per-slab color.
joint=(np.minimum((x*4)%1,1-(x*4)%1)<.008)|(np.minimum((y*4)%1,1-(y*4)%1)<.008)
families['paving']['height']=families['paving']['height']-joint*.4
families['paving']['variation']=families['paving']['variation']*np.where(joint,.42,1)
colors={'concrete':(.22,.24,.27),'paving':(.36,.38,.40),'asphalt':(.055,.065,.075),'steel':(.05,.06,.075),'silver':(.45,.52,.60),'seat':(.035,.045,.055),'seat2':(.065,.08,.095),'wood':(.32,.18,.08),'glass':(.035,.13,.19),'ivory':(.73,.78,.82),'blue':(.008,.08,.45),'black':(.009,.014,.025),'green':(.035,.16,.07)}
for i in range(8):colors['corten'+str(i)]=(.17+i*.022,.052+i*.009,.021+i*.006)
config={}
for family,d in families.items():
    h=d['height'];dx=(np.roll(h,-1,axis=1)-np.roll(h,1,axis=1))*d['normal'];dy=(np.roll(h,-1,axis=0)-np.roll(h,1,axis=0))*d['normal']
    normal=np.stack((-dx,dy,np.ones_like(h)),axis=-1);normal/=np.linalg.norm(normal,axis=-1,keepdims=True)
    Image.fromarray(np.uint8(np.clip(normal*.5+.5,0,1)*255)).save(ROOT/f'{family}-normal.png')
    Image.fromarray(np.uint8(np.clip(d['rough'],0,1)*255)).save(ROOT/f'{family}-rough.png')
for name,color in colors.items():
    family='corten' if name.startswith('corten') else 'seat' if name=='seat2' else 'stage' if name in ('blue','ivory') else name
    d=families[family];linear=np.clip(np.array(color)[None,None,:]*d['variation'][...,None],0,1)
    srgb=np.where(linear<=.0031308,linear*12.92,1.055*linear**(1/2.4)-.055)
    Image.fromarray(np.uint8(np.clip(srgb,0,1)*255)).save(ROOT/f'{name}-color.png')
    config[name]={'family':family,'tile':d['tile'],'metal':d['metal']}
assert all((ROOT/f'{name}-color.png').exists() for name in colors)
assert len(config)==21
(ROOT/'materials.json').write_text(json.dumps(config,indent=2))
print(f'{len(config)} materials, {len(list(ROOT.glob("*.png")))} maps')
