import axios from 'axios';
import * as dotenv from 'dotenv';
import Web3 from 'web3';

dotenv.config();

const ETH_API_KEY = process.env.ETH_API_KEY || '';

if (!ETH_API_KEY) {
  console.error('Please set ETH_API_KEY in .env file');
  process.exit(1);
}

const BASE_URL = `https://api.etherscan.io/api?module=account&action=balancemulti&tag=latest&apikey=${ETH_API_KEY}`;

const args = process.argv.slice(2);
if (args.length < 2) {
  console.error('Please provide both prefix and suffix as arguments.');
  process.exit(1);
}

const [knownPrefix, knownSuffix] = args;
const THRESHOLD = Web3.utils.toWei('34', 'ether');

async function getBalances(addresses: string[]): Promise<{ account: string, balance: string }[]> {
  const url = `${BASE_URL}&address=${addresses.join(',')}`;
  try {
    const response = await axios.get(url);
    if (response.data.status === '1') {
      return response.data.result;
    } else {
      console.error(`Error fetching balances: ${response.data.message}`);
      return [];
    }
  } catch (error) {
    console.error(`Error fetching balances: ${error}`);
    return [];
  }
}

function* generateAddressGroups(prefix: string, suffix: string, groupSize: number) {
  const charset = '0123456789abcdef';
  const middleLength = 40 - prefix.length - suffix.length;

  let group: string[] = [];

  for (let i = 0; i < Math.pow(charset.length, middleLength); i++) {
    let middle = i.toString(16).padStart(middleLength, '0');
    group.push(prefix + middle + suffix);

    if (group.length === groupSize) {
      yield group;
      group = [];
    }
  }

  if (group.length > 0) {
    yield group;
  }
}

async function main() {
  for (const addressGroup of generateAddressGroups(knownPrefix, knownSuffix, 20)) {
    const balances = await getBalances(addressGroup);

    for (const { account, balance } of balances) {
      const balanceWei = BigInt(balance);

      if (balanceWei > 0) {
        if (balanceWei > BigInt(THRESHOLD)) {
          console.log(`Address: ${account}, Balance: ${Web3.utils.fromWei(balance, 'ether')} ETH`);
          return;
        }
      }

      console.log(`Address: ${account}, Balance: ${Web3.utils.fromWei(balance, 'ether')} ETH`);
    }

    await new Promise(resolve => setTimeout(resolve, 250));
  }
}

main().catch(console.error);
