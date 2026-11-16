import numpy as np, sys
from load import load
from PIL import Image
from scipy import ndimage
from matplotlib.path import Path
NAMES=['none','ne','sh','ch','bi','fo','ab','abd','qu','ad','ca','tp','mb','la','lb','tr','gl','ha']
IDX={n:i for i,n in enumerate(NAMES)}
def inpoly(poly,x,y):
    return Path(poly).contains_points(np.c_[x,y])
def seg_d(P,a,b):
    a=np.array(a);b=np.array(b);ab=b-a
    t=np.clip(((P-a)@ab)/(ab@ab),0,1)
    return np.linalg.norm(P-(a+t[:,None]*ab),axis=1),t
_ZC={}
def zc_init(P):
    x,y,z=P[:,0],P[:,1],P[:,2]; ax=np.abs(x)
    def prof(mask,lo,hi,step=0.02):
        ys=np.arange(lo,hi,step); cz=[]
        for a in ys:
            m=mask&(y>=a)&(y<a+step)
            cz.append(z[m].mean() if m.sum()>3 else np.nan)
        cz=np.array(cz); ok=~np.isnan(cz); yc=ys+step/2
        co=np.polyfit(yc[ok],cz[ok],1)
        return lambda yy,co=co: np.polyval(co,yy)
    _ZC['leg']=prof((ax>0.06)&(ax<0.30)&(y<-0.12),-0.90,-0.12)
    _ZC['arm']=prof((ax>0.30)&(y<0.55)&(y>0.0),0.0,0.55)
def label(P,N):
    x,y,z=P[:,0],P[:,1],P[:,2]; ax=np.abs(x); sg=np.where(x>=0,1.,-1.)
    nx,ny,nz=N[:,0],N[:,1],N[:,2]
    Q=np.c_[ax,y,z]
    bones={'torso':((0,0.08,0),(0,0.60,0),0.20),'neck':((0,0.60,0),(0,0.76,0),0.075),
      'ua':((0.30,0.52,0),(0.40,0.28,0),0.095),'fa':((0.40,0.28,0),(0.43,0.02,0),0.062),
      'th':((0.13,-0.02,0),(0.21,-0.46,0),0.13),'sh':((0.21,-0.46,0),(0.22,-0.86,0),0.085)}
    best=np.full(len(P),'torso',dtype=object);bd=np.full(len(P),1e9);tt=np.zeros(len(P))
    for k,(a,b,r) in bones.items():
        d,t=seg_d(Q,a,b);d=d/r
        m=d<bd;bd[m]=d[m];best[m]=k;tt[m]=t[m]
    leg=(ax<0.34)&(y<0.0)
    best[(ax>0.32)&np.isin(best,['th','sh'])]='fa'
    best[leg&(y>-0.47)&(best=='sh')]='th'
    best[leg&(y<=-0.47)&(best=='th')]='sh'
    lab=np.full(len(P),'none',dtype=object)
    front=nz>0.12;back=nz<-0.12
    zl=_ZC['leg'](y);za=_ZC['arm'](y)
    inner=(-nx*sg)>0.25
    head=y>0.755
    m=(best=='neck')&~head; lab[m]=np.where(back[m],'tp','ne')
    T=(best=='torso')&~head
    xb=np.clip(0.205+0.25*(y-0.5),0.19,0.26)
    yb=0.405+0.28*np.minimum(ax,0.22)          # borde inferior del pectoral
    ycl=0.605+0.012*(ax/0.2)                    # clavícula
    ell=(((ax-0.315)/0.10)**2+((y-0.535)/0.15)**2)<1   # deltoides (elipse sobre el hombro)
    pec=front&(y>yb)&(y<ycl)&(ax<=xb)
    lab[T&pec]='ch'
    top=front&(y>=ycl)
    lab[T&top]=np.where(ax[T&top]>0.07,'tp','ne')
    lab[T&front&(ax<0.105)&(y<=yb)&(y>0.10)]='ab'
    lab[T&(~back)&(ax>=0.105)&(y>0.10)&(y<=yb)]='ab'
    lab[T&(~back)&(ax>xb)&(y>yb)&(y<0.46)]='ab'      # serrato / costillas junto a la axila
    B=T&back
    P=lambda poly:inpoly(poly,ax,y)
    lab[B]='la'
    lab[B&(ax>0.245)&(y<0.50)]='tr'
    lab[B&P([(0.0,0.165),(0.17,0.165),(0.225,0.10),(0.235,0.0),(0.21,-0.07),(0.12,-0.105),(0.0,-0.12)])]='gl'
    lab[B&P([(0.0,0.37),(0.09,0.36),(0.078,0.13),(0.0,0.12)])]='lb'
    lab[B&P([(0.24,0.50),(0.17,0.43),(0.09,0.37),(0.078,0.13),(0.24,0.145),(0.245,0.30)])]='la'
    lab[B&P([(0.0,0.37),(0.09,0.37),(0.17,0.43),(0.235,0.50),(0.235,0.58),(0.09,0.575),(0.0,0.56)])]='mb'
    lab[B&P([(0.0,0.75),(0.09,0.74),(0.265,0.635),(0.245,0.60),(0.12,0.575),(0.0,0.55)])]='tp'
    lab[B&ell]='sh'
    lab[B&P([(0.10,0.165),(0.245,0.145),(0.25,0.03),(0.20,0.03),(0.13,0.08)])]='abd'
    lab[T&front&ell]='sh'
    lab[(best=='torso')&(y<=0.10)&front]='none'
    # --- brazo
    A=best=='ua'
    sc=(z-za)*14+0.5*(-nx*sg)
    lab[A]=np.where(sc>0,'bi','tr')[A]
    lab[A&ell]='sh'
    lab[best=='fa']='fo'
    lab[(best=='fa')&(y<0.045)]='none'
    # --- muslo
    ing=-0.07+(ax-0.05)*0.95
    axis=0.13+(0.21-0.13)*np.clip((-0.02-y)/0.44,0,1)
    Th=(best=='th')&(ax<0.30)
    gbot=-0.105-0.015*np.clip(ax/0.2,0,1)
    lback=z<zl-0.005; lfront=z>zl+0.005
    q=Th&(y<=ing)
    lab[q]=np.where(lback[q],'ha','qu')
    adm=Th&(y<=ing)&(ax<axis-0.05)&(y>-0.34-(axis-ax)*0.6)&~lback
    lab[adm]='ad'
    lab[Th&(y>ing)&(y<=0.14)&~back]='none'
    bk=Th&lback&(y>-0.20)|Th&back&(y>-0.12)
    lab[bk]=np.where(y[bk]<=gbot[bk],'ha','gl')
    lab[Th&lback&(y<=gbot)]='ha'
    hipP=lambda poly:inpoly(poly,ax,y)
    lab[bk&hipP([(0.10,0.165),(0.245,0.145),(0.25,0.03),(0.20,0.03),(0.13,0.08)])]='abd'
    lab[Th&~back&(ax>0.20)&(ax<0.30)&(y>-0.02)&(y<0.14)]='abd'
    lab[(best=='torso')&~back&(ax>0.19)&(ax<0.30)&(y>-0.02)&(y<0.14)]='abd'
    # --- pierna
    Sh=best=='sh'
    lab[Sh]=np.where(z[Sh]<zl[Sh]-0.005,'ca','none')
    lab[Sh&(y<-0.84)]='none'
    lab[head]='none'
    ids=np.array([IDX[l] for l in lab])
    return ids*2+(x>0)
def bake(res=2048):
    P,N,U,F=load(); zc_init(P)
    img=np.zeros((res,res),np.uint8); filled=np.zeros((res,res),bool)
    for f in F:
        uv=U[f]*res; uv[:,1]=(1-U[f][:,1] if False else U[f][:,1])*res
        mn=np.floor(uv.min(0)).astype(int); mx=np.ceil(uv.max(0)).astype(int)
        xs,ys=np.meshgrid(np.arange(max(mn[0],0),min(mx[0],res)),np.arange(max(mn[1],0),min(mx[1],res)))
        px=np.c_[xs.ravel()+0.5,ys.ravel()+0.5]
        a,b,c=uv
        d=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1])
        if abs(d)<1e-12: continue
        w0=((b[1]-c[1])*(px[:,0]-c[0])+(c[0]-b[0])*(px[:,1]-c[1]))/d
        w1=((c[1]-a[1])*(px[:,0]-c[0])+(a[0]-c[0])*(px[:,1]-c[1]))/d
        w2=1-w0-w1
        ok=(w0>=-0.02)&(w1>=-0.02)&(w2>=-0.02)
        if not ok.any(): continue
        W=np.c_[w0,w1,w2][ok]; W=np.clip(W,0,1); W/=W.sum(1,keepdims=True)
        pos=W@P[f]; nor=W@N[f]; nor/=np.linalg.norm(nor,axis=1,keepdims=True)+1e-9
        l=label(pos,nor)
        xi=px[ok][:,0].astype(int); yi=px[ok][:,1].astype(int)
        img[yi,xi]=l; filled[yi,xi]=True
    # relleno de márgenes
    d,(iy,ix)=ndimage.distance_transform_edt(~filled,return_indices=True)
    pad=d<=4
    out=np.where(filled,img,np.where(pad,img[iy,ix],0))
    return out.astype(np.uint8),filled
if __name__=='__main__':
    out,filled=bake(2048)
    Image.fromarray(out,'L').save('idmap.png')
    # previsualización en color
    pal={ 'none':(110,110,110),'ne':(176,176,176),'sh':(255,159,28),'ch':(230,57,70),'bi':(42,157,143),'fo':(142,202,230),'ab':(255,209,102),'abd':(244,162,97),'qu':(67,97,238),'ad':(181,23,158),'ca':(6,214,160),'tp':(155,93,229),'mb':(0,187,249),'la':(241,91,181),'lb':(254,228,64),'tr':(128,237,153),'gl':(255,107,107),'ha':(58,134,255)}
    col=np.zeros(out.shape+(3,),np.uint8)
    for n,i in IDX.items():
        for s in (0,1):
            c=np.array(pal[n])*(0.88 if s else 1.0)
            col[out==i*2+s]=c.astype(np.uint8)
    # bordes
    e=np.zeros(out.shape,bool)
    e[:,1:]|=out[:,1:]!=out[:,:-1]; e[1:,:]|=out[1:,:]!=out[:-1,:]
    col[e]=(20,20,20)
    col[~filled&(out==0)]=col[~filled&(out==0)]
    Image.fromarray(col).save('preview.png')
    print('ok', np.unique(out//2,return_counts=True))
