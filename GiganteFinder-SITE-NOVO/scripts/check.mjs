import { stat, readFile } from 'node:fs/promises';
const required=['public/index.html','public/style.css','public/app.js','netlify/functions/api.mjs','netlify.toml','package.json'];
for(const f of required){if(!(await stat(f)).isFile())throw new Error(`Arquivo ausente: ${f}`);}
const html=await readFile('public/index.html','utf8');
if(!html.includes('GiganteFinder') || !html.includes('style.css') || !html.includes('app.js'))throw new Error('Página inicial incompleta');
console.log('GiganteFinder: estrutura validada. Publique a raiz inteira via GitHub na Netlify.');
