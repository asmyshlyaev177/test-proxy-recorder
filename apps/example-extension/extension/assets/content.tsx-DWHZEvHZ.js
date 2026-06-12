import{a as e,c as t,i as n,n as r,o as i,s as a,t as o}from"./countries-CPQFDGlg.js";function s(e){return new Promise((t,n)=>{e.oncomplete=e.onsuccess=()=>t(e.result),e.onabort=e.onerror=()=>n(e.error)})}function c(e,t){let n,r=()=>{if(n)return n;let r=indexedDB.open(e);return r.onupgradeneeded=()=>r.result.createObjectStore(t),n=s(r),n.then(e=>{e.onclose=()=>n=void 0},()=>{}),n};return(e,n)=>r().then(r=>n(r.transaction(t,e).objectStore(t)))}var l;function u(){return l||=c(`keyval-store`,`keyval`),l}function d(e,t=u()){return t(`readonly`,t=>s(t.get(e)))}function ee(e,t,n=u()){return n(`readwrite`,n=>(n.put(t,e),s(n.transaction)))}function f(e,t=u()){return t(`readwrite`,t=>(t.delete(e),s(t.transaction)))}function te(e,t){return e.openCursor().onsuccess=function(){this.result&&(t(this.result),this.result.continue())},s(e.transaction)}function p(e=u()){return e(`readonly`,t=>{if(t.getAll&&t.getAllKeys)return Promise.all([s(t.getAllKeys()),s(t.getAll())]).then(([e,t])=>e.map((e,n)=>[e,t[n]]));let n=[];return e(`readonly`,e=>te(e,e=>n.push([e.key,e.value])).then(()=>n))})}var m=10080*60*1e3,h=c(`x-profile-location`,`location-data`);async function g(e){let t=await d(e.toLowerCase(),h);if(t&&!(Date.now()-t.fetchedAt>m))return t.data}async function _(e,t){let n=e.toLowerCase();await ee(n,{data:{...(await d(n,h))?.data??{location:null,locationAccurate:!0,source:null},...t},fetchedAt:Date.now()},h)}async function ne(){let e=await p(h);await Promise.all(e.map(([e])=>f(e,h)))}async function re(){let e=await p(h),t=Date.now()-m;await Promise.all(e.filter(([,e])=>e.fetchedAt<t).map(([e])=>f(e,h)))}var ie=new Intl.Segmenter;function v(e){for(let t=0;t<e.length;t++)if(e.charCodeAt(t)>127)return ae(e);return e.split(``)}function ae(e){let t=[];for(let{segment:n}of ie.segment(e))t.push(n);return t}function oe(e,t){let n=t.length,r=e.length-n;outer:for(let i=0;i<=r;i++){for(let r=0;r<n;r++)if(e[i+r]!==t[r])continue outer;return!0}return!1}var y=null,b=[];function x(e){let t=[];b=[];for(let n of e)[...n].length===n.length?t.push(n):b.push(v(n));if(t.length===0)y=null;else{let e=t.map(e=>e.replace(/[.*+?^${}()|[\]\\]/g,`\\$&`));y=RegExp(`(?<![\\p{L}\\p{N}_])(${e.join(`|`)})(?![\\p{L}\\p{N}_])`,`iu`)}}function S(e){if(y!==null&&y.test(e))return!0;if(b.length>0){let t=v(e);for(let e of b)if(oe(t,e))return!0}return!1}var C=`https://x.com/i/api/graphql/XRqGa7EeokUU5kppkh13EA/AboutAccountQuery`,w=`[data-testid="HoverCard"]`,se=`[data-testid="UserName"] a[href]`,ce=`[data-testid="User-Name"] a[href]`,T=`article[data-testid="tweet"]`,E=`${T}[tabindex="-1"]`,D=`data-x-loc-primary-done`,le=300*1e3,O=new Set,k=new Set,A=!1,j=2,M=!1,N=!1;chrome.storage.local.get([o,e,n,t]).then(r=>{let i=r;O=new Set(Array.isArray(i.blockedCountries)?i[o]:[]),k=new Set(Array.isArray(i.highlightKeywords)?i[e].map(e=>e.toLowerCase()):[]),x([...k]);let a=i[n];A=a?.enabled??!1,j=a?.threshold??2,M=a?.uniqueOnly??!1,N=!!i[t]}),chrome.storage.onChanged.addListener((r,i)=>{if(i===`local`){if(r.blockedCountries){let e=r[o].newValue;O=new Set(Array.isArray(e)?e:[])}if(r.highlightKeywords){let t=r[e].newValue;k=new Set(Array.isArray(t)?t.map(e=>e.toLowerCase()):[]),x([...k]),q()}if(r.highlightFlags){let e=r[n].newValue;A=e?.enabled??!1,j=e?.threshold??2,M=e?.uniqueOnly??!1,q()}r.showLocationInFeed&&(N=!!r[t].newValue,pe())}});function P(e){if(O.has(e))return{emoji:`⚠️`,label:e};if(r[e])return{emoji:r[e],label:e};if(a[e]){let t=i[e];return t?{emoji:t,label:e,isText:!0}:{emoji:a[e],label:e}}return{emoji:`🌐`,label:e}}var F=null,ue=class{map=new Map;key(e){return e.toLowerCase()}has(e){return this.map.has(this.key(e))}get(e){return this.map.get(this.key(e))}set(e,t){this.map.set(this.key(e),t)}delete(e){return this.map.delete(this.key(e))}},I=new Set,L=new ue,R=0,z=null;chrome.runtime.onMessage.addListener(e=>{e?.type===`CLEAR_CACHE`&&(I.clear(),ne())});function B(e){let t=document.cookie.match(RegExp(`(?:^|; )`+e+`=([^;]*)`));return t?decodeURIComponent(t[1]):null}function V(e){let t=Math.ceil(e/1e3),n=Math.floor(t/60),r=t%60;return n>0?`${n}m ${r}s`:`${r}s`}function H(){let e=document.getElementById(`x-loc-rate-toast`);e||(e=document.createElement(`div`),e.id=`x-loc-rate-toast`,document.body.appendChild(e)),z&&clearInterval(z);function t(){let e=R-Date.now(),t=document.getElementById(`x-loc-rate-toast`);if(e<=0||!t){z&&clearInterval(z),z=null,t?.remove();return}t.textContent=`⚠ Rate limit hit · resets in ${V(e)}`}t(),z=setInterval(t,1e3)}async function U(e){if(L.has(e))return L.get(e);let t=F,n=(async()=>{let n=await g(e);if(n?.location||n?.source)return n;if(I.has(e.toLowerCase()))return n??null;if(!t)return null;if(R>Date.now())return H(),null;try{let r=JSON.stringify({screenName:e}),i=`${C}?variables=${encodeURIComponent(r)}`,a={authorization:t.authorization,"content-type":`application/json`,"x-twitter-client-language":t[`x-twitter-client-language`]??`en`,"x-twitter-active-user":t[`x-twitter-active-user`]??`yes`};if(t[`x-csrf-token`])a[`x-csrf-token`]=t[`x-csrf-token`];else{let e=B(`ct0`);e&&(a[`x-csrf-token`]=e)}let o=await fetch(i,{method:`GET`,headers:a,credentials:`include`});if(o.status===429){let e=o.headers.get(`x-rate-limit-reset`);return R=e?parseInt(e)*1e3:Date.now()+le,H(),null}if(!o.ok)return null;I.add(e.toLowerCase());let s=(await o.json())?.data?.user_result_by_screen_name?.result?.about_profile??null;if(!s)return n??null;let c={bio:n?.bio??null,location:s.account_based_in??null,locationAccurate:s.location_accurate!==!1,source:s.source??null};return await _(e,c),c}catch{return null}})();return L.set(e,n),n.finally(()=>L.delete(e)),n}function de(){if(document.getElementById(`x-loc-styles`))return;let e=document.createElement(`style`);e.id=`x-loc-styles`,e.textContent=`
.x-loc-info {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px;
}
.x-loc-icon {
  font-size: 20px;
  line-height: 1;
  cursor: default;
  display: inline-flex;
  align-items: center;
  user-select: none;
}
.x-loc-icon-flag {
  font-size: 26px;
}
.x-loc-icon-flag.x-loc-icon-abbr {
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.5px;
}
.x-loc-store-block .x-loc-icon-flag {
  font-size: 16px;
}
.x-loc-store-block .x-loc-icon-flag.x-loc-icon-abbr {
  font-size: 11px;
}
.x-loc-store-block {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  border: 1px solid rgba(128, 128, 128, 0.3);
  border-radius: 4px;
  padding: 1px 4px;
  margin-left: 4px;
  cursor: default;
  user-select: none;
}
.x-loc-icon-ratelimit {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.3px;
  line-height: 1;
  cursor: default;
  user-select: none;
  display: inline-flex;
  align-items: center;
  gap: 3px;
  background: rgba(180, 120, 0, 0.12);
  color: rgb(160, 100, 0);
  border: 1px solid rgba(180, 120, 0, 0.4);
  border-radius: 4px;
  padding: 2px 5px;
}
.x-loc-icon-vpn {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.3px;
  line-height: 1;
  cursor: default;
  user-select: none;
  display: inline-flex;
  align-items: center;
  gap: 3px;
  background: rgba(220, 38, 38, 0.15);
  color: rgb(200, 25, 25);
  border: 1px solid rgba(220, 38, 38, 0.4);
  border-radius: 4px;
  padding: 2px 5px;
}
#x-loc-rate-toast {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(24, 24, 24, 0.93);
  color: #fff;
  padding: 8px 18px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  z-index: 2147483647;
  pointer-events: none;
  white-space: nowrap;
  border: 1px solid rgba(220, 38, 38, 0.55);
}
article[data-x-loc-highlighted] {
  border-left: 3px solid #f59e0b !important;
  background: rgba(245, 158, 11, 0.05) !important;
}
`,(document.head||document.documentElement).appendChild(e)}function fe(e){let t=e.match(/[\u{1F1E6}-\u{1F1FF}]{2}/gu)??[];return M?new Set(t).size:t.length}function W(e){let t=e.querySelector(`[data-testid="User-Name"]`)??e.querySelector(`[data-testid="UserName"]`);if(!t)return{userName:null,displayName:``};let n=null,r=``;for(let e of Array.from(t.querySelectorAll(`a[href]`))){let t=(e.getAttribute(`href`)??``).match(/^\/([A-Za-z0-9_]{1,50})$/);if(!t)continue;n||=t[1];let i=e.textContent?.trim()??``;i&&!i.startsWith(`@`)&&!r&&(r=i)}return{userName:n,displayName:r}}function G(e,t,n){return!!(S(`${e} ${t} ${n??``}`)||A&&fe(`${e} ${t} ${n??``}`)>j)}async function K(e){if(k.size===0&&!A||e.hasAttribute(`data-x-loc-highlighted`))return;let{userName:t,displayName:n}=W(e);if(!t)return;let r=await g(t);G(t,n||r?.displayName||``,r?.bio)&&e.setAttribute(`data-x-loc-highlighted`,`1`)}function q(){let e=Array.from(document.querySelectorAll(T));if(k.size===0&&!A){e.forEach(e=>e.removeAttribute(`data-x-loc-highlighted`));return}e.forEach(e=>{e.removeAttribute(`data-x-loc-highlighted`),K(e)})}var J=`data-x-loc-feed-done`;async function Y(e){if(!N||e.getAttribute(J)||e.matches(E))return;let{userName:t}=W(e);if(!t)return;e.setAttribute(J,`1`);let n=await g(t);if(!n||!n.location&&n.locationAccurate&&!n.source)return;let r=e.querySelector(`[data-testid="User-Name"]`)??e.querySelector(`[data-testid="UserName"]`);if(!r||e.querySelector(`.x-loc-feed-row`))return;let i=Z(n);i.classList.add(`x-loc-feed-row`),r.insertAdjacentElement(`afterend`,i)}function X(e,t){if(!N||!t.location&&t.locationAccurate&&!t.source)return;let n=e.toLowerCase();document.querySelectorAll(T).forEach(e=>{if(W(e).userName?.toLowerCase()!==n||e.matches(E))return;let r=e.querySelector(`[data-testid="User-Name"]`)??e.querySelector(`[data-testid="UserName"]`);if(!r||e.querySelector(`.x-loc-feed-row`))return;e.setAttribute(J,`1`);let i=Z(t);i.classList.add(`x-loc-feed-row`),r.insertAdjacentElement(`afterend`,i)})}function pe(){let e=Array.from(document.querySelectorAll(T));if(!N){e.forEach(e=>{e.removeAttribute(J),e.querySelectorAll(`.x-loc-feed-row`).forEach(e=>e.remove())});return}e.forEach(e=>{e.removeAttribute(J),Y(e)})}function me(e){let t=e.querySelector(se)??e.querySelector(ce);if(t){let e=(t.getAttribute(`href`)??``).match(/^\/([A-Za-z0-9_]{1,50})$/);if(e)return e[1]}let n=e.querySelectorAll(`span`);for(let e of Array.from(n)){let t=e.textContent?.trim()??``;if(/^@[A-Za-z0-9_]{1,50}$/.test(t))return t.slice(1)}return null}function he(e,t){let n=document.createElement(`span`);return n.className=`x-loc-icon`,n.textContent=e,n.title=t,n}function Z(e){let t=document.createElement(`div`);t.className=`x-loc-info`;let n=/android\s+app|app\s+store/i.test(e?.source??``)&&e.source?.replace(/\s*(android\s+app|app\s+store)/i,``).trim()||null;if(n){let{emoji:r,isText:i}=P(n),a=document.createElement(`span`);a.className=`x-loc-store-block`,a.title=e.source;let o=document.createElement(`span`);o.textContent=`📱`;let s=document.createElement(`span`);s.className=`x-loc-icon-flag ${i?`x-loc-icon-abbr`:``}`,s.textContent=r,a.appendChild(o),a.appendChild(s),t.appendChild(a)}if(e?.location){let{emoji:n,label:r,isText:i}=P(e.location),a=he(n,r);a.classList.add(`x-loc-icon-flag`),i&&a.classList.add(`x-loc-icon-abbr`),t.appendChild(a)}if(e?.locationAccurate===!1){let e=document.createElement(`span`);e.className=`x-loc-icon-vpn`,e.title=`VPN used, location can be inaccurate`,e.textContent=`⚠ VPN`,t.appendChild(e)}return t}function Q(){let e=document.createElement(`div`);e.className=`x-loc-info`;let t=document.createElement(`span`);t.className=`x-loc-icon-ratelimit`,t.title=`X API rate limit reached — location lookups paused until reset`,t.textContent=`⏱ ${V(R-Date.now())}`,e.appendChild(t);let n=setInterval(()=>{let e=R-Date.now();if(e<=0||!t.isConnected){clearInterval(n);return}t.textContent=`⏱ ${V(e)}`},1e3);return e}function $(e,t,n){let r=Array.from(e.querySelectorAll(`span`)).find(e=>e.textContent?.trim().toLowerCase()===`@${t.toLowerCase()}`);if(r){let t=r;for(;t&&t!==e;){let r=t.parentElement;if(!r||r===e)break;if(r.children.length>=3){r.insertBefore(n,t.nextSibling);return}t=r}}(e.querySelector(`div > div > div`)??e).appendChild(n)}async function ge(e){if(e.getAttribute(`data-x-loc-done`))return;let t=me(e);if(!t)return;e.setAttribute(`data-x-loc-done`,`1`);let n=await U(t);if(n===null&&R>Date.now()){$(e,t,Q());return}!n||!n.location&&n.locationAccurate&&!n.source||($(e,t,Z(n)),X(t,n))}async function _e(){if(!/\/status\/\d+/.test(location.pathname))return;let e=document.querySelector(E);if(!e||e.getAttribute(D))return;let t=e.querySelector(`[data-testid="User-Name"]`)??e.querySelector(`[data-testid="UserName"]`);if(!t)return;let n=t.querySelector(`a[href]`);if(!n)return;let r=(n.getAttribute(`href`)??``).match(/^\/([A-Za-z0-9_]{1,50})$/);if(!r)return;let i=r[1];e.setAttribute(D,`1`);let a=await U(i),o=null;if(a===null&&R>Date.now()?o=Q():a&&(a.location||!a.locationAccurate||a.source)&&(o=Z(a)),!o)return;let s=t.children[1];s?.nextElementSibling?.classList.contains(`x-loc-info`)||(o.style.marginTop=`2px`,s?s.insertAdjacentElement(`afterend`,o):t.appendChild(o))}function ve(){new MutationObserver(e=>{let t=new Set;function n(e){t.has(e)||(t.add(e),ge(e))}let r=e.flatMap(e=>Array.from(e.addedNodes)).filter(e=>e instanceof Element);for(let e of r)e.matches(T)?(K(e),Y(e)):e.querySelectorAll(T).forEach(e=>{K(e),Y(e)});for(let e of r){let t=e.closest(w)??e.querySelector(w);if(t){n(t);break}if(e.matches(T)||e.querySelector(T)){_e();break}}}).observe(document.body,{childList:!0,subtree:!0})}window.addEventListener(`x-loc-headers-captured`,e=>{let t=e.detail?.headers;t?.authorization&&(F=t)}),window.addEventListener(`x-loc-users-data`,e=>{let t=e.detail?.users;if(t)for(let{userName:e,displayName:n,bio:r}of t){let t={bio:r??null};if(n&&(t.displayName=n),_(e,t),G(e,n??``,r)){let t=e.toLowerCase();document.querySelectorAll(T).forEach(e=>{(W(e).userName??``)?.toLowerCase()===t&&e.setAttribute(`data-x-loc-highlighted`,`1`)})}}}),de(),ve(),re(),window.dispatchEvent(new CustomEvent(`x-loc-request-headers`));