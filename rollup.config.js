import commonjs from "@rollup/plugin-commonjs";
import json from "@rollup/plugin-json";
import { nodeResolve } from "@rollup/plugin-node-resolve";

const config = {
  input: "src/index.js",
  output: {
    file: "dist/index.js",
    format: "es",
    sourcemap: true,
    inlineDynamicImports: true, // Inline dynamic imports into a single bundle
  },
  plugins: [
    json(), // Add JSON plugin first to handle JSON imports
    nodeResolve({ 
      preferBuiltins: true,
      exportConditions: ['node', 'default']
    }),
    commonjs({
      transformMixedEsModules: true,
    }),
  ],
  external: [], // release-it and its dependencies will be bundled
};

export default config;