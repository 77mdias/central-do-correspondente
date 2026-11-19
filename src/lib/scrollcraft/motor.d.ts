// Motor do scroll-craft (scrollcraft.js e .css copiados sem alteração da skill nateherk-design/scroll-craft 0.3.1).
// O JS registra window.ScrollCraft; o CSS entra como texto (?inline) só enquanto a landing está montada.

interface Window {
  ScrollCraft: { mount(root?: Element | null): { destroy(): void } };
}

declare module "*.css?inline" {
  const css: string;
  export default css;
}
