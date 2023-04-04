import * as docx from 'docx';

const fileInput = document.getElementById('file-input');

fileInput.addEventListener('change', async () => {
  const file = fileInput.files[0];
  const reader = new FileReader();
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

  reader.onload = async () => {
    const arrayBuffer = reader.result;
    const doc = await docx.Packer.toBuffer(arrayBuffer);
    const docxText = doc.toString('utf-8');

    const response = await fetch('https://api.openai.com/v1/engines/davinci-codex/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer' + OPENAI_API_KEY,
      },
      body: JSON.stringify({
        prompt: docxText,
        max_tokens: 5,
      }),
    });

    const data = await response.json();
    console.log(data);
  };

  reader.readAsArrayBuffer(file);
});
