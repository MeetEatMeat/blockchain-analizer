import axios from 'axios';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import * as csv from 'csv-parser';
import { exit } from 'process';
import { next } from 'cheerio/lib/api/traversing';
dotenv.config();

// const logFilePath = path.join(__dirname, '../outputs/console_output.log');
// const logStream = fs.createWriteStream(logFilePath, { flags: 'a' });
// console.log = (message) => {
//     logStream.write(`${new Date().toISOString()} - ${message}\n`);
// };

interface Transaction {
    txId: string;
    methodId: string;
    blockHash: string;
    height: string;
    transactionTime: string;
    from: string;
    to: string;
    isFromContract: boolean;
    isToContract: boolean;
    amount: string;
    transactionSymbol: string;
    txFee: string;
    state: string;
    tokenId: string;
    tokenContractAddress: string;
    challengeStatus: string;
    l1OriginHash: string;
}

interface TransactionList {
    page: string;
    limit: string;
    totalPage: string;
    chainFullName: string;
    chainShortName: string;
    transactionLists: Transaction[];
}

interface ApiResponse {
    code: string;
    msg: string;
    data: TransactionList[];
}

type Result = { 
    path: any[]
}

/*
This script uses the `processAddress()` function to take addresses from the `requestAddresses` array, 
which is a list of sanctioned addresses, and requests transactions for each address in the list. 
The `processAddress()` function then takes the first transaction, checks whether it was incoming or outgoing, 
and recursively calls itself to request transactions from the address that was either the sender or the recipient, 
depending on the direction, while preserving the direction.

For each transaction, the sender's or recipient's address is checked against the `targetAddresses` list, 
which is a list of Bitkub exchange addresses. At each level of recursion, 
the current transaction is stored in the `txPath` tuple at the position determined by the `depth` variable, 
which increments by 1 with each recursive call. This way, for each current transaction, 
the `txPath` variable stores the entire path leading up to it.

If an address from the `targetAddresses` list is found in the `to` or `from` field of the current transaction, 
the entire path—the entire chain of transactions stored in the `txPath` variable—is saved in the `results` variable, 
and the function returns to the previous recursion level. The next transaction is then examined.
*/

const request_list = path.join(__dirname, '../inputs/addresses_with1000_txs.csv');
const target_list = path.join(__dirname, '../inputs/cex_btc.csv');
const reports_directory = path.join(__dirname, '../outputs/btc_reports');
const mid_reports_directory = path.join(reports_directory, './mid_reports');
const final_report_path = path.join(reports_directory, 'bad_btc_txs_trace.json');
const MAX_DEPTH = 2;

async function getTransactionList() {
    _checkDirectories();

    let targetAddresses: string[] = await _checkAddressList(target_list);
    let requestAddresses: string[] = await _checkAddressList(request_list);

    const targetAddressSet = new Set(targetAddresses.map(addr => addr));
    const requestAddressSet = new Set(requestAddresses.map(addr => addr));

    const transactionCache = new Map<string, Set<Transaction>>();
    const results: Result[] = [];
    const visitedForwardAddresses = new Set<string>();
    const visitedBackwardAddresses = new Set<string>();
    const txPath: Transaction[] = Array(MAX_DEPTH + 1).fill(null);
    let totalTransactions = 0;
    let position = '';

    ////////////////////
    // MAIN LOOP
    ////////////////////
    for (let i = 0; i < requestAddresses.length; i++) {
        // console.log(`Processing address ${requestAddresses[i]}`);
        position = `Current position: ${i + 1}/${requestAddresses.length}`;
        await processAddress(position, requestAddresses[i], 0, 'start', 0);
    }

    async function processAddress(
        position: string, 
        prevLvlAddress: string, 
        depth: number,
        direction: 'forward' | 'backward' | 'start', 
        transactionTime: number
    ) {
        console.log(`Processing address ${prevLvlAddress} | Depth: ${depth} | Direction: ${direction}`);
        // We should process addresses from request list only on the first level
        if (direction !== 'start' && requestAddressSet.has(prevLvlAddress)) {
            console.log(`Address ${prevLvlAddress} is in the Bad list. Skipping...`);
            return;
        }

        // This address already visited in the forward direction
        if (direction === 'forward' && visitedForwardAddresses.has(prevLvlAddress)) {
            console.log(`Address ${prevLvlAddress} already visited forward. Skipping...`);
            return;
        } else if (direction === 'backward' && visitedBackwardAddresses.has(prevLvlAddress)) {
            console.log(`Address ${prevLvlAddress} already visited backward. Skipping...`);
            return;
        }

        if (direction === 'forward') {
            visitedForwardAddresses.add(prevLvlAddress);
        } else if (direction === 'backward') {
            visitedBackwardAddresses.add(prevLvlAddress);
        }

        // If we have transactions for this address in the cache, we use them
        const result = await _getTransactions(prevLvlAddress);
        if(!Array.isArray(result)) {
            console.log(`Error fetching transactions for ${prevLvlAddress}. Retrying...`);
            await processAddress(position, prevLvlAddress, depth, direction, transactionTime);
            return;
        }
        // console.log("Transactions before: ", result.length);
        const transactions = await _sortnfilterTransactions(result, transactionTime, direction);
        // console.log("Transactions after: ", transactions.length);
    
        for (const tx of transactions) {
            // await new Promise(resolve => setTimeout(resolve, 1000));
            console.log(`Processing txs`);
            if (direction === 'forward' && Number(tx.transactionTime) <= transactionTime) {
                console.log(`Transaction ${tx.txId} is older than the previous transaction. Direction ${direction}. Skipping...`);
                continue;
            } else if (direction === 'backward' && Number(tx.transactionTime) >= transactionTime) {
                console.log(`Transaction ${tx.txId} is newer than the previous transaction. Direction ${direction}. Skipping...`);
                continue;
            }

            totalTransactions++;
    
            console.log(`Processing tx for ${prevLvlAddress} | Total: ${totalTransactions} | ${position} | Tuple length: ${txPath.length} | Depth: ${depth} | Bad txs: ${results.length} | ${direction} | ${tx.transactionTime}`);

            await _prepareRecursion(direction, tx);
        }

        async function _getTransactions(address: string): Promise<Transaction[]> {
            if (transactionCache.has(address)) {
                // console.log("_getTransactions. First if");
                const txs = Array.from(transactionCache.get(address)!);
                console.log(`Transactions for ${address} found in cache. Total: ${txs.length}`);
                return txs;
            } else {
                // console.log("_getTransactions. Second if");
                let pages = 1;
                let txs: Transaction[] = [];
                console.log("OkLink requesting...");
                for(let i = 0; i <= pages; i++) {
                    // await new Promise(resolve => setTimeout(resolve, 1000));
                    let response = await requestTxList_OkLink(address, i + 1);
                    console.log(`Requesting data for address: ${address} | Page: ${i + 1}`);
                    if (response === null || response === undefined || response.code !== '0') {
                        console.log(`Retrying request for address ${address} due to unsuccessful status or null response...`);
                        if (direction === 'forward'){
                            visitedForwardAddresses.delete(address);
                        } else if (direction === 'backward'){
                            visitedBackwardAddresses.delete(address);
                        }
                        await processAddress(position, address, depth, direction, transactionTime);
                        return;
                    }
                    // if (Number(response.data[0].totalPage) > 10) {
                    //     console.log(`${address} is probably an exchange address. Skipping...`);
                    //     return;
                    // }
                    txs = txs.concat(response.data[0].transactionLists);
                    if(pages === 1) pages = Number(response.data[0].totalPage);
                }
                // console.log("Transaction list: ", txs.length);
                transactionCache.set(address, new Set(txs));
                // console.log("_getTransactions. Txs: ", txs.length);
                return txs;
            }
        }

        async function _prepareRecursion(dir: 'forward' | 'backward' | 'start', tx: Transaction) {
            // console.log(`Preparing recursion on depth: ${depth} | ${dir} | to: ${tx.to}, from: ${tx.from}`);

            let nextHopDirection = dir;
            if(direction === 'start'){
                if(tx.to.includes(prevLvlAddress)){
                    nextHopDirection = 'backward';
                } else if(tx.from.includes(prevLvlAddress)){
                    nextHopDirection = 'forward';
                }
            }

            let uniqueAddresses: string[] = [];
            if(nextHopDirection === 'forward'){
                uniqueAddresses = Array.from(new Set(tx.to.split(',')));
            } else if(nextHopDirection === 'backward'){
                uniqueAddresses = Array.from(new Set(tx.from.split(',')));
            }
        
            for (const addr of uniqueAddresses) {
                txPath[depth] = tx;
            
                if (depth < MAX_DEPTH) {
                    for (let i = depth + 1; i <= MAX_DEPTH; i++) {
                        txPath[i] = null;
                    }
                }
                // console.log(`txPath on depth ${depth}:`, txPath);

                if (targetAddressSet.has(addr)) {
                    results.push({ path: txPath });
                    console.log(`Bad transaction found for ${addr}: `, tx);
                    console.log(`Total bad transactions found: ${results.length}`);
        
                    saveStackToFile(txPath, mid_reports_directory);
                    continue;
                }
                if (depth < MAX_DEPTH) {
                    await processAddress(position, addr, depth + 1, nextHopDirection, Number(tx.transactionTime));
                }
            }
        }
    }

    async function saveStackToFile(stack: Transaction[], directory: string) {
        const stackFilePath = path.join(directory, `stack_${Date.now()}.json`);
        fs.writeFileSync(stackFilePath, JSON.stringify(stack, null, 2), 'utf-8');
        console.log(`Stack saved to ${stackFilePath}`);
    }

    _finalizeResults(totalTransactions, position, results);
}

async function requestTxList_OkLink(address: string, page: number): Promise<ApiResponse> {
    const apikey = process.env.OKLINK_API_KEY;
    if (!apikey) {
        console.error('requestTxList_OkLink. API Key not found');
        process.exit(1);
    }

    try {
        const response = await axios.get<ApiResponse>('https://www.oklink.com/api/v5/explorer/address/transaction-list', {
            params: {
                chainShortName: 'btc',
                address: address,
                limit: 100,
                page: page
            },
            headers: {
                'Ok-Access-Key': apikey
            }
        });
        // console.log("requestTxList_OkLink. Response: ", response);
        return response.data;
    } catch (error) {
        console.error(`Error fetching transactions for ${address}: `, error);
        return null;
    }
}

const readAddressesFromCsv = async (filePath: string): Promise<string[]> => {
    if(!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
    }

    const addresses: string[] = [];

    return new Promise((resolve, reject) => {
        fs.createReadStream(filePath)
            .pipe(csv())
            .on('data', (data) => addresses.push(data.Address))
            .on('end', () => resolve(addresses))
            .on('error', (error) => reject(error));
    });
};

async function _checkDirectories(){
    try{    
        if (!fs.existsSync(mid_reports_directory)) {
            fs.mkdirSync(mid_reports_directory, { recursive: true });
        }
    } catch(e){
        console.log("_checkDirectories error: ", e);
    }
}

async function _checkAddressList(path: string): Promise<string[]> {
    try {
        const addresses = await readAddressesFromCsv(path);
        console.log("Addresses to process found: ", addresses.length);
        return addresses;
    } catch (e) {
        console.error('Error reading target addresses from CSV: ', e);
        process.exit(1);
    }
}

async function _finalizeResults(totalTransactions: number, position: string, results: any[]){
    const report = {
        total: totalTransactions,
        position: position,
        foundings: results.length,
        badTransactions: results
    }
    fs.writeFileSync(final_report_path, JSON.stringify(report, null, 2), 'utf-8');
    console.log(`All transactions saved to ${final_report_path}`);
}

async function _sortnfilterTransactions(transactions: Transaction[], transactionTime: number, direction: 'forward' | 'backward' | 'start'): Promise<Transaction[]> {
    if (direction === 'start') {
        return transactions;
    }
    transactions.sort((a, b) => {
        const timeA = parseInt(a.transactionTime);
        const timeB = parseInt(b.transactionTime);
        
        if (direction === 'forward') {
            return timeA - timeB;
        } else {
            return timeB - timeA;
        }
    });

    return transactions.filter(tx => {
        if (direction === 'forward') {
            return parseInt(tx.transactionTime) >= transactionTime;
        } else if (direction === 'backward') {
            return parseInt(tx.transactionTime) <= transactionTime;
        }
    });
}

getTransactionList();
