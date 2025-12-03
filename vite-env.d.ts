// Custom type definitions for Vite environment

declare module '*.svg' {
  const content: string;
  export default content;
}

declare module '*.png' {
  const content: string;
  export default content;
}

declare module '*.jpg' {
  const content: string;
  export default content;
}

declare module '*.jpeg' {
  const content: string;
  export default content;
}

declare module '*.gif' {
  const content: string;
  export default content;
}

declare module '*.webp' {
  const content: string;
  export default content;
}

interface ImportMetaEnv {
  [key: string]: any;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare const process: {
  env: {
    [key: string]: string | undefined;
  }
};
