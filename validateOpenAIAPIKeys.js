import https from 'https';

function checkOpenAIKey(apiKey) {
  const options = {
    hostname: 'api.openai.com',
    path: '/v1/models',
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    }
  };

  const req = https.request(options, res => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      if (res.statusCode === 200) {
        console.log('✅ Key is valid!');
      } else {
        console.log(`❌ Invalid key (Status: ${res.statusCode}).`);
        try {
          const out = JSON.parse(data);
          if (out.error && out.error.message) {
            console.log('Error message:', out.error.message);
          }
        } catch (e) {
          console.log('Could not parse error response.');
        }
      }
    });
  });

  req.on('error', err => {
    console.log('❌ Request error:', err.message);
  });

  req.end();
}

// Example usage:
checkOpenAIKey('your-openai-api-key-here');
