/** Massimo e minimo di elenchi anche molto lunghi (Math.max(...a) va in errore oltre ~100.000 valori). */
export function massimo(a: ArrayLike<number>): number { let m = -Infinity; for (let i = 0; i < a.length; i++) if (a[i]! > m) m = a[i]!; return m; }
export function minimo(a: ArrayLike<number>): number { let m = Infinity; for (let i = 0; i < a.length; i++) if (a[i]! < m) m = a[i]!; return m; }
