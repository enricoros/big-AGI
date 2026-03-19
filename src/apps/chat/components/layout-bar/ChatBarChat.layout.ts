export function getParticipantRosterGridTemplateColumns(hasExpandedParticipant: boolean) {
  return {
    xs: '1fr',
    md: hasExpandedParticipant ? '1fr' : 'repeat(2, minmax(0, 1fr))',
  } as const;
}

export function getParticipantEditorGridTemplateColumns() {
  return {
    xs: '1fr',
    sm: 'repeat(2, minmax(0, 1fr))',
  } as const;
}

export function getParticipantEditorSpeakWhenGridColumn() {
  return {
    xs: 'auto',
    sm: '1 / -1',
  } as const;
}
