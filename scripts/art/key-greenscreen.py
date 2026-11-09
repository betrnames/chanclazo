import numpy as np, sys
from PIL import Image, ImageFilter
def key(src, out):
    im = np.asarray(Image.open(src).convert('RGB')).astype(np.float32)
    r,g,b = im[...,0],im[...,1],im[...,2]
    spill = g - np.maximum(r,b)
    # alpha: fully transparent when strongly green, opaque when not
    t0,t1 = 18., 55.
    a = 1 - np.clip((spill - t0)/(t1-t0), 0, 1)
    A = Image.fromarray((a*255).astype(np.uint8))
    # remove speckles + soften edge: erode 1px then slight blur
    A = A.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.7))
    a = np.asarray(A).astype(np.float32)/255
    # keep only largest connected component region (drop stray noise) via threshold mask bbox later
    # despill: clamp green to max(r,b) where green exceeds it
    g2 = np.where(spill>0, np.maximum(r,b) + np.clip(spill,0,None)*0.15, g)
    out_rgb = np.stack([r,g2,b],-1)
    rgba = np.dstack([out_rgb, a*255]).clip(0,255).astype(np.uint8)
    img = Image.fromarray(rgba,'RGBA')
    # zero tiny alpha
    arr = np.asarray(img).copy(); arr[...,3][arr[...,3]<12]=0; img=Image.fromarray(arr,'RGBA')
    bb = img.getbbox(); pad=6
    bb=(max(0,bb[0]-pad),max(0,bb[1]-pad),min(img.width,bb[2]+pad),min(img.height,bb[3]+pad))
    img = img.crop(bb)
    img.save(out+'.png', optimize=True)
    img.save(out+'.webp', quality=90, method=6)
    print(out, img.size, bb)
d='/workspace/chanclazo_assets/lander/'
key(d+'sidro-chibi-greenscreen.jpg', d+'keyed/sidro-chibi')
key(d+'abuela-chibi-greenscreen.jpg', d+'keyed/abuela-chibi')
key(d+'abuela-chibi-angry-greenscreen.jpg', d+'keyed/abuela-chibi-angry')
