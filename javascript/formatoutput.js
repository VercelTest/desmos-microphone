const output = document.querySelector('.output');
const lines = output.textContent.replace(/\r/g,'').split('\n');
output.innerHTML = lines.map(line => `<span>${line || ' '}</span>`).join('');