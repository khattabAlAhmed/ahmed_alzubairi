// Vitest imports files with `?raw` as text. Tests use it to read the docs.
declare module "*.md?raw" {
  const content: string;
  export default content;
}
