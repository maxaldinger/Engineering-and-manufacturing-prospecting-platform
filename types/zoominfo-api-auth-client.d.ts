// Ambient type declaration for ZoomInfo's official auth client.
// The published package (v1.0.1) ships no type definitions, so we declare
// the two functions we use. Signatures verified against the package source.
// https://www.npmjs.com/package/zoominfo-api-auth-client
declare module "zoominfo-api-auth-client" {
  /** PKI auth (recommended). Returns a JWT valid ~60 minutes. */
  export function getAccessTokenViaPKI(
    username: string,
    clientId: string,
    privateKey: string
  ): Promise<string>;

  /** Username/password auth. Returns a JWT valid ~60 minutes. */
  export function getAccessTokenViaBasicAuth(
    username: string,
    password: string
  ): Promise<string>;
}
