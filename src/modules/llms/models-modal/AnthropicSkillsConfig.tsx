import * as React from 'react';

import { Box, Chip, FormControl } from '@mui/joy';

import { FormLabelStart } from '~/common/components/forms/FormLabelStart';


// [EDITORIAL] Anthropic Default Skills
const DEFAULT_SKILLS = [
  { id: 'pdf', label: 'PDF' },
  { id: 'pptx', label: 'PPT' },
  { id: 'docx', label: 'Word' },
  { id: 'xlsx', label: 'Excel' },
] as const;


export function AnthropicSkillsConfig({ smaller, llmVndAntSkills, onChangeParameter, onRemoveParameter }: {
  smaller?: boolean;
  llmVndAntSkills: string | undefined;
  onChangeParameter: (params: { llmVndAntSkills: string | undefined }) => void;
  onRemoveParameter: (paramId: 'llmVndAntSkills') => void;
}) {

  const skillsArray = llmVndAntSkills ? llmVndAntSkills.split(',').map(s => s.trim()).filter(Boolean) : [];

  const handleSkillToggle = React.useCallback((event: React.MouseEvent<HTMLElement>) => {
    // id from the element, not a parameter (MUI Joy Chip bubbles from inner action button)
    const skillId = (event.target as HTMLElement).closest<HTMLElement>('[data-skill-id]')?.dataset.skillId;
    if (!skillId) return;

    // recompute the new skills
    const current = llmVndAntSkills ? llmVndAntSkills.split(',').map(s => s.trim()).filter(Boolean) : [];
    const next = current.includes(skillId) ? current.filter(id => id !== skillId) : [...current, skillId];
    const newSkills = next.length > 0 ? next.join(',') : undefined;

    // remove or set the parameter
    if (!newSkills) onRemoveParameter('llmVndAntSkills');
    else onChangeParameter({ llmVndAntSkills: newSkills });
  }, [llmVndAntSkills, onChangeParameter, onRemoveParameter]);

  return (
    <FormControl size={smaller ? 'sm' : undefined} orientation='horizontal' sx={{ flexWrap: smaller ? 'nowrap' : 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 0.5, width: '100%', minHeight: '2rem' }}>
      <FormLabelStart
        title={smaller ? 'Skills' : 'Anthropic Skills (Alpha)'}
        description={!smaller ? 'Server-side' : undefined}
        // tooltip='Select which document types Claude can create using server-side Skills API. Skills run on Anthropic servers and may incur additional costs.'
      />
      <Box sx={{ display: 'flex', gap: 0.5, py: 0.5, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        {DEFAULT_SKILLS.map((skill) => {
          const isSelected = skillsArray.includes(skill.id);
          return (
            <Chip
              size={smaller ? 'sm' : 'md'}
              key={skill.id}
              variant={isSelected ? 'solid' : 'outlined'}
              color={isSelected ? 'primary' : 'neutral'}
              data-skill-id={skill.id}
              onClick={handleSkillToggle}
              sx={{ borderRadius: 'sm' }}
            >
              {skill.label}
            </Chip>
          );
        })}
      </Box>
    </FormControl>
  );
}
