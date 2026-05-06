const { createTranscript } = require('discord-html-transcripts');

async function gerarTranscript(channel) {
  return await createTranscript(channel, {
    limit: -1,
    returnType: 'attachment',
    filename: `transcript-${channel.name}.html`,
    poweredBy: false,
  });
}

module.exports = { gerarTranscript };
