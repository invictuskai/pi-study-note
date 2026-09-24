import type { Root } from 'mdast';
import { visit } from 'unist-util-visit';
import { withBase } from './paths.ts';

/** Rewrite Markdown links/images, not code examples or external URLs. */
export default function remarkBasePath(options: { base: string }) {
  return (tree: Root) => {
    visit(tree, (node) => {
      if (node.type === 'link' || node.type === 'image' || node.type === 'definition') {
        node.url = withBase(node.url, options.base);
      }
    });
  };
}
