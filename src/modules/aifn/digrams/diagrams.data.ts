import type { FormRadioOption } from '~/common/components/forms/FormRadioControl';
import type { VChatMessageIn } from '~/modules/llms/llm.client';


export type DiagramType = 'auto' | 'mind';
export type DiagramLanguage = 'mermaid' | 'plantuml';

// NOTE: keep these global, or it will trigger re-renders
export const diagramTypes: FormRadioOption<DiagramType>[] = [
  { label: 'Automatic', value: 'auto' },
  { label: 'Mindmap', value: 'mind' },
];

export const diagramLanguages: FormRadioOption<DiagramLanguage>[] = [
  { label: 'PlantUML', value: 'plantuml' },
  { label: 'Mermaid (mindmaps)', value: 'mermaid' },
];

const mermaidMindmapExample = `For example:
\`\`\`mermaid
mindmap
  root((mindmap))
    Origins
      Long history
      ::icon(fa fa-book)
      Popularisation
        British popular psychology author Tony Buzan
    Research
      On effectiveness<br/>and features
      On Automatic creation
        Uses
            Creative techniques
    Tools
      Pen and paper
      Mermaid
\`\`\`
`;

function plantumlDiagramPrompt(diagramType: DiagramType): { sys: string, usr: string } {
  switch (diagramType) {
    case 'auto':
      return {
        sys: 'Generate a valid PlantUML diagram markdown (```plantuml\\n@startuml\\n...@enduml\\n```), ready for rendering. No external references allowed and all strings must be escaped correctly (each in a single line). Choose the most suitable PlantUML diagram type: sequence, class, use case, activity, component, state, object, deployment, wireframe, mindmap, gantt, or flowchart.',
        usr: 'Generate the PlantUML code for a suitable diagram that best captures the essence of the preceding message.',
      };
    case 'mind':
      return {
        sys: 'Generate a valid PlantUML mindmap markdown (```plantuml\\n@startmindmap\\n...@endmindmap\\n\`\`\`), ready for rendering. No external references allowed. Use one or more asterisks to indent and separate with spaces.',
        usr: 'Generate a PlantUML mindmap that effectively summarizes the key points from the preceding message.',
      };
  }
}

function mermaidDiagramPrompt(diagramType: DiagramType): { sys: string, usr: string } {
  let promptDetails = diagramType === 'auto'
    ? 'Generate a valid Mermaid diagram markdown (```mermaid\\n...```), ready for rendering. The code should have no external references and all names must be in double quotes and properly escaped. Select the most appropriate Mermaid diagram type: flowchart, sequence, class, state, erd, gantt, pie, or git.'
    : 'Generate a valid Mermaid mindmap markdown (```mermaid\\n...```), ready for rendering. The code should have no external references and all names must be in double quotes and properly escaped. ' + mermaidMindmapExample;
  return {
    sys: `Your task is to generate accurate and well-structured Mermaid code from the given text. ${promptDetails}`,
    usr: `Generate the Mermaid code for a ${diagramType === 'auto' ? 'suitable diagram' : 'mind map'} that ${diagramType === 'auto' ? 'best captures the essence' : 'effectively summarizes the key points'} of the preceding message.`,
  };
}

const sysSuffixPM = 'The next three messages will outline: 1. your personality, 2. the data you\'ll work with, and 3. a clear restatement of the instructions.';
const usrSuffixCoT = 'Please think step by step, then generate valid diagram code in a markdown block as instructed, and stop your response.';

export function bigDiagramPrompt(diagramType: DiagramType, diagramLanguage: DiagramLanguage, chatSystemPrompt: string, subject: string, customInstruction: string): VChatMessageIn[] {
  const { sys, usr } = diagramLanguage === 'mermaid' ? mermaidDiagramPrompt(diagramType) : plantumlDiagramPrompt(diagramType);
  return [
    { role: 'system', content: sys + '\n' + sysSuffixPM },
    { role: 'user', content: chatSystemPrompt },
    { role: 'assistant', content: subject },
    { role: 'user', content: (!customInstruction?.trim() ? usr : `${usr} Also consider the following instructions: ${customInstruction.trim()}`) + '\n' + usrSuffixCoT },
  ];
}