import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import ts from 'typescript';

const root = process.cwd();
const roots = ['app', 'components'];
const ignoredDirectories = new Set(['node_modules', '.next', '.git']);
const files = [];

function collect(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      const childPath = join(directory, entry.name);
      if (childPath === join(root, 'components', 'ui')) continue;
      if (!ignoredDirectories.has(entry.name)) collect(childPath);
      continue;
    }
    if (entry.isFile() && entry.name.endsWith('.tsx'))
      files.push(join(directory, entry.name));
  }
}

for (const directory of roots) collect(join(root, directory));

function hasAttribute(opening, names) {
  return opening.attributes.properties.some(
    (attribute) =>
      ts.isJsxAttribute(attribute) && names.includes(attribute.name.getText()),
  );
}

function expressionHasName(expression) {
  if (!expression) return false;
  if (ts.isParenthesizedExpression(expression))
    return expressionHasName(expression.expression);
  if (
    ts.isStringLiteral(expression) ||
    ts.isNoSubstitutionTemplateLiteral(expression) ||
    ts.isNumericLiteral(expression)
  )
    return true;
  if (ts.isCallExpression(expression)) return true;
  if (ts.isJsxElement(expression) || ts.isJsxFragment(expression))
    return expression.children.some(jsxHasName);
  if (
    ts.isPropertyAccessExpression(expression) ||
    ts.isElementAccessExpression(expression) ||
    ts.isIdentifier(expression)
  )
    return true;
  if (ts.isConditionalExpression(expression)) {
    return (
      expressionHasName(expression.whenTrue) &&
      expressionHasName(expression.whenFalse)
    );
  }
  if (
    ts.isBinaryExpression(expression) &&
    expression.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken
  ) {
    return (
      expressionHasName(expression.left) && expressionHasName(expression.right)
    );
  }
  return false;
}

function jsxHasName(node) {
  if (ts.isJsxText(node)) return node.getText().trim().length > 0;
  if (ts.isJsxExpression(node)) return expressionHasName(node.expression);
  if (ts.isJsxElement(node)) {
    return node.children.some(jsxHasName);
  }
  if (ts.isJsxFragment(node)) return node.children.some(jsxHasName);
  if (ts.isJsxSelfClosingElement(node)) return false;
  return false;
}

const violations = [];
for (const file of files) {
  const sourceText = readFileSync(file, 'utf8');
  const source = ts.createSourceFile(
    file,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  function visit(node) {
    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
      const opening = ts.isJsxElement(node) ? node.openingElement : node;
      const tag = opening.tagName.getText(source);
      if (tag === 'button' || tag === 'Button') {
        const hasExplicitName = hasAttribute(opening, [
          'aria-label',
          'aria-labelledby',
          'title',
        ]);
        const hasTextName =
          ts.isJsxElement(node) && node.children.some(jsxHasName);
        if (!hasExplicitName && !hasTextName) {
          const { line } = source.getLineAndCharacterOfPosition(
            opening.getStart(source),
          );
          violations.push(
            relative(root, file) +
              ':' +
              (line + 1) +
              ' <' +
              tag +
              '> has no accessible name',
          );
        }
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
}

if (violations.length) {
  console.error('Button accessibility audit failed:');
  for (const violation of violations) console.error('- ' + violation);
  console.error(
    'Add visible text, aria-label, aria-labelledby, or a meaningful title.',
  );
  process.exitCode = 1;
} else {
  console.log(
    'Button accessibility audit passed for ' + files.length + ' TSX modules.',
  );
}
