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

async function getTxList(address: string, chainShortName: string, currentPage: number, limit: number) {
    const apikey = process.env.OKLINK_API_KEY;
    if (!apikey) {
        console.error('requestTxList_OkLink. API Key not found');
        process.exit(1);
    }

    const response = await axios.get<TxListResponse>('https://www.oklink.com/api/v5/explorer/address/normal-transaction-list', {
        params: {
            chainShortName,
            address,
            page: currentPage.toString(),
            limit: limit.toString(),
        },
        headers: {
            'Ok-Access-Key': apikey,
        },
    });

    console.log('response', response.data.data[0].transactionList);
}

getTxList('TYZseM53iSPB75aN1V5N762GgzAjBp7PcX', 'tron', 1, 100);