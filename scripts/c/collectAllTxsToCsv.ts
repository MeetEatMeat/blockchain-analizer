import axios from 'axios';
import { createObjectCsvWriter } from 'csv-writer';
import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config();

interface Transaction {
    txId: string;
    methodId: string;
    nonce: string;
    gasPrice: string;
    gasLimit: string;
    gasUsed: string;
    blockHash: string;
    height: string;
    transactionTime: string;
    from: string;
    to: string;
    isFromContract: boolean;
    isToContract: boolean;
    amount: string;
    symbol: string;
    txFee: string;
    state: string;
    transactionType: string;
}

interface TransactionPage {
    limit: string;
    page: string;
    totalPage: string;
    transactionList: Transaction[];
}

interface TxListResponse {
    code: string;
    msg: string;
    data: TransactionPage[];
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


const labelBuffer = new Map<string, string>();

async function getLabelsForBatch(addresses: string[], chainShortName: string): Promise<Map<string, string>> {
    const apikey = await _getApiKey();

    console.log('Fetching batch labels:', addresses);
    const addressQuery = addresses.join(',');
    const url = `https://www.oklink.com/api/v5/explorer/address/entity-label`;
    const labelsMap = new Map<string, string>();

    try {
        const response = await axios.get(url, {
            params: {
                chainShortName,
                address: addressQuery,
            },
            headers: {
                'Ok-Access-Key': apikey,
            },
        });

        const labelsData = response.data.data || [];
        for (const labelInfo of labelsData) {
            labelsMap.set(labelInfo.address, labelInfo.label || '');
        }

        // Cache results in the buffer
        labelsMap.forEach((label, address) => {
            labelBuffer.set(address, label);
        });

    } catch (error) {
        console.error('Error fetching batch labels:', error);
    }
    console.log('Batch labels:', labelsMap.size);
    return labelsMap;
}

async function fetchAllTransactions(
    address: string, 
    chainShortName: string
): Promise<Transaction[]> {
    let allTransactions: Transaction[] = [];
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
        console.log(`Total pages: ${totalPages}`);

        if(totalPages < 100) {
            const [transactions, totalPages] = await _fetchAllPages(
                address,
                chainShortName,
                limit,
                startBlockHeight,
                endBlockHeight
            );

            allTransactions = allTransactions.concat(transactions);
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

        if (windowSize <= 1) {
            console.log('Window size too small. Exiting.');
            break;
        }
    }

    return allTransactions;
}

async function _getTotalPages(
    address: string, 
    chainShortName: string, 
    limit: number, 
    startBlockHeight: number, 
    endBlockHeight: number
): Promise<number> {
    const maxRetries = 5;
    const response = await _sendRequest(address, chainShortName, 1, limit, maxRetries, startBlockHeight, endBlockHeight);
    return parseInt(response.data[0].totalPage);
}

async function _fetchAllPages(
    address: string, 
    chainShortName: string, 
    limit: number, 
    startBlockHeight: number, 
    endBlockHeight: number
): Promise<[Transaction[], number]> {
    let currentPage = 1;
    let allTransactions: Transaction[] = [];
    let totalPages = 1;
    const maxRetries = 5;
    console.log(`Fetching page...`);
    try {
        while (true) {
            const response = await _sendRequest(address, chainShortName, currentPage, limit, maxRetries, startBlockHeight, endBlockHeight);

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
    console.log('Total transactions found:', allTransactions.length);
    return [allTransactions, totalPages];
}

async function _sendRequest(
    address: string, 
    chainShortName: string, 
    page: number, 
    limit: number, 
    maxRetries: number,
    startBlockHeight: number, 
    endBlockHeight: number
): Promise<TxListResponse> {
    const apikey = await _getApiKey();

    let retries = 0;
    console.log(`Fetching transactions for address ${address}. Page: ${page}`);
    do {
        const response = await axios.get<TxListResponse>('https://www.oklink.com/api/v5/explorer/address/normal-transaction-list', {
            params: {
                chainShortName,
                address,
                page: page.toString(),
                limit: limit.toString(),
                startBlockHeight: startBlockHeight.toString(),
                endBlockHeight: endBlockHeight.toString()
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

    } while (retries < maxRetries);
}

async function _getBlockStatistics(chainShortName: string): Promise<BlockStatistics | null> {
    const apikey = await _getApiKey();
    const url = `https://www.oklink.com/api/v5/explorer/blockchain/block`;
    
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
            return null;
        }
    } catch (error) {
        console.error(`Error fetching block statistics for ${chainShortName}: `, error);
        return null;
    }
}

async function getTransactionList(address: string, chainShortName: string) {
    try {
        const transactions = await fetchAllTransactions(address, chainShortName);

        const uniqueAddresses = new Set<string>();
        transactions.forEach(tx => {
            uniqueAddresses.add(tx.from);
            uniqueAddresses.add(tx.to);
        });

        const addressArray = Array.from(uniqueAddresses);
        const batchSize = 20;
        const labelsMap = new Map<string, string>();

        for (let i = 0; i < addressArray.length; i += batchSize) {
            const batchAddresses = addressArray.slice(i, i + batchSize);
            const batchLabels = await getLabelsForBatch(batchAddresses, chainShortName);
            batchLabels.forEach((label, addr) => labelsMap.set(addr, label));
        }

        const csvWriter = createObjectCsvWriter({
            path: path.join(__dirname, 'transactions.csv'),
            header: [
                { id: 'from', title: 'from' },
                { id: 'from_tag', title: 'from_tag' },
                { id: 'to', title: 'to' },
                { id: 'to_tag', title: 'to_tag' },
                { id: 'value', title: 'value' },
                { id: 'currency', title: 'currency' },
                { id: 'usd_value', title: 'usd_value' },
                { id: 'hash', title: 'hash' },
                { id: 'timestamp', title: 'timestamp' },
            ]
        });

        const records = transactions.map((tx) => {
            return {
                from: tx.from,
                from_tag: labelsMap.get(tx.from) || '',
                to: tx.to,
                to_tag: labelsMap.get(tx.to) || '',
                value: tx.amount,
                currency: tx.symbol,
                usd_value: '',
                hash: tx.txId,
                timestamp: new Date(parseInt(tx.transactionTime)).toISOString(),
            };
        });

        await csvWriter.writeRecords(records);

        console.log('CSV file successfully written.');
    } catch (error) {
        console.error('Error processing transaction list:', error);
    }
}

async function _getApiKey(): Promise<string> {
    const apikey = process.env.OKLINK_API_KEY;
    if (!apikey) {
        console.error('requestTxList_OkLink. API Key not found');
        process.exit(1);
    }
    return apikey;
}

getTransactionList('TYZseM53iSPB75aN1V5N762GgzAjBp7PcX', 'tron');
