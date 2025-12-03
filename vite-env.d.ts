export {};

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      PUBLIC_APP_URL?: string;
      [key: string]: string | undefined;
    }
  }
}
