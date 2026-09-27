"""Independent orbital bisection/angle-flux/dense quadrature check of actual TS.
No imports of production geometry, solar or inverse-calendar algorithms.
Run from the project: python audits/synthesis/oracle.py --output /tmp/earth-synthesis-audit
"""
import argparse, json, math, pathlib, subprocess
import numpy as np
P=365.; S=1361.; TAU=2*math.pi

def solar_angle(lat, tilt, theta, e, peri, axis):
    phi=np.deg2rad(lat); delta=np.arcsin(np.sin(np.deg2rad(tilt))*np.sin(theta))
    a=np.sin(phi)*np.sin(delta); b=np.cos(phi)*np.cos(delta)
    h=np.where(abs(b)<1e-12, np.where(a>1e-12,math.pi,np.where(a< -1e-12,0,math.pi/2)),
               np.arccos(np.clip(-a/np.where(abs(b)<1e-12,1,b),-1,1)))
    nu=theta+np.deg2rad(axis-peri); r=(1-e*e)/(1+e*np.cos(nu))
    return np.maximum(0,S/(math.pi*r*r)*(h*a+b*np.sin(h)))

def solar_time(lat,world,days):
    e=world['eccentricity']; rel=np.deg2rad(world['axis']-world['perihelion'])
    E0=2*np.arctan2(np.sqrt(1-e)*np.sin(rel/2),np.sqrt(1+e)*np.cos(rel/2))
    M=E0-e*np.sin(E0)+TAU*(np.asarray(days)-80)/P
    M=(M+math.pi)%TAU-math.pi
    lo=np.full(M.shape,-math.pi); hi=np.full(M.shape,math.pi)
    for _ in range(60):
        mid=(hi+lo)/2; lower=mid-e*np.sin(mid)<M
        lo=np.where(lower,mid,lo);hi=np.where(lower,hi,mid)
    E=(lo+hi)/2
    nu=2*np.arctan2(np.sqrt(1+e)*np.sin(E/2),np.sqrt(1-e)*np.cos(E/2))
    return solar_angle(lat,world['tilt'],nu+np.deg2rad(world['perihelion']-world['axis']),e,world['perihelion'],world['axis'])

p=argparse.ArgumentParser();p.add_argument('--output',default='/tmp/earth-synthesis-audit');args=p.parse_args()
root=pathlib.Path(__file__).resolve().parents[2];out=pathlib.Path(args.output).resolve()
if out.is_relative_to(root):raise ValueError('Write generated results outside project')
process=subprocess.run(['node',str(root/'audits/synthesis/run-production.mjs'),str(out)],check=True,capture_output=True,text=True)
payload=json.loads((out/'production.json').read_text());max_daily=max_angle=max_energy=max_duration=0.;values=0
for result in payload['results']:
    s=result['settings'];lat=s['latitude'];start=np.deg2rad(s['summer']-90)
    for row in result['rows']:
        w=row['world'];e=w['eccentricity'];peri=w['perihelion'];axis=w['axis']
        actual=np.asarray(row['daily']);expected=solar_time(lat,w,np.arange(1,366))
        max_daily=max(max_daily,float(np.max(abs(actual-expected))));values+=365
        theta=np.deg2rad((np.arange(72)+.5)*5)
        expected=solar_angle(lat,w['tilt'],theta,e,peri,axis)
        max_angle=max(max_angle,float(np.max(abs(np.asarray(row['seasonal'])-expected))));values+=72
        # Much finer angular integration, independently testing inverse-calendar and time weighting.
        bins=14400;theta=start+(np.arange(bins)+.5)*math.pi/bins
        nu=theta+np.deg2rad(axis-peri)
        dt=P/TAU*(1-e*e)**1.5/(1+e*np.cos(nu))**2*math.pi/bins
        energy=float(np.sum(solar_angle(lat,w['tilt'],theta,e,peri,axis)*dt)*.0864)
        max_energy=max(max_energy,abs(row['halfEnergy']-energy))
        max_duration=max(max_duration,abs(row['halfDays']-float(dt.sum())))
assert max_daily<1e-7,(max_daily,'daily')
assert max_angle<1e-7,(max_angle,'angle')
assert max_energy<.25,(max_energy,'MJ/m² quadrature')
assert max_duration<1e-6,(max_duration,'day quadrature')
report=dict(values=values,max_daily_w_m2=max_daily,max_angle_w_m2=max_angle,max_energy_quadrature_mj_m2=max_energy,
            max_duration_quadrature_days=max_duration,benchmark=json.loads(process.stdout),source_hashes=payload['hashes'])
(out/'report.json').write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2))
