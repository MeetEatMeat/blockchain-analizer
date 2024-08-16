import axios from 'axios';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import { readAddressesFromCsv } from '../src/blockchain/libs/CsvWorker';
dotenv.config();
/*
This script uses the `processAddress()` function to take addresses from the `requestAddresses` array, 
which is a list of sanctioned addresses, and requests transactions for each address in the list. 
The `processAddress()` function then takes the first transaction, checks whether it was incoming or outgoing, 
and recursively calls itself to request transactions from the address that was either the sender or the recipient, 
depending on the direction, while preserving the direction.

For each transaction, the sender's or recipient's address is checked against the `csvAddresses` list, 
which is a list of Bitkub exchange addresses. At each level of recursion, 
the current transaction is stored in the `txPath` tuple at the position determined by the `depth` variable, 
which increments by 1 with each recursive call. This way, for each current transaction, 
the `txPath` variable stores the entire path leading up to it.

If an address from the `csvAddresses` list is found in the `to` or `from` field of the current transaction, 
the entire path—the entire chain of transactions stored in the `txPath` variable—is saved in the `results` variable, 
and the function returns to the previous recursion level. The next transaction is then examined.
*/
async function getTransactionList() {
    const reportsDirectory = path.join(__dirname, '../outputs');
    if (!fs.existsSync(reportsDirectory)) {
        fs.mkdirSync(reportsDirectory, { recursive: true });
    }
    const outputFilePath = path.join(reportsDirectory, 'bad_eth_txs_with_stack.json');

    const individualStacksDir = path.join(reportsDirectory, '../outputs/stacks');
    if (!fs.existsSync(individualStacksDir)) {
        fs.mkdirSync(individualStacksDir, { recursive: true });
    }

    let csvAddresses: string[] = [];
    try {
        csvAddresses = await readAddressesFromCsv(path.join(__dirname, '../inputs/bitkub_addresses.csv'));
        console.log("Addresses for checking found: ", csvAddresses.length);
    } catch (e) {
        console.error('Error reading addresses from CSV: ', e);
        process.exit(1);
    }

    const csvAddressSet = new Set(csvAddresses.map(addr => addr.toLowerCase()));

    let requestAddresses: string[] = [];
    try {
        requestAddresses = await readAddressesFromCsv(path.join(__dirname, '../inputs/last_of_bad_eth.csv'));
        console.log("Addresses for requests found: ", requestAddresses.length);
    } catch (e) {
        console.error('Error reading request addresses from CSV: ', e);
        process.exit(1);
    }

    const requestAddressSet = new Set(requestAddresses.map(addr => addr.toLowerCase()));
    const transactionCache = new Map<string, Set<string>>();

    const OKLINK_API_KEY = process.env.OKLINK_API_KEY;
    console.log('API Key: ', OKLINK_API_KEY);
    const MAX_DEPTH = 2;

    const results: { path: any[], transactions: any[] }[] = [];
    const visitedForwardAddresses = new Set<string>();
    const visitedBackwardAddresses = new Set<string>();
    const txPath: any[] = Array(MAX_DEPTH + 1).fill(null);

    let totalTransactions = 0;

    let position = '';
    for (let i = 0; i < requestAddresses.length; i++) {
        position = `Current position: ${i + 1}/${requestAddresses.length}`;
        await processAddress(position, requestAddresses[i].toLowerCase(), 0, 'start', 0);
    }

    async function processAddress(
        position: string, 
        address: string, 
        depth: number,
        direction: 'forward' | 'backward' | 'start', 
        timestamp: number) 
        {

        if (direction !== 'start' && requestAddressSet.has(address)) {
            console.log(`Address ${address} is in the Bad list. Skipping...`);
            return;
        }

        if (direction === 'forward' && visitedForwardAddresses.has(address)) {
            console.log(`Address ${address} already visited forward. Skipping...`);
            return;
        }
    
        if (direction === 'forward') visitedForwardAddresses.add(address);

        if (direction === 'backward' && visitedBackwardAddresses.has(address)) {
            console.log(`Address ${address} already visited backward. Skipping...`);
            return;
        }

        if (direction === 'backward') visitedBackwardAddresses.add(address);

        let transactions: any[] = [];

        if (transactionCache.has(address)) {
            transactions = Array.from(transactionCache.get(address)!);
            console.log(`Transactions for ${address} found in cache. Total: ${transactions.length}`);
        } else {
            let response = await requestTxList_OkLink(address);
            console.log("OkLink requesting...");
        
            if (response === null || response.status !== "1") {
                console.log(`Retrying request for address ${address} due to unsuccessful status or null response...`);
                await processAddress(position, address, depth, direction, timestamp);
                return;
            }
        
            if (response.result.length > 99) {
                response = await requestTxList_Etherscan(address);
                console.log("Etherscan requesting...");
        
                if (response === null || response.status !== "1") {
                    console.log(`Retrying request for address ${address} due to unsuccessful status or null response...`);
                    await processAddress(position, address, depth, direction, timestamp);
                    return;
                }

                if (response.result.length > 1000) {
                    console.log(`${address} is probably an exchange address. Skipping...`);
                    return;
                }
            }
        
            transactions = response.result;
            transactionCache.set(address, new Set(transactions));
        }
    
        for (const tx of transactions) {
            if (direction === 'forward' && Number(tx.timeStamp) <= timestamp) {
                console.log(`Transaction ${tx.hash} is older than the previous transaction. Direction ${direction}. Skipping...`);
                continue;
            } else if (direction === 'backward' && Number(tx.timeStamp) >= timestamp) {
                console.log(`Transaction ${tx.hash} is newer than the previous transaction. Direction ${direction}. Skipping...`);
                continue;
            }

            totalTransactions++;
    
            txPath[depth] = tx;

            if (depth < MAX_DEPTH) {
                for (let i = depth + 1; i <= MAX_DEPTH; i++) {
                    txPath[i] = null;
                }
            }
            console.log(`Processing tx for ${address} | Total: ${totalTransactions} | ${position} | Tuple length: ${txPath.length} | Depth: ${depth} | Bad txs: ${results.length} | ${direction} | ${tx.timeStamp}`);

            if (tx.to.toLowerCase() === address && direction === 'backward'){
                if (csvAddressSet.has(tx.from.toLowerCase())){
                    results.push({ path: txPath, transactions: [tx] });
                    console.log(`Bad transaction found for ${address}: `, tx);
                    console.log(`Total bad transactions found: ${results.length}`);

                    saveStackToFile(txPath, individualStacksDir);
                    continue;
                }
                if (depth < MAX_DEPTH) {
                    console.log(`1Recursion on ${depth + 1}`);
                    await processAddress(position, tx.from.toLowerCase(), depth + 1, 'backward', Number(tx.timeStamp));
                }
            } else if (tx.from.toLowerCase() === address && direction === 'forward'){
                if (csvAddressSet.has(tx.to.toLowerCase())){
                    results.push({ path: txPath, transactions: [tx] });
                    console.log(`Bad transaction found for ${address}: `, tx);
                    console.log(`Total bad transactions found: ${results.length}`);

                    saveStackToFile(txPath, individualStacksDir);
                    continue;
                }
                if (depth < MAX_DEPTH) {
                    console.log(`2Recursion on ${depth + 1}`);
                    await processAddress(position, tx.to.toLowerCase(), depth + 1, 'forward', Number(tx.timeStamp));
                }
            } else if (tx.to.toLowerCase() === address && direction === 'start'){
                console.log(`3Recursion on ${depth + 1} | direction: ${direction}`);
                await processAddress(position, tx.from.toLowerCase(), depth + 1, 'backward', Number(tx.timeStamp));
            } else if (tx.from.toLowerCase() === address && direction === 'start'){
                console.log(`4Recursion on ${depth + 1} | direction: ${direction}`);
                await processAddress(position, tx.to.toLowerCase(), depth + 1, 'forward', Number(tx.timeStamp));
            }
        }
    }

    function saveStackToFile(stack: any[], directory: string): void {
        const stackFilePath = path.join(directory, `stack_${Date.now()}.json`);
        fs.writeFileSync(stackFilePath, JSON.stringify(stack, null, 2), 'utf-8');
        console.log(`Stack saved to ${stackFilePath}`);
    }

    const report = {
        total: totalTransactions,
        position: position,
        foundings: results.length,
        badTransactions: results
    }
    fs.writeFileSync(outputFilePath, JSON.stringify(report, null, 2), 'utf-8');
    console.log(`All transactions saved to ${outputFilePath}`);
}

async function requestTxList_OkLink(address: string) {
    const apikey = process.env.OKLINK_API_KEY;
    if (!apikey) {
        console.error('requestTxList_OkLink. API Key not found');
        process.exit(1);
    }

    try {
        const response = await axios.get('https://www.oklink.com/api/v5/explorer/eth/api', {
            params: {
                module: 'account',
                action: 'txlist',
                address: address,
                startblock: 0,
                endblock: 99999999,
                page: 1,
                offset: 10000,
                sort: 'asc'
            },
            headers: {
                'Ok-Access-Key': apikey
            }
        });
        return response.data;
    } catch (error) {
        console.error(`Error fetching transactions for ${address}: `, error);
        return null;
    }
}

async function requestTxList_Etherscan(address: string) {
    const apikey = process.env.ETH_API_KEY;
    if (!apikey) {
        console.error('requestTxList_Etherscan. API Key not found');
        process.exit(1);
    }

    try {
        const response = await axios.get('https://api.etherscan.io/api', {
            params: {
                module: 'account',
                action: 'txlist',
                address: address,
                startblock: 0,
                endblock: 99999999,
                page: 1,
                offset: 10000,
                sort: 'asc',
                apikey: apikey
            }
        });
        return response.data;
    } catch (error) {
        console.error(`Error fetching transactions for ${address}: `, error);
        return null;
    }
}

getTransactionList();
