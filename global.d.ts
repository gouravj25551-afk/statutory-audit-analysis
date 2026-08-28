// pdfjs-dist ships ESM builds without bundled type declarations for the
// subpath we import. We only use it through a dynamically-typed `any`, so a
// minimal ambient declaration is sufficient.
declare module "pdfjs-dist/build/pdf.mjs";
