// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface SkimApi {}

declare global {
  interface Window {
    skim: SkimApi
  }
}
