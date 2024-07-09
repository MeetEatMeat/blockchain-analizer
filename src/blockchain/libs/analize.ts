import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { BlockchainWorker } from './BlockchainWorker';
import { Transaction } from '../dto/transaction.dto';
import { saveTransactionsToCSV } from './csvWorker';

dotenv.config();

const ETH_MAIN_API_URL = 'https://api.etherscan.io/api';
const ETH_GOERLI_API_URL = 'https://api-goerli.etherscan.io/api';
const ETH_SEPOLIA_API_URL = 'https://api-sepolia.etherscan.io/api';
const API_KEY = process.env.ETH_API_KEY || '';

const analyzeAffiliatedAddresses = (transactions: Transaction[]) => {
    console.log('Analyzing affiliated addresses...\n');
    const fromAddresses: { [key: string]: number } = {};
    const toAddresses: { [key: string]: number } = {};

    transactions.forEach(tx => {
        fromAddresses[tx.from] = (fromAddresses[tx.from] || 0) + 1;
        toAddresses[tx.to] = (toAddresses[tx.to] || 0) + 1;
    });

    console.log('Most frequent From Addresses:', Object.entries(fromAddresses).sort((a, b) => b[1] - a[1]).slice(0, 5));
    console.log('Most frequent To Addresses:', Object.entries(toAddresses).sort((a, b) => b[1] - a[1]).slice(0, 5));
};

export default async function checkAffiliates(address: string, network: string = 'main', startblock = 0, endblock = 99999999, page = 1, offset = 10000, sort = 'asc') {
    console.log("Main program started\n");
    const networkUrl = network === 'main' ? ETH_MAIN_API_URL : 
                        network === 'goerli' ? ETH_GOERLI_API_URL : 
                        ETH_SEPOLIA_API_URL;
    console.log("Main. networkUrl: ", networkUrl);

    const bcworker = new BlockchainWorker(API_KEY);

    const latestBlock = await bcworker.getLatestBlock(networkUrl);
    console.log("Latest block: ", latestBlock);

    const transactions = await bcworker.fetchAllTransactions(address, networkUrl, startblock, latestBlock || endblock, page, offset, sort);
    console.log(`Fetched ${transactions.length} transactions`);

    const reportsDirectory = path.join(__dirname, '../outputs', address);
    console.log("Reports directory: ", reportsDirectory);
    if (!fs.existsSync(reportsDirectory)) {
        console.log("Creating directory: ", reportsDirectory);
        fs.mkdirSync(reportsDirectory, { recursive: true });
    }

    await saveTransactionsToCSV(transactions, reportsDirectory, 'transactions.csv');

    analyzeAffiliatedAddresses(transactions);
}