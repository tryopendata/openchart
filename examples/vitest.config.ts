import ts from 'typescript';
import { defineConfig } from 'vitest/config';

/** House-style contracts and parity checks over the authored example specs. */
export default defineConfig({
  plugins: [{
    name: 'collect-example-specs',
    enforce: 'pre',
    transform(source, id) {
      if (!/\.(stories|layouts)\.tsx$/.test(id)) return;
      const ast = ts.createSourceFile(id, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
      const names: string[] = [];
      for (const statement of ast.statements) {
        if (!ts.isVariableStatement(statement)) continue;
        for (const declaration of statement.declarationList.declarations) {
          if (ts.isIdentifier(declaration.name)) names.push(declaration.name.text);
        }
      }
      // Test-only export: exercises the real example objects without copying
      // hundreds of fixtures or changing the stories' production exports.
      return `${source}\nexport const __authoredValues = { ${names.join(',')} };`;
    },
  }],
  test: {
    name: 'examples',
    environment: 'happy-dom',
    include: ['src/**/*.test.ts', '.ladle/**/*.test.ts'],
  },
});
