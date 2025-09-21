declare module './EaslyAIEventFeed' { const value: any; export default value; }
declare module './EaslyOfflineAI' { const value: any; export default value; }
declare module './firebase' { const value: any; export default value; }
declare module './ProductDescriptionGenerator' { const value: any; export default value; }
// Allow importing .jsx and .js files as modules in TypeScript
declare module "*.jsx" {
  const value: any;
  export default value;
}
declare module "*.js" {
  const value: any;
  export default value;
}