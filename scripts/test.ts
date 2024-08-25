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

async function _getApiKey(): Promise<string> {
    const apikey = process.env.OKLINK_API_KEY;
    if (!apikey) {
        console.error('requestTxList_OkLink. API Key not found');
        process.exit(1);
    }
    return apikey;
}

async function _getAddressInfo(address: string): Promise<IAddressInfo | null> {
    const apikey = await _getApiKey();
    let response;
    let retries = 0;
    const maxRetries = 3;
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

async function _returnData(address: string){
    console.log(await _getAddressInfo(address));
}

console.log(_returnData('0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640'));