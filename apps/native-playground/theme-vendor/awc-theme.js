// Generated from packages/theme by node apps/native-playground/build-studio-theme.mjs. Includes Material Color Utilities (Apache-2.0); see LICENSES.txt.
/**
 * @license
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function z(r){return r<0?-1:r===0?0:1}function nt(r,t,e){return(1-e)*r+e*t}function Kt(r,t,e){return e<r?r:e>t?t:e}function N(r,t,e){return e<r?r:e>t?t:e}function st(r){return r=r%360,r<0&&(r=r+360),r}function U(r){return r=r%360,r<0&&(r=r+360),r}function Lt(r,t){return 180-Math.abs(Math.abs(r-t)-180)}function lt(r,t){let e=r[0]*t[0][0]+r[1]*t[0][1]+r[2]*t[0][2],n=r[0]*t[1][0]+r[1]*t[1][1]+r[2]*t[1][2],a=r[0]*t[2][0]+r[1]*t[2][1]+r[2]*t[2][2];return[e,n,a]}/**
 * @license
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */var $t=[[.41233895,.35762064,.18051042],[.2126,.7152,.0722],[.01932141,.11916382,.95034478]],ce=[[3.2413774792388685,-1.5376652402851851,-.49885366846268053],[-.9691452513005321,1.8758853451067872,.04156585616912061],[.05562093689691305,-.20395524564742123,1.0571799111220335]],Xt=[95.047,100,108.883];function At(r,t,e){return(255<<24|(r&255)<<16|(t&255)<<8|e&255)>>>0}function Ot(r){let t=at(r[0]),e=at(r[1]),n=at(r[2]);return At(t,e,n)}function mt(r){return r>>16&255}function ft(r){return r>>8&255}function pt(r){return r&255}function qt(r,t,e){let n=ce,a=n[0][0]*r+n[0][1]*t+n[0][2]*e,i=n[1][0]*r+n[1][1]*t+n[1][2]*e,o=n[2][0]*r+n[2][1]*t+n[2][2]*e,l=at(a),m=at(i),p=at(o);return At(l,m,p)}function ue(r){let t=j(mt(r)),e=j(ft(r)),n=j(pt(r));return lt([t,e,n],$t)}function Ht(r){let t=j(mt(r)),e=j(ft(r)),n=j(pt(r)),a=$t,i=a[0][0]*t+a[0][1]*e+a[0][2]*n,o=a[1][0]*t+a[1][1]*e+a[1][2]*n,l=a[2][0]*t+a[2][1]*e+a[2][2]*n,m=Xt,p=i/m[0],d=o/m[1],C=l/m[2],y=ht(p),P=ht(d),f=ht(C),h=116*P-16,S=500*(y-P),b=200*(P-f);return[h,S,b]}function jt(r){let t=$(r),e=at(t);return At(e,e,e)}function Dt(r){let t=ue(r)[1];return 116*ht(t/100)-16}function $(r){return 100*le((r+16)/116)}function dt(r){return ht(r/100)*116-16}function j(r){let t=r/255;return t<=.040449936?t/12.92*100:Math.pow((t+.055)/1.055,2.4)*100}function at(r){let t=r/100,e=0;return t<=.0031308?e=t*12.92:e=1.055*Math.pow(t,1/2.4)-.055,Kt(0,255,Math.round(e*255))}function Wt(){return Xt}function ht(r){let t=.008856451679035631,e=24389/27;return r>t?Math.pow(r,1/3):(e*r+16)/116}function le(r){let t=.008856451679035631,e=24389/27,n=r*r*r;return n>t?n:(116*r-16)/e}/**
 * @license
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */var Y=class r{static make(t=Wt(),e=200/Math.PI*$(50)/100,n=50,a=2,i=!1){let o=t,l=o[0]*.401288+o[1]*.650173+o[2]*-.051461,m=o[0]*-.250268+o[1]*1.204414+o[2]*.045854,p=o[0]*-.002079+o[1]*.048952+o[2]*.953127,d=.8+a/10,C=d>=.9?nt(.59,.69,(d-.9)*10):nt(.525,.59,(d-.8)*10),y=i?1:d*(1-1/3.6*Math.exp((-e-42)/92));y=y>1?1:y<0?0:y;let P=d,f=[y*(100/l)+1-y,y*(100/m)+1-y,y*(100/p)+1-y],h=1/(5*e+1),S=h*h*h*h,b=1-S,E=S*e+.1*b*b*Math.cbrt(5*e),R=$(n)/t[1],M=1.48+Math.sqrt(R),O=.725/Math.pow(R,.2),B=O,v=[Math.pow(E*f[0]*l/100,.42),Math.pow(E*f[1]*m/100,.42),Math.pow(E*f[2]*p/100,.42)],V=[400*v[0]/(v[0]+27.13),400*v[1]/(v[1]+27.13),400*v[2]/(v[2]+27.13)],_=(2*V[0]+V[1]+.05*V[2])*O;return new r(R,_,O,B,C,P,f,E,Math.pow(E,.25),M)}constructor(t,e,n,a,i,o,l,m,p,d){this.n=t,this.aw=e,this.nbb=n,this.ncb=a,this.c=i,this.nc=o,this.rgbD=l,this.fl=m,this.fLRoot=p,this.z=d}};Y.DEFAULT=Y.make();/**
 * @license
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */var W=class r{constructor(t,e,n,a,i,o,l,m,p){this.hue=t,this.chroma=e,this.j=n,this.q=a,this.m=i,this.s=o,this.jstar=l,this.astar=m,this.bstar=p}distance(t){let e=this.jstar-t.jstar,n=this.astar-t.astar,a=this.bstar-t.bstar,i=Math.sqrt(e*e+n*n+a*a);return 1.41*Math.pow(i,.63)}static fromInt(t){return r.fromIntInViewingConditions(t,Y.DEFAULT)}static fromIntInViewingConditions(t,e){let n=(t&16711680)>>16,a=(t&65280)>>8,i=t&255,o=j(n),l=j(a),m=j(i),p=.41233895*o+.35762064*l+.18051042*m,d=.2126*o+.7152*l+.0722*m,C=.01932141*o+.11916382*l+.95034478*m,y=.401288*p+.650173*d-.051461*C,P=-.250268*p+1.204414*d+.045854*C,f=-.002079*p+.048952*d+.953127*C,h=e.rgbD[0]*y,S=e.rgbD[1]*P,b=e.rgbD[2]*f,E=Math.pow(e.fl*Math.abs(h)/100,.42),R=Math.pow(e.fl*Math.abs(S)/100,.42),M=Math.pow(e.fl*Math.abs(b)/100,.42),O=z(h)*400*E/(E+27.13),B=z(S)*400*R/(R+27.13),v=z(b)*400*M/(M+27.13),V=(11*O+-12*B+v)/11,_=(O+B-2*v)/9,L=(20*O+20*B+21*v)/20,J=(40*O+20*B+v)/20,it=Math.atan2(_,V)*180/Math.PI,K=U(it),Ct=K*Math.PI/180,St=J*e.nbb,et=100*Math.pow(St/e.aw,e.c*e.z),xt=4/e.c*Math.sqrt(et/100)*(e.aw+4)*e.fLRoot,Rt=K<20.14?K+360:K,It=.25*(Math.cos(Rt*Math.PI/180+2)+3.8),Bt=5e4/13*It*e.nc*e.ncb*Math.sqrt(V*V+_*_)/(L+.305),Tt=Math.pow(Bt,.9)*Math.pow(1.64-Math.pow(.29,e.n),.73),zt=Tt*Math.sqrt(et/100),Yt=zt*e.fLRoot,ae=50*Math.sqrt(Tt*e.c/(e.aw+4)),oe=(1+100*.007)*et/(1+.007*et),Gt=1/.0228*Math.log(1+.0228*Yt),ie=Gt*Math.cos(Ct),se=Gt*Math.sin(Ct);return new r(K,zt,et,xt,Yt,ae,oe,ie,se)}static fromJch(t,e,n){return r.fromJchInViewingConditions(t,e,n,Y.DEFAULT)}static fromJchInViewingConditions(t,e,n,a){let i=4/a.c*Math.sqrt(t/100)*(a.aw+4)*a.fLRoot,o=e*a.fLRoot,l=e/Math.sqrt(t/100),m=50*Math.sqrt(l*a.c/(a.aw+4)),p=n*Math.PI/180,d=(1+100*.007)*t/(1+.007*t),C=1/.0228*Math.log(1+.0228*o),y=C*Math.cos(p),P=C*Math.sin(p);return new r(n,e,t,i,o,m,d,y,P)}static fromUcs(t,e,n){return r.fromUcsInViewingConditions(t,e,n,Y.DEFAULT)}static fromUcsInViewingConditions(t,e,n,a){let i=e,o=n,l=Math.sqrt(i*i+o*o),p=(Math.exp(l*.0228)-1)/.0228/a.fLRoot,d=Math.atan2(o,i)*(180/Math.PI);d<0&&(d+=360);let C=t/(1-(t-100)*.007);return r.fromJchInViewingConditions(C,p,d,a)}toInt(){return this.viewed(Y.DEFAULT)}viewed(t){let e=this.chroma===0||this.j===0?0:this.chroma/Math.sqrt(this.j/100),n=Math.pow(e/Math.pow(1.64-Math.pow(.29,t.n),.73),1/.9),a=this.hue*Math.PI/180,i=.25*(Math.cos(a+2)+3.8),o=t.aw*Math.pow(this.j/100,1/t.c/t.z),l=i*(5e4/13)*t.nc*t.ncb,m=o/t.nbb,p=Math.sin(a),d=Math.cos(a),C=23*(m+.305)*n/(23*l+11*n*d+108*n*p),y=C*d,P=C*p,f=(460*m+451*y+288*P)/1403,h=(460*m-891*y-261*P)/1403,S=(460*m-220*y-6300*P)/1403,b=Math.max(0,27.13*Math.abs(f)/(400-Math.abs(f))),E=z(f)*(100/t.fl)*Math.pow(b,1/.42),R=Math.max(0,27.13*Math.abs(h)/(400-Math.abs(h))),M=z(h)*(100/t.fl)*Math.pow(R,1/.42),O=Math.max(0,27.13*Math.abs(S)/(400-Math.abs(S))),B=z(S)*(100/t.fl)*Math.pow(O,1/.42),v=E/t.rgbD[0],V=M/t.rgbD[1],_=B/t.rgbD[2],L=1.86206786*v-1.01125463*V+.14918677*_,J=.38752654*v+.62144744*V-.00897398*_,tt=-.0158415*v-.03412294*V+1.04996444*_;return qt(L,J,tt)}static fromXyzInViewingConditions(t,e,n,a){let i=.401288*t+.650173*e-.051461*n,o=-.250268*t+1.204414*e+.045854*n,l=-.002079*t+.048952*e+.953127*n,m=a.rgbD[0]*i,p=a.rgbD[1]*o,d=a.rgbD[2]*l,C=Math.pow(a.fl*Math.abs(m)/100,.42),y=Math.pow(a.fl*Math.abs(p)/100,.42),P=Math.pow(a.fl*Math.abs(d)/100,.42),f=z(m)*400*C/(C+27.13),h=z(p)*400*y/(y+27.13),S=z(d)*400*P/(P+27.13),b=(11*f+-12*h+S)/11,E=(f+h-2*S)/9,R=(20*f+20*h+21*S)/20,M=(40*f+20*h+S)/20,B=Math.atan2(E,b)*180/Math.PI,v=B<0?B+360:B>=360?B-360:B,V=v*Math.PI/180,_=M*a.nbb,L=100*Math.pow(_/a.aw,a.c*a.z),J=4/a.c*Math.sqrt(L/100)*(a.aw+4)*a.fLRoot,tt=v<20.14?v+360:v,it=1/4*(Math.cos(tt*Math.PI/180+2)+3.8),Ct=5e4/13*it*a.nc*a.ncb*Math.sqrt(b*b+E*E)/(R+.305),St=Math.pow(Ct,.9)*Math.pow(1.64-Math.pow(.29,a.n),.73),et=St*Math.sqrt(L/100),xt=et*a.fLRoot,Rt=50*Math.sqrt(St*a.c/(a.aw+4)),It=(1+100*.007)*L/(1+.007*L),Mt=Math.log(1+.0228*xt)/.0228,Bt=Mt*Math.cos(V),Tt=Mt*Math.sin(V);return new r(v,et,L,J,xt,Rt,It,Bt,Tt)}xyzInViewingConditions(t){let e=this.chroma===0||this.j===0?0:this.chroma/Math.sqrt(this.j/100),n=Math.pow(e/Math.pow(1.64-Math.pow(.29,t.n),.73),1/.9),a=this.hue*Math.PI/180,i=.25*(Math.cos(a+2)+3.8),o=t.aw*Math.pow(this.j/100,1/t.c/t.z),l=i*(5e4/13)*t.nc*t.ncb,m=o/t.nbb,p=Math.sin(a),d=Math.cos(a),C=23*(m+.305)*n/(23*l+11*n*d+108*n*p),y=C*d,P=C*p,f=(460*m+451*y+288*P)/1403,h=(460*m-891*y-261*P)/1403,S=(460*m-220*y-6300*P)/1403,b=Math.max(0,27.13*Math.abs(f)/(400-Math.abs(f))),E=z(f)*(100/t.fl)*Math.pow(b,1/.42),R=Math.max(0,27.13*Math.abs(h)/(400-Math.abs(h))),M=z(h)*(100/t.fl)*Math.pow(R,1/.42),O=Math.max(0,27.13*Math.abs(S)/(400-Math.abs(S))),B=z(S)*(100/t.fl)*Math.pow(O,1/.42),v=E/t.rgbD[0],V=M/t.rgbD[1],_=B/t.rgbD[2],L=1.86206786*v-1.01125463*V+.14918677*_,J=.38752654*v+.62144744*V-.00897398*_,tt=-.0158415*v-.03412294*V+1.04996444*_;return[L,J,tt]}};/**
 * @license
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */var q=class r{static sanitizeRadians(t){return(t+Math.PI*8)%(Math.PI*2)}static trueDelinearized(t){let e=t/100,n=0;return e<=.0031308?n=e*12.92:n=1.055*Math.pow(e,1/2.4)-.055,n*255}static chromaticAdaptation(t){let e=Math.pow(Math.abs(t),.42);return z(t)*400*e/(e+27.13)}static hueOf(t){let e=lt(t,r.SCALED_DISCOUNT_FROM_LINRGB),n=r.chromaticAdaptation(e[0]),a=r.chromaticAdaptation(e[1]),i=r.chromaticAdaptation(e[2]),o=(11*n+-12*a+i)/11,l=(n+a-2*i)/9;return Math.atan2(l,o)}static areInCyclicOrder(t,e,n){let a=r.sanitizeRadians(e-t),i=r.sanitizeRadians(n-t);return a<i}static intercept(t,e,n){return(e-t)/(n-t)}static lerpPoint(t,e,n){return[t[0]+(n[0]-t[0])*e,t[1]+(n[1]-t[1])*e,t[2]+(n[2]-t[2])*e]}static setCoordinate(t,e,n,a){let i=r.intercept(t[a],e,n[a]);return r.lerpPoint(t,i,n)}static isBounded(t){return 0<=t&&t<=100}static nthVertex(t,e){let n=r.Y_FROM_LINRGB[0],a=r.Y_FROM_LINRGB[1],i=r.Y_FROM_LINRGB[2],o=e%4<=1?0:100,l=e%2===0?0:100;if(e<4){let m=o,p=l,d=(t-m*a-p*i)/n;return r.isBounded(d)?[d,m,p]:[-1,-1,-1]}else if(e<8){let m=o,p=l,d=(t-p*n-m*i)/a;return r.isBounded(d)?[p,d,m]:[-1,-1,-1]}else{let m=o,p=l,d=(t-m*n-p*a)/i;return r.isBounded(d)?[m,p,d]:[-1,-1,-1]}}static bisectToSegment(t,e){let n=[-1,-1,-1],a=n,i=0,o=0,l=!1,m=!0;for(let p=0;p<12;p++){let d=r.nthVertex(t,p);if(d[0]<0)continue;let C=r.hueOf(d);if(!l){n=d,a=d,i=C,o=C,l=!0;continue}(m||r.areInCyclicOrder(i,C,o))&&(m=!1,r.areInCyclicOrder(i,e,C)?(a=d,o=C):(n=d,i=C))}return[n,a]}static midpoint(t,e){return[(t[0]+e[0])/2,(t[1]+e[1])/2,(t[2]+e[2])/2]}static criticalPlaneBelow(t){return Math.floor(t-.5)}static criticalPlaneAbove(t){return Math.ceil(t-.5)}static bisectToLimit(t,e){let n=r.bisectToSegment(t,e),a=n[0],i=r.hueOf(a),o=n[1];for(let l=0;l<3;l++)if(a[l]!==o[l]){let m=-1,p=255;a[l]<o[l]?(m=r.criticalPlaneBelow(r.trueDelinearized(a[l])),p=r.criticalPlaneAbove(r.trueDelinearized(o[l]))):(m=r.criticalPlaneAbove(r.trueDelinearized(a[l])),p=r.criticalPlaneBelow(r.trueDelinearized(o[l])));for(let d=0;d<8&&!(Math.abs(p-m)<=1);d++){let C=Math.floor((m+p)/2),y=r.CRITICAL_PLANES[C],P=r.setCoordinate(a,y,o,l),f=r.hueOf(P);r.areInCyclicOrder(i,e,f)?(o=P,p=C):(a=P,i=f,m=C)}}return r.midpoint(a,o)}static inverseChromaticAdaptation(t){let e=Math.abs(t),n=Math.max(0,27.13*e/(400-e));return z(t)*Math.pow(n,1/.42)}static findResultByJ(t,e,n){let a=Math.sqrt(n)*11,i=Y.DEFAULT,o=1/Math.pow(1.64-Math.pow(.29,i.n),.73),m=.25*(Math.cos(t+2)+3.8)*(5e4/13)*i.nc*i.ncb,p=Math.sin(t),d=Math.cos(t);for(let C=0;C<5;C++){let y=a/100,P=e===0||a===0?0:e/Math.sqrt(y),f=Math.pow(P*o,1/.9),S=i.aw*Math.pow(y,1/i.c/i.z)/i.nbb,b=23*(S+.305)*f/(23*m+11*f*d+108*f*p),E=b*d,R=b*p,M=(460*S+451*E+288*R)/1403,O=(460*S-891*E-261*R)/1403,B=(460*S-220*E-6300*R)/1403,v=r.inverseChromaticAdaptation(M),V=r.inverseChromaticAdaptation(O),_=r.inverseChromaticAdaptation(B),L=lt([v,V,_],r.LINRGB_FROM_SCALED_DISCOUNT);if(L[0]<0||L[1]<0||L[2]<0)return 0;let J=r.Y_FROM_LINRGB[0],tt=r.Y_FROM_LINRGB[1],it=r.Y_FROM_LINRGB[2],K=J*L[0]+tt*L[1]+it*L[2];if(K<=0)return 0;if(C===4||Math.abs(K-n)<.002)return L[0]>100.01||L[1]>100.01||L[2]>100.01?0:Ot(L);a=a-(K-n)*a/(2*K)}return 0}static solveToInt(t,e,n){if(e<1e-4||n<1e-4||n>99.9999)return jt(n);t=U(t);let a=t/180*Math.PI,i=$(n),o=r.findResultByJ(a,e,i);if(o!==0)return o;let l=r.bisectToLimit(i,a);return Ot(l)}static solveToCam(t,e,n){return W.fromInt(r.solveToInt(t,e,n))}};q.SCALED_DISCOUNT_FROM_LINRGB=[[.001200833568784504,.002389694492170889,.0002795742885861124],[.0005891086651375999,.0029785502573438758,.0003270666104008398],[.00010146692491640572,.0005364214359186694,.0032979401770712076]];q.LINRGB_FROM_SCALED_DISCOUNT=[[1373.2198709594231,-1100.4251190754821,-7.278681089101213],[-271.815969077903,559.6580465940733,-32.46047482791194],[1.9622899599665666,-57.173814538844006,308.7233197812385]];q.Y_FROM_LINRGB=[.2126,.7152,.0722];q.CRITICAL_PLANES=[.015176349177441876,.045529047532325624,.07588174588720938,.10623444424209313,.13658714259697685,.16693984095186062,.19729253930674434,.2276452376616281,.2579979360165119,.28835063437139563,.3188300904430532,.350925934958123,.3848314933096426,.42057480301049466,.458183274052838,.4976837250274023,.5391024159806381,.5824650784040898,.6277969426914107,.6751227633498623,.7244668422128921,.775853049866786,.829304845476233,.8848452951698498,.942497089126609,1.0022825574869039,1.0642236851973577,1.1283421258858297,1.1946592148522128,1.2631959812511864,1.3339731595349034,1.407011200216447,1.4823302800086415,1.5599503113873272,1.6398909516233677,1.7221716113234105,1.8068114625156377,1.8938294463134073,1.9832442801866852,2.075074464868551,2.1693382909216234,2.2660538449872063,2.36523901573795,2.4669114995532007,2.5710888059345764,2.6777882626779785,2.7870270208169257,2.898822059350997,3.0131901897720907,3.1301480604002863,3.2497121605402226,3.3718988244681087,3.4967242352587946,3.624204428461639,3.754355295633311,3.887192587735158,4.022731918402185,4.160988767090289,4.301978482107941,4.445716283538092,4.592217266055746,4.741496401646282,4.893568542229298,5.048448422192488,5.20615066083972,5.3666897647573375,5.5300801301023865,5.696336044816294,5.865471690767354,6.037501145825082,6.212438385869475,6.390297286737924,6.571091626112461,6.7548350853498045,6.941541251256611,7.131223617812143,7.323895587840543,7.5195704746346665,7.7182615035334345,7.919981813454504,8.124744458384042,8.332562408825165,8.543448553206703,8.757415699253682,8.974476575321063,9.194643831691977,9.417930041841839,9.644347703669503,9.873909240696694,10.106627003236781,10.342513269534024,10.58158024687427,10.8238400726681,11.069304815507364,11.317986476196008,11.569896988756009,11.825048221409341,12.083451977536606,12.345119996613247,12.610063955123938,12.878295467455942,13.149826086772048,13.42466730586372,13.702830557985108,13.984327217668513,14.269168601521828,14.55736596900856,14.848930523210871,15.143873411576273,15.44220572664832,15.743938506781891,16.04908273684337,16.35764934889634,16.66964922287304,16.985093187232053,17.30399201960269,17.62635644741625,17.95219714852476,18.281524751807332,18.614349837764564,18.95068293910138,19.290534541298456,19.633915083172692,19.98083495742689,20.331304511189067,20.685334046541502,21.042933821039977,21.404114048223256,21.76888489811322,22.137256497705877,22.50923893145328,22.884842241736916,23.264076429332462,23.6469514538663,24.033477234264016,24.42366364919083,24.817520537484558,25.21505769858089,25.61628489293138,26.021211842414342,26.429848230738664,26.842203703840827,27.258287870275353,27.678110301598522,28.10168053274597,28.529008062403893,28.96010235337422,29.39497283293396,29.83362889318845,30.276079891419332,30.722335150426627,31.172403958865512,31.62629557157785,32.08401920991837,32.54558406207592,33.010999283389665,33.4802739966603,33.953417292456834,34.430438229418264,34.911345834551085,35.39614910352207,35.88485700094671,36.37747846067349,36.87402238606382,37.37449765026789,37.87891309649659,38.38727753828926,38.89959975977785,39.41588851594697,39.93615253289054,40.460400508064545,40.98864111053629,41.520882981230194,42.05713473317016,42.597404951718396,43.141702194811224,43.6900349931913,44.24241185063697,44.798841244188324,45.35933162437017,45.92389141541209,46.49252901546552,47.065252796817916,47.64207110610409,48.22299226451468,48.808024568002054,49.3971762874833,49.9904556690408,50.587870934119984,51.189430279724725,51.79514187861014,52.40501387947288,53.0190544071392,53.637271562750364,54.259673423945976,54.88626804504493,55.517063457223934,56.15206766869424,56.79128866487574,57.43473440856916,58.08241284012621,58.734331877617365,59.39049941699807,60.05092333227251,60.715611475655585,61.38457167773311,62.057811747619894,62.7353394731159,63.417162620860914,64.10328893648692,64.79372614476921,65.48848194977529,66.18756403501224,66.89098006357258,67.59873767827808,68.31084450182222,69.02730813691093,69.74813616640164,70.47333615344107,71.20291564160104,71.93688215501312,72.67524319850172,73.41800625771542,74.16517879925733,74.9167682708136,75.67278210128072,76.43322770089146,77.1981124613393,77.96744375590167,78.74122893956174,79.51947534912904,80.30219030335869,81.08938110306934,81.88105503125999,82.67721935322541,83.4778813166706,84.28304815182372,85.09272707154808,85.90692527145302,86.72564993000343,87.54890820862819,88.3767072518277,89.2090541872801,90.04595612594655,90.88742016217518,91.73345337380438,92.58406282226491,93.43925555268066,94.29903859396902,95.16341895893969,96.03240364439274,96.9059996312159,97.78421388448044,98.6670533535366,99.55452497210776];/**
 * @license
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */var x=class r{static from(t,e,n){return new r(q.solveToInt(t,e,n))}static fromInt(t){return new r(t)}toInt(){return this.argb}get hue(){return this.internalHue}set hue(t){this.setInternalState(q.solveToInt(t,this.internalChroma,this.internalTone))}get chroma(){return this.internalChroma}set chroma(t){this.setInternalState(q.solveToInt(this.internalHue,t,this.internalTone))}get tone(){return this.internalTone}set tone(t){this.setInternalState(q.solveToInt(this.internalHue,this.internalChroma,t))}setValue(t,e){this[t]=e}toString(){return`HCT(${this.hue.toFixed(0)}, ${this.chroma.toFixed(0)}, ${this.tone.toFixed(0)})`}static isBlue(t){return t>=250&&t<270}static isYellow(t){return t>=105&&t<125}static isCyan(t){return t>=170&&t<207}constructor(t){this.argb=t;let e=W.fromInt(t);this.internalHue=e.hue,this.internalChroma=e.chroma,this.internalTone=Dt(t),this.argb=t}setInternalState(t){let e=W.fromInt(t);this.internalHue=e.hue,this.internalChroma=e.chroma,this.internalTone=Dt(t),this.argb=t}inViewingConditions(t){let n=W.fromInt(this.toInt()).xyzInViewingConditions(t),a=W.fromXyzInViewingConditions(n[0],n[1],n[2],Y.make());return r.from(a.hue,a.chroma,dt(n[1]))}};/**
 * @license
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *//**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */var H=class r{static ratioOfTones(t,e){return t=N(0,100,t),e=N(0,100,e),r.ratioOfYs($(t),$(e))}static ratioOfYs(t,e){let n=t>e?t:e,a=n===e?t:e;return(n+5)/(a+5)}static lighter(t,e){if(t<0||t>100)return-1;let n=$(t),a=e*(n+5)-5,i=r.ratioOfYs(a,n),o=Math.abs(i-e);if(i<e&&o>.04)return-1;let l=dt(a)+.4;return l<0||l>100?-1:l}static darker(t,e){if(t<0||t>100)return-1;let n=$(t),a=(n+5)/e-5,i=r.ratioOfYs(n,a),o=Math.abs(i-e);if(i<e&&o>.04)return-1;let l=dt(a)-.4;return l<0||l>100?-1:l}static lighterUnsafe(t,e){let n=r.lighter(t,e);return n<0?100:n}static darkerUnsafe(t,e){let n=r.darker(t,e);return n<0?0:n}};/**
 * @license
 * Copyright 2023 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */var ot=class r{static isDisliked(t){let e=Math.round(t.hue)>=90&&Math.round(t.hue)<=111,n=Math.round(t.chroma)>16,a=Math.round(t.tone)<65;return e&&n&&a}static fixIfDisliked(t){return r.isDisliked(t)?x.from(t.hue,t.chroma,70):t}};/**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function he(r,t,e){if(r.name!==e.name)throw new Error(`Attempting to extend color ${r.name} with color ${e.name} of different name for spec version ${t}.`);if(r.isBackground!==e.isBackground)throw new Error(`Attempting to extend color ${r.name} as a ${r.isBackground?"background":"foreground"} with color ${e.name} as a ${e.isBackground?"background":"foreground"} for spec version ${t}.`)}function D(r,t,e){return he(r,t,e),c.fromPalette({name:r.name,palette:n=>n.specVersion===t?e.palette(n):r.palette(n),tone:n=>n.specVersion===t?e.tone(n):r.tone(n),isBackground:r.isBackground,chromaMultiplier:n=>{let a=n.specVersion===t?e.chromaMultiplier:r.chromaMultiplier;return a!==void 0?a(n):1},background:n=>{let a=n.specVersion===t?e.background:r.background;return a!==void 0?a(n):void 0},secondBackground:n=>{let a=n.specVersion===t?e.secondBackground:r.secondBackground;return a!==void 0?a(n):void 0},contrastCurve:n=>{let a=n.specVersion===t?e.contrastCurve:r.contrastCurve;return a!==void 0?a(n):void 0},toneDeltaPair:n=>{let a=n.specVersion===t?e.toneDeltaPair:r.toneDeltaPair;return a!==void 0?a(n):void 0}})}var c=class r{static fromPalette(t){return new r(t.name??"",t.palette,t.tone??r.getInitialToneFromBackground(t.background),t.isBackground??!1,t.chromaMultiplier,t.background,t.secondBackground,t.contrastCurve,t.toneDeltaPair)}static getInitialToneFromBackground(t){return t===void 0?e=>50:e=>t(e)?t(e).getTone(e):50}constructor(t,e,n,a,i,o,l,m,p){if(this.name=t,this.palette=e,this.tone=n,this.isBackground=a,this.chromaMultiplier=i,this.background=o,this.secondBackground=l,this.contrastCurve=m,this.toneDeltaPair=p,this.hctCache=new Map,!o&&l)throw new Error(`Color ${t} has secondBackgrounddefined, but background is not defined.`);if(!o&&m)throw new Error(`Color ${t} has contrastCurvedefined, but background is not defined.`);if(o&&!m)throw new Error(`Color ${t} has backgrounddefined, but contrastCurve is not defined.`)}clone(){return r.fromPalette({name:this.name,palette:this.palette,tone:this.tone,isBackground:this.isBackground,chromaMultiplier:this.chromaMultiplier,background:this.background,secondBackground:this.secondBackground,contrastCurve:this.contrastCurve,toneDeltaPair:this.toneDeltaPair})}clearCache(){this.hctCache.clear()}getArgb(t){return this.getHct(t).toInt()}getHct(t){let e=this.hctCache.get(t);if(e!=null)return e;let n=Jt(t.specVersion).getHct(t,this);return this.hctCache.size>4&&this.hctCache.clear(),this.hctCache.set(t,n),n}getTone(t){return Jt(t.specVersion).getTone(t,this)}static foregroundTone(t,e){let n=H.lighterUnsafe(t,e),a=H.darkerUnsafe(t,e),i=H.ratioOfTones(n,t),o=H.ratioOfTones(a,t);if(r.tonePrefersLightForeground(t)){let m=Math.abs(i-o)<.1&&i<e&&o<e;return i>=e||i>=o||m?n:a}else return o>=e||o>=i?a:n}static tonePrefersLightForeground(t){return Math.round(t)<60}static toneAllowsLightForeground(t){return Math.round(t)<=49}static enableLightForeground(t){return r.tonePrefersLightForeground(t)&&!r.toneAllowsLightForeground(t)?49:t}},Vt=class{getHct(t,e){let n=e.getTone(t);return e.palette(t).getHct(n)}getTone(t,e){let n=t.contrastLevel<0,a=e.toneDeltaPair?e.toneDeltaPair(t):void 0;if(a){let i=a.roleA,o=a.roleB,l=a.delta,m=a.polarity,p=a.stayTogether,d=m==="nearer"||m==="lighter"&&!t.isDark||m==="darker"&&t.isDark,C=d?i:o,y=d?o:i,P=e.name===C.name,f=t.isDark?1:-1,h=C.tone(t),S=y.tone(t);if(e.background&&C.contrastCurve&&y.contrastCurve){let b=e.background(t),E=C.contrastCurve(t),R=y.contrastCurve(t);if(b&&E&&R){let M=b.getTone(t),O=E.get(t.contrastLevel),B=R.get(t.contrastLevel);H.ratioOfTones(M,h)<O&&(h=c.foregroundTone(M,O)),H.ratioOfTones(M,S)<B&&(S=c.foregroundTone(M,B)),n&&(h=c.foregroundTone(M,O),S=c.foregroundTone(M,B))}}return(S-h)*f<l&&(S=N(0,100,h+l*f),(S-h)*f>=l||(h=N(0,100,S-l*f))),50<=h&&h<60?f>0?(h=60,S=Math.max(S,h+l*f)):(h=49,S=Math.min(S,h+l*f)):50<=S&&S<60&&(p?f>0?(h=60,S=Math.max(S,h+l*f)):(h=49,S=Math.min(S,h+l*f)):f>0?S=60:S=49),P?h:S}else{let i=e.tone(t);if(e.background==null||e.background(t)===void 0||e.contrastCurve==null||e.contrastCurve(t)===void 0)return i;let o=e.background(t).getTone(t),l=e.contrastCurve(t).get(t.contrastLevel);if(H.ratioOfTones(o,i)>=l||(i=c.foregroundTone(o,l)),n&&(i=c.foregroundTone(o,l)),e.isBackground&&50<=i&&i<60&&(H.ratioOfTones(49,o)>=l?i=49:i=60),e.secondBackground==null||e.secondBackground(t)===void 0)return i;let[m,p]=[e.background,e.secondBackground],[d,C]=[m(t).getTone(t),p(t).getTone(t)],[y,P]=[Math.max(d,C),Math.min(d,C)];if(H.ratioOfTones(y,i)>=l&&H.ratioOfTones(P,i)>=l)return i;let f=H.lighter(y,l),h=H.darker(P,l),S=[];return f!==-1&&S.push(f),h!==-1&&S.push(h),c.tonePrefersLightForeground(d)||c.tonePrefersLightForeground(C)?f<0?100:f:S.length===1?S[0]:h<0?0:h}}},Nt=class{getHct(t,e){let n=e.palette(t),a=e.getTone(t),i=n.hue,o=n.chroma*(e.chromaMultiplier?e.chromaMultiplier(t):1);return x.from(i,o,a)}getTone(t,e){let n=e.toneDeltaPair?e.toneDeltaPair(t):void 0;if(n){let a=n.roleA,i=n.roleB,o=n.polarity,l=n.constraint,m=o==="darker"||o==="relative_lighter"&&t.isDark||o==="relative_darker"&&!t.isDark?-n.delta:n.delta,p=e.name===a.name,d=p?a:i,C=p?i:a,y=d.tone(t),P=C.getTone(t),f=m*(p?1:-1);if(l==="exact"?y=N(0,100,P+f):l==="nearer"?f>0?y=N(0,100,N(P,P+f,y)):y=N(0,100,N(P+f,P,y)):l==="farther"&&(f>0?y=N(P+f,100,y):y=N(0,P+f,y)),e.background&&e.contrastCurve){let h=e.background(t),S=e.contrastCurve(t);if(h&&S){let b=h.getTone(t),E=S.get(t.contrastLevel);y=H.ratioOfTones(b,y)>=E&&t.contrastLevel>=0?y:c.foregroundTone(b,E)}}return e.isBackground&&!e.name.endsWith("_fixed_dim")&&(y>=57?y=N(65,100,y):y=N(0,49,y)),y}else{let a=e.tone(t);if(e.background==null||e.background(t)===void 0||e.contrastCurve==null||e.contrastCurve(t)===void 0)return a;let i=e.background(t).getTone(t),o=e.contrastCurve(t).get(t.contrastLevel);if(a=H.ratioOfTones(i,a)>=o&&t.contrastLevel>=0?a:c.foregroundTone(i,o),e.isBackground&&!e.name.endsWith("_fixed_dim")&&(a>=57?a=N(65,100,a):a=N(0,49,a)),e.secondBackground==null||e.secondBackground(t)===void 0)return a;let[l,m]=[e.background,e.secondBackground],[p,d]=[l(t).getTone(t),m(t).getTone(t)],[C,y]=[Math.max(p,d),Math.min(p,d)];if(H.ratioOfTones(C,a)>=o&&H.ratioOfTones(y,a)>=o)return a;let P=H.lighter(C,o),f=H.darker(y,o),h=[];return P!==-1&&h.push(P),f!==-1&&h.push(f),c.tonePrefersLightForeground(p)||c.tonePrefersLightForeground(d)?P<0?100:P:h.length===1?h[0]:f<0?0:f}}},me=new Vt,fe=new Nt;function Jt(r){return r==="2025"?fe:me}/**
 * @license
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */var g=class r{static fromInt(t){let e=x.fromInt(t);return r.fromHct(e)}static fromHct(t){return new r(t.hue,t.chroma,t)}static fromHueAndChroma(t,e){let n=new Ut(t,e).create();return new r(t,e,n)}constructor(t,e,n){this.hue=t,this.chroma=e,this.keyColor=n,this.cache=new Map}tone(t){let e=this.cache.get(t);return e===void 0&&(t==99&&x.isYellow(this.hue)?e=this.averageArgb(this.tone(98),this.tone(100)):e=x.from(this.hue,this.chroma,t).toInt(),this.cache.set(t,e)),e}getHct(t){return x.fromInt(this.tone(t))}averageArgb(t,e){let n=t>>>16&255,a=t>>>8&255,i=t&255,o=e>>>16&255,l=e>>>8&255,m=e&255,p=Math.round((n+o)/2),d=Math.round((a+l)/2),C=Math.round((i+m)/2);return(255<<24|(p&255)<<16|(d&255)<<8|C&255)>>>0}},Ut=class{constructor(t,e){this.hue=t,this.requestedChroma=e,this.chromaCache=new Map,this.maxChromaValue=200}create(){let a=0,i=100;for(;a<i;){let o=Math.floor((a+i)/2),l=this.maxChroma(o)<this.maxChroma(o+1);if(this.maxChroma(o)>=this.requestedChroma-.01)if(Math.abs(a-50)<Math.abs(i-50))i=o;else{if(a===o)return x.from(this.hue,this.requestedChroma,a);a=o}else l?a=o+1:i=o}return x.from(this.hue,this.requestedChroma,a)}maxChroma(t){if(this.chromaCache.has(t))return this.chromaCache.get(t);let e=x.from(this.hue,this.maxChromaValue,t).chroma;return this.chromaCache.set(t,e),e}};/**
 * @license
 * Copyright 2023 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */var gt=class r{constructor(t){this.input=t,this.hctsByTempCache=[],this.hctsByHueCache=[],this.tempsByHctCache=new Map,this.inputRelativeTemperatureCache=-1,this.complementCache=null}get hctsByTemp(){if(this.hctsByTempCache.length>0)return this.hctsByTempCache;let t=this.hctsByHue.concat([this.input]),e=this.tempsByHct;return t.sort((n,a)=>e.get(n)-e.get(a)),this.hctsByTempCache=t,t}get warmest(){return this.hctsByTemp[this.hctsByTemp.length-1]}get coldest(){return this.hctsByTemp[0]}analogous(t=5,e=12){let n=Math.round(this.input.hue),a=this.hctsByHue[n],i=this.relativeTemperature(a),o=[a],l=0;for(let f=0;f<360;f++){let h=st(n+f),S=this.hctsByHue[h],b=this.relativeTemperature(S),E=Math.abs(b-i);i=b,l+=E}let m=1,p=l/e,d=0;for(i=this.relativeTemperature(a);o.length<e;){let f=st(n+m),h=this.hctsByHue[f],S=this.relativeTemperature(h),b=Math.abs(S-i);d+=b;let E=o.length*p,R=d>=E,M=1;for(;R&&o.length<e;){o.push(h);let O=(o.length+M)*p;R=d>=O,M++}if(i=S,m++,m>360){for(;o.length<e;)o.push(h);break}}let C=[this.input],y=Math.floor((t-1)/2);for(let f=1;f<y+1;f++){let h=0-f;for(;h<0;)h=o.length+h;h>=o.length&&(h=h%o.length),C.splice(0,0,o[h])}let P=t-y-1;for(let f=1;f<P+1;f++){let h=f;for(;h<0;)h=o.length+h;h>=o.length&&(h=h%o.length),C.push(o[h])}return C}get complement(){if(this.complementCache!=null)return this.complementCache;let t=this.coldest.hue,e=this.tempsByHct.get(this.coldest),n=this.warmest.hue,i=this.tempsByHct.get(this.warmest)-e,o=r.isBetween(this.input.hue,t,n),l=o?n:t,m=o?t:n,p=1,d=1e3,C=this.hctsByHue[Math.round(this.input.hue)],y=1-this.inputRelativeTemperature;for(let P=0;P<=360;P+=1){let f=U(l+p*P);if(!r.isBetween(f,l,m))continue;let h=this.hctsByHue[Math.round(f)],S=(this.tempsByHct.get(h)-e)/i,b=Math.abs(y-S);b<d&&(d=b,C=h)}return this.complementCache=C,this.complementCache}relativeTemperature(t){let e=this.tempsByHct.get(this.warmest)-this.tempsByHct.get(this.coldest),n=this.tempsByHct.get(t)-this.tempsByHct.get(this.coldest);return e===0?.5:n/e}get inputRelativeTemperature(){return this.inputRelativeTemperatureCache>=0?this.inputRelativeTemperatureCache:(this.inputRelativeTemperatureCache=this.relativeTemperature(this.input),this.inputRelativeTemperatureCache)}get tempsByHct(){if(this.tempsByHctCache.size>0)return this.tempsByHctCache;let t=this.hctsByHue.concat([this.input]),e=new Map;for(let n of t)e.set(n,r.rawTemperature(n));return this.tempsByHctCache=e,e}get hctsByHue(){if(this.hctsByHueCache.length>0)return this.hctsByHueCache;let t=[];for(let e=0;e<=360;e+=1){let n=x.from(e,this.input.chroma,this.input.tone);t.push(n)}return this.hctsByHueCache=t,this.hctsByHueCache}static isBetween(t,e,n){return e<n?e<=t&&t<=n:e<=t||t<=n}static rawTemperature(t){let e=Ht(t.toInt()),n=U(Math.atan2(e[2],e[1])*180/Math.PI),a=Math.sqrt(e[1]*e[1]+e[2]*e[2]);return-.5+.02*Math.pow(a,1.07)*Math.cos(U(n-50)*Math.PI/180)}};/**
 * @license
 * Copyright 2023 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */var T=class{constructor(t,e,n,a){this.low=t,this.normal=e,this.medium=n,this.high=a}get(t){return t<=-1?this.low:t<0?nt(this.low,this.normal,(t- -1)/1):t<.5?nt(this.normal,this.medium,(t-0)/.5):t<1?nt(this.medium,this.high,(t-.5)/.5):this.high}};/**
 * @license
 * Copyright 2023 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */var F=class{constructor(t,e,n,a,i,o){this.roleA=t,this.roleB=e,this.delta=n,this.polarity=a,this.stayTogether=i,this.constraint=o,this.constraint=o??"exact"}};/**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */var s;(function(r){r[r.MONOCHROME=0]="MONOCHROME",r[r.NEUTRAL=1]="NEUTRAL",r[r.TONAL_SPOT=2]="TONAL_SPOT",r[r.VIBRANT=3]="VIBRANT",r[r.EXPRESSIVE=4]="EXPRESSIVE",r[r.FIDELITY=5]="FIDELITY",r[r.CONTENT=6]="CONTENT",r[r.RAINBOW=7]="RAINBOW",r[r.FRUIT_SALAD=8]="FRUIT_SALAD"})(s||(s={}));/**
 * @license
 * Copyright 2025 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function ct(r){return r.variant===s.FIDELITY||r.variant===s.CONTENT}function I(r){return r.variant===s.MONOCHROME}function pe(r,t,e,n){let a=e,i=x.from(r,t,e);if(i.chroma<t){let o=i.chroma;for(;i.chroma<t;){a+=n?-1:1;let l=x.from(r,t,a);if(o>l.chroma||Math.abs(l.chroma-t)<.4)break;let m=Math.abs(l.chroma-t),p=Math.abs(i.chroma-t);m<p&&(i=l),o=Math.max(o,l.chroma)}}return a}var kt=class{primaryPaletteKeyColor(){return c.fromPalette({name:"primary_palette_key_color",palette:t=>t.primaryPalette,tone:t=>t.primaryPalette.keyColor.tone})}secondaryPaletteKeyColor(){return c.fromPalette({name:"secondary_palette_key_color",palette:t=>t.secondaryPalette,tone:t=>t.secondaryPalette.keyColor.tone})}tertiaryPaletteKeyColor(){return c.fromPalette({name:"tertiary_palette_key_color",palette:t=>t.tertiaryPalette,tone:t=>t.tertiaryPalette.keyColor.tone})}neutralPaletteKeyColor(){return c.fromPalette({name:"neutral_palette_key_color",palette:t=>t.neutralPalette,tone:t=>t.neutralPalette.keyColor.tone})}neutralVariantPaletteKeyColor(){return c.fromPalette({name:"neutral_variant_palette_key_color",palette:t=>t.neutralVariantPalette,tone:t=>t.neutralVariantPalette.keyColor.tone})}errorPaletteKeyColor(){return c.fromPalette({name:"error_palette_key_color",palette:t=>t.errorPalette,tone:t=>t.errorPalette.keyColor.tone})}background(){return c.fromPalette({name:"background",palette:t=>t.neutralPalette,tone:t=>t.isDark?6:98,isBackground:!0})}onBackground(){return c.fromPalette({name:"on_background",palette:t=>t.neutralPalette,tone:t=>t.isDark?90:10,background:t=>this.background(),contrastCurve:t=>new T(3,3,4.5,7)})}surface(){return c.fromPalette({name:"surface",palette:t=>t.neutralPalette,tone:t=>t.isDark?6:98,isBackground:!0})}surfaceDim(){return c.fromPalette({name:"surface_dim",palette:t=>t.neutralPalette,tone:t=>t.isDark?6:new T(87,87,80,75).get(t.contrastLevel),isBackground:!0})}surfaceBright(){return c.fromPalette({name:"surface_bright",palette:t=>t.neutralPalette,tone:t=>t.isDark?new T(24,24,29,34).get(t.contrastLevel):98,isBackground:!0})}surfaceContainerLowest(){return c.fromPalette({name:"surface_container_lowest",palette:t=>t.neutralPalette,tone:t=>t.isDark?new T(4,4,2,0).get(t.contrastLevel):100,isBackground:!0})}surfaceContainerLow(){return c.fromPalette({name:"surface_container_low",palette:t=>t.neutralPalette,tone:t=>t.isDark?new T(10,10,11,12).get(t.contrastLevel):new T(96,96,96,95).get(t.contrastLevel),isBackground:!0})}surfaceContainer(){return c.fromPalette({name:"surface_container",palette:t=>t.neutralPalette,tone:t=>t.isDark?new T(12,12,16,20).get(t.contrastLevel):new T(94,94,92,90).get(t.contrastLevel),isBackground:!0})}surfaceContainerHigh(){return c.fromPalette({name:"surface_container_high",palette:t=>t.neutralPalette,tone:t=>t.isDark?new T(17,17,21,25).get(t.contrastLevel):new T(92,92,88,85).get(t.contrastLevel),isBackground:!0})}surfaceContainerHighest(){return c.fromPalette({name:"surface_container_highest",palette:t=>t.neutralPalette,tone:t=>t.isDark?new T(22,22,26,30).get(t.contrastLevel):new T(90,90,84,80).get(t.contrastLevel),isBackground:!0})}onSurface(){return c.fromPalette({name:"on_surface",palette:t=>t.neutralPalette,tone:t=>t.isDark?90:10,background:t=>this.highestSurface(t),contrastCurve:t=>new T(4.5,7,11,21)})}surfaceVariant(){return c.fromPalette({name:"surface_variant",palette:t=>t.neutralVariantPalette,tone:t=>t.isDark?30:90,isBackground:!0})}onSurfaceVariant(){return c.fromPalette({name:"on_surface_variant",palette:t=>t.neutralVariantPalette,tone:t=>t.isDark?80:30,background:t=>this.highestSurface(t),contrastCurve:t=>new T(3,4.5,7,11)})}inverseSurface(){return c.fromPalette({name:"inverse_surface",palette:t=>t.neutralPalette,tone:t=>t.isDark?90:20,isBackground:!0})}inverseOnSurface(){return c.fromPalette({name:"inverse_on_surface",palette:t=>t.neutralPalette,tone:t=>t.isDark?20:95,background:t=>this.inverseSurface(),contrastCurve:t=>new T(4.5,7,11,21)})}outline(){return c.fromPalette({name:"outline",palette:t=>t.neutralVariantPalette,tone:t=>t.isDark?60:50,background:t=>this.highestSurface(t),contrastCurve:t=>new T(1.5,3,4.5,7)})}outlineVariant(){return c.fromPalette({name:"outline_variant",palette:t=>t.neutralVariantPalette,tone:t=>t.isDark?30:80,background:t=>this.highestSurface(t),contrastCurve:t=>new T(1,1,3,4.5)})}shadow(){return c.fromPalette({name:"shadow",palette:t=>t.neutralPalette,tone:t=>0})}scrim(){return c.fromPalette({name:"scrim",palette:t=>t.neutralPalette,tone:t=>0})}surfaceTint(){return c.fromPalette({name:"surface_tint",palette:t=>t.primaryPalette,tone:t=>t.isDark?80:40,isBackground:!0})}primary(){return c.fromPalette({name:"primary",palette:t=>t.primaryPalette,tone:t=>I(t)?t.isDark?100:0:t.isDark?80:40,isBackground:!0,background:t=>this.highestSurface(t),contrastCurve:t=>new T(3,4.5,7,7),toneDeltaPair:t=>new F(this.primaryContainer(),this.primary(),10,"nearer",!1)})}primaryDim(){}onPrimary(){return c.fromPalette({name:"on_primary",palette:t=>t.primaryPalette,tone:t=>I(t)?t.isDark?10:90:t.isDark?20:100,background:t=>this.primary(),contrastCurve:t=>new T(4.5,7,11,21)})}primaryContainer(){return c.fromPalette({name:"primary_container",palette:t=>t.primaryPalette,tone:t=>ct(t)?t.sourceColorHct.tone:I(t)?t.isDark?85:25:t.isDark?30:90,isBackground:!0,background:t=>this.highestSurface(t),contrastCurve:t=>new T(1,1,3,4.5),toneDeltaPair:t=>new F(this.primaryContainer(),this.primary(),10,"nearer",!1)})}onPrimaryContainer(){return c.fromPalette({name:"on_primary_container",palette:t=>t.primaryPalette,tone:t=>ct(t)?c.foregroundTone(this.primaryContainer().tone(t),4.5):I(t)?t.isDark?0:100:t.isDark?90:30,background:t=>this.primaryContainer(),contrastCurve:t=>new T(3,4.5,7,11)})}inversePrimary(){return c.fromPalette({name:"inverse_primary",palette:t=>t.primaryPalette,tone:t=>t.isDark?40:80,background:t=>this.inverseSurface(),contrastCurve:t=>new T(3,4.5,7,7)})}secondary(){return c.fromPalette({name:"secondary",palette:t=>t.secondaryPalette,tone:t=>t.isDark?80:40,isBackground:!0,background:t=>this.highestSurface(t),contrastCurve:t=>new T(3,4.5,7,7),toneDeltaPair:t=>new F(this.secondaryContainer(),this.secondary(),10,"nearer",!1)})}secondaryDim(){}onSecondary(){return c.fromPalette({name:"on_secondary",palette:t=>t.secondaryPalette,tone:t=>I(t)?t.isDark?10:100:t.isDark?20:100,background:t=>this.secondary(),contrastCurve:t=>new T(4.5,7,11,21)})}secondaryContainer(){return c.fromPalette({name:"secondary_container",palette:t=>t.secondaryPalette,tone:t=>{let e=t.isDark?30:90;return I(t)?t.isDark?30:85:ct(t)?pe(t.secondaryPalette.hue,t.secondaryPalette.chroma,e,!t.isDark):e},isBackground:!0,background:t=>this.highestSurface(t),contrastCurve:t=>new T(1,1,3,4.5),toneDeltaPair:t=>new F(this.secondaryContainer(),this.secondary(),10,"nearer",!1)})}onSecondaryContainer(){return c.fromPalette({name:"on_secondary_container",palette:t=>t.secondaryPalette,tone:t=>I(t)?t.isDark?90:10:ct(t)?c.foregroundTone(this.secondaryContainer().tone(t),4.5):t.isDark?90:30,background:t=>this.secondaryContainer(),contrastCurve:t=>new T(3,4.5,7,11)})}tertiary(){return c.fromPalette({name:"tertiary",palette:t=>t.tertiaryPalette,tone:t=>I(t)?t.isDark?90:25:t.isDark?80:40,isBackground:!0,background:t=>this.highestSurface(t),contrastCurve:t=>new T(3,4.5,7,7),toneDeltaPair:t=>new F(this.tertiaryContainer(),this.tertiary(),10,"nearer",!1)})}tertiaryDim(){}onTertiary(){return c.fromPalette({name:"on_tertiary",palette:t=>t.tertiaryPalette,tone:t=>I(t)?t.isDark?10:90:t.isDark?20:100,background:t=>this.tertiary(),contrastCurve:t=>new T(4.5,7,11,21)})}tertiaryContainer(){return c.fromPalette({name:"tertiary_container",palette:t=>t.tertiaryPalette,tone:t=>{if(I(t))return t.isDark?60:49;if(!ct(t))return t.isDark?30:90;let e=t.tertiaryPalette.getHct(t.sourceColorHct.tone);return ot.fixIfDisliked(e).tone},isBackground:!0,background:t=>this.highestSurface(t),contrastCurve:t=>new T(1,1,3,4.5),toneDeltaPair:t=>new F(this.tertiaryContainer(),this.tertiary(),10,"nearer",!1)})}onTertiaryContainer(){return c.fromPalette({name:"on_tertiary_container",palette:t=>t.tertiaryPalette,tone:t=>I(t)?t.isDark?0:100:ct(t)?c.foregroundTone(this.tertiaryContainer().tone(t),4.5):t.isDark?90:30,background:t=>this.tertiaryContainer(),contrastCurve:t=>new T(3,4.5,7,11)})}error(){return c.fromPalette({name:"error",palette:t=>t.errorPalette,tone:t=>t.isDark?80:40,isBackground:!0,background:t=>this.highestSurface(t),contrastCurve:t=>new T(3,4.5,7,7),toneDeltaPair:t=>new F(this.errorContainer(),this.error(),10,"nearer",!1)})}errorDim(){}onError(){return c.fromPalette({name:"on_error",palette:t=>t.errorPalette,tone:t=>t.isDark?20:100,background:t=>this.error(),contrastCurve:t=>new T(4.5,7,11,21)})}errorContainer(){return c.fromPalette({name:"error_container",palette:t=>t.errorPalette,tone:t=>t.isDark?30:90,isBackground:!0,background:t=>this.highestSurface(t),contrastCurve:t=>new T(1,1,3,4.5),toneDeltaPair:t=>new F(this.errorContainer(),this.error(),10,"nearer",!1)})}onErrorContainer(){return c.fromPalette({name:"on_error_container",palette:t=>t.errorPalette,tone:t=>I(t)?t.isDark?90:10:t.isDark?90:30,background:t=>this.errorContainer(),contrastCurve:t=>new T(3,4.5,7,11)})}primaryFixed(){return c.fromPalette({name:"primary_fixed",palette:t=>t.primaryPalette,tone:t=>I(t)?40:90,isBackground:!0,background:t=>this.highestSurface(t),contrastCurve:t=>new T(1,1,3,4.5),toneDeltaPair:t=>new F(this.primaryFixed(),this.primaryFixedDim(),10,"lighter",!0)})}primaryFixedDim(){return c.fromPalette({name:"primary_fixed_dim",palette:t=>t.primaryPalette,tone:t=>I(t)?30:80,isBackground:!0,background:t=>this.highestSurface(t),contrastCurve:t=>new T(1,1,3,4.5),toneDeltaPair:t=>new F(this.primaryFixed(),this.primaryFixedDim(),10,"lighter",!0)})}onPrimaryFixed(){return c.fromPalette({name:"on_primary_fixed",palette:t=>t.primaryPalette,tone:t=>I(t)?100:10,background:t=>this.primaryFixedDim(),secondBackground:t=>this.primaryFixed(),contrastCurve:t=>new T(4.5,7,11,21)})}onPrimaryFixedVariant(){return c.fromPalette({name:"on_primary_fixed_variant",palette:t=>t.primaryPalette,tone:t=>I(t)?90:30,background:t=>this.primaryFixedDim(),secondBackground:t=>this.primaryFixed(),contrastCurve:t=>new T(3,4.5,7,11)})}secondaryFixed(){return c.fromPalette({name:"secondary_fixed",palette:t=>t.secondaryPalette,tone:t=>I(t)?80:90,isBackground:!0,background:t=>this.highestSurface(t),contrastCurve:t=>new T(1,1,3,4.5),toneDeltaPair:t=>new F(this.secondaryFixed(),this.secondaryFixedDim(),10,"lighter",!0)})}secondaryFixedDim(){return c.fromPalette({name:"secondary_fixed_dim",palette:t=>t.secondaryPalette,tone:t=>I(t)?70:80,isBackground:!0,background:t=>this.highestSurface(t),contrastCurve:t=>new T(1,1,3,4.5),toneDeltaPair:t=>new F(this.secondaryFixed(),this.secondaryFixedDim(),10,"lighter",!0)})}onSecondaryFixed(){return c.fromPalette({name:"on_secondary_fixed",palette:t=>t.secondaryPalette,tone:t=>10,background:t=>this.secondaryFixedDim(),secondBackground:t=>this.secondaryFixed(),contrastCurve:t=>new T(4.5,7,11,21)})}onSecondaryFixedVariant(){return c.fromPalette({name:"on_secondary_fixed_variant",palette:t=>t.secondaryPalette,tone:t=>I(t)?25:30,background:t=>this.secondaryFixedDim(),secondBackground:t=>this.secondaryFixed(),contrastCurve:t=>new T(3,4.5,7,11)})}tertiaryFixed(){return c.fromPalette({name:"tertiary_fixed",palette:t=>t.tertiaryPalette,tone:t=>I(t)?40:90,isBackground:!0,background:t=>this.highestSurface(t),contrastCurve:t=>new T(1,1,3,4.5),toneDeltaPair:t=>new F(this.tertiaryFixed(),this.tertiaryFixedDim(),10,"lighter",!0)})}tertiaryFixedDim(){return c.fromPalette({name:"tertiary_fixed_dim",palette:t=>t.tertiaryPalette,tone:t=>I(t)?30:80,isBackground:!0,background:t=>this.highestSurface(t),contrastCurve:t=>new T(1,1,3,4.5),toneDeltaPair:t=>new F(this.tertiaryFixed(),this.tertiaryFixedDim(),10,"lighter",!0)})}onTertiaryFixed(){return c.fromPalette({name:"on_tertiary_fixed",palette:t=>t.tertiaryPalette,tone:t=>I(t)?100:10,background:t=>this.tertiaryFixedDim(),secondBackground:t=>this.tertiaryFixed(),contrastCurve:t=>new T(4.5,7,11,21)})}onTertiaryFixedVariant(){return c.fromPalette({name:"on_tertiary_fixed_variant",palette:t=>t.tertiaryPalette,tone:t=>I(t)?90:30,background:t=>this.tertiaryFixedDim(),secondBackground:t=>this.tertiaryFixed(),contrastCurve:t=>new T(3,4.5,7,11)})}highestSurface(t){return t.isDark?this.surfaceBright():this.surfaceDim()}};/**
 * @license
 * Copyright 2025 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function k(r,t=0,e=100,n=1){let a=Zt(r.hue,r.chroma*n,100,!0);return N(t,e,a)}function rt(r,t=0,e=100){let n=Zt(r.hue,r.chroma,0,!1);return N(t,e,n)}function Zt(r,t,e,n){let a=e,i=x.from(r,t,a);for(;i.chroma<t&&!(e<0||e>100);){e+=n?-1:1;let o=x.from(r,t,e);i.chroma<o.chroma&&(i=o,a=e)}return a}function A(r){return r===1.5?new T(1.5,1.5,3,5.5):r===3?new T(3,3,4.5,7):r===4.5?new T(4.5,4.5,7,11):r===6?new T(6,6,7,11):r===7?new T(7,7,11,21):r===9?new T(9,9,11,21):r===11?new T(11,11,21,21):r===21?new T(21,21,21,21):new T(r,r,7,21)}var bt=class extends kt{surface(){let t=c.fromPalette({name:"surface",palette:e=>e.neutralPalette,tone:e=>(super.surface().tone(e),e.platform==="phone"?e.isDark?4:x.isYellow(e.neutralPalette.hue)?99:e.variant===s.VIBRANT?97:98:0),isBackground:!0});return D(super.surface(),"2025",t)}surfaceDim(){let t=c.fromPalette({name:"surface_dim",palette:e=>e.neutralPalette,tone:e=>e.isDark?4:x.isYellow(e.neutralPalette.hue)?90:e.variant===s.VIBRANT?85:87,isBackground:!0,chromaMultiplier:e=>{if(!e.isDark){if(e.variant===s.NEUTRAL)return 2.5;if(e.variant===s.TONAL_SPOT)return 1.7;if(e.variant===s.EXPRESSIVE)return x.isYellow(e.neutralPalette.hue)?2.7:1.75;if(e.variant===s.VIBRANT)return 1.36}return 1}});return D(super.surfaceDim(),"2025",t)}surfaceBright(){let t=c.fromPalette({name:"surface_bright",palette:e=>e.neutralPalette,tone:e=>e.isDark?18:x.isYellow(e.neutralPalette.hue)?99:e.variant===s.VIBRANT?97:98,isBackground:!0,chromaMultiplier:e=>{if(e.isDark){if(e.variant===s.NEUTRAL)return 2.5;if(e.variant===s.TONAL_SPOT)return 1.7;if(e.variant===s.EXPRESSIVE)return x.isYellow(e.neutralPalette.hue)?2.7:1.75;if(e.variant===s.VIBRANT)return 1.36}return 1}});return D(super.surfaceBright(),"2025",t)}surfaceContainerLowest(){let t=c.fromPalette({name:"surface_container_lowest",palette:e=>e.neutralPalette,tone:e=>e.isDark?0:100,isBackground:!0});return D(super.surfaceContainerLowest(),"2025",t)}surfaceContainerLow(){let t=c.fromPalette({name:"surface_container_low",palette:e=>e.neutralPalette,tone:e=>e.platform==="phone"?e.isDark?6:x.isYellow(e.neutralPalette.hue)?98:e.variant===s.VIBRANT?95:96:15,isBackground:!0,chromaMultiplier:e=>{if(e.platform==="phone"){if(e.variant===s.NEUTRAL)return 1.3;if(e.variant===s.TONAL_SPOT)return 1.25;if(e.variant===s.EXPRESSIVE)return x.isYellow(e.neutralPalette.hue)?1.3:1.15;if(e.variant===s.VIBRANT)return 1.08}return 1}});return D(super.surfaceContainerLow(),"2025",t)}surfaceContainer(){let t=c.fromPalette({name:"surface_container",palette:e=>e.neutralPalette,tone:e=>e.platform==="phone"?e.isDark?9:x.isYellow(e.neutralPalette.hue)?96:e.variant===s.VIBRANT?92:94:20,isBackground:!0,chromaMultiplier:e=>{if(e.platform==="phone"){if(e.variant===s.NEUTRAL)return 1.6;if(e.variant===s.TONAL_SPOT)return 1.4;if(e.variant===s.EXPRESSIVE)return x.isYellow(e.neutralPalette.hue)?1.6:1.3;if(e.variant===s.VIBRANT)return 1.15}return 1}});return D(super.surfaceContainer(),"2025",t)}surfaceContainerHigh(){let t=c.fromPalette({name:"surface_container_high",palette:e=>e.neutralPalette,tone:e=>e.platform==="phone"?e.isDark?12:x.isYellow(e.neutralPalette.hue)?94:e.variant===s.VIBRANT?90:92:25,isBackground:!0,chromaMultiplier:e=>{if(e.platform==="phone"){if(e.variant===s.NEUTRAL)return 1.9;if(e.variant===s.TONAL_SPOT)return 1.5;if(e.variant===s.EXPRESSIVE)return x.isYellow(e.neutralPalette.hue)?1.95:1.45;if(e.variant===s.VIBRANT)return 1.22}return 1}});return D(super.surfaceContainerHigh(),"2025",t)}surfaceContainerHighest(){let t=c.fromPalette({name:"surface_container_highest",palette:e=>e.neutralPalette,tone:e=>e.isDark?15:x.isYellow(e.neutralPalette.hue)?92:e.variant===s.VIBRANT?88:90,isBackground:!0,chromaMultiplier:e=>e.variant===s.NEUTRAL?2.2:e.variant===s.TONAL_SPOT?1.7:e.variant===s.EXPRESSIVE?x.isYellow(e.neutralPalette.hue)?2.3:1.6:e.variant===s.VIBRANT?1.29:1});return D(super.surfaceContainerHighest(),"2025",t)}onSurface(){let t=c.fromPalette({name:"on_surface",palette:e=>e.neutralPalette,tone:e=>e.variant===s.VIBRANT?k(e.neutralPalette,0,100,1.1):c.getInitialToneFromBackground(n=>n.platform==="phone"?this.highestSurface(n):this.surfaceContainerHigh())(e),chromaMultiplier:e=>{if(e.platform==="phone"){if(e.variant===s.NEUTRAL)return 2.2;if(e.variant===s.TONAL_SPOT)return 1.7;if(e.variant===s.EXPRESSIVE)return x.isYellow(e.neutralPalette.hue)?e.isDark?3:2.3:1.6}return 1},background:e=>e.platform==="phone"?this.highestSurface(e):this.surfaceContainerHigh(),contrastCurve:e=>e.isDark&&e.platform==="phone"?A(11):A(9)});return D(super.onSurface(),"2025",t)}onSurfaceVariant(){let t=c.fromPalette({name:"on_surface_variant",palette:e=>e.neutralPalette,chromaMultiplier:e=>{if(e.platform==="phone"){if(e.variant===s.NEUTRAL)return 2.2;if(e.variant===s.TONAL_SPOT)return 1.7;if(e.variant===s.EXPRESSIVE)return x.isYellow(e.neutralPalette.hue)?e.isDark?3:2.3:1.6}return 1},background:e=>e.platform==="phone"?this.highestSurface(e):this.surfaceContainerHigh(),contrastCurve:e=>e.platform==="phone"?e.isDark?A(6):A(4.5):A(7)});return D(super.onSurfaceVariant(),"2025",t)}outline(){let t=c.fromPalette({name:"outline",palette:e=>e.neutralPalette,chromaMultiplier:e=>{if(e.platform==="phone"){if(e.variant===s.NEUTRAL)return 2.2;if(e.variant===s.TONAL_SPOT)return 1.7;if(e.variant===s.EXPRESSIVE)return x.isYellow(e.neutralPalette.hue)?e.isDark?3:2.3:1.6}return 1},background:e=>e.platform==="phone"?this.highestSurface(e):this.surfaceContainerHigh(),contrastCurve:e=>e.platform==="phone"?A(3):A(4.5)});return D(super.outline(),"2025",t)}outlineVariant(){let t=c.fromPalette({name:"outline_variant",palette:e=>e.neutralPalette,chromaMultiplier:e=>{if(e.platform==="phone"){if(e.variant===s.NEUTRAL)return 2.2;if(e.variant===s.TONAL_SPOT)return 1.7;if(e.variant===s.EXPRESSIVE)return x.isYellow(e.neutralPalette.hue)?e.isDark?3:2.3:1.6}return 1},background:e=>e.platform==="phone"?this.highestSurface(e):this.surfaceContainerHigh(),contrastCurve:e=>e.platform==="phone"?A(1.5):A(3)});return D(super.outlineVariant(),"2025",t)}inverseSurface(){let t=c.fromPalette({name:"inverse_surface",palette:e=>e.neutralPalette,tone:e=>e.isDark?98:4,isBackground:!0});return D(super.inverseSurface(),"2025",t)}inverseOnSurface(){let t=c.fromPalette({name:"inverse_on_surface",palette:e=>e.neutralPalette,background:e=>this.inverseSurface(),contrastCurve:e=>A(7)});return D(super.inverseOnSurface(),"2025",t)}primary(){let t=c.fromPalette({name:"primary",palette:e=>e.primaryPalette,tone:e=>e.variant===s.NEUTRAL?e.platform==="phone"?e.isDark?80:40:90:e.variant===s.TONAL_SPOT?e.platform==="phone"?e.isDark?80:k(e.primaryPalette):k(e.primaryPalette,0,90):e.variant===s.EXPRESSIVE?e.platform==="phone"?k(e.primaryPalette,0,x.isYellow(e.primaryPalette.hue)?25:x.isCyan(e.primaryPalette.hue)?88:98):k(e.primaryPalette):e.platform==="phone"?k(e.primaryPalette,0,x.isCyan(e.primaryPalette.hue)?88:98):k(e.primaryPalette),isBackground:!0,background:e=>e.platform==="phone"?this.highestSurface(e):this.surfaceContainerHigh(),contrastCurve:e=>e.platform==="phone"?A(4.5):A(7),toneDeltaPair:e=>e.platform==="phone"?new F(this.primaryContainer(),this.primary(),5,"relative_lighter",!0,"farther"):void 0});return D(super.primary(),"2025",t)}primaryDim(){return c.fromPalette({name:"primary_dim",palette:t=>t.primaryPalette,tone:t=>t.variant===s.NEUTRAL?85:t.variant===s.TONAL_SPOT?k(t.primaryPalette,0,90):k(t.primaryPalette),isBackground:!0,background:t=>this.surfaceContainerHigh(),contrastCurve:t=>A(4.5),toneDeltaPair:t=>new F(this.primaryDim(),this.primary(),5,"darker",!0,"farther")})}onPrimary(){let t=c.fromPalette({name:"on_primary",palette:e=>e.primaryPalette,background:e=>e.platform==="phone"?this.primary():this.primaryDim(),contrastCurve:e=>e.platform==="phone"?A(6):A(7)});return D(super.onPrimary(),"2025",t)}primaryContainer(){let t=c.fromPalette({name:"primary_container",palette:e=>e.primaryPalette,tone:e=>e.platform==="watch"?30:e.variant===s.NEUTRAL?e.isDark?30:90:e.variant===s.TONAL_SPOT?e.isDark?rt(e.primaryPalette,35,93):k(e.primaryPalette,0,90):e.variant===s.EXPRESSIVE?e.isDark?k(e.primaryPalette,30,93):k(e.primaryPalette,78,x.isCyan(e.primaryPalette.hue)?88:90):e.isDark?rt(e.primaryPalette,66,93):k(e.primaryPalette,66,x.isCyan(e.primaryPalette.hue)?88:93),isBackground:!0,background:e=>e.platform==="phone"?this.highestSurface(e):void 0,toneDeltaPair:e=>e.platform==="phone"?void 0:new F(this.primaryContainer(),this.primaryDim(),10,"darker",!0,"farther"),contrastCurve:e=>e.platform==="phone"&&e.contrastLevel>0?A(1.5):void 0});return D(super.primaryContainer(),"2025",t)}onPrimaryContainer(){let t=c.fromPalette({name:"on_primary_container",palette:e=>e.primaryPalette,background:e=>this.primaryContainer(),contrastCurve:e=>e.platform==="phone"?A(6):A(7)});return D(super.onPrimaryContainer(),"2025",t)}primaryFixed(){let t=c.fromPalette({name:"primary_fixed",palette:e=>e.primaryPalette,tone:e=>{let n=Object.assign({},e,{isDark:!1,contrastLevel:0});return this.primaryContainer().getTone(n)},isBackground:!0,background:e=>e.platform==="phone"?this.highestSurface(e):void 0,contrastCurve:e=>e.platform==="phone"&&e.contrastLevel>0?A(1.5):void 0});return D(super.primaryFixed(),"2025",t)}primaryFixedDim(){let t=c.fromPalette({name:"primary_fixed_dim",palette:e=>e.primaryPalette,tone:e=>this.primaryFixed().getTone(e),isBackground:!0,toneDeltaPair:e=>new F(this.primaryFixedDim(),this.primaryFixed(),5,"darker",!0,"exact")});return D(super.primaryFixedDim(),"2025",t)}onPrimaryFixed(){let t=c.fromPalette({name:"on_primary_fixed",palette:e=>e.primaryPalette,background:e=>this.primaryFixedDim(),contrastCurve:e=>A(7)});return D(super.onPrimaryFixed(),"2025",t)}onPrimaryFixedVariant(){let t=c.fromPalette({name:"on_primary_fixed_variant",palette:e=>e.primaryPalette,background:e=>this.primaryFixedDim(),contrastCurve:e=>A(4.5)});return D(super.onPrimaryFixedVariant(),"2025",t)}inversePrimary(){let t=c.fromPalette({name:"inverse_primary",palette:e=>e.primaryPalette,tone:e=>k(e.primaryPalette),background:e=>this.inverseSurface(),contrastCurve:e=>e.platform==="phone"?A(6):A(7)});return D(super.inversePrimary(),"2025",t)}secondary(){let t=c.fromPalette({name:"secondary",palette:e=>e.secondaryPalette,tone:e=>e.platform==="watch"?e.variant===s.NEUTRAL?90:k(e.secondaryPalette,0,90):e.variant===s.NEUTRAL?e.isDark?rt(e.secondaryPalette,0,98):k(e.secondaryPalette):e.variant===s.VIBRANT?k(e.secondaryPalette,0,e.isDark?90:98):e.isDark?80:k(e.secondaryPalette),isBackground:!0,background:e=>e.platform==="phone"?this.highestSurface(e):this.surfaceContainerHigh(),contrastCurve:e=>e.platform==="phone"?A(4.5):A(7),toneDeltaPair:e=>e.platform==="phone"?new F(this.secondaryContainer(),this.secondary(),5,"relative_lighter",!0,"farther"):void 0});return D(super.secondary(),"2025",t)}secondaryDim(){return c.fromPalette({name:"secondary_dim",palette:t=>t.secondaryPalette,tone:t=>t.variant===s.NEUTRAL?85:k(t.secondaryPalette,0,90),isBackground:!0,background:t=>this.surfaceContainerHigh(),contrastCurve:t=>A(4.5),toneDeltaPair:t=>new F(this.secondaryDim(),this.secondary(),5,"darker",!0,"farther")})}onSecondary(){let t=c.fromPalette({name:"on_secondary",palette:e=>e.secondaryPalette,background:e=>e.platform==="phone"?this.secondary():this.secondaryDim(),contrastCurve:e=>e.platform==="phone"?A(6):A(7)});return D(super.onSecondary(),"2025",t)}secondaryContainer(){let t=c.fromPalette({name:"secondary_container",palette:e=>e.secondaryPalette,tone:e=>e.platform==="watch"?30:e.variant===s.VIBRANT?e.isDark?rt(e.secondaryPalette,30,40):k(e.secondaryPalette,84,90):e.variant===s.EXPRESSIVE?e.isDark?15:k(e.secondaryPalette,90,95):e.isDark?25:90,isBackground:!0,background:e=>e.platform==="phone"?this.highestSurface(e):void 0,toneDeltaPair:e=>e.platform==="watch"?new F(this.secondaryContainer(),this.secondaryDim(),10,"darker",!0,"farther"):void 0,contrastCurve:e=>e.platform==="phone"&&e.contrastLevel>0?A(1.5):void 0});return D(super.secondaryContainer(),"2025",t)}onSecondaryContainer(){let t=c.fromPalette({name:"on_secondary_container",palette:e=>e.secondaryPalette,background:e=>this.secondaryContainer(),contrastCurve:e=>e.platform==="phone"?A(6):A(7)});return D(super.onSecondaryContainer(),"2025",t)}secondaryFixed(){let t=c.fromPalette({name:"secondary_fixed",palette:e=>e.secondaryPalette,tone:e=>{let n=Object.assign({},e,{isDark:!1,contrastLevel:0});return this.secondaryContainer().getTone(n)},isBackground:!0,background:e=>e.platform==="phone"?this.highestSurface(e):void 0,contrastCurve:e=>e.platform==="phone"&&e.contrastLevel>0?A(1.5):void 0});return D(super.secondaryFixed(),"2025",t)}secondaryFixedDim(){let t=c.fromPalette({name:"secondary_fixed_dim",palette:e=>e.secondaryPalette,tone:e=>this.secondaryFixed().getTone(e),isBackground:!0,toneDeltaPair:e=>new F(this.secondaryFixedDim(),this.secondaryFixed(),5,"darker",!0,"exact")});return D(super.secondaryFixedDim(),"2025",t)}onSecondaryFixed(){let t=c.fromPalette({name:"on_secondary_fixed",palette:e=>e.secondaryPalette,background:e=>this.secondaryFixedDim(),contrastCurve:e=>A(7)});return D(super.onSecondaryFixed(),"2025",t)}onSecondaryFixedVariant(){let t=c.fromPalette({name:"on_secondary_fixed_variant",palette:e=>e.secondaryPalette,background:e=>this.secondaryFixedDim(),contrastCurve:e=>A(4.5)});return D(super.onSecondaryFixedVariant(),"2025",t)}tertiary(){let t=c.fromPalette({name:"tertiary",palette:e=>e.tertiaryPalette,tone:e=>e.platform==="watch"?e.variant===s.TONAL_SPOT?k(e.tertiaryPalette,0,90):k(e.tertiaryPalette):e.variant===s.EXPRESSIVE||e.variant===s.VIBRANT?k(e.tertiaryPalette,0,x.isCyan(e.tertiaryPalette.hue)?88:e.isDark?98:100):e.isDark?k(e.tertiaryPalette,0,98):k(e.tertiaryPalette),isBackground:!0,background:e=>e.platform==="phone"?this.highestSurface(e):this.surfaceContainerHigh(),contrastCurve:e=>e.platform==="phone"?A(4.5):A(7),toneDeltaPair:e=>e.platform==="phone"?new F(this.tertiaryContainer(),this.tertiary(),5,"relative_lighter",!0,"farther"):void 0});return D(super.tertiary(),"2025",t)}tertiaryDim(){return c.fromPalette({name:"tertiary_dim",palette:t=>t.tertiaryPalette,tone:t=>t.variant===s.TONAL_SPOT?k(t.tertiaryPalette,0,90):k(t.tertiaryPalette),isBackground:!0,background:t=>this.surfaceContainerHigh(),contrastCurve:t=>A(4.5),toneDeltaPair:t=>new F(this.tertiaryDim(),this.tertiary(),5,"darker",!0,"farther")})}onTertiary(){let t=c.fromPalette({name:"on_tertiary",palette:e=>e.tertiaryPalette,background:e=>e.platform==="phone"?this.tertiary():this.tertiaryDim(),contrastCurve:e=>e.platform==="phone"?A(6):A(7)});return D(super.onTertiary(),"2025",t)}tertiaryContainer(){let t=c.fromPalette({name:"tertiary_container",palette:e=>e.tertiaryPalette,tone:e=>e.platform==="watch"?e.variant===s.TONAL_SPOT?k(e.tertiaryPalette,0,90):k(e.tertiaryPalette):e.variant===s.NEUTRAL?e.isDark?k(e.tertiaryPalette,0,93):k(e.tertiaryPalette,0,96):e.variant===s.TONAL_SPOT?k(e.tertiaryPalette,0,e.isDark?93:100):e.variant===s.EXPRESSIVE?k(e.tertiaryPalette,75,x.isCyan(e.tertiaryPalette.hue)?88:e.isDark?93:100):e.isDark?k(e.tertiaryPalette,0,93):k(e.tertiaryPalette,72,100),isBackground:!0,background:e=>e.platform==="phone"?this.highestSurface(e):void 0,toneDeltaPair:e=>e.platform==="watch"?new F(this.tertiaryContainer(),this.tertiaryDim(),10,"darker",!0,"farther"):void 0,contrastCurve:e=>e.platform==="phone"&&e.contrastLevel>0?A(1.5):void 0});return D(super.tertiaryContainer(),"2025",t)}onTertiaryContainer(){let t=c.fromPalette({name:"on_tertiary_container",palette:e=>e.tertiaryPalette,background:e=>this.tertiaryContainer(),contrastCurve:e=>e.platform==="phone"?A(6):A(7)});return D(super.onTertiaryContainer(),"2025",t)}tertiaryFixed(){let t=c.fromPalette({name:"tertiary_fixed",palette:e=>e.tertiaryPalette,tone:e=>{let n=Object.assign({},e,{isDark:!1,contrastLevel:0});return this.tertiaryContainer().getTone(n)},isBackground:!0,background:e=>e.platform==="phone"?this.highestSurface(e):void 0,contrastCurve:e=>e.platform==="phone"&&e.contrastLevel>0?A(1.5):void 0});return D(super.tertiaryFixed(),"2025",t)}tertiaryFixedDim(){let t=c.fromPalette({name:"tertiary_fixed_dim",palette:e=>e.tertiaryPalette,tone:e=>this.tertiaryFixed().getTone(e),isBackground:!0,toneDeltaPair:e=>new F(this.tertiaryFixedDim(),this.tertiaryFixed(),5,"darker",!0,"exact")});return D(super.tertiaryFixedDim(),"2025",t)}onTertiaryFixed(){let t=c.fromPalette({name:"on_tertiary_fixed",palette:e=>e.tertiaryPalette,background:e=>this.tertiaryFixedDim(),contrastCurve:e=>A(7)});return D(super.onTertiaryFixed(),"2025",t)}onTertiaryFixedVariant(){let t=c.fromPalette({name:"on_tertiary_fixed_variant",palette:e=>e.tertiaryPalette,background:e=>this.tertiaryFixedDim(),contrastCurve:e=>A(4.5)});return D(super.onTertiaryFixedVariant(),"2025",t)}error(){let t=c.fromPalette({name:"error",palette:e=>e.errorPalette,tone:e=>e.platform==="phone"?e.isDark?rt(e.errorPalette,0,98):k(e.errorPalette):rt(e.errorPalette),isBackground:!0,background:e=>e.platform==="phone"?this.highestSurface(e):this.surfaceContainerHigh(),contrastCurve:e=>e.platform==="phone"?A(4.5):A(7),toneDeltaPair:e=>e.platform==="phone"?new F(this.errorContainer(),this.error(),5,"relative_lighter",!0,"farther"):void 0});return D(super.error(),"2025",t)}errorDim(){return c.fromPalette({name:"error_dim",palette:t=>t.errorPalette,tone:t=>rt(t.errorPalette),isBackground:!0,background:t=>this.surfaceContainerHigh(),contrastCurve:t=>A(4.5),toneDeltaPair:t=>new F(this.errorDim(),this.error(),5,"darker",!0,"farther")})}onError(){let t=c.fromPalette({name:"on_error",palette:e=>e.errorPalette,background:e=>e.platform==="phone"?this.error():this.errorDim(),contrastCurve:e=>e.platform==="phone"?A(6):A(7)});return D(super.onError(),"2025",t)}errorContainer(){let t=c.fromPalette({name:"error_container",palette:e=>e.errorPalette,tone:e=>e.platform==="watch"?30:e.isDark?rt(e.errorPalette,30,93):k(e.errorPalette,0,90),isBackground:!0,background:e=>e.platform==="phone"?this.highestSurface(e):void 0,toneDeltaPair:e=>e.platform==="watch"?new F(this.errorContainer(),this.errorDim(),10,"darker",!0,"farther"):void 0,contrastCurve:e=>e.platform==="phone"&&e.contrastLevel>0?A(1.5):void 0});return D(super.errorContainer(),"2025",t)}onErrorContainer(){let t=c.fromPalette({name:"on_error_container",palette:e=>e.errorPalette,background:e=>this.errorContainer(),contrastCurve:e=>e.platform==="phone"?A(4.5):A(7)});return D(super.onErrorContainer(),"2025",t)}surfaceVariant(){let t=Object.assign(this.surfaceContainerHighest().clone(),{name:"surface_variant"});return D(super.surfaceVariant(),"2025",t)}surfaceTint(){let t=Object.assign(this.primary().clone(),{name:"surface_tint"});return D(super.surfaceTint(),"2025",t)}background(){let t=Object.assign(this.surface().clone(),{name:"background"});return D(super.background(),"2025",t)}onBackground(){let t=Object.assign(this.onSurface().clone(),{name:"on_background",tone:e=>e.platform==="watch"?100:this.onSurface().getTone(e)});return D(super.onBackground(),"2025",t)}};/**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */var u=class r{constructor(){this.allColors=[this.background(),this.onBackground(),this.surface(),this.surfaceDim(),this.surfaceBright(),this.surfaceContainerLowest(),this.surfaceContainerLow(),this.surfaceContainer(),this.surfaceContainerHigh(),this.surfaceContainerHighest(),this.onSurface(),this.onSurfaceVariant(),this.outline(),this.outlineVariant(),this.inverseSurface(),this.inverseOnSurface(),this.primary(),this.primaryDim(),this.onPrimary(),this.primaryContainer(),this.onPrimaryContainer(),this.primaryFixed(),this.primaryFixedDim(),this.onPrimaryFixed(),this.onPrimaryFixedVariant(),this.inversePrimary(),this.secondary(),this.secondaryDim(),this.onSecondary(),this.secondaryContainer(),this.onSecondaryContainer(),this.secondaryFixed(),this.secondaryFixedDim(),this.onSecondaryFixed(),this.onSecondaryFixedVariant(),this.tertiary(),this.tertiaryDim(),this.onTertiary(),this.tertiaryContainer(),this.onTertiaryContainer(),this.tertiaryFixed(),this.tertiaryFixedDim(),this.onTertiaryFixed(),this.onTertiaryFixedVariant(),this.error(),this.errorDim(),this.onError(),this.errorContainer(),this.onErrorContainer()].filter(t=>t!==void 0)}highestSurface(t){return r.colorSpec.highestSurface(t)}primaryPaletteKeyColor(){return r.colorSpec.primaryPaletteKeyColor()}secondaryPaletteKeyColor(){return r.colorSpec.secondaryPaletteKeyColor()}tertiaryPaletteKeyColor(){return r.colorSpec.tertiaryPaletteKeyColor()}neutralPaletteKeyColor(){return r.colorSpec.neutralPaletteKeyColor()}neutralVariantPaletteKeyColor(){return r.colorSpec.neutralVariantPaletteKeyColor()}errorPaletteKeyColor(){return r.colorSpec.errorPaletteKeyColor()}background(){return r.colorSpec.background()}onBackground(){return r.colorSpec.onBackground()}surface(){return r.colorSpec.surface()}surfaceDim(){return r.colorSpec.surfaceDim()}surfaceBright(){return r.colorSpec.surfaceBright()}surfaceContainerLowest(){return r.colorSpec.surfaceContainerLowest()}surfaceContainerLow(){return r.colorSpec.surfaceContainerLow()}surfaceContainer(){return r.colorSpec.surfaceContainer()}surfaceContainerHigh(){return r.colorSpec.surfaceContainerHigh()}surfaceContainerHighest(){return r.colorSpec.surfaceContainerHighest()}onSurface(){return r.colorSpec.onSurface()}surfaceVariant(){return r.colorSpec.surfaceVariant()}onSurfaceVariant(){return r.colorSpec.onSurfaceVariant()}outline(){return r.colorSpec.outline()}outlineVariant(){return r.colorSpec.outlineVariant()}inverseSurface(){return r.colorSpec.inverseSurface()}inverseOnSurface(){return r.colorSpec.inverseOnSurface()}shadow(){return r.colorSpec.shadow()}scrim(){return r.colorSpec.scrim()}surfaceTint(){return r.colorSpec.surfaceTint()}primary(){return r.colorSpec.primary()}primaryDim(){return r.colorSpec.primaryDim()}onPrimary(){return r.colorSpec.onPrimary()}primaryContainer(){return r.colorSpec.primaryContainer()}onPrimaryContainer(){return r.colorSpec.onPrimaryContainer()}inversePrimary(){return r.colorSpec.inversePrimary()}primaryFixed(){return r.colorSpec.primaryFixed()}primaryFixedDim(){return r.colorSpec.primaryFixedDim()}onPrimaryFixed(){return r.colorSpec.onPrimaryFixed()}onPrimaryFixedVariant(){return r.colorSpec.onPrimaryFixedVariant()}secondary(){return r.colorSpec.secondary()}secondaryDim(){return r.colorSpec.secondaryDim()}onSecondary(){return r.colorSpec.onSecondary()}secondaryContainer(){return r.colorSpec.secondaryContainer()}onSecondaryContainer(){return r.colorSpec.onSecondaryContainer()}secondaryFixed(){return r.colorSpec.secondaryFixed()}secondaryFixedDim(){return r.colorSpec.secondaryFixedDim()}onSecondaryFixed(){return r.colorSpec.onSecondaryFixed()}onSecondaryFixedVariant(){return r.colorSpec.onSecondaryFixedVariant()}tertiary(){return r.colorSpec.tertiary()}tertiaryDim(){return r.colorSpec.tertiaryDim()}onTertiary(){return r.colorSpec.onTertiary()}tertiaryContainer(){return r.colorSpec.tertiaryContainer()}onTertiaryContainer(){return r.colorSpec.onTertiaryContainer()}tertiaryFixed(){return r.colorSpec.tertiaryFixed()}tertiaryFixedDim(){return r.colorSpec.tertiaryFixedDim()}onTertiaryFixed(){return r.colorSpec.onTertiaryFixed()}onTertiaryFixedVariant(){return r.colorSpec.onTertiaryFixedVariant()}error(){return r.colorSpec.error()}errorDim(){return r.colorSpec.errorDim()}onError(){return r.colorSpec.onError()}errorContainer(){return r.colorSpec.errorContainer()}onErrorContainer(){return r.colorSpec.onErrorContainer()}static highestSurface(t){return r.colorSpec.highestSurface(t)}};u.contentAccentToneDelta=15;u.colorSpec=new bt;u.primaryPaletteKeyColor=u.colorSpec.primaryPaletteKeyColor();u.secondaryPaletteKeyColor=u.colorSpec.secondaryPaletteKeyColor();u.tertiaryPaletteKeyColor=u.colorSpec.tertiaryPaletteKeyColor();u.neutralPaletteKeyColor=u.colorSpec.neutralPaletteKeyColor();u.neutralVariantPaletteKeyColor=u.colorSpec.neutralVariantPaletteKeyColor();u.background=u.colorSpec.background();u.onBackground=u.colorSpec.onBackground();u.surface=u.colorSpec.surface();u.surfaceDim=u.colorSpec.surfaceDim();u.surfaceBright=u.colorSpec.surfaceBright();u.surfaceContainerLowest=u.colorSpec.surfaceContainerLowest();u.surfaceContainerLow=u.colorSpec.surfaceContainerLow();u.surfaceContainer=u.colorSpec.surfaceContainer();u.surfaceContainerHigh=u.colorSpec.surfaceContainerHigh();u.surfaceContainerHighest=u.colorSpec.surfaceContainerHighest();u.onSurface=u.colorSpec.onSurface();u.surfaceVariant=u.colorSpec.surfaceVariant();u.onSurfaceVariant=u.colorSpec.onSurfaceVariant();u.inverseSurface=u.colorSpec.inverseSurface();u.inverseOnSurface=u.colorSpec.inverseOnSurface();u.outline=u.colorSpec.outline();u.outlineVariant=u.colorSpec.outlineVariant();u.shadow=u.colorSpec.shadow();u.scrim=u.colorSpec.scrim();u.surfaceTint=u.colorSpec.surfaceTint();u.primary=u.colorSpec.primary();u.onPrimary=u.colorSpec.onPrimary();u.primaryContainer=u.colorSpec.primaryContainer();u.onPrimaryContainer=u.colorSpec.onPrimaryContainer();u.inversePrimary=u.colorSpec.inversePrimary();u.secondary=u.colorSpec.secondary();u.onSecondary=u.colorSpec.onSecondary();u.secondaryContainer=u.colorSpec.secondaryContainer();u.onSecondaryContainer=u.colorSpec.onSecondaryContainer();u.tertiary=u.colorSpec.tertiary();u.onTertiary=u.colorSpec.onTertiary();u.tertiaryContainer=u.colorSpec.tertiaryContainer();u.onTertiaryContainer=u.colorSpec.onTertiaryContainer();u.error=u.colorSpec.error();u.onError=u.colorSpec.onError();u.errorContainer=u.colorSpec.errorContainer();u.onErrorContainer=u.colorSpec.onErrorContainer();u.primaryFixed=u.colorSpec.primaryFixed();u.primaryFixedDim=u.colorSpec.primaryFixedDim();u.onPrimaryFixed=u.colorSpec.onPrimaryFixed();u.onPrimaryFixedVariant=u.colorSpec.onPrimaryFixedVariant();u.secondaryFixed=u.colorSpec.secondaryFixed();u.secondaryFixedDim=u.colorSpec.secondaryFixedDim();u.onSecondaryFixed=u.colorSpec.onSecondaryFixed();u.onSecondaryFixedVariant=u.colorSpec.onSecondaryFixedVariant();u.tertiaryFixed=u.colorSpec.tertiaryFixed();u.tertiaryFixedDim=u.colorSpec.tertiaryFixedDim();u.onTertiaryFixed=u.colorSpec.onTertiaryFixed();u.onTertiaryFixedVariant=u.colorSpec.onTertiaryFixedVariant();/**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */var w=class r{static maybeFallbackSpecVersion(t,e){switch(e){case s.EXPRESSIVE:case s.VIBRANT:case s.TONAL_SPOT:case s.NEUTRAL:return t;default:return"2021"}}constructor(t){this.sourceColorArgb=t.sourceColorHct.toInt(),this.variant=t.variant,this.contrastLevel=t.contrastLevel,this.isDark=t.isDark,this.platform=t.platform??"phone",this.specVersion=r.maybeFallbackSpecVersion(t.specVersion??"2021",this.variant),this.sourceColorHct=t.sourceColorHct,this.primaryPalette=t.primaryPalette??ut(this.specVersion).getPrimaryPalette(this.variant,t.sourceColorHct,this.isDark,this.platform,this.contrastLevel),this.secondaryPalette=t.secondaryPalette??ut(this.specVersion).getSecondaryPalette(this.variant,t.sourceColorHct,this.isDark,this.platform,this.contrastLevel),this.tertiaryPalette=t.tertiaryPalette??ut(this.specVersion).getTertiaryPalette(this.variant,t.sourceColorHct,this.isDark,this.platform,this.contrastLevel),this.neutralPalette=t.neutralPalette??ut(this.specVersion).getNeutralPalette(this.variant,t.sourceColorHct,this.isDark,this.platform,this.contrastLevel),this.neutralVariantPalette=t.neutralVariantPalette??ut(this.specVersion).getNeutralVariantPalette(this.variant,t.sourceColorHct,this.isDark,this.platform,this.contrastLevel),this.errorPalette=t.errorPalette??ut(this.specVersion).getErrorPalette(this.variant,t.sourceColorHct,this.isDark,this.platform,this.contrastLevel)??g.fromHueAndChroma(25,84),this.colors=new u}toString(){return`Scheme: variant=${s[this.variant]}, mode=${this.isDark?"dark":"light"}, platform=${this.platform}, contrastLevel=${this.contrastLevel.toFixed(1)}, seed=${this.sourceColorHct.toString()}, specVersion=${this.specVersion}`}static getPiecewiseHue(t,e,n){let a=Math.min(e.length-1,n.length),i=t.hue;for(let o=0;o<a;o++)if(i>=e[o]&&i<e[o+1])return U(n[o]);return i}static getRotatedHue(t,e,n){let a=r.getPiecewiseHue(t,e,n);return Math.min(e.length-1,n.length)<=0&&(a=0),U(t.hue+a)}getArgb(t){return t.getArgb(this)}getHct(t){return t.getHct(this)}get primaryPaletteKeyColor(){return this.getArgb(this.colors.primaryPaletteKeyColor())}get secondaryPaletteKeyColor(){return this.getArgb(this.colors.secondaryPaletteKeyColor())}get tertiaryPaletteKeyColor(){return this.getArgb(this.colors.tertiaryPaletteKeyColor())}get neutralPaletteKeyColor(){return this.getArgb(this.colors.neutralPaletteKeyColor())}get neutralVariantPaletteKeyColor(){return this.getArgb(this.colors.neutralVariantPaletteKeyColor())}get errorPaletteKeyColor(){return this.getArgb(this.colors.errorPaletteKeyColor())}get background(){return this.getArgb(this.colors.background())}get onBackground(){return this.getArgb(this.colors.onBackground())}get surface(){return this.getArgb(this.colors.surface())}get surfaceDim(){return this.getArgb(this.colors.surfaceDim())}get surfaceBright(){return this.getArgb(this.colors.surfaceBright())}get surfaceContainerLowest(){return this.getArgb(this.colors.surfaceContainerLowest())}get surfaceContainerLow(){return this.getArgb(this.colors.surfaceContainerLow())}get surfaceContainer(){return this.getArgb(this.colors.surfaceContainer())}get surfaceContainerHigh(){return this.getArgb(this.colors.surfaceContainerHigh())}get surfaceContainerHighest(){return this.getArgb(this.colors.surfaceContainerHighest())}get onSurface(){return this.getArgb(this.colors.onSurface())}get surfaceVariant(){return this.getArgb(this.colors.surfaceVariant())}get onSurfaceVariant(){return this.getArgb(this.colors.onSurfaceVariant())}get inverseSurface(){return this.getArgb(this.colors.inverseSurface())}get inverseOnSurface(){return this.getArgb(this.colors.inverseOnSurface())}get outline(){return this.getArgb(this.colors.outline())}get outlineVariant(){return this.getArgb(this.colors.outlineVariant())}get shadow(){return this.getArgb(this.colors.shadow())}get scrim(){return this.getArgb(this.colors.scrim())}get surfaceTint(){return this.getArgb(this.colors.surfaceTint())}get primary(){return this.getArgb(this.colors.primary())}get primaryDim(){let t=this.colors.primaryDim();if(t===void 0)throw new Error("`primaryDim` color is undefined prior to 2025 spec.");return this.getArgb(t)}get onPrimary(){return this.getArgb(this.colors.onPrimary())}get primaryContainer(){return this.getArgb(this.colors.primaryContainer())}get onPrimaryContainer(){return this.getArgb(this.colors.onPrimaryContainer())}get primaryFixed(){return this.getArgb(this.colors.primaryFixed())}get primaryFixedDim(){return this.getArgb(this.colors.primaryFixedDim())}get onPrimaryFixed(){return this.getArgb(this.colors.onPrimaryFixed())}get onPrimaryFixedVariant(){return this.getArgb(this.colors.onPrimaryFixedVariant())}get inversePrimary(){return this.getArgb(this.colors.inversePrimary())}get secondary(){return this.getArgb(this.colors.secondary())}get secondaryDim(){let t=this.colors.secondaryDim();if(t===void 0)throw new Error("`secondaryDim` color is undefined prior to 2025 spec.");return this.getArgb(t)}get onSecondary(){return this.getArgb(this.colors.onSecondary())}get secondaryContainer(){return this.getArgb(this.colors.secondaryContainer())}get onSecondaryContainer(){return this.getArgb(this.colors.onSecondaryContainer())}get secondaryFixed(){return this.getArgb(this.colors.secondaryFixed())}get secondaryFixedDim(){return this.getArgb(this.colors.secondaryFixedDim())}get onSecondaryFixed(){return this.getArgb(this.colors.onSecondaryFixed())}get onSecondaryFixedVariant(){return this.getArgb(this.colors.onSecondaryFixedVariant())}get tertiary(){return this.getArgb(this.colors.tertiary())}get tertiaryDim(){let t=this.colors.tertiaryDim();if(t===void 0)throw new Error("`tertiaryDim` color is undefined prior to 2025 spec.");return this.getArgb(t)}get onTertiary(){return this.getArgb(this.colors.onTertiary())}get tertiaryContainer(){return this.getArgb(this.colors.tertiaryContainer())}get onTertiaryContainer(){return this.getArgb(this.colors.onTertiaryContainer())}get tertiaryFixed(){return this.getArgb(this.colors.tertiaryFixed())}get tertiaryFixedDim(){return this.getArgb(this.colors.tertiaryFixedDim())}get onTertiaryFixed(){return this.getArgb(this.colors.onTertiaryFixed())}get onTertiaryFixedVariant(){return this.getArgb(this.colors.onTertiaryFixedVariant())}get error(){return this.getArgb(this.colors.error())}get errorDim(){let t=this.colors.errorDim();if(t===void 0)throw new Error("`errorDim` color is undefined prior to 2025 spec.");return this.getArgb(t)}get onError(){return this.getArgb(this.colors.onError())}get errorContainer(){return this.getArgb(this.colors.errorContainer())}get onErrorContainer(){return this.getArgb(this.colors.onErrorContainer())}};w.DEFAULT_SPEC_VERSION="2021";w.DEFAULT_PLATFORM="phone";var Ft=class{getPrimaryPalette(t,e,n,a,i){switch(t){case s.CONTENT:case s.FIDELITY:return g.fromHueAndChroma(e.hue,e.chroma);case s.FRUIT_SALAD:return g.fromHueAndChroma(U(e.hue-50),48);case s.MONOCHROME:return g.fromHueAndChroma(e.hue,0);case s.NEUTRAL:return g.fromHueAndChroma(e.hue,12);case s.RAINBOW:return g.fromHueAndChroma(e.hue,48);case s.TONAL_SPOT:return g.fromHueAndChroma(e.hue,36);case s.EXPRESSIVE:return g.fromHueAndChroma(U(e.hue+240),40);case s.VIBRANT:return g.fromHueAndChroma(e.hue,200);default:throw new Error(`Unsupported variant: ${t}`)}}getSecondaryPalette(t,e,n,a,i){switch(t){case s.CONTENT:case s.FIDELITY:return g.fromHueAndChroma(e.hue,Math.max(e.chroma-32,e.chroma*.5));case s.FRUIT_SALAD:return g.fromHueAndChroma(U(e.hue-50),36);case s.MONOCHROME:return g.fromHueAndChroma(e.hue,0);case s.NEUTRAL:return g.fromHueAndChroma(e.hue,8);case s.RAINBOW:return g.fromHueAndChroma(e.hue,16);case s.TONAL_SPOT:return g.fromHueAndChroma(e.hue,16);case s.EXPRESSIVE:return g.fromHueAndChroma(w.getRotatedHue(e,[0,21,51,121,151,191,271,321,360],[45,95,45,20,45,90,45,45,45]),24);case s.VIBRANT:return g.fromHueAndChroma(w.getRotatedHue(e,[0,41,61,101,131,181,251,301,360],[18,15,10,12,15,18,15,12,12]),24);default:throw new Error(`Unsupported variant: ${t}`)}}getTertiaryPalette(t,e,n,a,i){switch(t){case s.CONTENT:return g.fromHct(ot.fixIfDisliked(new gt(e).analogous(3,6)[2]));case s.FIDELITY:return g.fromHct(ot.fixIfDisliked(new gt(e).complement));case s.FRUIT_SALAD:return g.fromHueAndChroma(e.hue,36);case s.MONOCHROME:return g.fromHueAndChroma(e.hue,0);case s.NEUTRAL:return g.fromHueAndChroma(e.hue,16);case s.RAINBOW:case s.TONAL_SPOT:return g.fromHueAndChroma(U(e.hue+60),24);case s.EXPRESSIVE:return g.fromHueAndChroma(w.getRotatedHue(e,[0,21,51,121,151,191,271,321,360],[120,120,20,45,20,15,20,120,120]),32);case s.VIBRANT:return g.fromHueAndChroma(w.getRotatedHue(e,[0,41,61,101,131,181,251,301,360],[35,30,20,25,30,35,30,25,25]),32);default:throw new Error(`Unsupported variant: ${t}`)}}getNeutralPalette(t,e,n,a,i){switch(t){case s.CONTENT:case s.FIDELITY:return g.fromHueAndChroma(e.hue,e.chroma/8);case s.FRUIT_SALAD:return g.fromHueAndChroma(e.hue,10);case s.MONOCHROME:return g.fromHueAndChroma(e.hue,0);case s.NEUTRAL:return g.fromHueAndChroma(e.hue,2);case s.RAINBOW:return g.fromHueAndChroma(e.hue,0);case s.TONAL_SPOT:return g.fromHueAndChroma(e.hue,6);case s.EXPRESSIVE:return g.fromHueAndChroma(U(e.hue+15),8);case s.VIBRANT:return g.fromHueAndChroma(e.hue,10);default:throw new Error(`Unsupported variant: ${t}`)}}getNeutralVariantPalette(t,e,n,a,i){switch(t){case s.CONTENT:return g.fromHueAndChroma(e.hue,e.chroma/8+4);case s.FIDELITY:return g.fromHueAndChroma(e.hue,e.chroma/8+4);case s.FRUIT_SALAD:return g.fromHueAndChroma(e.hue,16);case s.MONOCHROME:return g.fromHueAndChroma(e.hue,0);case s.NEUTRAL:return g.fromHueAndChroma(e.hue,2);case s.RAINBOW:return g.fromHueAndChroma(e.hue,0);case s.TONAL_SPOT:return g.fromHueAndChroma(e.hue,8);case s.EXPRESSIVE:return g.fromHueAndChroma(U(e.hue+15),12);case s.VIBRANT:return g.fromHueAndChroma(e.hue,12);default:throw new Error(`Unsupported variant: ${t}`)}}getErrorPalette(t,e,n,a,i){}},_t=class r extends Ft{getPrimaryPalette(t,e,n,a,i){switch(t){case s.NEUTRAL:return g.fromHueAndChroma(e.hue,a==="phone"?x.isBlue(e.hue)?12:8:x.isBlue(e.hue)?16:12);case s.TONAL_SPOT:return g.fromHueAndChroma(e.hue,a==="phone"&&n?26:32);case s.EXPRESSIVE:return g.fromHueAndChroma(e.hue,a==="phone"?n?36:48:40);case s.VIBRANT:return g.fromHueAndChroma(e.hue,a==="phone"?74:56);default:return super.getPrimaryPalette(t,e,n,a,i)}}getSecondaryPalette(t,e,n,a,i){switch(t){case s.NEUTRAL:return g.fromHueAndChroma(e.hue,a==="phone"?x.isBlue(e.hue)?6:4:x.isBlue(e.hue)?10:6);case s.TONAL_SPOT:return g.fromHueAndChroma(e.hue,16);case s.EXPRESSIVE:return g.fromHueAndChroma(w.getRotatedHue(e,[0,105,140,204,253,278,300,333,360],[-160,155,-100,96,-96,-156,-165,-160]),a==="phone"&&n?16:24);case s.VIBRANT:return g.fromHueAndChroma(w.getRotatedHue(e,[0,38,105,140,333,360],[-14,10,-14,10,-14]),a==="phone"?56:36);default:return super.getSecondaryPalette(t,e,n,a,i)}}getTertiaryPalette(t,e,n,a,i){switch(t){case s.NEUTRAL:return g.fromHueAndChroma(w.getRotatedHue(e,[0,38,105,161,204,278,333,360],[-32,26,10,-39,24,-15,-32]),a==="phone"?20:36);case s.TONAL_SPOT:return g.fromHueAndChroma(w.getRotatedHue(e,[0,20,71,161,333,360],[-40,48,-32,40,-32]),a==="phone"?28:32);case s.EXPRESSIVE:return g.fromHueAndChroma(w.getRotatedHue(e,[0,105,140,204,253,278,300,333,360],[-165,160,-105,101,-101,-160,-170,-165]),48);case s.VIBRANT:return g.fromHueAndChroma(w.getRotatedHue(e,[0,38,71,105,140,161,253,333,360],[-72,35,24,-24,62,50,62,-72]),56);default:return super.getTertiaryPalette(t,e,n,a,i)}}static getExpressiveNeutralHue(t){return w.getRotatedHue(t,[0,71,124,253,278,300,360],[10,0,10,0,10,0])}static getExpressiveNeutralChroma(t,e,n){let a=r.getExpressiveNeutralHue(t);return n==="phone"?e?x.isYellow(a)?6:14:18:12}static getVibrantNeutralHue(t){return w.getRotatedHue(t,[0,38,105,140,333,360],[-14,10,-14,10,-14])}static getVibrantNeutralChroma(t,e){let n=r.getVibrantNeutralHue(t);return e==="phone"||x.isBlue(n)?28:20}getNeutralPalette(t,e,n,a,i){switch(t){case s.NEUTRAL:return g.fromHueAndChroma(e.hue,a==="phone"?1.4:6);case s.TONAL_SPOT:return g.fromHueAndChroma(e.hue,a==="phone"?5:10);case s.EXPRESSIVE:return g.fromHueAndChroma(r.getExpressiveNeutralHue(e),r.getExpressiveNeutralChroma(e,n,a));case s.VIBRANT:return g.fromHueAndChroma(r.getVibrantNeutralHue(e),r.getVibrantNeutralChroma(e,a));default:return super.getNeutralPalette(t,e,n,a,i)}}getNeutralVariantPalette(t,e,n,a,i){switch(t){case s.NEUTRAL:return g.fromHueAndChroma(e.hue,(a==="phone"?1.4:6)*2.2);case s.TONAL_SPOT:return g.fromHueAndChroma(e.hue,(a==="phone"?5:10)*1.7);case s.EXPRESSIVE:let o=r.getExpressiveNeutralHue(e),l=r.getExpressiveNeutralChroma(e,n,a);return g.fromHueAndChroma(o,l*(o>=105&&o<125?1.6:2.3));case s.VIBRANT:let m=r.getVibrantNeutralHue(e),p=r.getVibrantNeutralChroma(e,a);return g.fromHueAndChroma(m,p*1.29);default:return super.getNeutralVariantPalette(t,e,n,a,i)}}getErrorPalette(t,e,n,a,i){let o=w.getPiecewiseHue(e,[0,3,13,23,33,43,153,273,360],[12,22,32,12,22,32,22,12]);switch(t){case s.NEUTRAL:return g.fromHueAndChroma(o,a==="phone"?50:40);case s.TONAL_SPOT:return g.fromHueAndChroma(o,a==="phone"?60:48);case s.EXPRESSIVE:return g.fromHueAndChroma(o,a==="phone"?64:48);case s.VIBRANT:return g.fromHueAndChroma(o,a==="phone"?80:60);default:return super.getErrorPalette(t,e,n,a,i)}}},de=new Ft,ge=new _t;function ut(r){return r==="2025"?ge:de}/**
 * @license
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *//**
 * @license
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *//**
 * @license
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *//**
 * @license
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *//**
 * @license
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *//**
 * @license
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *//**
 * @license
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *//**
 * @license
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *//**
 * @license
 * Copyright 2023 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *//**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *//**
 * @license
 * Copyright 2023 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *//**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *//**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *//**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *//**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *//**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *//**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *//**
 * @license
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */var ye={desired:4,fallbackColorARGB:4282549748,filter:!0};function Pe(r,t){return r.score>t.score?-1:r.score<t.score?1:0}var Z=class r{constructor(){}static score(t,e){let{desired:n,fallbackColorARGB:a,filter:i}={...ye,...e},o=[],l=new Array(360).fill(0),m=0;for(let[P,f]of t.entries()){let h=x.fromInt(P);o.push(h);let S=Math.floor(h.hue);l[S]+=f,m+=f}let p=new Array(360).fill(0);for(let P=0;P<360;P++){let f=l[P]/m;for(let h=P-14;h<P+16;h++){let S=st(h);p[S]+=f}}let d=new Array;for(let P of o){let f=st(Math.round(P.hue)),h=p[f];if(i&&(P.chroma<r.CUTOFF_CHROMA||h<=r.CUTOFF_EXCITED_PROPORTION))continue;let S=h*100*r.WEIGHT_PROPORTION,b=P.chroma<r.TARGET_CHROMA?r.WEIGHT_CHROMA_BELOW:r.WEIGHT_CHROMA_ABOVE,E=(P.chroma-r.TARGET_CHROMA)*b,R=S+E;d.push({hct:P,score:R})}d.sort(Pe);let C=[];for(let P=90;P>=15;P--){C.length=0;for(let{hct:f}of d)if(C.find(S=>Lt(f.hue,S.hue)<P)||C.push(f),C.length>=n)break;if(C.length>=n)break}let y=[];C.length===0&&y.push(a);for(let P of C)y.push(P.toInt());return y}};Z.TARGET_CHROMA=48;Z.WEIGHT_PROPORTION=.7;Z.WEIGHT_CHROMA_ABOVE=.3;Z.WEIGHT_CHROMA_BELOW=.1;Z.CUTOFF_CHROMA=5;Z.CUTOFF_EXCITED_PROPORTION=.01;/**
 * @license
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Et(r){let t=mt(r),e=ft(r),n=pt(r),a=[t.toString(16),e.toString(16),n.toString(16)];for(let[i,o]of a.entries())o.length===1&&(a[i]="0"+o);return"#"+a.join("")}function wt(r){r=r.replace("#","");let t=r.length===3,e=r.length===6,n=r.length===8;if(!t&&!e&&!n)throw new Error("unexpected hex "+r);let a=0,i=0,o=0;return t?(a=Q(r.slice(0,1).repeat(2)),i=Q(r.slice(1,2).repeat(2)),o=Q(r.slice(2,3).repeat(2))):e?(a=Q(r.slice(0,2)),i=Q(r.slice(2,4)),o=Q(r.slice(4,6))):n&&(a=Q(r.slice(2,4)),i=Q(r.slice(4,6)),o=Q(r.slice(6,8))),(255<<24|(a&255)<<16|(i&255)<<8|o&255)>>>0}function Q(r){return parseInt(r,16)}/**
 * @license
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *//**
 * @license
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *//**
 * @license
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */var vt=["primary","onPrimary","primaryContainer","onPrimaryContainer","inversePrimary","secondary","onSecondary","secondaryContainer","onSecondaryContainer","tertiary","onTertiary","tertiaryContainer","onTertiaryContainer","error","onError","errorContainer","onErrorContainer","background","onBackground","surface","onSurface","surfaceVariant","onSurfaceVariant","surfaceContainerLowest","surfaceContainerLow","surfaceContainer","surfaceContainerHigh","surfaceContainerHighest","surfaceDim","surfaceBright","outline","outlineVariant","inverseSurface","inverseOnSurface","shadow","scrim","surfaceTint"],te={primary:"#6750A4",secondary:"#625B71",tertiary:"#7D5260"};var Ce=[0,10,20,30,40,50,60,70,80,90,95,99,100],Se=4,xe=8;function yt(r){let t={};for(let e of Ce)t[e]=Et(r.tone(e)).toUpperCase();return t}function ee(r){let t={};for(let e of vt){let n=r[e];t[e]=Et(n).toUpperCase()}return t}function re(r){let t=performance.now(),e=wt(r.primaryHex),n=x.fromInt(e),a=g.fromHct(n),i=r.secondaryHex?g.fromHct(x.fromInt(wt(r.secondaryHex))):g.fromHueAndChroma(n.hue,16),o=r.tertiaryHex?g.fromHct(x.fromInt(wt(r.tertiaryHex))):g.fromHueAndChroma(n.hue+60,24),l=g.fromHueAndChroma(n.hue,Se),m=g.fromHueAndChroma(n.hue,xe),p={primary:yt(a),secondary:yt(i),tertiary:yt(o),neutral:yt(l),neutralVariant:yt(m)},d=typeof r.contrastLevel=="number"&&Number.isFinite(r.contrastLevel)?r.contrastLevel:0,C=Math.max(-1,Math.min(1,d)),y=h=>new w({sourceColorHct:n,variant:s.TONAL_SPOT,contrastLevel:C,isDark:h,primaryPalette:a,secondaryPalette:i,tertiaryPalette:o,neutralPalette:l,neutralVariantPalette:m}),P=ee(y(!1)),f=ee(y(!0));return{tones:p,roles:{light:P,dark:f},sources:{primary:r.primaryHex.toUpperCase(),secondary:r.secondaryHex?.toUpperCase()??"",tertiary:r.tertiaryHex?.toUpperCase()??""},contrastLevel:C,durationMs:Math.round((performance.now()-t)*100)/100}}function Pt(r){return r.replace(/[A-Z]/g,t=>`-${t.toLowerCase()}`)}function ne(r){let t=new Date().toISOString(),{sources:e,roles:n}=r,a=["/*!"," * AWC UI \u2014 Material Design 3 theme",` * Generated: ${t}`," * Source colors:",`   primary:   ${e.primary}`,`   secondary: ${e.secondary}`,`   tertiary:  ${e.tertiary}`," *"," * Drop this file after @awc-ui/tokens to override the default theme.",' * Toggle dark mode by setting [data-theme="dark"] on <html> or any ancestor.'," */","",":root {"];for(let[i,o]of Object.entries(n.light))a.push(`  --md-sys-color-${Pt(i)}: ${o};`);a.push("}","",'[data-theme="dark"] {');for(let[i,o]of Object.entries(n.dark))a.push(`  --md-sys-color-${Pt(i)}: ${o};`);return a.push("}",""),a.join(`
`)}export{te as DEFAULT_SEED_COLORS,vt as ROLE_KEYS,re as computeTheme,ne as generateCss,Pt as tokenName};
