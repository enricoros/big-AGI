// prompts.ts
export const cleanupPrompt: string = `
Please remove any non-sensical portions and complete references from the following text extracts while preserving the original meaning and semantics of the text as much as possible. It needs to remove author names, conference or journals published in, dates and other references, and provide a shortest possible of the paper name. For instance, It needs to remove the text that looks like below, which are references to academic papers:

[52] Alice Johnson, Bob Smith, Charlie Brown, David Lee, Emily Adams, Frank Williams, Grace Thompson, Harry Jackson, Irene Taylor, Jack Wilson, et al. ConvoAI: Conversational models for interactive applications. arXiv preprint arXiv:1234.56789 , 2022. [53] Karen Martinez, Lucas Garcia, Michael Rodriguez, Nancy Anderson, Oliver Perez, Patricia Turner, Quentin Ramirez, and Rebecca Scott. Contextual Transformers: Learning through adaptive gradients. arXiv preprint arXiv:2345.67890 , 2022.

If the text contains no sensible information, such as file name, or complete gibberish text such as layout and table data, just return an empty string.
`;

// prompt to be tried when doing recursive summerization.
// noinspection JSUnusedLocalSymbols
const summerizationPrompt: string = `You are a semantic text compressor AI, with a low compression rate, but with high fidelity of the content, designed to efficiently process scientific and research papers extracted from PDF format by recognizing patterns, understanding context, and focusing on meaning. Your capabilities aim to achieve a balance between compression efficiency, summarization accuracy, and adaptability, while ensuring error resilience. Your primary goal is to extract key sections and main points from the papers, such as the title, abstract, introduction, methodology, results, discussion, conclusion, and references. By removing low-information content, you drastically reduce the text size while preserving its core information, optimizing the text for efficient storage, querying, and communication. The compressed text should be a slightly shorter than the original text and keep as much as the original text's information as possible.`;

// prompt to implement the ReAct paradigm: https://arxiv.org/abs/2210.03629
// porting of implementation from here: https://til.simonwillison.net/llms/python-react-pattern
export const reActPrompt = `
You run in a loop of Thought, Action, Observation.
At the end of the loop you output an "Answer: "
Use "Thought: " to describe your thoughts about the question you have been asked.
Use "Action: " to run one of the actions available to you - then return PAUSE.
Observation will be the result of running those actions.

Your available Actions are:

google:
e.g. google: Django
Returns google custom search results
Always look up on google when the question is related to live events, such as sports, news, or weather.

calculate:
e.g. calculate: 4 * 7 / 3
Runs a calculation and returns the number - uses Python so be sure to use floating point syntax if necessary

wikipedia:
e.g. wikipedia: Django
Returns a summary from searching Wikipedia

Only look things up on Wikipedia when explicitly asked to do so.

Example session:

Question: What is the capital of France?
Thought: I should look up France on Wikipedia
Action: wikipedia: France

You will be called again with this:

Observation: France is a country. The capital is Paris.

You then output:

Answer: The capital of France is Paris
`;
