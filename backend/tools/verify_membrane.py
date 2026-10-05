from Pynite import FEModel3D
import numpy as np
def build(mesh=0.25, w=1.0, h=0.5, t=0.3):
    m = FEModel3D()
    m.add_material('c', 30e6, 30e6/2.4, 0.2, 0)
    m.add_rectangle_mesh('M', mesh, w, h, t, 'c', plane='XY', element_type='Quad')
    m.meshes['M'].generate()
    for n in m.nodes.values():
        m.def_support(n.name, False, False, True, True, True, True)
    return m, w, h, t
# 1) uniform tension
m,w,h,t = build()
for n in m.nodes.values():
    if abs(n.X)<1e-9: m.def_support(n.name, True, abs(n.Y)<1e-9, True,True,True,True)
right=[n for n in m.nodes.values() if abs(n.X-w)<1e-9]
ys=sorted(n.Y for n in right)
F=150.0
for n in right:
    trib = (h/(len(right)-1))*(0.5 if n.Y in (ys[0],ys[-1]) else 1)
    m.add_node_load(n.name,'FX',F*trib/h,'T')
m.add_load_combo('C',{'T':1})
m.analyze_linear(check_stability=True, sparse=True)
q=list(m.quads.values())[0]
print('sigma expected', F/(t*h), 'membrane', q.membrane(0,0,True,'C').flatten())
# 2) cantilever with tip load -Y at right edge
m,w,h,t = build(mesh=0.125)
for n in m.nodes.values():
    if abs(n.X)<1e-9: m.def_support(n.name, True, True, True,True,True,True)
right=[n for n in m.nodes.values() if abs(n.X-w)<1e-9]
for n in right:
    m.add_node_load(n.name,'FY',-10.0/len(right),'T')
m.add_load_combo('C',{'T':1})
m.analyze_linear(check_stability=True, sparse=True)
q=m.quads['Q1']  # bottom-left element near fixed end
print('Q1 nodes', [(x.name,x.X,x.Y) for x in (q.i_node,q.j_node,q.m_node,q.n_node)])
for xi,eta in [(-1,-1),(1,-1),(1,1),(-1,1),(0,0)]:
    print(xi,eta, q.membrane(xi,eta,True,'C').flatten())
# Beam theory: M=10*1=10 at fixed end, sigma=M*y/I, I=t h^3/12
I=0.3*0.5**3/12; print('beam sigma_x at bottom/top fixed end', 10*0.25/I)
