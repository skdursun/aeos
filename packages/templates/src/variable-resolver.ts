export type TemplateVariableMap = Readonly<Record<string, string>>;

export interface VariableResolveResult {
  readonly ok: boolean;
  readonly content: string;
  readonly missingVariables: readonly string[];
}

const templateVariablePattern = /\{\{([A-Za-z_][A-Za-z0-9_]*)\}\}/g;

export function resolveTemplateVariables(
  content: string,
  variables: TemplateVariableMap,
): VariableResolveResult {
  const missingVariables: string[] = [];
  const seenMissingVariables = new Set<string>();

  const resolvedContent = content.replace(
    templateVariablePattern,
    (token: string, variableName: string): string => {
      if (hasVariable(variables, variableName)) {
        return variables[variableName];
      }

      if (!seenMissingVariables.has(variableName)) {
        seenMissingVariables.add(variableName);
        missingVariables.push(variableName);
      }

      return token;
    },
  );

  return {
    ok: missingVariables.length === 0,
    content: resolvedContent,
    missingVariables,
  };
}

export function findMissingVariables(
  content: string,
  variables: TemplateVariableMap,
): readonly string[] {
  return resolveTemplateVariables(content, variables).missingVariables;
}

function hasVariable(
  variables: TemplateVariableMap,
  variableName: string,
): boolean {
  return Object.prototype.hasOwnProperty.call(variables, variableName);
}
