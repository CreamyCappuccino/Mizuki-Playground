"""Independent nonlinear periodic EBM oracle. No application imports.
Same declared scheme; separate orbital bisection, geometry and SciPy banded solve.
Requires NumPy/SciPy. Compares numerical implementations, not climate accuracy.
"""
from pathlib import Path
import json, time, argparse, subprocess, tempfile
import numpy as np
from scipy.linalg import solve_banded

def solar(day, tilt, orbit, lat):
    e=orbit['eccentricity']; axis=np.deg2rad(orbit['axis']); peri=np.deg2rad(orbit['perihelion'])
    phase=2*np.pi*(day-80)/365
    if e==0:
        season=phase; factor=np.ones_like(day)
    else:
        nu0=axis-peri
        E0=2*np.arctan2(np.sqrt(1-e)*np.sin(nu0/2),np.sqrt(1+e)*np.cos(nu0/2))
        M=(E0-e*np.sin(E0)+phase+np.pi)%(2*np.pi)-np.pi
        lo=np.full(day.shape,-np.pi);hi=np.full(day.shape,np.pi)
        for _ in range(58):
            mid=(lo+hi)/2; lhs=mid-e*np.sin(mid);lo=np.where(lhs<M,mid,lo);hi=np.where(lhs>=M,mid,hi)
        E=(lo+hi)/2
        # Independent half-angle conversion (application uses Cartesian atan2).
        nu=2*np.arctan2(np.sqrt(1+e)*np.sin(E/2),np.sqrt(1-e)*np.cos(E/2))
        season=nu+peri-axis; factor=(1-e*np.cos(E))**-2
    delta=np.arcsin(np.sin(np.deg2rad(tilt))*np.sin(season))
    a=np.sin(delta)[:,None]*np.sin(lat)[None,:]
    b=np.cos(delta)[:,None]*np.cos(lat)[None,:]
    with np.errstate(divide='ignore',invalid='ignore'):
        h=np.arccos(np.clip(-a/b,-1,1))
    h=np.where(np.abs(b)<1e-12,np.where(a>1e-12,np.pi,np.where(a<-1e-12,0,np.pi/2)),h)
    return np.maximum(0,1361*factor[:,None]/np.pi*(h*a+b*np.sin(h)))

def solve(tilt=23.44,depth=10,solar_scale=1.,initial=20.,feedback=True,n=90,steps=2,maxyears=80,orbit=None):
    orbit=orbit or {'eccentricity':0.,'perihelion':0.,'axis':0.}
    edges=np.sin(np.linspace(-np.pi/2,np.pi/2,n+1))
    x=(edges[:-1]+edges[1:])/2; w=np.diff(edges); lat=np.arcsin(x)
    conductance=.55*(1-edges[1:-1]**2)/np.diff(x)
    lower=np.r_[0.,conductance/w[1:]]; upper=np.r_[conductance/w[:-1],0.]
    alpha=.3+.078*(3*x*x-1)/2
    h=86400/(steps*4e6*depth)
    band=np.zeros((3,n));band[0,1:]=-h*upper[:-1];band[1,:]=1+h*(2+lower+upper);band[2,:-1]=-h*lower[1:]
    Q=solar(1+(np.arange(365*steps)+1)/steps,tilt,orbit,lat)*solar_scale
    T=np.broadcast_to(initial,(n,)).copy(); U=np.zeros((steps*365,n));old=None
    masks=np.zeros((steps*365,n),dtype=bool);oldmasks=None
    t0=time.perf_counter(); error=np.inf; stablemask=False
    for yr in range(1,maxyears+1):
        output=np.empty((365,n)); asum=0.; maxres=0.
        for k in range(365*steps):
            if k%steps==0:output[k//steps,:]=T
            ice=(T < -10.) if feedback else np.zeros(n,dtype=bool)
            a=np.where(ice,.62,alpha)
            F=(1-a)*Q[k]-210.
            nxt=solve_banded((1,1),band,T+h*F,check_finite=False)
            res=np.sum(w*(F-2*nxt-(nxt-T)/h))/2
            asum+=np.dot(w,F-2*nxt)/2
            maxres=max(maxres,abs(res));T=nxt;U[k,:]=T;masks[k,:]=ice
        if old is not None:
            error=float(np.max(np.abs(U-old))); stablemask=np.array_equal(masks,oldmasks)
            if error<1e-6 and stablemask:break
        old=U.copy();oldmasks=masks.copy()
    result={'tilt':tilt,'depth':depth,'solarScale':solar_scale,'initialMean':float(np.mean(initial)),
            'feedback':feedback,'n':n,'steps':steps,'years':yr,'converged':error<1e-6 and stablemask,
            'periodicMaxC':error,'iceMaskRepeats':stablemask,'meanC':float(np.mean(output@w/2)),
            'minC':float(output.min()),'maxC':float(output.max()),'annualIceArea':float(np.mean(masks@w/2)),
            'radiationResidualWm2':float(asum/(365*steps)),'maxStepEnergyResidualWm2':float(maxres),
            'seconds':time.perf_counter()-t0}
    return result,output,T


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--output',type=Path,required=True,help='Generated audit output directory, outside Git')
    args=parser.parse_args(); args.output.mkdir(parents=True,exist_ok=True)
    subprocess.run(['node',str(Path(__file__).with_name('run-production.mjs')),str(args.output)],check=True,timeout=120)
    cases=json.loads((args.output/'production.json').read_text())
    reports=[]
    for index,case in enumerate(cases):
        params=case['input']; stats,expected,_=solve(tilt=params['tilt'],depth=params['depth'],solar_scale=params['solarScale'],
            initial=params['initial'],feedback=params['enabled'],orbit=params['orbit'])
        actual=np.fromfile(args.output/f'case-{index}.f64',dtype='<f8').reshape(expected.shape)
        difference=float(np.max(np.abs(actual-expected)))
        passed=bool(case['converged'] and stats['converged'] and difference<1e-5)
        reports.append(dict(case=index,values=int(actual.size),maxAbsC=difference,passed=passed))
        print(json.dumps(reports[-1]),flush=True)
    output=dict(scope='actual production solver vs independent Python/SciPy; not climate accuracy',
                thresholdC=1e-5,passed=all(r['passed'] for r in reports),cases=reports)
    (args.output/'comparison.json').write_text(json.dumps(output,indent=2)+'\n')
    if not output['passed']:raise RuntimeError('Numerical comparison failed. Do not widen tolerance to pass.')
if __name__=='__main__':main()
