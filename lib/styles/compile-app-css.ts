import { readFile } from 'node:fs/promises';
import path from 'node:path';
import postcss from 'postcss';
import tailwindcss from '@tailwindcss/postcss';

export async function compileAppCss(
  cssFilePath: string = path.join(process.cwd(), 'app', 'globals.css'),
): Promise<string> {
  const source = await readFile(cssFilePath, 'utf8');
  const result = await postcss([tailwindcss()]).process(source, {
    from: cssFilePath,
  });
  return result.css;
}
