// Reads the committed OpenAPI documents (the output of `pnpm contracts:generate`).
import { PROBLEM_CODES_EXTENSION } from '../routes/operation';
import { SURFACE_NAMES, type SurfaceName } from '../surfaces';
import { readRepoFile } from './sources';

const METHODS = ['get', 'put', 'post', 'delete', 'patch', 'head', 'options'] as const;

export interface OpenApiResponse {
  content?: Record<string, { schema?: { $ref?: string } }>;
  [key: string]: unknown;
}
export interface OpenApiOperation {
  security?: unknown;
  responses?: Record<string, OpenApiResponse>;
  [key: string]: unknown;
}

/** Every operation of the three surface documents, as "GET /path". */
export const openApiOperations = (): {
  surface: SurfaceName;
  id: string;
  operation: OpenApiOperation;
}[] =>
  SURFACE_NAMES.flatMap((surface) => {
    const doc = JSON.parse(readRepoFile(`packages/contracts/openapi/${surface}.json`)) as {
      paths: Record<string, Partial<Record<(typeof METHODS)[number], OpenApiOperation>>>;
    };
    return Object.entries(doc.paths).flatMap(([path, item]) =>
      METHODS.flatMap((method) => {
        const operation = item[method];
        return operation ? [{ surface, id: `${method.toUpperCase()} ${path}`, operation }] : [];
      }),
    );
  });

/** The registry codes declared by any operation's error responses. */
export const declaredProblemCodes = (): Set<string> =>
  new Set(
    openApiOperations().flatMap(({ operation }) =>
      Object.values(operation.responses ?? {}).flatMap(
        (response) => (response[PROBLEM_CODES_EXTENSION] as string[] | undefined) ?? [],
      ),
    ),
  );
