import axios from 'axios';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import { createObjectCsvWriter } from 'csv-writer';
import * as csv from 'csv-parser';
import { verbose } from "sqlite3";
import { count } from 'console';
const sqlite3 = verbose();
dotenv.config();

interface ITransferResponse {
    code: string;
    msg: string;
    data: ITransferData[];
}

interface ITransferData {
    limit: string;
    page: string;
    totalPage: string;
    transactionList: ITransfer[];
}

interface ITransfer {
    txId: string;
    blockHash: string;
    height: string;
    transactionTime: string;
    from: string;
    to: string;
    tokenContractAddress: string;
    tokenId: string;
    amount: string;
    symbol: string;
    isFromContract: boolean;
    isToContract: boolean;
}

interface BlockStatisticsResponse {
    code: string;
    msg: string;
    data: BlockStatistics[];
}

interface BlockStatistics {
    chainFullName: string;
    chainShortName: string;
    symbol: string;
    lastHeight: string;
    firstExchangeHistoricalTime: string;
    firstBlockTime: string;
    firstBlockHeight: string;
    avgBlockInterval: string;
    avgBlockSize24h: string;
    avgBlockSize24hPercent: string;
    mediaBlockSize: string;
    halveTime: string;
}

interface Label {
    address: string;
    chainId: number;
    label: string;
    name?: string;
    symbol?: string;
    website?: string;
    image?: string;
}

interface IAddressInfoResponse {
    code: string;
    msg: string;
    data: IAddressInfo[];
}

interface IAddressInfo {
    chainFullName: string;
    chainShortName: string;
    address: string;
    contractAddress: string;
    balance: string;
    balanceSymbol: string;
    transactionCount: string;
    verifying: string;
    sendAmount: string;
    receiveAmount: string;
    tokenAmount: string;
    totalTokenValue: string;
    createContractAddress: string;
    createContractTransactionHash: string;
    firstTransactionTime: string;
    lastTransactionTime: string;
    token: string;
    bandwidth: string;
    energy: string;
    votingRights: string;
    unclaimedVotingRewards: string;
    isAaAddress: boolean;
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

For each transaction, the sender's or recipient's address is checked against the `csvAddresses` list, 
which is a list of Bitkub exchange addresses. At each level of recursion, 
the current transaction is stored in the `txPath` tuple at the position determined by the `depth` variable, 
which increments by 1 with each recursive call. This way, for each current transaction, 
the `txPath` variable stores the entire path leading up to it.

If an address from the `csvAddresses` list is found in the `to` or `from` field of the current transaction, 
the entire path—the entire chain of transactions stored in the `txPath` variable—is saved in the `results` variable, 
and the function returns to the previous recursion level. The next transaction is then examined.
*/

const request_list = path.join(__dirname, '../inputs/charles_case/first_list.csv');
const reports_directory = path.join(__dirname, '../outputs/charles_case/first_list_reports');
const mid_reports_directory = path.join(reports_directory, './mid_reports');
const final_report_path = path.join(reports_directory, 'bad_soursing_token20_trace.json');
const MAX_DEPTH = 2;
const txPath: any[] = Array(MAX_DEPTH + 1).fill(null);
const results: Result[] = [];
const transactionCache = new Map<string, Set<ITransfer>>();
const visitedAddresses = new Set<string>();
const visitedTransactions = new Set<string>();
const maxRetries = 5;
let totalTransactions = 0;

async function getTransactionList() {
    await _checkDirectories();

    let requestAddresses: string[] = await _checkAddressList(request_list);
    const requestAddressSet = new Set(requestAddresses.map(addr => addr.toLowerCase()));

    let position = '';

    ////////////////////
    // MAIN LOOP
    ////////////////////
    for (let i = 0; i < requestAddresses.length; i++) {
        position = `Current position: ${i + 1}/${requestAddresses.length}`;
        await _processAddress(position, requestAddresses[i].toLowerCase(), 0, 0, '', requestAddressSet);
    }

    await _finalizeResults(totalTransactions, position, results);
}

async function _processAddress(
    position: string, 
    prevLvlAddress: string, 
    depth: number,
    timestamp: number,
    symbol: string,
    requestAddressSet: Set<string>
) {
    console.log(`Processing address ${prevLvlAddress} | Depth: ${depth}`);
    // We should process addresses from request list only on the first level
    if (depth > 0 && requestAddressSet.has(prevLvlAddress)) {
        console.log(`Address ${prevLvlAddress} is in the request list, there is loop. Depth: ${depth} Skipping...`);
        return;
    }

    if(visitedAddresses.has(prevLvlAddress)){
        console.log(`Address ${prevLvlAddress} already visited backward. Skipping...`);
        return;
    }

    visitedAddresses.add(prevLvlAddress);

    await _processOperations(prevLvlAddress, depth, position, timestamp, symbol, requestAddressSet);
}

async function _processOperations(
    address: string, 
    depth: number, 
    position: string, 
    timestamp: number,
    symbol: string,
    requestAddressSet: Set<string>
) {
    // If we have transactions for this address in the cache, we use them
    const transactions = await _processTransactions(address, timestamp);
    // console.log("_processOperations. transactions: ", transactions);

    for (const tx of transactions) {
        const visited = visitedTransactions.has(tx.txId);
        console.log(`Transaction ${tx.txId} visited: ${visited}`);
        if (visited) {
            console.log(`Transaction ${tx.txId} already visited. Skipping...`);
            continue;
        }

        if (Number(tx.transactionTime) >= timestamp && timestamp > 0) {
            console.log(`Transaction ${tx.txId} is newer than the previous transaction. Skipping...`);
            continue;
        }

        if(Number(tx.amount) < 1){
            console.log(`Transaction ${tx.txId} is less than 1. Skipping...`);
            continue;
        }

        if(symbol !== '' && tx.symbol !== symbol){
            console.log(`Transaction ${tx.txId} has different symbol. Skipping...`);
            continue;
        }

        visitedTransactions.add(tx.txId);

        totalTransactions++;
        console.log(`Processing transaction for ${address} | Total: ${totalTransactions} | ${position} | Tuple length: ${txPath.length} | Depth: ${depth} | Bad txs: ${results.length} | ${tx.transactionTime}`);
        await _prepareRecursion(position, address, depth, tx, symbol, requestAddressSet);
    }
}

async function _processTransactions(address: string, timestamp: number): Promise<ITransfer[]>{
    let result: ITransfer[];
    try{
        result = await _getTransactions(address, transactionCache);
        // console.log("_processTransactions. result length: ", result.length);

        if(!Array.isArray(result)) {
            console.log(`Error fetching transactions for ${address}. Retrying...`);
            await _processTransactions(address, timestamp);
            return;
        }
    } catch(e) {
        console.error(e.message);
        return;
    }
    return await _sortnFilterTransactions(result, timestamp);
}

async function _prepareRecursion(
    position: string,
    prevLvlAddress: string, 
    depth: number, 
    tx: ITransfer,
    symbol: string,
    requestAddressSet: Set<string>
) {
    txPath[depth] = tx;

    if (depth < MAX_DEPTH) {
        for (let i = depth + 1; i <= MAX_DEPTH; i++) {
            txPath[i] = null;
        }
    }

    const addressInfo = await _getAddressInfo(tx.from);
    const countOfTransactions = Number(addressInfo.transactionCount);
    const isNotContract = addressInfo.contractAddress === '';
    console.log(`Address ${tx.from} has transactions: ${countOfTransactions} | Is not contract: ${isNotContract}`);

    let nextHopAddress = tx.from.toLowerCase();
    const nextHopDepth = depth + 1;
    const nextHopSymbol = symbol === '' ? tx.symbol : symbol;
    const attribution = await _getLabelFromDB(nextHopAddress);
    if(depth > 0){
        if (attribution !== null){
            results.push({ path: txPath });
            console.log(`Bad transaction found for ${prevLvlAddress}: `, tx, attribution);
            console.log(`Total bad transactions found: ${results.length}`);

            await _saveStackToFile(txPath, attribution, mid_reports_directory);
            return;
        }
    }

    if (depth < MAX_DEPTH && attribution === null && countOfTransactions < 1000 && isNotContract) {
        await _processAddress(position, nextHopAddress, nextHopDepth, Number(tx.transactionTime), nextHopSymbol, requestAddressSet);
    }
}

// async function _saveStackToFile(stack: ITransaction[], attribution: Label, directory: string) {
//     const stackWithAttribution = [...stack, attribution];
//     const stackFilePath = path.join(directory, `stack_${Date.now()}.json`);
//     fs.writeFileSync(stackFilePath, JSON.stringify(stackWithAttribution, null, 2), 'utf-8');
//     console.log(`Stack saved to ${stackFilePath}`);
// }
async function _saveStackToFile(stack: ITransfer[], attribution: Label, directory: string) {
    const records = [];
    const csvWriter = createObjectCsvWriter({
        path: path.join(directory, `mid_token20_report.csv`),
        header: [
            { id: 'from_address', title: 'from_address' },
            { id: 'from_address_attribution', title: 'from_address_attribution' },
            { id: 'tx1_hash', title: 'tx1_hash' },
            { id: 'tx1_timestamp', title: 'tx1_timestamp' },
            { id: 'tx1_value', title: 'tx1_value' },
            { id: 'tx1_currency', title: 'tx1_currency' },
            { id: 'middle_address1', title: 'middle_address1' },
            { id: 'middle_address1_attribution', title: 'middle_address1_attribution' },
            { id: 'tx2_hash', title: 'tx2_hash' },
            { id: 'tx2_timestamp', title: 'tx2_timestamp' },
            { id: 'tx2_value', title: 'tx2_value' },
            { id: 'tx2_currency', title: 'tx2_currency' },
            { id: 'middle_address2', title: 'middle_address2' },
            { id: 'middle_address2_attribution', title: 'middle_address2_attribution' },
            { id: 'tx3_hash', title: 'tx3_hash' },
            { id: 'tx3_timestamp', title: 'tx3_timestamp' },
            { id: 'tx3_value', title: 'tx3_value' },
            { id: 'tx3_currency', title: 'tx3_currency' },
            { id: 'to_address', title: 'to_address' },
            { id: 'to_address_attribution', title: 'to_address_attribution' }
        ],
        append: true
    });

    let record;
    if (stack[2]) {
        record = {
            from_address: stack[2]?.from || '',
            from_address_attribution: attribution.name || '',
            tx1_hash: stack[2]?.txId || '',
            tx1_timestamp: stack[2]?.transactionTime || '',
            tx1_value: stack[2]?.amount || '',
            tx1_currency: stack[2]?.symbol || '',
            middle_address1: stack[1]?.from || '',
            middle_address1_attribution: '',
            tx2_hash: stack[1]?.txId || '',
            tx2_timestamp: stack[1]?.transactionTime || '',
            tx2_value: stack[1]?.amount || '',
            tx2_currency: stack[1]?.symbol || '',
            middle_address2: stack[0]?.from || '',
            middle_address2_attribution: '',
            tx3_hash: stack[0]?.txId || '',
            tx3_timestamp: stack[0]?.transactionTime || '',
            tx3_value: stack[0]?.amount || '',
            tx3_currency: stack[0]?.symbol || '',
            to_address: stack[0]?.to || '',
            to_address_attribution: ''
        };
    } else {
        record = {
            from_address: stack[1]?.from || '',
            from_address_attribution: attribution.name || '',
            tx1_hash: stack[1]?.txId || '',
            tx1_timestamp: stack[1]?.transactionTime || '',
            tx1_value: stack[1]?.amount || '',
            tx1_currency: stack[1].symbol || '',
            middle_address1: stack[0]?.from || '',
            middle_address1_attribution:'',
            tx2_hash: stack[0]?.txId || '',
            tx2_timestamp: stack[0]?.transactionTime || '',
            tx2_value: stack[0]?.amount || '',
            tx2_currency: stack[0].symbol || '',
            to_address: stack[0]?.to || '',
            to_address_attribution: '',
            middle_address2: '',
            middle_address2_attribution: '',
            tx3_hash: '',
            tx3_timestamp: '',
            tx3_value: '',
            tx3_currency: ''
        };
    }
    records.push(record);
    await csvWriter.writeRecords(records);
    console.log(`New rows successfully saved at ${path.join(directory, `mid_report.csv`)}`);
}

async function _getTransactions(address: string, transactionCache: Map<string, Set<ITransfer>>): Promise<ITransfer[]> {
    if (transactionCache.has(address)) {
        const txs = Array.from(transactionCache.get(address)!);
        console.log(`Transactions for ${address} found in cache. Total: ${txs.length}`);
        return txs;
    } else {
        console.log("OkLink transactions requesting...");
        
        let response = await _fetchAllTransactions(address, 'eth');

        transactionCache.set(address, new Set(response));
        // console.log("_getTransactions. response length: ", response.length);
        return response;
    }
}

async function _fetchAllTransactions(
    address: string, 
    chainShortName: string
): Promise<ITransfer[]> {
    let allTransactions: ITransfer[] = [];
    const limit = 100;
    const latestBlock = parseInt((await _getBlockStatistics(chainShortName)).lastHeight);
    let startBlockHeight = 0;
    let endBlockHeight = latestBlock;
    let windowSize = endBlockHeight - startBlockHeight;
    console.log("Fetching transactions...");

    while (startBlockHeight < latestBlock) {
        const totalPages = await _getTotalPages(
            address,
            chainShortName,
            limit,
            startBlockHeight,
            endBlockHeight
        );
        console.log(`Total pages: ${totalPages}, start block: ${startBlockHeight}, end block: ${endBlockHeight}, latest block: ${latestBlock}`);

        if(totalPages < 100) {
            const [transactions, totalPages] = await _fetchAllPages(
                address,
                chainShortName,
                limit,
                startBlockHeight,
                endBlockHeight
            );

            allTransactions = allTransactions.concat(transactions);
            // console.log("_fetchAllTransactions. allTransactions length: ", allTransactions.length);
            if (endBlockHeight === latestBlock) {
                break;
            }
            startBlockHeight = endBlockHeight + 1;
            endBlockHeight = startBlockHeight + windowSize;

            if (endBlockHeight > latestBlock) {
                endBlockHeight = latestBlock;
            }

            if (totalPages < 20) {
                console.log('Too few pages. Increasing window size.');
                windowSize = Math.floor(windowSize * 4 / 3);
                endBlockHeight = startBlockHeight + windowSize;
    
                if (endBlockHeight > latestBlock) {
                    endBlockHeight = latestBlock;
                }
            }
        } else if (isNaN(totalPages)){
            console.log(`NaN returned. Offsetting window. ${startBlockHeight}, ${endBlockHeight}`);
            startBlockHeight = endBlockHeight + 1;
            endBlockHeight = startBlockHeight + windowSize;

            if (endBlockHeight > latestBlock) {
                endBlockHeight = latestBlock;
            }
        } else {
            console.log(`Too many pages. Decreasing window size. Current start block ${startBlockHeight}, end block ${endBlockHeight}`);
            windowSize = Math.floor(windowSize / 2);
            endBlockHeight = startBlockHeight + windowSize;
        }
    }
    console.log('All transactions fetched.');
    return allTransactions;
}

async function _getTotalPages(
    address: string, 
    chainShortName: string, 
    limit: number, 
    startBlockHeight: number, 
    endBlockHeight: number
): Promise<number> {
    const response = await _sendRequest(address, chainShortName, 1, limit, startBlockHeight, endBlockHeight);
    return parseInt(response.data[0].totalPage);
}

async function _fetchAllPages(
    address: string, 
    chainShortName: string, 
    limit: number, 
    startBlockHeight: number, 
    endBlockHeight: number
): Promise<[ITransfer[], number]> {
    let currentPage = 1;
    let allTransactions: ITransfer[] = [];
    let totalPages = 1;
    console.log(`Fetching page...`);
    try {
        while (true) {
            const response = await _sendRequest(address, chainShortName, currentPage, limit, startBlockHeight, endBlockHeight);

            if (response.code !== '0') {
                console.error(`Failed to fetch transactions after ${maxRetries} retries.`);
                throw new Error('Failed to fetch transactions');
            }

            const transactionPage = response.data[0];
            if (totalPages === 1) totalPages = parseInt(transactionPage.totalPage);
            allTransactions = allTransactions.concat(transactionPage.transactionList);
            if (currentPage >= parseInt(transactionPage.totalPage)) {
                break;
            }

            currentPage++;
        }

    } catch (error) {
        console.error('Error fetching transactions:', error);
    }
    // console.log('Total transactions found:', allTransactions.length);
    return [allTransactions, totalPages];
}

async function _sendRequest(
    address: string, 
    chainShortName: string, 
    page: number, 
    limit: number, 
    startBlockHeight: number, 
    endBlockHeight: number
): Promise<ITransferResponse> {
    const apikey = await _getApiKey();

    let retries = 0;
    console.log(`Fetching transactions for address ${address}. Page: ${page}`);
    do {
        try{
            const response = await axios.get<ITransferResponse>('https://www.oklink.com/api/v5/explorer/address/token-transaction-list', {
                params: {
                    chainShortName,
                    address,
                    protocolType: 'token_20',
                    page: page.toString(),
                    limit: limit.toString(),
                    startBlockHeight: startBlockHeight.toString(),
                    endBlockHeight: endBlockHeight.toString(),
                    isFromOrTo: 'to'
                },
                headers: {
                    'Ok-Access-Key': apikey,
                },
            });
    
            if (response.data.code !== '0') {
                retries++;
                console.error(`Error fetching transactions. Retrying... (${retries}/${maxRetries})`);
                await new Promise(resolve => setTimeout(resolve, 1000));
            } else {
                return response.data;
            }
        } catch(e) {
            console.error(`Error fetching transactions. Retrying...`, e);
            retries++;
        }
    } while (retries < maxRetries);
}

async function _getBlockStatistics(chainShortName: string): Promise<BlockStatistics | null> {
    const apikey = await _getApiKey();
    const url = `https://www.oklink.com/api/v5/explorer/blockchain/block`;
    let retries = 0;
    do{
        try {
            const response = await axios.get<BlockStatisticsResponse>(url, {
                params: {
                    chainShortName,
                },
                headers: {
                    'Ok-Access-Key': apikey
                },
            });

            if (response.data.code === "0" && response.data.data.length > 0) {
                return response.data.data[0];
            } else {
                console.error(`Error fetching block statistics: ${response.data.msg}`);
                retries++;
            }
        } catch (error) {
            console.error(`Error fetching block statistics for ${chainShortName}: `, error);
            retries++;
        }
    } while (retries < maxRetries);
}

async function _getApiKey(): Promise<string> {
    const apikey = process.env.OKLINK_API_KEY;
    if (!apikey) {
        console.error('requestTxList_OkLink. API Key not found');
        process.exit(1);
    }
    return apikey;
}

async function _sortnFilterTransactions(transactions: ITransfer[], timestamp: number): Promise<ITransfer[]> {
    transactions.sort((a, b) => {
        const timeA = parseInt(a.transactionTime);
        const timeB = parseInt(b.transactionTime);
        return timeB - timeA;
    });
    // console.log("_sortnFilterTransactions. transactions lenght: ", transactions.length);
    // console.log("timestamp: ", timestamp);
    if(timestamp === 0){
        return transactions;
    } else {
        return transactions.filter(tx => {
            // console.log("tx.transactionTime: ", tx.transactionTime);
            return parseInt(tx.transactionTime) < timestamp;
        });
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

async function _getLabelFromDB(address: string): Promise<Label | null> {
    const db = new sqlite3.Database('/Users/admin/nestjs-backend/blockchain-analizer/db.sqlite3', sqlite3.OPEN_READONLY, (err) => {
        if (err) {
            console.error('Ошибка при подключении к базе данных:', err.message);
        } else {
            console.log('Подключение к базе данных успешно.');
        }
    });

    return new Promise((resolve, reject) => {
        db.get(
            "SELECT label, name, symbol, website, image FROM tokens WHERE address = ? UNION ALL SELECT label, name_tag as name, '' as symbol, '' as website, '' as image FROM accounts WHERE address = ?",
            [address, address],
            (err, row: Label) => {
                if (err) {
                    reject(err);
                } else {
                    if (row) {
                        resolve({
                            address: address,
                            chainId: 1,
                            label: row.label,
                            name: row.name,
                            symbol: row.symbol,
                            website: row.website,
                            image: row.image,
                        });
                    } else {
                        resolve(null);
                    }
                }
            }
        );

        db.close((err) => {
            if (err) {
                console.error('Ошибка при закрытии базы данных:', err.message);
            } else {
                console.log('Подключение к базе данных закрыто.');
            }
        });
    });
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

async function _getAddressInfo(address: string): Promise<IAddressInfo | null> {
    const apikey = await _getApiKey();
    let response;
    let retries = 0;
    do {
        try{
            response = await axios.get<IAddressInfoResponse>('https://www.oklink.com/api/v5/explorer/address/address-summary', {
                params: {
                    chainShortName: 'eth',
                    address,
                },
                headers: {
                    'Ok-Access-Key': apikey,
                },
            });

            if (response.data.code !== '0') {
                retries++;
                console.error(`Error fetching address info: ${response.data.msg}`);
            }
            return response.data.data[0];

        } catch(e) {
            retries++;
            console.error(`Error fetching address info: ${e.message}`);
        }
    } while (retries < maxRetries);
}

getTransactionList();
