# Spec: Frontmatter Handling

## Job to Be Done
User's YAML frontmatter is preserved exactly when editing markdown, without appearing in the rendered view.

## Requirements
- Parse YAML frontmatter via gray-matter on file open (F-45)
- Frontmatter stripped before loading content into Tiptap editor
- Frontmatter prepended back on save (before markdown body)
- Frontmatter hidden from WYSIWYG preview (F-46)
- Frontmatter visible as raw YAML in CodeMirror source editor
- Exact preservation: byte-for-byte identical frontmatter output on save (no reformatting)
- Handle edge cases: no frontmatter, empty frontmatter, complex YAML (nested objects, arrays)

## Performance Logging
- `frontmatter:parse` — time to parse frontmatter via gray-matter
- `frontmatter:recombine` — time to prepend frontmatter on save

## Acceptance Criteria
- [ ] File with frontmatter opens — frontmatter not shown in WYSIWYG
- [ ] File with frontmatter opens — frontmatter shown in source mode
- [ ] Edit body, save — frontmatter byte-for-byte identical in saved file
- [ ] File without frontmatter — editor works normally, no errors
- [ ] File with empty frontmatter (`---\n---`) — preserved on save
- [ ] File with complex YAML (nested objects, arrays, multiline strings) — preserved
- [ ] Frontmatter parsing completes within 10ms for typical files

## Test Cases
| Input | Expected Output |
|-------|-----------------|
| `---\ntitle: Hello\n---\n# Body` | WYSIWYG shows "Body" heading only |
| Edit body, save | File starts with `---\ntitle: Hello\n---\n` |
| No frontmatter | Editor loads normally, save has no `---` prefix |
| `---\n---\n# Body` (empty FM) | Empty frontmatter preserved on save |
| Complex YAML with arrays | Arrays preserved exactly |
| Frontmatter with special chars | No encoding changes on save |

## Technical Notes
- gray-matter returns `{ data, content, matter, orig }` — use `matter` (raw string) for exact preservation
- Store raw frontmatter string separately from parsed data
- On save: `rawFrontmatter + '\n' + serializedMarkdown`
- Do NOT re-serialize YAML from parsed object — this would reformat it

## Revision History
- 2026-03-05: Initial spec from PRD
- 2026-03-05: Implementation uses custom lightweight parser instead of gray-matter. gray-matter depends on Node.js builtins (fs, Buffer) and adds ~15KB+ gzipped to bundle. Custom parser achieves byte-for-byte preservation with 0 dependencies by splitting on `---` delimiters and storing raw frontmatter block as-is.
