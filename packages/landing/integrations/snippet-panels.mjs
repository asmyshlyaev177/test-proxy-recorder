/**
 * The homepage draws its snippets as terminal panels, dark in both page themes
 * like the hero's (global.css: "Terminal panels stay cobalt-dark"). Only
 * HomePage.astro renders `src/snippets/`, so marking those groups
 * `data-theme="dark"` selects EC's dark theme for them and nothing else; EC's
 * stylesheet already scopes a theme to `.expressive-code[data-theme]`.
 */
const SNIPPETS_DIR = /[\\/]src[\\/]snippets[\\/]/;

export const darkSnippetPanels = {
  name: 'dark-snippet-panels',
  hooks: {
    postprocessRenderedBlockGroup: ({ renderedGroupContents, renderData }) => {
      const source = renderedGroupContents[0]?.codeBlock.parentDocument?.sourceFilePath ?? '';
      if (SNIPPETS_DIR.test(source)) renderData.groupAst.properties.dataTheme = 'dark';
    },
  },
};
