/**
 * ProseMirror plugin that applies Prism.js syntax highlighting
 * as decorations on code_block nodes in Tiptap.
 */
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { EditorView } from '@tiptap/pm/view';
import { Node as ProsemirrorNode } from '@tiptap/pm/model';
import { getPrism, loadPrism } from './highlight-service';

export const prismPluginKey = new PluginKey('prismHighlight');

type PrismToken = { type: string; content: string | PrismToken[] | PrismToken; length: number };

/** Flatten Prism tokens into [className, start, end] triples */
function flattenTokens(
  tokens: (string | PrismToken)[],
  offset: number,
  result: [string, number, number][],
): void {
  for (const token of tokens) {
    if (typeof token === 'string') {
      offset += token.length;
    } else {
      const className = `token ${token.type}`;
      const tokenLen = token.length;
      if (typeof token.content === 'string') {
        result.push([className, offset, offset + token.content.length]);
        offset += token.content.length;
      } else if (Array.isArray(token.content)) {
        result.push([className, offset, offset + tokenLen]);
        flattenTokens(token.content, offset, result);
        offset += tokenLen;
      } else {
        result.push([className, offset, offset + tokenLen]);
        flattenTokens([token.content], offset, result);
        offset += tokenLen;
      }
    }
  }
}

function getDecorations(doc: ProsemirrorNode): DecorationSet {
  const Prism = getPrism();
  const decorations: Decoration[] = [];

  doc.descendants((node, pos) => {
    if (node.type.name !== 'codeBlock') return false;

    const language = node.attrs.language;
    if (!language) return false;

    // Add language label decoration on the node (works even before Prism loads)
    decorations.push(
      Decoration.node(pos, pos + node.nodeSize, {
        'data-language': language,
      }),
    );

    // Syntax highlighting requires Prism to be loaded
    if (!Prism) return false;

    const grammar = Prism.languages[language];
    if (!grammar) return false;

    const code = node.textContent;
    if (!code) return false;

    const tokens = Prism.tokenize(code, grammar);
    const flat: [string, number, number][] = [];
    flattenTokens(tokens as (string | PrismToken)[], 0, flat);

    // pos + 1 is the start of the text content inside the code_block node
    const blockStart = pos + 1;

    for (const [className, from, to] of flat) {
      if (from === to) continue;
      decorations.push(
        Decoration.inline(blockStart + from, blockStart + to, {
          class: className,
        }),
      );
    }

    return false;
  });

  return DecorationSet.create(doc, decorations);
}

/**
 * Creates a ProseMirror plugin that applies Prism syntax highlighting
 * as inline decorations on codeBlock nodes.
 */
export function createPrismPlugin(): Plugin {
  let editorView: EditorView | null = null;

  const plugin: Plugin = new Plugin({
    key: prismPluginKey,
    state: {
      init(_, { doc }) {
        return getDecorations(doc);
      },
      apply(tr, old) {
        if (!tr.docChanged) return old;
        return getDecorations(tr.doc);
      },
    },
    props: {
      decorations(state): DecorationSet | undefined {
        return prismPluginKey.getState(state) as DecorationSet | undefined;
      },
    },
    view(view) {
      editorView = view;

      // If Prism isn't loaded yet, load it and then trigger re-decoration
      if (!getPrism()) {
        loadPrism().then(() => {
          if (editorView) {
            editorView.dispatch(editorView.state.tr);
          }
        });
      }

      return {
        update(view) {
          editorView = view;
        },
        destroy() {
          editorView = null;
        },
      };
    },
  });

  return plugin;
}
