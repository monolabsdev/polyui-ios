declare module '*.css' {
  const value: string;
  export default value;
}

declare module '*.module.css' {
  const classes: Record<string, string>;
  export default classes;
}
