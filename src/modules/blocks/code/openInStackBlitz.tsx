import { Brand } from '~/common/app.config';
import { prettyTimestampForFilenames } from '~/common/util/timeUtils';


const _languages = [
  'typescript',
  'javascript', 'json',
  'html', 'css',
  // 'python',
];

// Mapping of languages to StackBlitz templates
const languageToTemplateMapping: { [language: string]: string } = {
  typescript: 'typescript',
  javascript: 'javascript', json: 'javascript',
  html: 'html', css: 'html',
  // python: 'secret-python', // webcontainers? secret-python? python?
};

// Mapping of languages to their primary file names in StackBlitz
const languageToFileExtensionMapping: { [language: string]: string } = {
  typescript: 'index.ts',
  javascript: 'index.js', json: 'data.json',
  html: 'index.html', css: 'style.css',
  // python: 'main.py',
};


export function isStackBlitzSupported(language: string | null) {
  return !!language && _languages.includes(language);
}

export function openInStackBlitz(code: string, language: string, title?: string) {

  const template = languageToTemplateMapping[language] || 'javascript'; // Fallback to 'javascript'
  const fileName = languageToFileExtensionMapping[language] || 'index.js'; // Fallback to 'index.js'

  const projectDetails = {
    files: { [fileName]: code },
    template: template,
    description: `${Brand.Title.Common} file created on ${prettyTimestampForFilenames()}`,
    title: language == 'python' ? 'Python Starter' : title,
  } as const;

  const form = document.createElement('form');
  form.action = 'https://stackblitz.com/run';
  form.method = 'POST';
  form.target = '_blank';

  const addField = (name: string, value: string) => {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = name;
    input.value = value;
    form.appendChild(input);
  };

  Object.keys(projectDetails.files).forEach((filePath) => {
    addField(`project[files][${filePath}]`, projectDetails.files[filePath]);
  });

  addField('project[description]', projectDetails.description);
  addField('project[template]', projectDetails.template);
  !!projectDetails.title && addField('project[title]', projectDetails.title);

  document.body.appendChild(form);
  form.submit();
  document.body.removeChild(form);
}
