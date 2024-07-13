import axios from 'axios';
import { Transaction } from '../dto/transaction.dto';
import { TokenTransfer } from '../dto/token-transfer.dto';

class BlockchainWorker {
    private apiKey: string;

    constructor(apiKey: string) {
        this.apiKey = apiKey;
    }

    getNetwork(): string {
        return 'https://api.etherscan.io/api';
    }

    async getLatestBlock(): Promise<number> {
        console.log('Fetching latest block...\n');
        try {
            const response = await axios.get(this.getNetwork(), {
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

    async getTransactions(address: string, startblock: number, endblock: number, page: number, offset: number, sort: string): Promise<Transaction[]> {
        try {
            const response = await axios.get(this.getNetwork(), {
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

    async fetchAllTransactions(address: string, startblock: number, endblock: number, page: number, offset: number, sort: string): Promise<Transaction[]> {
        let transactions: Transaction[] = [];
        let currentStartBlock = startblock;
        let currentEndBlock = endblock;
        let range = 0;

        console.log("Fetching all transactions...\n");
        while (currentStartBlock < endblock) {
            const txs = await this.getTransactions(address, currentStartBlock, currentEndBlock, page, offset, sort);

            if (txs.length < 10000) {
                transactions = transactions.concat(txs);
                console.log(`Fetched ${txs.length} transactions from blocks ${currentStartBlock} to ${currentEndBlock} Block range: ${range} Total transactions: ${transactions.length}`);
                if (currentEndBlock === endblock) {
                    break;
                }
                currentStartBlock = currentEndBlock + 1;
                currentEndBlock = currentStartBlock + range > endblock ? endblock : currentStartBlock + range;
                if (txs.length < 3000) {
                    console.log("\n======================= Increasing range =========================\n");
                    range = range * 2;
                    currentEndBlock = currentStartBlock + range > endblock ? endblock : currentStartBlock + range;
                }
            } else {
                console.log("\n======================= Decreasing range =========================\n");
                currentEndBlock = currentStartBlock + Math.floor((currentEndBlock - currentStartBlock) / 2);
                range = currentEndBlock - currentStartBlock;
            }
        }

        return transactions;
    }

    async getTokenTransfers(contractaddress: string, address: string, startblock: number, endblock: number, page: number, offset: number, sort: string): Promise<TokenTransfer[]> {
        try {
            let response;
            if(contractaddress && address){
                response = await axios.get(this.getNetwork(), {
                    params: {
                        module: 'account',
                        action: 'tokentx',
                        contractaddress: contractaddress,
                        address: address,
                        startblock,
                        endblock,
                        page,
                        offset,
                        sort,
                        apikey: this.apiKey
                    }
                });
            } else if (address){
                response = await axios.get(this.getNetwork(), {
                    params: {
                        module: 'account',
                        action: 'tokentx',
                        address: address,
                        startblock,
                        endblock,
                        page,
                        offset,
                        sort,
                        apikey: this.apiKey
                    }
                });
            } else {
                response = await axios.get(this.getNetwork(), {
                    params: {
                        module: 'account',
                        action: 'tokentx',
                        contractaddress: contractaddress,
                        startblock,
                        endblock,
                        page,
                        offset,
                        sort,
                        apikey: this.apiKey
                    }
                });
            }

            const data = response.data;
            if (data.status === '1') {
                return data.result.map((item: any) => this.mapToTokenTransfer(item));
            } else {
                console.error('Error fetching token transfers 1:', data);
                return [];
            }
        } catch (error) {
            console.error('Error fetching token transfers 2:', error);
            return [];
        }
    }

    async fetchAllTokenTransfers(contractaddress: string, address: string, startblock: number, endblock: number, page: number, offset: number, sort: string): Promise<TokenTransfer[]> {
        let tokenTransfers: TokenTransfer[] = [];
        let currentStartBlock = startblock;
        let currentEndBlock = endblock;
        let range = 0;
        console.log("Start block: ", startblock);
        console.log("End block: ", endblock);

        while (currentStartBlock < endblock) {
            const txs = await this.getTokenTransfers(contractaddress, address, currentStartBlock, currentEndBlock, page, offset, sort);
            if (txs.length < 10000) {
                tokenTransfers = tokenTransfers.concat(txs);
                console.log("Fetched transactions: ", txs);
                console.log(`Fetched ${txs.length} transactions from blocks ${currentStartBlock} to ${currentEndBlock} Block range: ${range} Total transactions: ${tokenTransfers.length}`);
                if (currentEndBlock === endblock) {
                    break;
                }
                currentStartBlock = currentEndBlock + 1;
                currentEndBlock = currentStartBlock + range > endblock ? endblock : currentStartBlock + range;
                if (txs.length < 3000) {
                    console.log("\n======================= Increasing range =========================\n");
                    range = range * 2;
                    currentEndBlock = currentStartBlock + range > endblock ? endblock : currentStartBlock + range;
                }
            } else {
                console.log("\n======================= Decreasing range =========================\n");
                currentEndBlock = currentStartBlock + Math.floor((currentEndBlock - currentStartBlock) / 2);
                range = currentEndBlock - currentStartBlock;
            }
        }

        return tokenTransfers;
    }

    private mapToTokenTransfer(item: any): TokenTransfer {
        return {
            hash: item.hash,
            blockNumber: item.blockNumber,
            timeStamp: item.timeStamp,
            nonce: item.nonce,
            blockHash: item.blockHash,
            from: item.from,
            contractAddress: item.contractAddress,
            to: item.to,
            value: item.value,
            tokenName: item.tokenName,
            tokenSymbol: item.tokenSymbol,
            tokenDecimal: item.tokenDecimal,
            transactionIndex: item.transactionIndex,
            gas: item.gas,
            gasPrice: item.gasPrice,
            gasUsed: item.gasUsed,
            cumulativeGasUsed: item.cumulativeGasUsed,
            input: item.input,
            confirmations: item.confirmations,
        };
    }
}

export { BlockchainWorker, Transaction, TokenTransfer };
