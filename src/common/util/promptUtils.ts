export function processPromptTemplate(template: string, variables: { [key: string]: string }, templateName: string) {

  // Replace the variables in the template
  const missingVariables = new Set<string>();
  const replacedTemplate = template.replace(/{{(\w+)}}/g, (_, key) => {
    if (!variables[key]) missingVariables.add(key);
    return variables[key] || '';
  });

  // [DEV] Warn for every variable that is not replaced
  if (process.env.NODE_ENV === 'development' && missingVariables.size > 0)
    console.warn('[DEV] Missing variables:', missingVariables, 'in template:', templateName);

  return replacedTemplate;
}
