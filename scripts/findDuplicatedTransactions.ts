import { Test, TestingModule } from '@nestjs/testing';
import { BlockchainService } from '../src/blockchain/blockchain.service';
import { readAddressesFromCsv } from '../src/blockchain/libs/CsvWorker';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { PrismaService } from '../src/prisma.service';

dotenv.config();

async function main() {
    const module: TestingModule = await Test.createTestingModule({
        providers: [BlockchainService, PrismaService],
    }).compile();

    const blockchainService = module.get<BlockchainService>(BlockchainService);

    const worker = await blockchainService.getWorker();

    // Get addresses from CSV
    let addresses: string[] = [];
    try {
        addresses = await readAddressesFromCsv(path.join(__dirname, './CollectAllCounterparties/inputs/addresses.csv'));
        console.log("Addresses found: ", addresses);
    } catch (e) {
        console.error('Error reading addresses from CSV: ', e);
        process.exit(1);
    };

    let allTransactionsSet = new Set<string>();
    let allTransactions: any[] = [];
    let duplicateTransactions: any[] = [];

    for (const address of addresses) {
        const startBlock = await blockchainService.transactionsGetLatestBlockInDB(address);
        const latestBlock = await worker.getLatestBlock();

        const transactions = await worker.fetchAllTransactions(
            address, 
            startBlock, 
            latestBlock, 
            1, 
            10000, 
            'asc'
        );

        let arrl = transactions.length;
        for (const tx of transactions) {
            console.log(`Checking transaction: ${tx.hash} | Total transactions: ${arrl}`);
            arrl--;

            if (allTransactionsSet.has(tx.hash)) {
                console.log(`Duplicate transaction found: ${tx.hash}`);
                duplicateTransactions.push(tx);
            } else {
                allTransactionsSet.add(tx.hash);
                allTransactions.push(tx);
            }
        }
    }

    const fs = require('fs');
    const duplicateFilePath = path.join(__dirname, 'duplicate_transactions.txt');
    fs.writeFileSync(duplicateFilePath, JSON.stringify(duplicateTransactions, null, 2), 'utf-8');

    const allTransactionsFilePath = path.join(__dirname, 'all_transactions.txt');
    fs.writeFileSync(allTransactionsFilePath, JSON.stringify(allTransactions, null, 2), 'utf-8');

    console.log("Duplicate transactions saved to duplicate_transactions.txt");
    console.log("All transactions saved to all_transactions.txt");
}

main().catch(e => {
    console.error(e);
    process.exit(1);
});
