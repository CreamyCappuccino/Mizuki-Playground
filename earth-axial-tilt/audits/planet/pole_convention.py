"""Reproduce fixed pole/season constants from JPL Table 1 and NAIF PCK00011.
Reference URLs and interpretation: docs/V2.2.md. No epoch propagation is claimed.
"""
import math
import json
D = math.pi / 180

def dot(a, b):
    return sum(x*y for x, y in zip(a, b))

def reference(ra, dec, inclination, node, peri, sign):
    ra *= D; dec *= D
    eq = [sign*math.cos(dec)*math.cos(ra), sign*math.cos(dec)*math.sin(ra), sign*math.sin(dec)]
    c, s = math.cos(23.43928*D), math.sin(23.43928*D)
    n = [eq[0], c*eq[1]+s*eq[2], -s*eq[1]+c*eq[2]]
    w = (peri-node)*D; node *= D; inclination *= D
    cw, sw, cn, sn, ci, si = math.cos(w), math.sin(w), math.cos(node), math.sin(node), math.cos(inclination), math.sin(inclination)
    p = [cw*cn-sw*sn*ci, cw*sn+sw*cn*ci, sw*si]
    q = [-sw*cn-cw*sn*ci, -sw*sn+cw*cn*ci, cw*si]
    k = [p[1]*q[2]-p[2]*q[1], p[2]*q[0]-p[0]*q[2], p[0]*q[1]-p[1]*q[0]]
    return dict(tilt=math.acos(dot(n,k))/D, perihelionLs=math.atan2(-dot(n,p),-dot(n,q))/D%360)

if __name__ == '__main__':
    print(json.dumps({'uranus': reference(257.311,-15.175,.77263783,74.01692503,170.95427630,-1), 'mercury': reference(281.0103,61.4155,7.00497902,48.33076593,77.45779628,1)},indent=2))
