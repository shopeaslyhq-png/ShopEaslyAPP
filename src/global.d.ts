// Allow importing .jsx and .js files as modules in TypeScript
declare module "*.jsx" {
  const value: any;
  export default value;
}
declare module "*.js" {
  const value: any;
  export default value;
}