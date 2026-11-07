// occt-import-js non fornisce tipi: l'interfaccia usata è descritta in src/lib/leggiStep.ts.
declare module "occt-import-js" {
  const fabbrica: (opzioni: { locateFile: (file: string) => string }) => Promise<unknown>;
  export default fabbrica;
}
