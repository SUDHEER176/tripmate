// Node module hook: Deno-style `npm:pkg@version/path` imports resolve to the
// package installed in backend/node_modules (the version comes from package.json).

const NPM_SPECIFIER = /^npm:(@[^/]+\/[^@/]+|[^@/]+)(?:@[^/]+)?(\/.*)?$/;

export async function resolve(specifier, context, nextResolve) {
  const match = NPM_SPECIFIER.exec(specifier);
  if (match) return nextResolve(match[1] + (match[2] ?? ""), context);
  return nextResolve(specifier, context);
}
