import type { Corpo, ModelloEdificio, Punto2 } from "./tipi";
export function rettangolo(L: number, W: number, H: number, id: string, x = 0, y = 0): Corpo {
  if (![L, W, H].every((n) => Number.isFinite(n) && n > 0)) throw new Error("Dimensioni maggiori di zero richieste.");
  return { id, nome: "Corpo di fabbrica", impronta: [[x,y],[x+L,y],[x+L,y+W],[x,y+W]], quotaBase: 0, altezzaGronda: H, tipoTetto: "piano", altezzaColmo: H };
}
export function limitiModello(m: ModelloEdificio) {
  const punti = m.corpi.flatMap((c) => c.impronta);
  if (!punti.length) return { minX: 0, minY: 0, maxX: 0, maxY: 0, L: 0, W: 0, H: 0, approssimato: false };
  const minX = Math.min(...punti.map((p) => p[0])), maxX = Math.max(...punti.map((p) => p[0]));
  const minY = Math.min(...punti.map((p) => p[1])), maxY = Math.max(...punti.map((p) => p[1]));
  const H = Math.max(...m.corpi.map((c) => c.quotaBase + Math.max(c.altezzaGronda,c.altezzaColmo)));
  const semplice = m.corpi.length === 1 && punti.length === 4 && punti.every((p) => [minX,maxX].includes(p[0]) && [minY,maxY].includes(p[1]));
  return { minX,minY,maxX,maxY,L:maxX-minX,W:maxY-minY,H,approssimato:!semplice };
}
export function dentroPoligono(x: number, y: number, p: Punto2[]) {
  let dentro = false;
  for (let i=0,j=p.length-1;i<p.length;j=i++) { const a=p[i], b=p[j]; if (!a || !b) continue; if ((a[1]>y)!==(b[1]>y) && x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0]) dentro=!dentro; }
  return dentro;
}
export function locale(lat: number, lon: number, origine: {lat:number;lon:number}): Punto2 {
  return [(lon-origine.lon)*Math.PI/180*6378137*Math.cos(origine.lat*Math.PI/180),(lat-origine.lat)*Math.PI/180*6378137];
}