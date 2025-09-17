// Simulate the creative assistant flow without external APIs
const assistant = require('../easly/creativeAssistant');

async function fakeImageGen(prompt) {
  return { imageUrl: `https://images.example.com/mock?prompt=${encodeURIComponent(prompt)}`, meta: { provider: 'fake' } };
}

(async () => {
  const clientId = 'local-test';
  const s1 = assistant.startBrainstormSession(clientId);
  console.log(s1.message);
  const s2 = assistant.chooseProductType(clientId, 'T-Shirt');
  console.log(s2.message);
  const col = assistant.collectDesignInspiration(clientId, 'Space Explorers', 'Retro', 'bold typography, astronaut icon');
  console.log(col.message);
  const gen = await assistant.generateVisualMockup(clientId, col.prompt, fakeImageGen);
  console.log(gen.message, gen.imageUrl);
  const created = await assistant.recordDesignAndCreateProduct(clientId, { name: 'Space Explorers Tee', price: 25, quantity: 10 });
  console.log(created.message, created.product);
})();
