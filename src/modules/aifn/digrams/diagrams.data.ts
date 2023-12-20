import type { FormRadioOption } from '~/common/components/forms/FormRadioControl';
import type { VChatMessageIn } from '~/modules/llms/llm.client';


export type DiagramType = 'auto' | 'mind';
export type DiagramLanguage = 'mermaid' | 'plantuml';

// NOTE: keep these global, or it will trigger re-renders
export const diagramTypes: FormRadioOption<DiagramType>[] = [
  { label: 'Auto-diagram', value: 'auto' },
  { label: 'Mindmap', value: 'mind' },
];

export const diagramLanguages: FormRadioOption<DiagramLanguage>[] = [
  { label: 'PlantUML', value: 'plantuml' },
  { label: 'Mermaid (mindmaps)', value: 'mermaid' },
];

const mermaidMindmapExample = `
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
`.trim();

function mermaidDiagramPrompt(diagramType: DiagramType): { sys: string, usr: string } {
  let promptDetails = diagramType === 'auto'
    ? 'You create a valid Mermaid diagram markdown (```mermaid\\n...), ready to be rendered into a diagram. Ensure the code contains no external references, and all names are properly enclosed in double quotes and escaped if necessary. Choose the most suitable diagram type from the following supported types: flowchart, sequence, class, state, erd, gantt, pie, git.'
    : 'You create a valid Mermaid mindmap markdown (```mermaid\\n...), ready to be rendered into a mind map. Ensure the code contains no external references, and all names are properly enclosed in double quotes and escaped if necessary. For example:\n' + mermaidMindmapExample + '\n';
  return {
    sys: `You are an AI that generates correct Mermaid code based on provided text. ${promptDetails}`,
    usr: `Generate the Mermaid code for a ${diagramType === 'auto' ? 'suitable diagram' : 'mind map'} that represents the preceding assistant message.`,
  };
}

function plantumlDiagramPrompt(diagramType: DiagramType): { sys: string, usr: string } {
  switch (diagramType) {
    case 'auto':
      return {
        sys: 'You are an AI that writes PlantUML code based on provided text. You create a valid PlantUML string, enclosed by "```\n@startuml" and "@enduml\n```", ready to be rendered into a diagram or mindmap, ensuring the code contains no external references and all names are properly escaped without spaces. You choose the most suitable diagram type—sequence, class, use case, activity, component, state, object, deployment, wireframe, mindmap, gantt, or flowchart.',
        usr: 'Generate the PlantUML code for the diagram type that best represents the preceding assistant message.',
      };
    case 'mind':
      return {
        sys: 'You are an AI that writes PlantUML code based on provided text. You create a valid PlantUML string, enclosed by "```\n@startmindmap" and "@endmindmap\n```", ready to be rendered into a mind map, ensuring the code contains no external references and all names are properly escaped without spaces.',
        usr: 'Generate the PlantUML code for a mind map based on the preceding assistant message.',
      };
  }
}

export function bigDiagramPrompt(diagramType: DiagramType, diagramLanguage: DiagramLanguage, chatSystemPrompt: string, subject: string, customInstruction: string): VChatMessageIn[] {
  const { sys, usr } = diagramLanguage === 'mermaid' ? mermaidDiagramPrompt(diagramType) : plantumlDiagramPrompt(diagramType);
  if (customInstruction) {
    customInstruction = 'Also consider the following instructions: ' + customInstruction;
  }
  return [
    { role: 'system', content: sys },
    { role: 'system', content: chatSystemPrompt },
    { role: 'assistant', content: subject },
    { role: 'user', content: `${usr} ${customInstruction}` },
  ];
}