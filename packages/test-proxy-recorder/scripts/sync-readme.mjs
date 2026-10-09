// Copies the repo README into the package for `npm pack`. npm and agents
// reading node_modules see it without the repo, so relative links are made
// absolute: images to raw files, everything else to the GitHub page.
import { readFileSync, writeFileSync } from 'node:fs';

const REPO_URL = 'https://github.com/asmyshlyaev177/test-proxy-recorder';
const BRANCH = 'master';
const RELATIVE = /^(?!https?:|mailto:|#)(?:\.\/)?(.+)$/;

function toAbsolute(target, kind) {
  const match = RELATIVE.exec(target);
  if (!match) return target;
  return `${REPO_URL}/${kind}/${BRANCH}/${match[1]}`;
}

const source = readFileSync(new URL('../../../README.md', import.meta.url), 'utf8');
const readme = source
  .replaceAll(
    /(!?)\[([^\]]*)\]\(([^)\s]+)\)/g,
    (_, bang, text, target) =>
      `${bang}[${text}](${toAbsolute(target, bang ? 'raw' : 'blob')})`,
  )
  .replaceAll(/src="([^"]+)"/g, (_, target) => `src="${toAbsolute(target, 'raw')}"`);

writeFileSync(new URL('../README.md', import.meta.url), readme);
