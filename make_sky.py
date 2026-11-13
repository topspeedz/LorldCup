from pathlib import Path
import numpy as np
from PIL import Image

root=Path(__file__).resolve().parent/'web'
w,h=2048,1024
y,x=np.mgrid[0:h,0:w].astype(np.float32);u=x/w;v=y/h
rng=np.random.default_rng(73)
cloud=np.zeros((h,w),dtype=np.float32)
for scale,amplitude in [(4,1),(8,.55),(16,.25),(32,.12)]:
    for _ in range(6):
        a=rng.integers(1,scale+1);b=rng.integers(1,scale+1)
        cloud+=amplitude*np.sin(2*np.pi*(u*a+v*b)+rng.uniform(0,6.28))/6
cloud=np.clip((cloud+.10)*3,0,1)
cloud=cloud*cloud*(3-2*cloud)
band=np.clip((v-.035)/.07,0,1)*np.clip((.50-v)/.08,0,1)
cloud*=band
top=np.array([53,123,175]);horizon=np.array([184,207,217])
t=np.clip(v/.50,0,1)[...,None]
sky=top[None,None,:]*(1-t)+horizon[None,None,:]*t
shade=np.clip(.91+np.gradient(cloud,axis=0)*10,.70,1.04)
white=np.array([246,244,228])[None,None,:]*shade[...,None]
sky=sky*(1-cloud[...,None]) + white*cloud[...,None]
sky[v>.51]=np.array([96,111,119])
Image.fromarray(np.uint8(np.clip(sky,0,255))).save(root/'city-sky.jpg',quality=93)
print('Sky panorama: 2048 x 1024')
