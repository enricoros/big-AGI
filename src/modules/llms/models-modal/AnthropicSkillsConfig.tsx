import * as React from 'react';

import { Box, Chip, FormControl } from '@mui/joy';

import { FormLabelStart } from '~/common/components/forms/FormLabelStart';
import { Release } from '~/common/app.release';


// configuration
const ENABLE_ANTHROPIC_SKILLS_CONFIG = Release.IsNodeDevBuild; // FIXME: enable on non-dev builds too


// [EDITORIAL] Anthropic Default Skills
const DEFAULT_SKILLS = [
  { id: 'xlsx', label: 'Excel' },
  { id: 'pptx', label: 'PowerPoint' },
  { id: 'pdf', label: 'PDF' },
  { id: 'docx', label: 'Word' },
] as const;


export function AnthropicSkillsConfig({ llmVndAntSkills, onChangeParameter }: {
  llmVndAntSkills: string | undefined;
  onChangeParameter: (params: { llmVndAntSkills: string | undefined }) => void;
}) {

  if (!ENABLE_ANTHROPIC_SKILLS_CONFIG) return null;

  const skillsArray = llmVndAntSkills ? llmVndAntSkills.split(',').map(s => s.trim()).filter(Boolean) : [];

  const handleSkillToggle = (skillId: string) => {
    const newSkills = skillsArray.includes(skillId)
      ? skillsArray.filter(id => id !== skillId)
      : [...skillsArray, skillId];
    const newValue = newSkills.length > 0 ? newSkills.join(',') : undefined;
    onChangeParameter({ llmVndAntSkills: newValue });
  };

  return (
    <FormControl orientation='horizontal' sx={{ flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <FormLabelStart
        title='Anthropic Skills (Alpha)'
        description='Server-side'
        // tooltip='Select which document types Claude can create using server-side Skills API. Skills run on Anthropic servers and may incur additional costs.'
      />
      <Box sx={{ display: 'flex', gap: 1, py: 1, flexWrap: 'wrap' }}>
        {DEFAULT_SKILLS.map((skill) => {
          const isSelected = skillsArray.includes(skill.id);
          return (
            <Chip
              size='md'
              key={skill.id}
              variant={isSelected ? 'solid' : 'outlined'}
              color={isSelected ? 'primary' : 'neutral'}
              onClick={() => handleSkillToggle(skill.id)}
            >
              {skill.label}
            </Chip>
          );
        })}
      </Box>
    </FormControl>
  );
}
