from PIL import Image, ImageFilter, ImageDraw
import numpy as np, sys
src,dst=sys.argv[1],sys.argv[2]
im=Image.open(src); a=np.asarray(im).astype(int).copy()
r,g,b,al=a[...,0],a[...,1],a[...,2],a[...,3]
H,W=al.shape; yy,xx=np.mgrid[0:H,0:W]
mx=np.maximum(np.maximum(r,g),b); mn=np.minimum(np.minimum(r,g),b); sat=(mx-mn)/np.maximum(mx,1)
gold=(b<0.15*r)&(r>90)
roi=(xx<122)&(yy>=300)&(yy<600)&~((yy<345)&(xx>=80)&~gold)
M=lambda m,k,f: np.asarray(Image.fromarray((m*255).astype(np.uint8)).filter(f(k)))>0
skin=(b>0.17*r)&(g<0.74*r)&(r>150)&(xx<122)&(yy>425)&(yy<600)
skin=M(M(skin,5,ImageFilter.MinFilter),5,ImageFilter.MaxFilter)
pts=np.argwhere(skin)[:,::-1]
def hull(P):
  P=sorted(set(map(tuple,P)))
  cr=lambda o,a,b:(a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0])
  lo=[];up=[]
  for p in P:
    while len(lo)>=2 and cr(lo[-2],lo[-1],p)<=0: lo.pop()
    lo.append(p)
  for p in reversed(P):
    while len(up)>=2 and cr(up[-2],up[-1],p)<=0: up.pop()
    up.append(p)
  return lo[:-1]+up[:-1]
mask=Image.new('L',(W,H),0); ImageDraw.Draw(mask).polygon(hull(pts),fill=255)
fist=M(M(np.asarray(mask)>0,7,ImageFilter.MinFilter),7,ImageFilter.MaxFilter)
fistO=M(fist,5,ImageFilter.MaxFilter)
a[...,3][roi&~fistO]=0
fill=fist&~skin
ys=np.nonzero(fist)[0]; t=(yy-ys.min())/max(1,ys.max()-ys.min())
for c,(top,bot) in enumerate([(150,215),(80,128),(40,64)]):
  a[...,c][fill]=(top+(bot-top)*t[fill]).astype(int)
a[...,3][fill]=255
ring=fistO&~fist
a[ring,0]=74;a[ring,1]=38;a[ring,2]=22;a[...,3][ring]=255
Image.fromarray(a.clip(0,255).astype(np.uint8),'RGBA').save(dst)
