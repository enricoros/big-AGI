import { z } from 'zod';


// Export types
export type IntakeToolDefinition = z.infer<typeof intakeToolDefinitionSchema>;
export type IntakeToolsPolicy = z.infer<typeof intakeToolsPolicySchema>;


// Tools > Function Call

/**
 * The zod definition of an "OpenAPI 3.0.3" "Schema Object".
 * https://spec.openapis.org/oas/v3.0.3#schema-object
 *
 * 1. this is an OpenAPI Schema Object, and not a standard JSON Schema, which is
 *    ("application/schema+json", a JSON object that describes the structure of JSON data).
 * 2. this is actually a subset of the OpenAPI Schema Object, as we only need a subset
 *    of the properties for our function calling use case.
 *
 */
const openAPISchemaObjectSchema = z.object({
  // allowed data types - https://ai.google.dev/api/rest/v1beta/cachedContents#Type
  type: z.enum(['string', 'number', 'integer', 'boolean', 'array', 'object']),

  // (recommended) brief description of the parameter - can contain examples - can be markdown
  description: z.string().optional(),

  // the value may be null
  nullable: z.boolean().optional(),

  // [string] possible values
  enum: z.array(z.any()).optional(),

  // [number] float, double - [integer]: int32, int64
  format: z.string().optional(),

  // [object] properties (recursively)
  properties: z.record(z.any() /* could refer to self using z.lazy().... */).optional(),
  // [object] required properties
  required: z.array(z.string()).optional(),

  // [array] schema of the items
  items: z.any().optional(), // could refer to self using z.lazy()....

  // ignore but possibly useful properties..
  // minimum: z.number().optional(),
  // maximum: z.number().optional(),
  // minLength: z.number().int().nonnegative().optional(),
  // maxLength: z.number().int().nonnegative().optional(),
  // pattern: z.string().optional(),
  // default: z.any().optional(),
  // additionalProperties: z.union([z.boolean(), jsonSchema]).optional(),
});

// an object-only subset of the above, which is the JSON object owner of the parameters
const intakeFunctionCallInputSchemaSchema = z.object({
  type: z.literal('object'),
  properties: z.record(openAPISchemaObjectSchema),
  required: z.array(z.string()).optional(),
});

const intakeFunctionCallSchema = z.object({
  /**
   * The name of the function to call. Up to 64 characters long, and can only contain letters, numbers, underscores, and hyphens.
   */
  name: z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/, {
    message: 'Function name must be 1-64 characters long and contain only letters, numbers, underscores, and hyphens',
  }),
  /**
   * 3-4 sentences. Detailed description of what the tool does, when it should be used (and when not), what each parameter means, caveats and limitations.
   * - Good: "Retrieves the current stock price for a given ticker symbol. The ticker symbol must be a valid symbol for a publicly traded company on a major US stock exchange like NYSE or NASDAQ. The tool will return the latest trade price in USD. It should be used when the user asks about the current or most recent price of a specific stock. It will not provide any other information about the stock or company."
   * - Poor: "Gets the stock price for a ticker."
   */
  description: z.string(),
  /**
   *  A JSON Schema object defining the expected parameters for the function call.
   *  (OpenAI,Google: parameters, Anthropic: input_schema)
   */
  input_schema: intakeFunctionCallInputSchemaSchema.optional(),
});

const intakeToolFunctionCallDefinitionSchema = z.object({
  type: z.literal('function_call'),
  function: intakeFunctionCallSchema,
  // domain: z.enum(['server', 'client']).optional(),
});


// Tools - Gemini Code Interpreter

const intakeToolGeminiCodeInterpreterSchema = z.object({
  type: z.literal('gemini_code_interpreter'),
});


// Tools - Preprocessor

/**
 * We only have 1 preprocessor so far, which is the Anthropic Artifacts processor.
 * This tool will inject parts of the system prompt to force the llm to think about the problem
 * and then emit code and other artifacts in special xml blocks which we'll parse to send to
 * the client as special message parts.
 *
 * In the future we can have multiple preprocessors, such as data retrieval and generation (rag), etc.
 */
const intakeToolPreprocessorSchema = z.object({
  type: z.literal('preprocessor'),
  pname: z.literal('anthropic_artifacts'),
});


// Tools Schema

/**
 * Describe 'Tools' available to the model.
 *
 * __Function calls__
 * The model requests for a function to be called and creates a JSON object to fill-in
 * the input parameters, provided a schema
 *
 * __Gemini Code Interpreter__
 * Models of the Gemini family will execute a sandboxed code interpreter on the generated code
 * and then resume execution of the code, inline.
 *
 * __Preprocessor__
 * Preprocessors are tools that modify the input of the model before it is processed.
 *
 * - Right now, we only have the Anthropic Artifacts preprocessor, which injects parts of the
 *   system prompt into the input to force the llm to think about the problem and then emit
 *   code and other artifacts in special xml blocks which we'll parse.
 *
 * @example
 * [
 *  { type: 'function_call', function: { name: 'get_stock_price', description: 'Retrieves the current stock price for a given ticker symbol.', input_schema: { type: 'object', properties: { ticker: { type: 'string', description: 'The ticker symbol of the stock to get the price for.' } } } } },
 *  { type: 'gemini_code_interpreter' },
 *  { type: 'preprocessor', pname: 'anthropic_artifacts' },
 * ]
 */
export const intakeToolDefinitionSchema = z.discriminatedUnion('type', [
  intakeToolFunctionCallDefinitionSchema,
  intakeToolGeminiCodeInterpreterSchema,
  intakeToolPreprocessorSchema,
]);

/**
 * Policy for tools that the model can use:
 * - any: must use one tool at least
 * - auto: can use a tool or not (default, same as not specifying a policy)
 * - function: must use a specific Function Tool
 * - none: same as not giving the model any tool
 */
export const intakeToolsPolicySchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('any') /*, parallel: z.boolean()*/ }),
  z.object({ type: z.literal('auto') }),
  z.object({ type: z.literal('function'), function: z.object({ name: z.string() }) }),
  z.object({ type: z.literal('none') }),
]);
