# Third-party notices

Original Explainer HTML code: [MIT](LICENSE), copyright 2026 Napat.

| Component | Version / source | License |
| --- | --- | --- |
| Archify | 3.0.1, commit 2ab3cae7ac2c2a55d7386ca789d03c4fcd31816c, [upstream](https://github.com/tt-a1i/archify) | [MIT](vendor/archify/LICENSE) |
| yaml | 2.9.1, bundled | [ISC](vendor/licenses/yaml.txt) |
| marked | 18.0.14, bundled | [MIT](vendor/licenses/marked.txt) |
| parse5 | 8.0.1, bundled | [MIT](vendor/licenses/parse5.txt) |
| entities | Transitive parse5 dependency pinned in package-lock.json | [BSD-2-Clause](vendor/licenses/entities.txt) |

Archify files are unmodified. The adapter extracts SVG and applies original namespace/page/interaction logic. No Dagre runtime or answer-me-with-html code, styles, templates, assets or tests are included.

esbuild and Playwright are development tools, not runtime requirements. Generated HTML contains page runtime and rendered SVG, not npm packages or browser binaries.
