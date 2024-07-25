import Web3 from 'web3';
import * as dotenv from 'dotenv';

dotenv.config();

const INFURA_URL = `https://mainnet.infura.io/v3/${process.env.INFURA}`;
const web3 = new Web3(new Web3.providers.HttpProvider(INFURA_URL));

const knownPrefix = '0xaa5e';
const knownSuffix = '7032';

async function getBalance(address: string): Promise<string> {
  try {
    const balanceWei = await web3.eth.getBalance(address);
    return balanceWei.toString();
  } catch (error) {
    console.error(`Error fetching balance for ${address}: ${error}`);
    return '0';
  }
}

function* generateAddresses(prefix: string, suffix: string) {
  const charset = '0123456789abcdef';
  const middleLength = 40 - prefix.length - suffix.length;

  for (let i = 0; i < Math.pow(charset.length, middleLength); i++) {
    let middle = i.toString(16).padStart(middleLength, '0');
    yield prefix + middle + suffix;
  }
}

async function main() {
  for (const address of generateAddresses(knownPrefix, knownSuffix)) {
    const balance = await getBalance(address);
    console.log(`Address: ${address}, Balance: ${balance}`);
    await new Promise(resolve => setTimeout(resolve, 200));
  }
}

main().catch(console.error);
