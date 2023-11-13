import type { VChatMessageIn } from '~/modules/llms/transports/chatGenerate';

import type { FormRadioOption } from '~/common/components/forms/useFormRadio';


export type DiagramType = 'auto' | 'mind';
export type DiagramLanguage = 'mermaid' | 'plantuml';

// NOTE: keep these global, or it will trigger re-renders
export const diagramTypes: FormRadioOption<DiagramType>[] = [
  { label: 'Diagram', value: 'auto' },
  { label: 'Mindmap', value: 'mind' },
];

export const diagramLanguages: FormRadioOption<DiagramLanguage>[] = [
  { label: 'Mermaid', value: 'mermaid' },
  { label: 'PlantUML', value: 'plantuml' },
];

function mermaidDiagramPrompt(diagramType: DiagramType): { sys: string, usr: string } {
  let promptDetails = diagramType === 'auto'
    ? 'You create a valid Mermaid diagram markdown (```mermaid\n...) ready to be rendered into a diagram or mindmap, ensuring the code contains no external references and all names are properly escaped without spaces. You choose the most suitable diagram string from the following supported types: flowchart, sequence, class, state, erd, gantt, pie, git, or mindmap.'
    : 'You create a valid Mermaid mindmap markdown (```mermaid\n...) ready to be rendered into a mind map, ensuring the code contains no external references and all names are properly escaped without spaces.';
  return {
    sys: `You are an AI that writes Mermaid code based on provided text. ${promptDetails}`,
    usr: `Generate the Mermaid code for a ${diagramType === 'auto' ? 'suitable diagram' : 'mind map'} that represents the preceding assistant message.`,
  };
}

function plantumlDiagramPrompt(diagramType: DiagramType): { sys: string, usr: string } {
  switch (diagramType) {
    case 'auto':
      return {
        sys: 'You are an AI that writes PlantUML code based on provided text. You create a valid PlantUML string, enclosed by "@startuml" and "@enduml", ready to be rendered into a diagram or mindmap, ensuring the code contains no external references and all names are properly escaped without spaces. You choose the most suitable diagram type—sequence, class, use case, activity, component, state, object, deployment, wireframe, mindmap, gantt, or flowchart.',
        usr: 'Generate the PlantUML code for the diagram type that best represents the preceding assistant message.',
      };
    case 'mind':
      return {
        sys: 'You are an AI that writes PlantUML code based on provided text. You create a valid PlantUML string, enclosed by @startmindmap" and "@endmindmap", ready to be rendered into a mind map, ensuring the code contains no external references and all names are properly escaped without spaces.',
        usr: 'Generate the PlantUML code for a mind map based on the preceding assistant message.',
      };
  }
}

export function bigDiagramPrompt(diagramType: DiagramType, diagramLanguage: DiagramLanguage, chatSystemPrompt: string, subject: string): VChatMessageIn[] {
  const { sys, usr } = diagramLanguage === 'mermaid' ? mermaidDiagramPrompt(diagramType) : plantumlDiagramPrompt(diagramType);
  return [
    { role: 'system', content: sys + ' Your output is strictly markdown and nothing else.' },
    { role: 'system', content: chatSystemPrompt },
    { role: 'assistant', content: subject },
    { role: 'user', content: usr },
  ];
}