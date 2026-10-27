// @mixmark-io/domino ships typings declared under its upstream name 'domino'; expose them under the package name
declare module '@mixmark-io/domino' {
  export function createDocument(html?: string, force?: boolean): Document;
}
