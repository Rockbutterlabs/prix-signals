const fs = require('fs');
const input = '.env';
const output = '.env.example';

try {
  const lines = fs.readFileSync(input, 'utf-8')
    .split('\n')
    .map(line => {
      if (line.trim().startsWith('#') || line.trim() === '') return line;
      const [key] = line.split('=');
      return `${key}=`;
    });

  fs.writeFileSync(output, lines.join('\n'));
  console.log('✅ .env.example created successfully!');
} catch (err) {
  console.error('❌ Failed to generate .env.example:', err.message);
} 