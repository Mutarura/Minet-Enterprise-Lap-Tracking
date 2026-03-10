// server.js
const { exec } = require('child_process');

// Start the serve process
const serve = exec('serve -s dist -l 3000');

serve.stdout.on('data', data => console.log(data));
serve.stderr.on('data', data => console.error(data));

serve.on('close', code => {
    console.log(`serve process exited with code ${code}`);
});