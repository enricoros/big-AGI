import * as React from 'react';

import { Box, Chip, FormControl } from '@mui/joy';

import { FormLabelStart } from '~/common/components/forms/FormLabelStart';


// [EDITORIAL] Anthropic Default Skills
const DEFAULT_SKILLS = [
  { id: 'xlsx', label: 'Excel' },
  { id: 'pptx', label: 'PowerPoint' },
  { id: 'pdf', label: 'PDF' },
  { id: 'docx', label: 'Word' },
] as const;


export function AnthropicSkillsConfig({ smaller, llmVndAntSkills, onChangeParameter, onRemoveParameter }: {
  smaller?: boolean;
  llmVndAntSkills: string | undefined;
  onChangeParameter: (params: { llmVndAntSkills: string | undefined }) => void;
  onRemoveParameter: (paramId: 'llmVndAntSkills') => void;
}) {

  const skillsArray = llmVndAntSkills ? llmVndAntSkills.split(',').map(s => s.trim()).filter(Boolean) : [];

  const handleSkillToggle = (skillId: string) => {
    const newSkills = skillsArray.includes(skillId)
      ? skillsArray.filter(id => id !== skillId)
      : [...skillsArray, skillId];
    const newValue = newSkills.length > 0 ? newSkills.join(',') : undefined;
    if (!newValue) onRemoveParameter('llmVndAntSkills');
    else onChangeParameter({ llmVndAntSkills: newValue });
  };

  return (
    <FormControl orientation='horizontal' sx={{ flexWrap: smaller ? 'nowrap' : 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 2, width: '100%' }}>
      <FormLabelStart
        title={smaller ? 'Skills' : 'Anthropic Skills (Alpha)'}
        description={smaller ? undefined : 'Server-side'}
        // tooltip='Select which document types Claude can create using server-side Skills API. Skills run on Anthropic servers and may incur additional costs.'
      />
      <Box sx={{ display: 'flex', gap: 1, py: 0.5, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        {DEFAULT_SKILLS.map((skill) => {
          const isSelected = skillsArray.includes(skill.id);
          return (
            <Chip
              size={smaller ? 'sm' : 'md'}
              key={skill.id}
              variant={isSelected ? 'solid' : 'outlined'}
              color={isSelected ? 'primary' : 'neutral'}
              onClick={() => handleSkillToggle(skill.id)}
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
