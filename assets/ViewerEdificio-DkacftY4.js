import{r as e}from"./rolldown-runtime-hePW80VL.js";import{t}from"./react-CwJFpaho.js";import{t as n}from"./jsx-runtime-NZYk81nU.js";import{at as r}from"./index-BWNkHlaf.js";import{$ as i,$t as a,D as o,E as s,It as c,Lt as l,Mt as u,N as d,O as f,Q as p,Ut as m,Xt as h,Z as ee,_t as g,c as _,d as te,dt as v,en as y,et as b,ft as x,g as S,ht as C,jt as w,l as T,m as E,rn as ne,rt as re,t as ie,tn as D,ut as O,x as k,y as A,z as j}from"./three.module-BpiNdMIZ.js";import{n as M}from"./geometria-D-AqTmnT.js";import{a as ae,i as oe,n as se,r as N,t as P}from"./OrbitControls-XcakVF4H.js";import{t as F}from"./posizioni-CHjwUrsN.js";var I=e(t()),ce=e(r()),L=new y,R=new y,z=new y,le=new a;function ue(e,t,n){let r=L.setFromMatrixPosition(e.matrixWorld);r.project(t);let i=n.width/2,a=n.height/2;return[r.x*i+i,-(r.y*a)+a]}function de(e,t){let n=L.setFromMatrixPosition(e.matrixWorld),r=R.setFromMatrixPosition(t.matrixWorld),i=n.sub(r),a=t.getWorldDirection(z);return i.angleTo(a)>Math.PI/2}function fe(e,t,n,r){let i=L.setFromMatrixPosition(e.matrixWorld),a=i.clone();a.project(t),le.set(a.x,a.y),n.setFromCamera(le,t);let o=n.intersectObjects(r,!0);if(o.length){let e=o[0].distance;return i.distanceTo(n.ray.origin)<e}return!0}function pe(e,t){if(t instanceof x)return t.zoom;if(t instanceof C){let n=L.setFromMatrixPosition(e.matrixWorld),r=R.setFromMatrixPosition(t.matrixWorld),i=t.fov*Math.PI/180,a=n.distanceTo(r);return 1/(2*Math.tan(i/2)*a)}return 1}function me(e,t,n){if(t instanceof C||t instanceof x){let r=L.setFromMatrixPosition(e.matrixWorld),i=R.setFromMatrixPosition(t.matrixWorld),a=r.distanceTo(i),o=(n[1]-n[0])/(t.far-t.near),s=n[1]-o*t.far;return Math.round(o*a+s)}}var he=e=>Math.abs(e)<1e-10?0:e;function B(e,t,n=``){let r=`matrix3d(`;for(let n=0;n!==16;n++)r+=he(t[n]*e.elements[n])+(n===15?`)`:`,`);return n+r}var ge=(e=>t=>B(t,e))([1,-1,1,1,1,-1,1,1,1,-1,1,1,1,-1,1,1]),_e=(e=>(t,n)=>B(t,e(n),`translate(-50%,-50%)`))(e=>[1/e,1/e,1/e,1,-1/e,-1/e,-1/e,-1,1/e,1/e,1/e,1,1,1,1,1]);function ve(e){return e&&typeof e==`object`&&`current`in e}var V=I.forwardRef(({children:e,eps:t=.001,style:n,className:r,prepend:i,center:a,fullscreen:o,portal:s,distanceFactor:c,sprite:l=!1,transform:u=!1,occlude:d,onOcclude:f,castShadow:p,receiveShadow:m,material:h,geometry:ee,zIndexRange:g=[16777271,0],calculatePosition:_=ue,as:te=`div`,wrapperClass:v,pointerEvents:b=`auto`,...x},S)=>{let{gl:C,camera:w,scene:T,size:E,raycaster:ne,events:re,viewport:ie}=ae(),[D]=I.useState(()=>document.createElement(te)),O=I.useRef(null),k=I.useRef(null),A=I.useRef(0),j=I.useRef([0,0]),M=I.useRef(null),N=I.useRef(null),P=s?.current||re.connected||C.domElement.parentNode,F=I.useRef(null),L=I.useRef(!1),R=I.useMemo(()=>d&&d!==`blending`||Array.isArray(d)&&d.length&&ve(d[0]),[d]);I.useLayoutEffect(()=>{let e=C.domElement;d&&d===`blending`?(e.style.zIndex=`${Math.floor(g[0]/2)}`,e.style.position=`absolute`,e.style.pointerEvents=`none`):(e.style.zIndex=null,e.style.position=null,e.style.pointerEvents=null)},[d]),I.useLayoutEffect(()=>{if(k.current){let e=O.current=ce.createRoot(D);if(T.updateMatrixWorld(),u)D.style.cssText=`position:absolute;top:0;left:0;pointer-events:none;overflow:hidden;`;else{let e=_(k.current,w,E);D.style.cssText=`position:absolute;top:0;left:0;transform:translate3d(${e[0]}px,${e[1]}px,0);transform-origin:0 0;`}return P&&(i?P.prepend(D):P.appendChild(D)),()=>{P&&P.removeChild(D),e.unmount()}}},[P,u]),I.useLayoutEffect(()=>{v&&(D.className=v)},[v]);let z=I.useMemo(()=>u?{position:`absolute`,top:0,left:0,width:E.width,height:E.height,transformStyle:`preserve-3d`,pointerEvents:`none`}:{position:`absolute`,transform:a?`translate3d(-50%,-50%,0)`:`none`,...o&&{top:-E.height/2,left:-E.width/2,width:E.width,height:E.height},...n},[n,a,o,E,u]),le=I.useMemo(()=>({position:`absolute`,pointerEvents:b}),[b]);I.useLayoutEffect(()=>{if(L.current=!1,u){var t;(t=O.current)==null||t.render(I.createElement(`div`,{ref:M,style:z},I.createElement(`div`,{ref:N,style:le},I.createElement(`div`,{ref:S,className:r,style:n,children:e}))))}else{var i;(i=O.current)==null||i.render(I.createElement(`div`,{ref:S,style:z,className:r,children:e}))}});let B=I.useRef(!0);oe(e=>{if(k.current){w.updateMatrixWorld(),k.current.updateWorldMatrix(!0,!1);let e=u?j.current:_(k.current,w,E);if(u||Math.abs(A.current-w.zoom)>t||Math.abs(j.current[0]-e[0])>t||Math.abs(j.current[1]-e[1])>t){let t=de(k.current,w),n=!1;R&&(Array.isArray(d)?n=d.map(e=>e.current):d!==`blending`&&(n=[T]));let r=B.current;if(n){let e=fe(k.current,w,ne,n);B.current=e&&!t}else B.current=!t;r!==B.current&&(f?f(!B.current):D.style.display=B.current?`block`:`none`);let i=Math.floor(g[0]/2),a=d?R?[g[0],i]:[i-1,0]:g;if(D.style.zIndex=`${me(k.current,w,a)}`,u){let[e,t]=[E.width/2,E.height/2],n=w.projectionMatrix.elements[5]*t,{isOrthographicCamera:r,top:i,left:a,bottom:o,right:s}=w,u=ge(w.matrixWorldInverse),d=r?`scale(${n})translate(${he(-(s+a)/2)}px,${he((i+o)/2)}px)`:`translateZ(${n}px)`,f=k.current.matrixWorld;l&&(f=w.matrixWorldInverse.clone().transpose().copyPosition(f).scale(k.current.scale),f.elements[3]=f.elements[7]=f.elements[11]=0,f.elements[15]=1),D.style.width=E.width+`px`,D.style.height=E.height+`px`,D.style.perspective=r?``:`${n}px`,M.current&&N.current&&(M.current.style.transform=`${d}${u}translate(${e}px,${t}px)`,N.current.style.transform=_e(f,1/((c||10)/400)))}else{let t=c===void 0?1:pe(k.current,w)*c;D.style.transform=`translate3d(${e[0]}px,${e[1]}px,0) scale(${t})`}j.current=e,A.current=w.zoom}}if(!R&&F.current&&!L.current)if(u){if(M.current){let e=M.current.children[0];if(e!=null&&e.clientWidth&&e!=null&&e.clientHeight){let{isOrthographicCamera:t}=w;if(t||ee)x.scale&&(Array.isArray(x.scale)?x.scale instanceof y?F.current.scale.copy(x.scale.clone().divideScalar(1)):F.current.scale.set(1/x.scale[0],1/x.scale[1],1/x.scale[2]):F.current.scale.setScalar(1/x.scale));else{let t=(c||10)/400,n=e.clientWidth*t,r=e.clientHeight*t;F.current.scale.set(n,r,1)}L.current=!0}}}else{let t=D.children[0];if(t!=null&&t.clientWidth&&t!=null&&t.clientHeight){let e=1/ie.factor,n=t.clientWidth*e,r=t.clientHeight*e;F.current.scale.set(n,r,1),L.current=!0}F.current.lookAt(e.camera.position)}});let V=I.useMemo(()=>({vertexShader:u?void 0:`
          /*
            This shader is from the THREE's SpriteMaterial.
            We need to turn the backing plane into a Sprite
            (make it always face the camera) if "transfrom"
            is false.
          */
          #include <common>

          void main() {
            vec2 center = vec2(0., 1.);
            float rotation = 0.0;

            // This is somewhat arbitrary, but it seems to work well
            // Need to figure out how to derive this dynamically if it even matters
            float size = 0.03;

            vec4 mvPosition = modelViewMatrix * vec4( 0.0, 0.0, 0.0, 1.0 );
            vec2 scale;
            scale.x = length( vec3( modelMatrix[ 0 ].x, modelMatrix[ 0 ].y, modelMatrix[ 0 ].z ) );
            scale.y = length( vec3( modelMatrix[ 1 ].x, modelMatrix[ 1 ].y, modelMatrix[ 1 ].z ) );

            bool isPerspective = isPerspectiveMatrix( projectionMatrix );
            if ( isPerspective ) scale *= - mvPosition.z;

            vec2 alignedPosition = ( position.xy - ( center - vec2( 0.5 ) ) ) * scale * size;
            vec2 rotatedPosition;
            rotatedPosition.x = cos( rotation ) * alignedPosition.x - sin( rotation ) * alignedPosition.y;
            rotatedPosition.y = sin( rotation ) * alignedPosition.x + cos( rotation ) * alignedPosition.y;
            mvPosition.xy += rotatedPosition;

            gl_Position = projectionMatrix * mvPosition;
          }
      `,fragmentShader:`
        void main() {
          gl_FragColor = vec4(0.0, 0.0, 0.0, 0.0);
        }
      `}),[u]);return I.createElement(`group`,se({},x,{ref:k}),d&&!R&&I.createElement(`mesh`,{castShadow:p,receiveShadow:m,ref:F},ee||I.createElement(`planeGeometry`,null),h||I.createElement(`shaderMaterial`,{side:2,vertexShader:V.vertexShader,fragmentShader:V.fragmentShader})))}),ye=parseInt(`187`.replace(/\D+/g,``)),be=ye>=125?`uv1`:`uv2`,xe=new _,H=new y,Se=class extends s{constructor(){super(),this.isLineSegmentsGeometry=!0,this.type=`LineSegmentsGeometry`,this.setIndex([0,2,1,2,3,1,2,4,3,4,5,3,4,6,5,6,7,5]),this.setAttribute(`position`,new k([-1,2,0,1,2,0,-1,1,0,1,1,0,-1,0,0,1,0,0,-1,-1,0,1,-1,0],3)),this.setAttribute(`uv`,new k([-1,2,1,2,-1,1,1,1,-1,-1,1,-1,-1,-2,1,-2],2))}applyMatrix4(e){let t=this.attributes.instanceStart,n=this.attributes.instanceEnd;return t!==void 0&&(t.applyMatrix4(e),n.applyMatrix4(e),t.needsUpdate=!0),this.boundingBox!==null&&this.computeBoundingBox(),this.boundingSphere!==null&&this.computeBoundingSphere(),this}setPositions(e){let t;e instanceof Float32Array?t=e:Array.isArray(e)&&(t=new Float32Array(e));let n=new o(t,6,1);return this.setAttribute(`instanceStart`,new d(n,3,0)),this.setAttribute(`instanceEnd`,new d(n,3,3)),this.computeBoundingBox(),this.computeBoundingSphere(),this}setColors(e,t=3){let n;e instanceof Float32Array?n=e:Array.isArray(e)&&(n=new Float32Array(e));let r=new o(n,t*2,1);return this.setAttribute(`instanceColorStart`,new d(r,t,0)),this.setAttribute(`instanceColorEnd`,new d(r,t,t)),this}fromWireframeGeometry(e){return this.setPositions(e.attributes.position.array),this}fromEdgesGeometry(e){return this.setPositions(e.attributes.position.array),this}fromMesh(e){return this.fromWireframeGeometry(new ne(e.geometry)),this}fromLineSegments(e){let t=e.geometry;return this.setPositions(t.attributes.position.array),this}computeBoundingBox(){this.boundingBox===null&&(this.boundingBox=new _);let e=this.attributes.instanceStart,t=this.attributes.instanceEnd;e!==void 0&&t!==void 0&&(this.boundingBox.setFromBufferAttribute(e),xe.setFromBufferAttribute(t),this.boundingBox.union(xe))}computeBoundingSphere(){this.boundingSphere===null&&(this.boundingSphere=new c),this.boundingBox===null&&this.computeBoundingBox();let e=this.attributes.instanceStart,t=this.attributes.instanceEnd;if(e!==void 0&&t!==void 0){let n=this.boundingSphere.center;this.boundingBox.getCenter(n);let r=0;for(let i=0,a=e.count;i<a;i++)H.fromBufferAttribute(e,i),r=Math.max(r,n.distanceToSquared(H)),H.fromBufferAttribute(t,i),r=Math.max(r,n.distanceToSquared(H));this.boundingSphere.radius=Math.sqrt(r),isNaN(this.boundingSphere.radius)&&console.error(`THREE.LineSegmentsGeometry.computeBoundingSphere(): Computed radius is NaN. The instanced position data is likely to have NaN values.`,this)}}toJSON(){}applyMatrix(e){return console.warn(`THREE.LineSegmentsGeometry: applyMatrix() has been renamed to applyMatrix4().`),this.applyMatrix4(e)}},Ce=class extends Se{constructor(){super(),this.isLineGeometry=!0,this.type=`LineGeometry`}setPositions(e){let t=e.length-3,n=new Float32Array(2*t);for(let r=0;r<t;r+=3)n[2*r]=e[r],n[2*r+1]=e[r+1],n[2*r+2]=e[r+2],n[2*r+3]=e[r+3],n[2*r+4]=e[r+4],n[2*r+5]=e[r+5];return super.setPositions(n),this}setColors(e,t=3){let n=e.length-t,r=new Float32Array(2*n);if(t===3)for(let i=0;i<n;i+=t)r[2*i]=e[i],r[2*i+1]=e[i+1],r[2*i+2]=e[i+2],r[2*i+3]=e[i+3],r[2*i+4]=e[i+4],r[2*i+5]=e[i+5];else for(let i=0;i<n;i+=t)r[2*i]=e[i],r[2*i+1]=e[i+1],r[2*i+2]=e[i+2],r[2*i+3]=e[i+3],r[2*i+4]=e[i+4],r[2*i+5]=e[i+5],r[2*i+6]=e[i+6],r[2*i+7]=e[i+7];return super.setColors(r,t),this}fromLine(e){let t=e.geometry;return this.setPositions(t.attributes.position.array),this}},we=class extends w{constructor(e){super({type:`LineMaterial`,uniforms:h.clone(h.merge([ie.common,ie.fog,{worldUnits:{value:1},linewidth:{value:1},resolution:{value:new a(1,1)},dashOffset:{value:0},dashScale:{value:1},dashSize:{value:1},gapSize:{value:1}}])),vertexShader:`
				#include <common>
				#include <fog_pars_vertex>
				#include <logdepthbuf_pars_vertex>
				#include <clipping_planes_pars_vertex>

				uniform float linewidth;
				uniform vec2 resolution;

				attribute vec3 instanceStart;
				attribute vec3 instanceEnd;

				#ifdef USE_COLOR
					#ifdef USE_LINE_COLOR_ALPHA
						varying vec4 vLineColor;
						attribute vec4 instanceColorStart;
						attribute vec4 instanceColorEnd;
					#else
						varying vec3 vLineColor;
						attribute vec3 instanceColorStart;
						attribute vec3 instanceColorEnd;
					#endif
				#endif

				#ifdef WORLD_UNITS

					varying vec4 worldPos;
					varying vec3 worldStart;
					varying vec3 worldEnd;

					#ifdef USE_DASH

						varying vec2 vUv;

					#endif

				#else

					varying vec2 vUv;

				#endif

				#ifdef USE_DASH

					uniform float dashScale;
					attribute float instanceDistanceStart;
					attribute float instanceDistanceEnd;
					varying float vLineDistance;

				#endif

				void trimSegment( const in vec4 start, inout vec4 end ) {

					// trim end segment so it terminates between the camera plane and the near plane

					// conservative estimate of the near plane
					float a = projectionMatrix[ 2 ][ 2 ]; // 3nd entry in 3th column
					float b = projectionMatrix[ 3 ][ 2 ]; // 3nd entry in 4th column
					float nearEstimate = - 0.5 * b / a;

					float alpha = ( nearEstimate - start.z ) / ( end.z - start.z );

					end.xyz = mix( start.xyz, end.xyz, alpha );

				}

				void main() {

					#ifdef USE_COLOR

						vLineColor = ( position.y < 0.5 ) ? instanceColorStart : instanceColorEnd;

					#endif

					#ifdef USE_DASH

						vLineDistance = ( position.y < 0.5 ) ? dashScale * instanceDistanceStart : dashScale * instanceDistanceEnd;
						vUv = uv;

					#endif

					float aspect = resolution.x / resolution.y;

					// camera space
					vec4 start = modelViewMatrix * vec4( instanceStart, 1.0 );
					vec4 end = modelViewMatrix * vec4( instanceEnd, 1.0 );

					#ifdef WORLD_UNITS

						worldStart = start.xyz;
						worldEnd = end.xyz;

					#else

						vUv = uv;

					#endif

					// special case for perspective projection, and segments that terminate either in, or behind, the camera plane
					// clearly the gpu firmware has a way of addressing this issue when projecting into ndc space
					// but we need to perform ndc-space calculations in the shader, so we must address this issue directly
					// perhaps there is a more elegant solution -- WestLangley

					bool perspective = ( projectionMatrix[ 2 ][ 3 ] == - 1.0 ); // 4th entry in the 3rd column

					if ( perspective ) {

						if ( start.z < 0.0 && end.z >= 0.0 ) {

							trimSegment( start, end );

						} else if ( end.z < 0.0 && start.z >= 0.0 ) {

							trimSegment( end, start );

						}

					}

					// clip space
					vec4 clipStart = projectionMatrix * start;
					vec4 clipEnd = projectionMatrix * end;

					// ndc space
					vec3 ndcStart = clipStart.xyz / clipStart.w;
					vec3 ndcEnd = clipEnd.xyz / clipEnd.w;

					// direction
					vec2 dir = ndcEnd.xy - ndcStart.xy;

					// account for clip-space aspect ratio
					dir.x *= aspect;
					dir = normalize( dir );

					#ifdef WORLD_UNITS

						// get the offset direction as perpendicular to the view vector
						vec3 worldDir = normalize( end.xyz - start.xyz );
						vec3 offset;
						if ( position.y < 0.5 ) {

							offset = normalize( cross( start.xyz, worldDir ) );

						} else {

							offset = normalize( cross( end.xyz, worldDir ) );

						}

						// sign flip
						if ( position.x < 0.0 ) offset *= - 1.0;

						float forwardOffset = dot( worldDir, vec3( 0.0, 0.0, 1.0 ) );

						// don't extend the line if we're rendering dashes because we
						// won't be rendering the endcaps
						#ifndef USE_DASH

							// extend the line bounds to encompass  endcaps
							start.xyz += - worldDir * linewidth * 0.5;
							end.xyz += worldDir * linewidth * 0.5;

							// shift the position of the quad so it hugs the forward edge of the line
							offset.xy -= dir * forwardOffset;
							offset.z += 0.5;

						#endif

						// endcaps
						if ( position.y > 1.0 || position.y < 0.0 ) {

							offset.xy += dir * 2.0 * forwardOffset;

						}

						// adjust for linewidth
						offset *= linewidth * 0.5;

						// set the world position
						worldPos = ( position.y < 0.5 ) ? start : end;
						worldPos.xyz += offset;

						// project the worldpos
						vec4 clip = projectionMatrix * worldPos;

						// shift the depth of the projected points so the line
						// segments overlap neatly
						vec3 clipPose = ( position.y < 0.5 ) ? ndcStart : ndcEnd;
						clip.z = clipPose.z * clip.w;

					#else

						vec2 offset = vec2( dir.y, - dir.x );
						// undo aspect ratio adjustment
						dir.x /= aspect;
						offset.x /= aspect;

						// sign flip
						if ( position.x < 0.0 ) offset *= - 1.0;

						// endcaps
						if ( position.y < 0.0 ) {

							offset += - dir;

						} else if ( position.y > 1.0 ) {

							offset += dir;

						}

						// adjust for linewidth
						offset *= linewidth;

						// adjust for clip-space to screen-space conversion // maybe resolution should be based on viewport ...
						offset /= resolution.y;

						// select end
						vec4 clip = ( position.y < 0.5 ) ? clipStart : clipEnd;

						// back to clip space
						offset *= clip.w;

						clip.xy += offset;

					#endif

					gl_Position = clip;

					vec4 mvPosition = ( position.y < 0.5 ) ? start : end; // this is an approximation

					#include <logdepthbuf_vertex>
					#include <clipping_planes_vertex>
					#include <fog_vertex>

				}
			`,fragmentShader:`
				uniform vec3 diffuse;
				uniform float opacity;
				uniform float linewidth;

				#ifdef USE_DASH

					uniform float dashOffset;
					uniform float dashSize;
					uniform float gapSize;

				#endif

				varying float vLineDistance;

				#ifdef WORLD_UNITS

					varying vec4 worldPos;
					varying vec3 worldStart;
					varying vec3 worldEnd;

					#ifdef USE_DASH

						varying vec2 vUv;

					#endif

				#else

					varying vec2 vUv;

				#endif

				#include <common>
				#include <fog_pars_fragment>
				#include <logdepthbuf_pars_fragment>
				#include <clipping_planes_pars_fragment>

				#ifdef USE_COLOR
					#ifdef USE_LINE_COLOR_ALPHA
						varying vec4 vLineColor;
					#else
						varying vec3 vLineColor;
					#endif
				#endif

				vec2 closestLineToLine(vec3 p1, vec3 p2, vec3 p3, vec3 p4) {

					float mua;
					float mub;

					vec3 p13 = p1 - p3;
					vec3 p43 = p4 - p3;

					vec3 p21 = p2 - p1;

					float d1343 = dot( p13, p43 );
					float d4321 = dot( p43, p21 );
					float d1321 = dot( p13, p21 );
					float d4343 = dot( p43, p43 );
					float d2121 = dot( p21, p21 );

					float denom = d2121 * d4343 - d4321 * d4321;

					float numer = d1343 * d4321 - d1321 * d4343;

					mua = numer / denom;
					mua = clamp( mua, 0.0, 1.0 );
					mub = ( d1343 + d4321 * ( mua ) ) / d4343;
					mub = clamp( mub, 0.0, 1.0 );

					return vec2( mua, mub );

				}

				void main() {

					#include <clipping_planes_fragment>

					#ifdef USE_DASH

						if ( vUv.y < - 1.0 || vUv.y > 1.0 ) discard; // discard endcaps

						if ( mod( vLineDistance + dashOffset, dashSize + gapSize ) > dashSize ) discard; // todo - FIX

					#endif

					float alpha = opacity;

					#ifdef WORLD_UNITS

						// Find the closest points on the view ray and the line segment
						vec3 rayEnd = normalize( worldPos.xyz ) * 1e5;
						vec3 lineDir = worldEnd - worldStart;
						vec2 params = closestLineToLine( worldStart, worldEnd, vec3( 0.0, 0.0, 0.0 ), rayEnd );

						vec3 p1 = worldStart + lineDir * params.x;
						vec3 p2 = rayEnd * params.y;
						vec3 delta = p1 - p2;
						float len = length( delta );
						float norm = len / linewidth;

						#ifndef USE_DASH

							#ifdef USE_ALPHA_TO_COVERAGE

								float dnorm = fwidth( norm );
								alpha = 1.0 - smoothstep( 0.5 - dnorm, 0.5 + dnorm, norm );

							#else

								if ( norm > 0.5 ) {

									discard;

								}

							#endif

						#endif

					#else

						#ifdef USE_ALPHA_TO_COVERAGE

							// artifacts appear on some hardware if a derivative is taken within a conditional
							float a = vUv.x;
							float b = ( vUv.y > 0.0 ) ? vUv.y - 1.0 : vUv.y + 1.0;
							float len2 = a * a + b * b;
							float dlen = fwidth( len2 );

							if ( abs( vUv.y ) > 1.0 ) {

								alpha = 1.0 - smoothstep( 1.0 - dlen, 1.0 + dlen, len2 );

							}

						#else

							if ( abs( vUv.y ) > 1.0 ) {

								float a = vUv.x;
								float b = ( vUv.y > 0.0 ) ? vUv.y - 1.0 : vUv.y + 1.0;
								float len2 = a * a + b * b;

								if ( len2 > 1.0 ) discard;

							}

						#endif

					#endif

					vec4 diffuseColor = vec4( diffuse, alpha );
					#ifdef USE_COLOR
						#ifdef USE_LINE_COLOR_ALPHA
							diffuseColor *= vLineColor;
						#else
							diffuseColor.rgb *= vLineColor;
						#endif
					#endif

					#include <logdepthbuf_fragment>

					gl_FragColor = diffuseColor;

					#include <tonemapping_fragment>
					#include <${ye>=154?`colorspace_fragment`:`encodings_fragment`}>
					#include <fog_fragment>
					#include <premultiplied_alpha_fragment>

				}
			`,clipping:!0}),this.isLineMaterial=!0,this.onBeforeCompile=function(){this.transparent?this.defines.USE_LINE_COLOR_ALPHA=`1`:delete this.defines.USE_LINE_COLOR_ALPHA},Object.defineProperties(this,{color:{enumerable:!0,get:function(){return this.uniforms.diffuse.value},set:function(e){this.uniforms.diffuse.value=e}},worldUnits:{enumerable:!0,get:function(){return`WORLD_UNITS`in this.defines},set:function(e){e===!0?this.defines.WORLD_UNITS=``:delete this.defines.WORLD_UNITS}},linewidth:{enumerable:!0,get:function(){return this.uniforms.linewidth.value},set:function(e){this.uniforms.linewidth.value=e}},dashed:{enumerable:!0,get:function(){return`USE_DASH`in this.defines},set(e){!!e!=`USE_DASH`in this.defines&&(this.needsUpdate=!0),e===!0?this.defines.USE_DASH=``:delete this.defines.USE_DASH}},dashScale:{enumerable:!0,get:function(){return this.uniforms.dashScale.value},set:function(e){this.uniforms.dashScale.value=e}},dashSize:{enumerable:!0,get:function(){return this.uniforms.dashSize.value},set:function(e){this.uniforms.dashSize.value=e}},dashOffset:{enumerable:!0,get:function(){return this.uniforms.dashOffset.value},set:function(e){this.uniforms.dashOffset.value=e}},gapSize:{enumerable:!0,get:function(){return this.uniforms.gapSize.value},set:function(e){this.uniforms.gapSize.value=e}},opacity:{enumerable:!0,get:function(){return this.uniforms.opacity.value},set:function(e){this.uniforms.opacity.value=e}},resolution:{enumerable:!0,get:function(){return this.uniforms.resolution.value},set:function(e){this.uniforms.resolution.value.copy(e)}},alphaToCoverage:{enumerable:!0,get:function(){return`USE_ALPHA_TO_COVERAGE`in this.defines},set:function(e){!!e!=`USE_ALPHA_TO_COVERAGE`in this.defines&&(this.needsUpdate=!0),e===!0?(this.defines.USE_ALPHA_TO_COVERAGE=``,this.extensions.derivatives=!0):(delete this.defines.USE_ALPHA_TO_COVERAGE,this.extensions.derivatives=!1)}}}),this.setValues(e)}},Te=new D,Ee=new y,De=new y,U=new D,W=new D,G=new D,Oe=new y,ke=new p,K=new j,Ae=new y,q=new _,J=new c,Y=new D,X,Z;function je(e,t,n){return Y.set(0,0,-t,1).applyMatrix4(e.projectionMatrix),Y.multiplyScalar(1/Y.w),Y.x=Z/n.width,Y.y=Z/n.height,Y.applyMatrix4(e.projectionMatrixInverse),Y.multiplyScalar(1/Y.w),Math.abs(Math.max(Y.x,Y.y))}function Me(e,t){let n=e.matrixWorld,r=e.geometry,i=r.attributes.instanceStart,a=r.attributes.instanceEnd,o=Math.min(r.instanceCount,i.count);for(let r=0,s=o;r<s;r++){K.start.fromBufferAttribute(i,r),K.end.fromBufferAttribute(a,r),K.applyMatrix4(n);let o=new y,s=new y;X.distanceSqToSegment(K.start,K.end,s,o),s.distanceTo(o)<Z*.5&&t.push({point:s,pointOnLine:o,distance:X.origin.distanceTo(s),object:e,face:null,faceIndex:r,uv:null,[be]:null})}}function Ne(e,t,n){let r=t.projectionMatrix,i=e.material.resolution,a=e.matrixWorld,o=e.geometry,s=o.attributes.instanceStart,c=o.attributes.instanceEnd,l=Math.min(o.instanceCount,s.count),u=-t.near;X.at(1,G),G.w=1,G.applyMatrix4(t.matrixWorldInverse),G.applyMatrix4(r),G.multiplyScalar(1/G.w),G.x*=i.x/2,G.y*=i.y/2,G.z=0,Oe.copy(G),ke.multiplyMatrices(t.matrixWorldInverse,a);for(let t=0,o=l;t<o;t++){if(U.fromBufferAttribute(s,t),W.fromBufferAttribute(c,t),U.w=1,W.w=1,U.applyMatrix4(ke),W.applyMatrix4(ke),U.z>u&&W.z>u)continue;if(U.z>u){let e=U.z-W.z,t=(U.z-u)/e;U.lerp(W,t)}else if(W.z>u){let e=W.z-U.z,t=(W.z-u)/e;W.lerp(U,t)}U.applyMatrix4(r),W.applyMatrix4(r),U.multiplyScalar(1/U.w),W.multiplyScalar(1/W.w),U.x*=i.x/2,U.y*=i.y/2,W.x*=i.x/2,W.y*=i.y/2,K.start.copy(U),K.start.z=0,K.end.copy(W),K.end.z=0;let o=K.closestPointToPointParameter(Oe,!0);K.at(o,Ae);let l=ee.lerp(U.z,W.z,o),d=l>=-1&&l<=1,f=Oe.distanceTo(Ae)<Z*.5;if(d&&f){K.start.fromBufferAttribute(s,t),K.end.fromBufferAttribute(c,t),K.start.applyMatrix4(a),K.end.applyMatrix4(a);let r=new y,i=new y;X.distanceSqToSegment(K.start,K.end,i,r),n.push({point:i,pointOnLine:r,distance:X.origin.distanceTo(i),object:e,face:null,faceIndex:t,uv:null,[be]:null})}}}var Pe=class extends i{constructor(e=new Se,t=new we({color:Math.random()*16777215})){super(e,t),this.isLineSegments2=!0,this.type=`LineSegments2`}computeLineDistances(){let e=this.geometry,t=e.attributes.instanceStart,n=e.attributes.instanceEnd,r=new Float32Array(2*t.count);for(let e=0,i=0,a=t.count;e<a;e++,i+=2)Ee.fromBufferAttribute(t,e),De.fromBufferAttribute(n,e),r[i]=i===0?0:r[i-1],r[i+1]=r[i]+Ee.distanceTo(De);let i=new o(r,2,1);return e.setAttribute(`instanceDistanceStart`,new d(i,1,0)),e.setAttribute(`instanceDistanceEnd`,new d(i,1,1)),this}raycast(e,t){let n=this.material.worldUnits,r=e.camera;r===null&&!n&&console.error(`LineSegments2: "Raycaster.camera" needs to be set in order to raycast against LineSegments2 while worldUnits is set to false.`);let i=e.params.Line2===void 0?0:e.params.Line2.threshold||0;X=e.ray;let a=this.matrixWorld,o=this.geometry,s=this.material;Z=s.linewidth+i,o.boundingSphere===null&&o.computeBoundingSphere(),J.copy(o.boundingSphere).applyMatrix4(a);let c;if(c=n?Z*.5:je(r,Math.max(r.near,J.distanceToPoint(X.origin)),s.resolution),J.radius+=c,X.intersectsSphere(J)===!1)return;o.boundingBox===null&&o.computeBoundingBox(),q.copy(o.boundingBox).applyMatrix4(a);let l;l=n?Z*.5:je(r,Math.max(r.near,q.distanceToPoint(X.origin)),s.resolution),q.expandByScalar(l),X.intersectsBox(q)!==!1&&(n?Me(this,t):Ne(this,r,t))}onBeforeRender(e){let t=this.material.uniforms;t&&t.resolution&&(e.getViewport(Te),this.material.uniforms.resolution.value.set(Te.z,Te.w))}},Fe=class extends Pe{constructor(e=new Ce,t=new we({color:Math.random()*16777215})){super(e,t),this.isLine2=!0,this.type=`Line2`}},Q=I.forwardRef(function({points:e,color:t=16777215,vertexColors:n,linewidth:r,lineWidth:i,segments:o,dashed:s,...c},l){var u;let d=ae(e=>e.size),f=I.useMemo(()=>o?new Pe:new Fe,[o]),[p]=I.useState(()=>new we),m=(n==null||(u=n[0])==null?void 0:u.length)===4?4:3,h=I.useMemo(()=>{let r=o?new Se:new Ce,i=e.map(e=>{let t=Array.isArray(e);return e instanceof y||e instanceof D?[e.x,e.y,e.z]:e instanceof a?[e.x,e.y,0]:t&&e.length===3?[e[0],e[1],e[2]]:t&&e.length===2?[e[0],e[1],0]:e});if(r.setPositions(i.flat()),n){t=16777215;let e=n.map(e=>e instanceof E?e.toArray():e);r.setColors(e.flat(),m)}return r},[e,o,n,m]);return I.useLayoutEffect(()=>{f.computeLineDistances()},[e,f]),I.useLayoutEffect(()=>{s?p.defines.USE_DASH=``:delete p.defines.USE_DASH,p.needsUpdate=!0},[s,p]),I.useEffect(()=>()=>{h.dispose(),p.dispose()},[h]),I.createElement(`primitive`,se({object:f,ref:l},c),I.createElement(`primitive`,{object:h,attach:`geometry`}),I.createElement(`primitive`,se({object:p,attach:`material`,color:t,vertexColors:!!n,resolution:[d.width,d.height],linewidth:r??i??1,dashed:s,transparent:m===4},c)))}),$=n();function Ie(e){let t=e.toLowerCase();return t.includes(`sezionamento`)?`giunto`:t.includes(`punto di terra`)?`punto-terra`:t.includes(`picchetto`)?`picchetto`:t.includes(`compensator`)?`compensatore`:t.includes(`supporto`)?`supporto`:t.startsWith(`asta`)?`asta`:`morsetto`}var Le={supporto:()=>new S(.06,.09,.08,10),morsetto:()=>new T(.08,.08,.08),compensatore:()=>new m(.1,.02,6,12,Math.PI),giunto:()=>new T(.14,.1,.08),picchetto:()=>new l(.07,10,8),"punto-terra":()=>new S(.1,.1,.02,16),asta:()=>new l(.07,10,8)},Re={supporto:`#6b7a84`,morsetto:`#3a4750`,compensatore:`#6b7a84`,giunto:`#e5b300`,picchetto:`#875b32`,"punto-terra":`#875b32`,asta:`#3a4750`},ze=`#f39b00`;function Be({marcatori:e,forma:t,proposta:n,onClic:r,onSopra:i}){let a=(0,I.useMemo)(()=>{let r=Le[t](),i=new re({color:n?ze:Re[t],transparent:n,opacity:n?.7:1}),a=new f(r,i,Math.max(1,e.length)),o=new O;return e.forEach((e,t)=>{o.position.set(e.x,e.z+.05,-e.y),o.updateMatrix(),a.setMatrixAt(t,o.matrix)}),a.count=e.length,a.instanceMatrix.needsUpdate=!0,a.renderOrder=3,a},[e,t,n]),o=t=>t.instanceId===void 0?null:e[t.instanceId]??null;return(0,$.jsx)(`primitive`,{object:a,onClick:e=>{e.stopPropagation();let t=o(e);t&&r(t)},onPointerMove:e=>{e.stopPropagation(),i(o(e))},onPointerOut:()=>i(null)})}function Ve({marcatori:e,onSeleziona:t}){let[n,r]=(0,I.useState)(null),i=(0,I.useMemo)(()=>{let t=new Map;for(let n of e){let e=Ie(n.tipoComponente),r=n.origine!==`progetto`,i=`${e}|${r}`,a=t.get(i)??{forma:e,proposta:r,lista:[]};a.lista.push(n),t.set(i,a)}return[...t.entries()]},[e]);return(0,$.jsxs)(`group`,{children:[i.map(([e,n])=>(0,$.jsx)(Be,{marcatori:n.lista,forma:n.forma,proposta:n.proposta,onClic:e=>t(e.idParticolare),onSopra:r},e)),n&&(0,$.jsx)(V,{position:[n.x,n.z+.35,-n.y],center:!0,style:{pointerEvents:`none`},children:(0,$.jsxs)(`div`,{className:`whitespace-nowrap rounded-full bg-[#212529] px-2 py-0.5 text-xs text-white shadow`,children:[F(n.idParticolare),` · `,n.tipoComponente,n.quantita>1?` ×${n.quantita}`:``]})})]})}function He(){let e=getComputedStyle(document.documentElement),t=t=>e.getPropertyValue(t).trim();return{terra:t(`--viewer-terra`),surface:t(`--viewer-surface`),roof:t(`--viewer-roof`),metal:t(`--viewer-metal`),grid:t(`--viewer-grid`),exposed:t(`--viewer-exposed`),protected:t(`--viewer-protected`),maglia:t(`--viewer-maglia`),accent:t(`--accent`)}}function Ue({corpo:e,c:t,onClick:n}){let r=(0,I.useMemo)(()=>{if(e.mesh){let t=new te,n=e.mesh.posizioni,r=[];for(let t=0;t<n.length;t+=3)r.push(n[t]??0,(n[t+2]??0)+e.quotaBase,-(n[t+1]??0));return t.setAttribute(`position`,new k(r,3)),e.mesh.indici&&t.setIndex(e.mesh.indici),t.computeVertexNormals(),t}let t=new u;e.impronta.forEach((e,n)=>n?t.lineTo(e[0],e[1]):t.moveTo(e[0],e[1])),t.closePath();let n=new A(t,{depth:e.altezzaGronda,bevelEnabled:!1});return n.rotateX(-Math.PI/2),n.translate(0,e.quotaBase,0),n},[e]);(0,I.useEffect)(()=>()=>r.dispose(),[r]);let i=(0,I.useMemo)(()=>{if(e.tipoTetto!==`falde`)return null;let t=e.impronta.map(e=>e[0]),n=e.impronta.map(e=>e[1]),r=Math.min(...t),i=Math.max(...t),a=Math.min(...n),o=Math.max(...n),s=(a+o)/2,c=e.quotaBase+e.altezzaGronda,l=e.quotaBase+e.altezzaColmo,u=[r,c,-a,i,c,-a,i,l,-s,r,c,-a,i,l,-s,r,l,-s,r,l,-s,i,l,-s,i,c,-o,r,l,-s,i,c,-o,r,c,-o],d=new te;return d.setAttribute(`position`,new k(u,3)),d.computeVertexNormals(),d},[e]);return(0,I.useEffect)(()=>()=>i?.dispose(),[i]),(0,$.jsxs)(`group`,{children:[(0,$.jsx)(`mesh`,{geometry:r,onClick:n,children:(0,$.jsx)(`meshStandardMaterial`,{color:t.surface,side:2})}),i&&(0,$.jsx)(`mesh`,{geometry:i,onClick:n,children:(0,$.jsx)(`meshStandardMaterial`,{color:t.roof,side:2})})]})}function We({alto:e,modello:t}){let{camera:n,invalidate:r}=ae();return(0,I.useEffect)(()=>{let i=M(t),a=(i.minX+i.maxX)/2,o=-(i.minY+i.maxY)/2,s=Math.max(i.L,i.W,i.H,20)*1.8;n.position.set(e?a:a+s,e?s:s*.8,e?o+.01:o+s),n.lookAt(a,i.H*.3,o),r()},[e,t,n,r]),null}function Ge({r:e,combinata:t,c:n}){let{esposte:r,protette:i,daMaglia:a}=(0,I.useMemo)(()=>{let n=e.griglia,r=[],i=[],a=[];for(let o=0;o<e.esposta.length;o++){let s=e.esposta[o];if(!s)continue;let c=o%n.nx,l=Math.floor(o/n.nx),u=[n.x0+c*n.passo,n.y0+l*n.passo,e.altezze[o]??0];if(t){let e=t.stato[o];e===1?i.push(u):e===2?a.push(u):e===3&&r.push(u)}else(s===1?r:i).push(u)}return{esposte:r,protette:i,daMaglia:a}},[e,t]),o=(t,n)=>{let r=new g(e.griglia.passo,e.griglia.passo),i=new b({color:n,side:2}),a=new f(r,i,Math.max(1,t.length)),o=new O;return t.forEach((e,t)=>{o.position.set(e[0],e[2]+.06,-e[1]),o.rotation.set(-Math.PI/2,0,0),o.updateMatrix(),a.setMatrixAt(t,o.matrix)}),a.count=t.length,a.instanceMatrix.needsUpdate=!0,a},s=(0,I.useMemo)(()=>o(r,n.exposed),[r,n.exposed,e.griglia.passo]),c=(0,I.useMemo)(()=>o(i,n.protected),[i,n.protected,e.griglia.passo]),l=(0,I.useMemo)(()=>o(a,n.maglia),[a,n.maglia,e.griglia.passo]);return(0,I.useEffect)(()=>()=>{s.geometry.dispose(),c.geometry.dispose(),l.geometry.dispose()},[s,c,l]),(0,$.jsxs)(`group`,{children:[r.length>0&&(0,$.jsx)(`primitive`,{object:s}),i.length>0&&(0,$.jsx)(`primitive`,{object:c}),a.length>0&&(0,$.jsx)(`primitive`,{object:l})]})}function Ke({rm:e,r:t,c:n,evidenziata:r}){let i=t.griglia,a=(0,I.useMemo)(()=>e.maglie.map(n=>{let r=[];for(let a=0;a<e.maglia.length;a++){if(e.maglia[a]!==n.id)continue;let o=a%i.nx,s=Math.floor(a/i.nx),c=i.x0+o*i.passo,l=i.y0+s*i.passo,u=(t.altezze[a]??0)+.08,d=i.passo/2,f=(t,n)=>{let r=o+t,a=s+n;return r<0||a<0||r>=i.nx||a>=i.ny?-1:e.maglia[a*i.nx+r]};f(0,-1)!==n.id&&r.push([c-d,u,-(l-d)],[c+d,u,-(l-d)]),f(0,1)!==n.id&&r.push([c-d,u,-(l+d)],[c+d,u,-(l+d)]),f(-1,0)!==n.id&&r.push([c-d,u,-(l-d)],[c-d,u,-(l+d)]),f(1,0)!==n.id&&r.push([c+d,u,-(l-d)],[c+d,u,-(l+d)])}let a=Math.round((n.centro[0]-i.x0)/i.passo),o=Math.round((n.centro[1]-i.y0)/i.passo);return{m:n,seg:r,zCentro:t.altezze[Math.min(i.ny-1,Math.max(0,o))*i.nx+Math.min(i.nx-1,Math.max(0,a))]??0}}),[e,t,i]);return(0,$.jsx)(`group`,{children:a.map(({m:e,seg:t,zCentro:i})=>{let a=e.id===r?n.accent:e.conforme?n.protected:n.exposed;return(0,$.jsxs)(`group`,{children:[t.length>0&&(0,$.jsx)(Q,{segments:!0,points:t,color:a,lineWidth:e.id===r?5:2}),(0,$.jsx)(V,{position:[e.centro[0],i+.4,-e.centro[1]],center:!0,style:{pointerEvents:`none`},children:(0,$.jsxs)(`div`,{style:{background:`var(--background)`,color:a,border:`1px solid ${a}`,borderRadius:4,padding:`1px 6px`,fontSize:11,whiteSpace:`nowrap`},children:[e.lunghezza.toFixed(1),` × `,e.larghezza.toFixed(1),` m`]})})]},e.id)})})}function qe({r:e,c:t}){let n=(0,I.useMemo)(()=>{let n=e.facceEsposte;if(!n.length)return null;let r=new g(1,1),i=new b({color:t.exposed,transparent:!0,opacity:.55,side:2,depthWrite:!1}),a=new f(r,i,n.length),o=new O;return n.forEach((e,t)=>{let n=Math.max(.01,e.zA-e.zDa);o.position.set(e.x,(e.zDa+e.zA)/2,-e.y),o.rotation.set(0,Math.atan2(e.normale[0],e.normale[1]),0),o.scale.set(e.lunghezza,n,1),o.updateMatrix(),a.setMatrixAt(t,o.matrix)}),a.instanceMatrix.needsUpdate=!0,a},[e,t.exposed]);return(0,I.useEffect)(()=>()=>{n?.geometry.dispose()},[n]),n?(0,$.jsx)(`primitive`,{object:n}):null}function Je({inv:e,c:t}){let n=(0,I.useMemo)(()=>{let t=new g((e.nx-1)*e.passo,(e.ny-1)*e.passo,e.nx-1,e.ny-1),n=t.attributes.position;if(!n)return t;for(let t=0;t<e.ny;t++)for(let r=0;r<e.nx;r++){let i=t*e.nx+r,a=e.z[t]?.[r];n.setXYZ(i,e.x0+r*e.passo,-(e.y0+t*e.passo),Number.isFinite(a)?a:0)}return t.computeVertexNormals(),t},[e]);return(0,I.useEffect)(()=>()=>n.dispose(),[n]),(0,$.jsx)(`mesh`,{geometry:n,children:(0,$.jsx)(`meshStandardMaterial`,{color:`#7dd3fc`,transparent:!0,opacity:.25,side:2,depthWrite:!1})})}function Ye({r:e,anima:t,centri:n,posizione:r,color:i}){let a=(0,I.useRef)(null),o=(0,I.useRef)(0);return oe((e,i)=>{if(!a.current||!n.length)return;t&&(o.current+=i);let s=n.length-1,c=t?o.current%4/4*s:Math.min(s,r*s),l=Math.min(s,Math.floor(c)),u=c-l,d=n[l],f=n[Math.min(s,l+1)];d&&f&&a.current.position.set(d[0]+(f[0]-d[0])*u,d[2]+(f[2]-d[2])*u,-(d[1]+(f[1]-d[1])*u)),a.current.rotation.z=o.current*2}),(0,$.jsxs)(`mesh`,{ref:a,children:[(0,$.jsx)(`sphereGeometry`,{args:[e.raggio,32,20]}),(0,$.jsx)(`meshBasicMaterial`,{color:i,wireframe:!0,transparent:!0,opacity:.35})]})}function Xe({p:e,c:t}){let n=(e,n,r=t.accent)=>{let i=new l(n,8,6),a=new b({color:r}),o=new f(i,a,Math.max(1,e.length)),s=new O;return e.forEach((e,t)=>{s.position.set(e.x,e.z,-e.y),s.updateMatrix(),o.setMatrixAt(t,s.matrix)}),o.count=e.length,o.instanceMatrix.needsUpdate=!0,o},r=(0,I.useMemo)(()=>e.supporti.filter(e=>e.tipo===`supporto calata`),[e.supporti]),i=(0,I.useMemo)(()=>e.supporti.filter(e=>e.tipo!==`supporto calata`),[e.supporti]),a=(0,I.useMemo)(()=>n(i,.07),[i,t.accent]),o=(0,I.useMemo)(()=>n(r,.09,t.protected),[r,t.protected]),s=(0,I.useMemo)(()=>n(e.morsetti,.14),[e.morsetti,t.accent]),c=e.compensatori??[],u=(0,I.useMemo)(()=>{let e=new v(.2,0),n=new b({color:t.metal}),r=new f(e,n,Math.max(1,c.length)),i=new O;return c.forEach((e,t)=>{i.position.set(e.x,e.z+.1,-e.y),i.rotation.set(0,(e.rotazione??0)*Math.PI/180,0),i.scale.set(1,.6,.5),i.updateMatrix(),r.setMatrixAt(t,i.matrix)}),r.count=c.length,r.instanceMatrix.needsUpdate=!0,r},[c,t.metal]);return(0,I.useEffect)(()=>()=>{o.geometry.dispose(),a.geometry.dispose(),s.geometry.dispose(),u.geometry.dispose()},[a,o,s,u]),(0,$.jsxs)(`group`,{children:[e.conduttori.map((e,n)=>(0,$.jsx)(Q,{points:e.punti.map(e=>[e[0],e[2]+.05,-e[1]]),color:t.accent,lineWidth:2,dashed:!0,dashSize:.4,gapSize:.25},n)),e.aste.map((e,n)=>(0,$.jsxs)(`mesh`,{position:[e.x,(e.z??0)+e.altezza/2,-e.y],children:[(0,$.jsx)(`cylinderGeometry`,{args:[.08,.08,e.altezza,8]}),(0,$.jsx)(`meshStandardMaterial`,{color:t.accent,transparent:!0,opacity:.8})]},n)),i.length>0&&(0,$.jsx)(`primitive`,{object:a}),r.length>0&&(0,$.jsx)(`primitive`,{object:o}),e.morsetti.length>0&&(0,$.jsx)(`primitive`,{object:s}),c.length>0&&(0,$.jsx)(`primitive`,{object:u})]})}function Ze(e){let[t,n]=(0,I.useState)(null),[r,i]=(0,I.useState)([]),[a,o]=(0,I.useState)(!1);if((0,I.useEffect)(()=>n(He()),[]),!t)return(0,$.jsx)(`div`,{className:`viewer-canvas bg-secondary`});function s(t){t.stopPropagation();let n=[t.point.x,-t.point.z,t.point.y];e.onPunto(n),e.misura&&i(e=>e.length===1?[...e,n]:[n])}let c=r[0],l=r[1],u=c&&l?Math.hypot(c[0]-l[0],c[1]-l[1],c[2]-l[2]):null;return(0,$.jsxs)(`div`,{className:`relative`,"data-scene-ready":a?`true`:void 0,children:[(0,$.jsx)(`div`,{className:`viewer-canvas`,children:(0,$.jsxs)(N,{frameloop:e.anima?`always`:`demand`,camera:{position:[40,35,40],near:.1,far:5e3},onCreated:()=>o(!0),children:[(0,$.jsx)(`color`,{attach:`background`,args:[t.surface]}),(0,$.jsx)(`ambientLight`,{intensity:.8}),(0,$.jsx)(`directionalLight`,{position:[30,60,20],intensity:1.6}),(0,$.jsx)(`gridHelper`,{args:[500,100,t.grid,t.grid]}),(0,$.jsx)(`axesHelper`,{args:[10]}),(0,$.jsx)(We,{alto:e.alto,modello:e.modello}),(0,$.jsx)(P,{makeDefault:!0,target:[(M(e.modello).minX+M(e.modello).maxX)/2,M(e.modello).H*.3,-(M(e.modello).minY+M(e.modello).maxY)/2]}),e.modello.corpi.map(e=>(0,$.jsx)(Ue,{corpo:e,c:t,onClick:s},e.id)),e.aste.map(e=>(0,$.jsxs)(`mesh`,{position:[e.x,e.z+e.altezza/2,-e.y],children:[(0,$.jsx)(`cylinderGeometry`,{args:[Math.max(.06,e.diametro/2),Math.max(.06,e.diametro/2),e.altezza,8]}),(0,$.jsx)(`meshStandardMaterial`,{color:t.metal})]},e.id)),e.suggerite.map(e=>(0,$.jsxs)(`mesh`,{position:[e.x,e.z+e.altezza/2,-e.y],children:[(0,$.jsx)(`cylinderGeometry`,{args:[Math.max(.08,e.diametro/2),Math.max(.08,e.diametro/2),e.altezza,8]}),(0,$.jsx)(`meshStandardMaterial`,{color:t.accent,transparent:!0,opacity:.7})]},e.id)),e.conduttori.map(e=>(0,$.jsx)(Q,{points:e.punti.map(e=>[e[0],e[2]+.04,-e[1]]),color:e.tipo===`terra`?t.terra:t.metal,depthTest:e.tipo!==`terra`,renderOrder:e.tipo===`terra`?2:0,lineWidth:3},e.id)),(e.picchetti??[]).map((e,n)=>(0,$.jsx)(Q,{points:[[e.x,e.z??0,-e.y],[e.x,(e.z??0)-e.lunghezza,-e.y]],color:t.terra,depthTest:!1,renderOrder:2,lineWidth:4},`picchetto-${n}`)),e.propostaTerra&&(0,$.jsxs)(`group`,{children:[e.propostaTerra.conduttori.map((e,n)=>(0,$.jsx)(Q,{points:e.punti.map(e=>[e[0],e[2],-e[1]]),color:t.terra,depthTest:!1,renderOrder:2,lineWidth:3,dashed:!0,dashSize:.4,gapSize:.2},`terra-${n}`)),e.propostaTerra.picchetti.map((e,n)=>(0,$.jsx)(Q,{points:[[e.x,e.z??0,-e.y],[e.x,(e.z??0)-e.lunghezza,-e.y]],color:t.terra,depthTest:!1,renderOrder:2,lineWidth:4},`picchetto-preview-${n}`)),e.propostaTerra.morsetti.map((e,n)=>(0,$.jsxs)(`mesh`,{position:[e.x,e.z,-e.y],children:[(0,$.jsx)(`sphereGeometry`,{args:[.15,8,6]}),(0,$.jsx)(`meshBasicMaterial`,{color:t.terra})]},`morsetto-terra-${n}`))]}),e.proposta&&(0,$.jsx)(Xe,{p:e.proposta,c:t}),e.particolari&&e.particolari.length>0&&(0,$.jsx)(Ve,{marcatori:e.particolari,onSeleziona:t=>{e.onParticolare?.(t)}}),e.risultato&&(0,$.jsxs)($.Fragment,{children:[(0,$.jsx)(Ge,{r:e.risultato,combinata:e.combinata,c:t}),(0,$.jsx)(qe,{r:e.risultato,c:t}),e.mostraMaglie&&e.maglia&&(0,$.jsx)(Ke,{rm:e.maglia,r:e.risultato,c:t,evidenziata:e.magliaEvidenziata}),e.mostraInviluppo&&e.inviluppo&&(0,$.jsx)(Je,{inv:e.inviluppo,c:t}),(0,$.jsx)(Ye,{r:e.risultato,anima:e.anima,centri:e.centriSfera,posizione:e.posizioneSfera,color:t.metal})]}),c&&l&&(0,$.jsx)(Q,{points:[[c[0],c[2]+.1,-c[1]],[l[0],l[2]+.1,-l[1]]],color:t.metal,lineWidth:3})]})}),u!==null&&(0,$.jsxs)(`div`,{className:`absolute left-4 top-4 rounded bg-background px-3 py-2 font-mono text-sm`,children:[u.toFixed(2),` m`]})]})}export{Ze as default};