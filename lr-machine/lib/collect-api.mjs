import { readdir, readFile } from "node:fs/promises";
import { relative, resolve } from "node:path";

import ts from "typescript";

function hasExportModifier(node) {
  return Boolean(
    node.modifiers?.some(
      (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
    ),
  );
}

function declarationKind(node) {
  if (ts.isFunctionDeclaration(node)) return "function";
  if (ts.isClassDeclaration(node)) return "class";
  if (ts.isInterfaceDeclaration(node)) return "interface";
  if (ts.isTypeAliasDeclaration(node)) return "type";
  if (ts.isEnumDeclaration(node)) return "enum";
  if (ts.isVariableStatement(node)) return "constant";
  if (ts.isExportDeclaration(node)) return "re-export";
  return "export";
}

function declarationNames(node) {
  if (ts.isVariableStatement(node)) {
    return node.declarationList.declarations
      .map((declaration) =>
        ts.isIdentifier(declaration.name) ? declaration.name.text : null,
      )
      .filter(Boolean);
  }

  if (ts.isExportDeclaration(node)) {
    if (!node.exportClause) return ["*"];
    if (ts.isNamedExports(node.exportClause)) {
      return node.exportClause.elements.map((element) => element.name.text);
    }
    return [node.exportClause.name.text];
  }

  return node.name && ts.isIdentifier(node.name) ? [node.name.text] : [];
}

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true }).catch(
    () => [],
  );
  const files = [];

  for (const entry of entries) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(path)));
    if (
      entry.isFile() &&
      entry.name.endsWith(".ts") &&
      !entry.name.endsWith(".d.ts")
    ) {
      files.push(path);
    }
  }

  return files;
}

export async function collectApiExports(projectRoot) {
  const sourceRoot = resolve(projectRoot, "src");
  const files = await walk(sourceRoot);
  const exports = [];

  for (const file of files) {
    const sourceText = await readFile(file, "utf8");
    const sourceFile = ts.createSourceFile(
      file,
      sourceText,
      ts.ScriptTarget.Latest,
      true,
    );

    for (const statement of sourceFile.statements) {
      if (!hasExportModifier(statement) && !ts.isExportDeclaration(statement))
        continue;
      const line =
        sourceFile.getLineAndCharacterOfPosition(statement.getStart(sourceFile))
          .line + 1;
      const signature = statement
        .getText(sourceFile)
        .replace(/\s+/g, " ")
        .slice(0, 220);

      for (const name of declarationNames(statement)) {
        exports.push({
          name,
          kind: declarationKind(statement),
          path: relative(projectRoot, file).split("\\").join("/"),
          line,
          signature,
        });
      }
    }
  }

  return exports.sort(
    (left, right) =>
      left.path.localeCompare(right.path) || left.line - right.line,
  );
}
