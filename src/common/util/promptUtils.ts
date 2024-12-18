/**
 * This function performs expansion of variables and evaluates ternary expressions.
 * Recursion occurs only within the trueBranch and falseBranch of ternary expressions.
 *
 * Simple variable replacement:
 * - {{varName}} -> replaced with variables[varName]
 *
 * Ternary expressions:
 * - {{varCondition ? 'true string' : 'false string'}} -> if variables[varCondition] is truthy, replace with 'true string', else replace with 'false string'
 *
 * Combined Ternary:
 * - {{varCondition ? 'string with {{innerVar}}' : 'string with {{anotherVar}}'}} -- this should work really well, but it's only been used once
 *
 */
export function processPromptTemplate(
  template: string,
  variables: Record<string, string | boolean>,
  templateName: string
): string {

  // match ternary expressions and simple variables
  const regex = /{{\s*(\w+)\s*\?\s*'(.*?)'\s*:\s*'(.*?)'\s*}}|{{\s*(\w+)\s*}}/g;

  // keep track of missing variables
  const missingVariables = new Set<string>();

  // Replace variables and evaluate ternary expressions
  const replacedStr = template.replace(
    regex,
    (match, key1, trueValue, falseValue, key2) => {
      const key = key1 || key2; // key can be in either group
      const value = variables[key];

      // Variable is missing
      if (value === undefined) {
        missingVariables.add(key);
        return '';
      }

      // Ternary conditional
      if (trueValue !== undefined && falseValue !== undefined) {
        const branch = value ? trueValue as string : falseValue as string;

        // Replace variables within the selected branch
        return branch.replace(/{{\s*(\w+)\s*}}/g, (m, varName) => {
          const varValue = variables[varName];
          if (varValue === undefined || typeof varValue !== 'string') {
            missingVariables.add(varName);
            return '';
          }
          return varValue;
        });
      } else {
        // Simple variable replacement
        if (typeof value !== 'string') {
          missingVariables.add(key);
          return '';
        }
        return value;
      }
    }
  );

  // [DEV] Warn for every variable that is not replaced
  if (process.env.NODE_ENV === 'development' && missingVariables.size > 0)
    console.warn(`[DEV] Missing variables in template "${templateName}" (or wrong types):`, Array.from(missingVariables));

  return replacedStr;
}
