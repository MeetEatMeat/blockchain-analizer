import axios from 'axios';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import * as csv from 'csv-parser';
dotenv.config();

interface ITransaction {
    blockNumber: string;
    timeStamp: string;
    hash: string;
    nonce: string;
    blockHash: string;
    transactionIndex: string;
    from: string;
    to: string;
    value: string;
    gas: string;
    gasPrice: string;
    isError: string;
    input: string;
    contractAddress: string;
    cumulativeGasUsed: string;
    gasUsed: string;
    confirmations: string;
    methodId: string;
    functionName: string;
    txreceipt_status: string;
}

interface TxListResponse {
    status: string;
    message: string;
    result: ITransaction[];
}

type Result = { 
    path: any[]
}

enum ApiType {
    Oklink = 'oklink',
    Etherscan = 'etherscan'
};

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

const request_list = path.join(__dirname, '../inputs/filtered_bad_eth.csv');
const target_list = path.join(__dirname, '../inputs/bitkub_addresses.csv');
const reports_directory = path.join(__dirname, '../outputs/eth_reports');
const mid_reports_directory = path.join(reports_directory, './mid_reports');
const final_report_path = path.join(reports_directory, 'bad_eth_txs_trace.json');
const MAX_DEPTH = 2;
const txPath: any[] = Array(MAX_DEPTH + 1).fill(null);
const results: Result[] = [];
const transactionCache = new Map<string, Set<ITransaction>>();
const visitedForwardAddresses = new Set<string>();
const visitedBackwardAddresses = new Set<string>();
let totalTransactions = 0;

async function getTransactionList() {
    await _checkDirectories();

    let targetAddresses: string[] = await _checkAddressList(target_list);
    let requestAddresses: string[] = await _checkAddressList(request_list);

    const targetAddressSet = new Set(targetAddresses.map(addr => addr.toLowerCase()));
    const requestAddressSet = new Set(requestAddresses.map(addr => addr.toLowerCase()));

    let position = '';

    ////////////////////
    // MAIN LOOP
    ////////////////////
    for (let i = 0; i < requestAddresses.length; i++) {
        position = `Current position: ${i + 1}/${requestAddresses.length}`;
        await _processAddress(position, requestAddresses[i].toLowerCase(), 0, 'start', 0, targetAddressSet, requestAddressSet);
    }

    await _finalizeResults(totalTransactions, position, results);
}

async function _processAddress(
    position: string, 
    prevLvlAddress: string, 
    depth: number,
    direction: 'forward' | 'backward' | 'start', 
    timestamp: number,
    targetAddressSet: Set<string>,
    requestAddressSet: Set<string>
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
    let result: ITransaction[];
    try{
        result = await _getTransactions(prevLvlAddress, transactionCache);
        if(!Array.isArray(result)) {
            console.log(`Error fetching transactions for ${prevLvlAddress}. Retrying...`);
            if (direction === 'forward') {
                visitedForwardAddresses.delete(prevLvlAddress);
            } else if (direction === 'backward') {
                visitedBackwardAddresses.delete(prevLvlAddress);
            }
            await _processAddress(position, prevLvlAddress, depth, direction, timestamp, targetAddressSet, requestAddressSet);
            return;
        }
    } catch(e) {
        console.log(e.message);
        return;
    }

    const transactions = await _sortnFilterTransactions(result, timestamp, direction);

    for (const tx of transactions) {
        if (direction === 'forward' && Number(tx.timeStamp) <= timestamp) {
            console.log(`Transaction ${tx.hash} is older than the previous transaction. Direction ${direction}. Skipping...`);
            continue;
        } else if (direction === 'backward' && Number(tx.timeStamp) >= timestamp) {
            console.log(`Transaction ${tx.hash} is newer than the previous transaction. Direction ${direction}. Skipping...`);
            continue;
        }

        totalTransactions++;
        console.log(`Processing tx for ${prevLvlAddress} | Total: ${totalTransactions} | ${position} | Tuple length: ${txPath.length} | Depth: ${depth} | Bad txs: ${results.length} | ${direction} | ${tx.timeStamp}`);
        await _prepareRecursion(position, prevLvlAddress, direction, depth, tx, targetAddressSet, requestAddressSet);
    }
}

async function _prepareRecursion(
    position: string,
    prevLvlAddress: string, 
    dir: 'forward' | 'backward' | 'start', 
    depth: number, 
    tx: ITransaction,
    targetAddressSet: Set<string>,
    requestAddressSet: Set<string>
) {
    txPath[depth] = tx;

    if (depth < MAX_DEPTH) {
        for (let i = depth + 1; i <= MAX_DEPTH; i++) {
            txPath[i] = null;
        }
    }

    let nextHopDirection = dir;
    if(dir === 'start'){
        if(tx.to === prevLvlAddress){
            nextHopDirection = 'backward';
        } else if(tx.from === prevLvlAddress){
            nextHopDirection = 'forward';
        }
    }

    let nextHopAddress = '';
    if(nextHopDirection === 'forward'){
        nextHopAddress = tx.to.toLowerCase();
    } else if(nextHopDirection === 'backward'){
        nextHopAddress = tx.from.toLowerCase();
    }

    const nextHopDepth = depth + 1;

    if (targetAddressSet.has(nextHopAddress)){
        results.push({ path: txPath });
        console.log(`Bad transaction found for ${prevLvlAddress}: `, tx);
        console.log(`Total bad transactions found: ${results.length}`);

        await _saveStackToFile(txPath, mid_reports_directory);
        return;
    }
    if (depth < MAX_DEPTH) {
        await _processAddress(position, nextHopAddress, nextHopDepth, nextHopDirection, Number(tx.timeStamp), targetAddressSet, requestAddressSet);
    }
}

async function _saveStackToFile(stack: ITransaction[], directory: string) {
    const stackFilePath = path.join(directory, `stack_${Date.now()}.json`);
    fs.writeFileSync(stackFilePath, JSON.stringify(stack, null, 2), 'utf-8');
    console.log(`Stack saved to ${stackFilePath}`);
}

async function _getTransactions(address: string, transactionCache: Map<string, Set<ITransaction>>): Promise<ITransaction[]> {
    if (transactionCache.has(address)) {
        const txs = Array.from(transactionCache.get(address)!);
        console.log(`Transactions for ${address} found in cache. Total: ${txs.length}`);
        return txs;
    } else {
        console.log("OkLink requesting...");
        
        let response = await _requestTxList(address, ApiType.Oklink);
    
        if (response.length > 99) {
            console.log("Etherscan requesting...");

            response = await _requestTxList(address, ApiType.Etherscan);

            if (response.length > 9999) {
                throw new Error(`${address} is probably an exchange address. Skipping...`);
            }
        }
        transactionCache.set(address, new Set(response));
        return response;
    }
}

async function _sortnFilterTransactions(transactions: ITransaction[], timestamp: number, direction: 'forward' | 'backward' | 'start'): Promise<ITransaction[]> {
    if (direction === 'start') {
        return transactions;
    }
    transactions.sort((a, b) => {
        const timeA = parseInt(a.timeStamp);
        const timeB = parseInt(b.timeStamp);
        
        if (direction === 'forward') {
            return timeA - timeB;
        } else {
            return timeB - timeA;
        }
    });

    return transactions.filter(tx => {
        if (direction === 'forward') {
            return parseInt(tx.timeStamp) >= timestamp;
        } else if (direction === 'backward') {
            return parseInt(tx.timeStamp) <= timestamp;
        }
    });
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

async function _checkDirectories(){
    try{    
        if (!fs.existsSync(mid_reports_directory)) {
            fs.mkdirSync(mid_reports_directory, { recursive: true });
        }
    } catch(e){
        console.log("_checkDirectories error: ", e);
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

async function _requestTxList(address: string, apiType: ApiType): Promise<ITransaction[]> {
    let apikey: string;
    let url: string;
    let params: Object = {};
    let headers: Object = {};

    if(apiType === ApiType.Oklink) {

        apikey = process.env.OKLINK_API_KEY;
        if (!apikey) {
            console.error('_requestTxList. Oklink API Key not found');
            process.exit(1);
        }

        params = {
            module: 'account',
            action: 'txlist',
            address: address,
            startblock: 0,
            endblock: 99999999,
            page: 1,
            offset: 10000,
            sort: 'asc'
        }

        headers = { 'Ok-Access-Key': apikey };

        url = 'https://www.oklink.com/api/v5/explorer/eth/api';

    } else if (apiType === ApiType.Etherscan) {

        apikey = process.env.ETH_API_KEY;
        if (!apikey) {
            console.error('_requestTxList. Etherscan API Key not found');
            process.exit(1);
        }

        params = {
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

        url = 'https://api.etherscan.io/api';
    }

    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
        try {
            const response = await axios.get<TxListResponse>(url, {
                params: params,
                headers: headers
            });

            if (response.data.status === "1") {
                return response.data.result;
            } else {
                console.warn(`${apiType} Attempt ${attempts + 1} failed. Status: ${response.data.status}, Message: ${response.data.message}`);
            }
        } catch (error) {
            console.error(`${apiType} Error fetching transactions for ${address} on attempt ${attempts + 1}: `, error);
        }

        attempts++;
    }

    console.error(`Failed to fetch transactions for ${address} after ${maxAttempts} attempts.`);
    return null;
}

async function _finalizeResults(totalTransactions: number, position: string, results: Result[]){
    const report = {
        total: totalTransactions,
        position: position,
        foundings: results.length,
        badTransactions: results
    }
    fs.writeFileSync(final_report_path, JSON.stringify(report, null, 2), 'utf-8');
    console.log(`All transactions saved to ${final_report_path}`);
}

getTransactionList();
