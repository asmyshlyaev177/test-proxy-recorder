import { docsLoader } from '@astrojs/starlight/loaders';
import { docsSchema } from '@astrojs/starlight/schema';
import { defineCollection, z } from 'astro:content';

export const collections = {
  docs: defineCollection({
    loader: docsLoader(),
    schema: docsSchema({
      // Two fields that only translated pages carry, recording which revision
      // of the English page this one was translated from. `pnpm i18n:docs`
      // reads them to report what has drifted — without them a translation can
      // sit a whole feature behind its source with nothing to say so, which is
      // how the first five languages here were left in exactly that state.
      //
      // Declared rather than merely tolerated: an undeclared key is stripped
      // by the schema, so nothing could read it back.
      extend: z.object({
        /** Collection id of the English page, e.g. `docs/guides/cli`. */
        i18nSource: z.string().optional(),
        /** `git hash-object` of that page's file when this was translated. */
        i18nSourceBlob: z.string().optional(),
      }),
    }),
  }),
};
