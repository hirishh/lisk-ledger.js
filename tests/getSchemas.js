const { apiClient, transactions } = require('@liskhq/lisk-client');

let clientCache;

const getClient = async () => {
    if (!clientCache) {
        clientCache = await apiClient.createWSClient('ws://betanet.lisk.io');
    }
    return clientCache;
};

const runCode = async () => {
  const client = await getClient();
  console.info(client);
}

runCode();




