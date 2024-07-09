import axios from 'axios';
import { Transaction } from '../dto/transaction.dto';

class BlockchainWorker {
    private apiKey: string;

    constructor(apiKey: string) {
        this.apiKey = apiKey;
    }

    async getLatestBlock(network: string): Promise<number> {
        console.log('Fetching latest block...\n');
        try {
            const response = await axios.get(network, {
                params: {
                    module: 'proxy',
                    action: 'eth_blockNumber',
                    apikey: this.apiKey
                }
            });

            const data = response.data;
            if (data.result) {
                return parseInt(data.result, 16);
            } else {
                console.error('Error fetching latest block:', data.message);
                return 99999999;
            }
        } catch (error) {
            console.error('Error fetching latest block:', error);
            return 99999999;
        }
    }

    async getTransactions(address: string, network: string, startblock: number, endblock: number, page: number, offset: number, sort: string): Promise<Transaction[]> {
        try {
            const response = await axios.get(network, {
                params: {
                    module: 'account',
                    action: 'txlist',
                    address,
                    startblock,
                    endblock,
                    page,
                    offset,
                    sort,
                    apikey: this.apiKey
                }
            });
            // console.log("getTransactions. response length: ", response.data.result);
            const data = response.data;
            if (data.status === '1') {
                return data.result;
            } else {
                console.error('Error fetching transactions:', data.message);
                return [];
            }
        } catch (error) {
            console.error('Error fetching transactions:', error);
            return [];
        }
    }

    async fetchAllTransactions(address: string, network: string, startblock: number, endblock: number, page: number, offset: number, sort: string): Promise<Transaction[]> {
        let transactions: Transaction[] = [];
        let currentStartBlock = startblock;
        let currentEndBlock = endblock;
        let range = 0;

        console.log("Fetching all transactions...\n");
        while (currentStartBlock < endblock) {
            const txs = await this.getTransactions(address, network, currentStartBlock, currentEndBlock, page, offset, sort);

            if (txs.length < 10000) {
                transactions = transactions.concat(txs);
                console.log(`Fetched ${txs.length} txs from block ${currentStartBlock} to ${currentEndBlock} | Range: ${range} | Total txs: ${transactions.length}`);
                if (currentEndBlock === endblock) {
                    break;
                }
                currentStartBlock = currentEndBlock + 1;
                currentEndBlock = currentStartBlock + range > endblock ? endblock : currentStartBlock + range;
                if (txs.length < 3000 && transactions.length) {
                    // console.log(`\nReceived ${txs.length} transactions ==> Increasing range\n`);
                    range = range * 2;
                    currentEndBlock = currentStartBlock + range > endblock ? endblock : currentStartBlock + range;
                }
            } else {
                // console.log(`\nReceived ${txs.length} transactions ==> Decreasing range\n`);
                currentEndBlock = currentStartBlock + Math.floor((currentEndBlock - currentStartBlock) / 2);
                range = currentEndBlock - currentStartBlock;
            }
        }

        return transactions;
    }
}

export { BlockchainWorker, Transaction };
