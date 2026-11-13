"""Non-overlapping per-face charts and linear RGBM transport for static lightmaps."""
import math
import numpy as np

def planar_chart(points, normal):
    points=np.asarray(points,dtype=float)
    edges=np.roll(points,-1,axis=0)-points
    tangent=edges[np.argmax(np.sum(edges*edges,axis=1))]
    tangent=tangent/np.linalg.norm(tangent)
    bitangent=np.cross(normal,tangent)
    projected=np.column_stack((points@tangent,points@bitangent))
    low=projected.min(axis=0);extent=np.maximum(projected.max(axis=0)-low,1e-8)
    return (projected-low)/extent,extent

def pack_charts(extents, size, margin=2):
    extents=np.maximum(np.asarray(extents,dtype=float),1e-7)
    order=np.argsort(-extents[:,1],kind='stable')
    def place(density):
        dims=np.maximum(4,np.ceil(extents*density).astype(np.int32))+2*margin
        coords=np.zeros((len(extents),2),dtype=np.int32)
        x=y=row=0
        for i in order:
            w,h=dims[i]
            if w>size or h>size:return None
            if x+w>size:x=0;y+=row;row=0
            if y+h>size:return None
            coords[i]=(x,y);x+=w;row=max(row,h)
        return coords,dims
    assert place(0) is not None,'Too many charts for atlas; split the bake group'
    lo=0.;hi=size/max(extents.max(),1e-7)
    for _ in range(22):
        mid=(lo+hi)/2
        if place(mid) is None:hi=mid
        else:lo=mid
    origins,dims=place(lo)
    return origins+margin+.5,dims-2*margin-1,lo

def encode_rgbm(rgb):
    rgb=np.maximum(np.nan_to_num(np.asarray(rgb,dtype=np.float32),nan=0,posinf=0,neginf=0),0)
    peak=float(rgb.max())
    scale=float(2**math.ceil(math.log2(max(peak,1))))
    multiplier=np.maximum(np.ceil(np.max(rgb,axis=-1)/scale*255)/255,1/255)
    encoded=np.concatenate((rgb/(multiplier[...,None]*scale),multiplier[...,None]),axis=-1)
    return np.rint(np.clip(encoded,0,1)*255).astype(np.uint8),scale

if __name__=='__main__':
    # A long diagonal face must get a rectangular chart, not a mostly empty square.
    points=np.array([[0,0,0],[100,100,0],[100.1,99.9,0],[.1,-.1,0]])
    chart,extent=planar_chart(points,[0,0,-1])
    assert extent.max()/extent.min()>900 and np.allclose(chart.min(axis=0),0) and np.allclose(chart.max(axis=0),1)
    extents=np.array([[2,1],[1,.2],[.001,3],[5,4],[1,1]])
    origins,dims,density=pack_charts(extents,64)
    boxes=[(*o,*(o+d)) for o,d in zip(origins,dims)]
    for i,(x,y,r,b) in enumerate(boxes):
        assert 0<x<r<64 and 0<y<b<64
        for xx,yy,rr,bb in boxes[i+1:]:assert r<xx or rr<x or b<yy or bb<y
    values=np.array([[0,0,0],[.0001,.005,.02],[1,3,7],[16,40,80]],dtype=float)
    encoded,scale=encode_rgbm(values)
    decoded=encoded[:,:3]/255*(encoded[:,3:]/255)*scale
    assert np.all(np.abs(decoded-values)<=np.maximum(.002,values*.012)),(values,decoded)
    print('Thin diagonal chart, atlas bounds/non-overlap and RGBM HDR/dark-value round trip passed')
