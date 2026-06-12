import * as React from 'react';

import { Box, Button, FormControl, FormLabel, Input, Textarea } from '@mui/joy';
import { agiUuidV4 } from '~/common/util/idUtils';
import { SystemPurposes } from 'src/data';

export function PersonaForm() {
  const [title, setTitle] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [systemMessage, setSystemMessage] = React.useState('');
  const [symbol, setSymbol] = React.useState('');
  const [examples, setExamples] = React.useState(['']);

  const handleAddExample = () => {
    if (examples.length < 4) {
      setExamples([...examples, '']);
    }
  };

  const handleExampleChange = (index: number, value: string) => {
    const newExamples = [...examples];
    newExamples[index] = value;
    setExamples(newExamples);
  };

  const handleSubmit = () => {
    const newPersonaId = agiUuidV4('persona-2');

    const newPersona = {
      title,
      description,
      systemMessage,
      symbol,
      examples: examples.map(example => example),
    };

    SystemPurposes[newPersonaId as any] = newPersona;

    localStorage.setItem('personas', JSON.stringify(SystemPurposes));

    console.log('New persona added:', { newPersonaId, newPersona });
    console.log('SystemPurposes:', SystemPurposes);
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <FormControl>
        <FormLabel>Title</FormLabel>
        <Input
          type="text"
          placeholder="Code Reviewer"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </FormControl>
      <FormControl>
        <FormLabel>Description</FormLabel>
        <Textarea
          placeholder="Helps you review code"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </FormControl>
      <FormControl>
        <FormLabel>System Prompt</FormLabel>
        <Textarea
          placeholder="You are a code reviewer. You provide feedback on code quality, style, and best practices."
          value={systemMessage}
          onChange={(e) => setSystemMessage(e.target.value)}
        />
      </FormControl>
      <FormControl>
        <FormLabel>Symbol</FormLabel>
        <Input
          type="text"
          placeholder="🧐"
          value={symbol}
          onChange={(e) => setSymbol(e.target.value)}
        />
      </FormControl>
      <FormControl>
        <FormLabel>Examples</FormLabel>
        {examples.map((example, index) => (
          <Box key={index} sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <Input
              type="text"
              placeholder={index === 0 ? 'Check for potential bugs' : index === 1 ? 'Suggest improvements to code style' : 'Identify security vulnerabilities'}
              value={example}
              onChange={(e) => handleExampleChange(index, e.target.value)}
              sx={{ mb: 1, flexGrow: 1 }}
            />
            <Button onClick={() => {
              const newExamples = [...examples];
              newExamples.splice(index, 1);
              setExamples(newExamples);
            }}
            sx={{ mb: 1 }}
            >Remove</Button>
          </Box>
        ))}
        <br />
        <Button onClick={handleAddExample}>Add Example</Button>
      </FormControl>
      <Button onClick={handleSubmit}>Create Persona</Button>
    </Box>
  );
}