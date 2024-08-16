import axios from 'axios';
import * as dotenv from 'dotenv';
import { readAddressesFromCsv } from '../src/blockchain/libs/CsvWorker';
import { createObjectCsvWriter } from 'csv-writer';
import * as path from 'path';
import * as fs from 'fs';
dotenv.config();

///////////////////////
// Block details
///////////////////////

interface IBlockData {
    chainFullName: string;
    chainShortName: string;
    hash: string;
    height: string;
    validator: string;
    blockTime: string;
    txnCount: string;
    amount: string;
    blockSize: string;
    mineReward: string;
    totalFee: string;
    feeSymbol: string;
    ommerBlock: string;
    merkleRootHash: string;
    gasUsed: string;
    gasLimit: string;
    gasAvgPrice: string;
    state: string;
    burnt: string;
    netWork: string;
    txnInternal: string;
    miner: string;
    difficuity: string;
    nonce: string;
    tips: string;
    confirm: string;
    baseFeePerGas: string;
}

interface IApiBlockDataResponse {
    code: string;
    msg: string;
    data: IBlockData[];
}

///////////////////////
// Blockchain details
///////////////////////

interface IBlockchainData {
    chainFullName: string;
    chainShortName: string;
    symbol: string;
    rank: string;
    mineable: boolean;
    algorithm: string;
    consensus: string;
    diffEstimation: string;
    currentDiff: string;
    diffAdjustTime: string;
    circulatingSupply: string;
    totalSupply: string;
    tps: string;
    lastHeight: string;
    lastBlockTime: string;
    issueDate: string;
}

interface IApiBlockchainDataResponse {
    code: string;
    msg: string;
    data: IBlockchainData[];
}


async function main() {
    const apikey = await _getApiKey();
    const height = Number(await _getHeight());
    let totalTxs = 0;

    const url = 'https://www.oklink.com/api/v5/explorer/block/block-fills';

    try {
        for(let i = height; i > (height - 100); i--){
            const response = await axios.get<IApiBlockDataResponse>(url, {
                params: {
                    chainShortName: 'eth',
                    height: i
                },
                headers: {
                    'Ok-Access-Key': apikey
                }
            });
            if (response.data.code === '0') {
                const txsNumber = response.data.data[0].txnCount;
                totalTxs += Number(txsNumber);
                console.log(`Block number: ${i} | Amount of transactions ${txsNumber}`);
            } else {
                console.error(`Error: ${response.data.msg}`);
                process.exit(1);
            }
        }
        console.log("Average amount of transactions in the last 100 blocks: ", totalTxs/100);
    } catch (error) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
}

async function _getHeight(): Promise<string> {
    const apikey = await _getApiKey();
    const url = 'https://www.oklink.com/api/v5/explorer/blockchain/info';

    try {
        const response = await axios.get<IApiBlockchainDataResponse>(url, {
            params: {
                chainShortName: 'eth'
            },
            headers: {
                'Ok-Access-Key': apikey
            }
        });
        if (response.data.code === '0') {
            return response.data.data[0].lastHeight;
        } else {
            console.error(`Error: ${response.data.msg}`);
            process.exit(1);
        }
    } catch (error) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
}

async function _getApiKey(): Promise<string> {
    const apikey = process.env.OKLINK_API_KEY;
    if (!apikey) {
        console.error('API Key not found');
        process.exit(1);
    }
    return apikey;
}

main();
