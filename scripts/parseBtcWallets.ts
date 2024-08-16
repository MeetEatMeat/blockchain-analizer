import axios from 'axios';
import * as dotenv from 'dotenv';
import { readAddressesFromCsv } from '../src/blockchain/libs/CsvWorker';
import { createObjectCsvWriter } from 'csv-writer';
import * as path from 'path';
import * as fs from 'fs';
dotenv.config();

interface UTXO {
    txid: string;
    height: string;
    blockTime: string;
    address: string;
    unspentAmount: string;
    index: string;
}

interface UTXOResponse {
    code: string;
    msg: string;
    data: [
        {
            page: string;
            limit: string;
            totalPage: string;
            utxoList: UTXO[];
        }
    ];
}

interface IODetails {
    outputHash: string;
    isContract: boolean;
    amount: string;
}

interface TxDetails {
    chainFullName: string;
    chainShortName: string;
    txid: string;
    height: string;
    transactionTime: string;
    amount: string;
    transactionSymbol: string;
    txfee: string;
    index: string;
    confirm: string;
    inputDetails: IODetails[];
    outputDetails: IODetails[];
    state: string;
    gasLimit: string;
    gasUsed: string;
    gasPrice: string;
    totalTransactionSize: string;
    virtualSize: string;
    weight: string;
    nonce: string;
    transactionType: string;
    methodId: string;
    errorLog: string;
    inputData: string;
    isAaTransaction: boolean;
    tokenTransferDetails: any[];
    contractDetails: any[];
}

interface TxDetailsResponse {
    code: string;
    msg: string;
    data: TxDetails[];
}

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

interface AddressTxResponse {
    code: string;
    msg: string;
    data: TransactionList[];
}

interface UTXOAnkr {
    txid: string;
    vout: number;
    value: string;
    height: number;
    confirmations: number;
    coinbase: boolean;
}

type UTXOAnkrResponse = UTXOAnkr[];

interface Vin {
    sequence: number;
    n: number;
    isAddress: boolean;
    coinbase: string;
}

interface Vout {
    value: string;
    n: number;
    hex: string;
    addresses: string[];
    isAddress: boolean;
}

interface TxDetailAnkr {
    txid: string;
    version: number;
    vin: Vin[];
    vout: Vout[];
    blockHash: string;
    blockHeight: number;
    confirmations: number;
    blockTime: number;
    size: number;
    vsize: number;
    value: string;
    valueIn: string;
    fees: string;
    hex: string;
}

interface IAddrInfoAnkrResponse {
    page: number;
    totalPages: number;
    itemsOnPage: number;
    address: string;
    balance: string;
    totalReceived: string;
    totalSent: string;
    unconfirmedBalance: string;
    unconfirmedTxs: number;
    txs: number;
    txids: string[];
}


const address_list = path.join(__dirname, '../inputs/addresses_with1000_txs.csv');
const target_list = path.join(__dirname, '../inputs/bitkub_btc.csv');
const reports_directory = path.join(__dirname, '../outputs/btc_reports');
const mid_reports_directory = path.join(reports_directory, './mid_reports');
const final_report_path = path.join(reports_directory, 'bad_btc_txs_trace.json');
const MAX_DEPTH = 2;

async function parseTransactions(address: string) {
    _checkDirectories();

    const requestAddressesList = await _getAddressList(address_list);
    const requestAddressesSet = new Set(requestAddressesList);
    const targetsSet = new Set(await _getAddressList(target_list));

    const transactionCache = new Map<string, Set<string>>();
    const results: { path: any[], transactions: any[] }[] = [];
    const visitedForwardAddresses = new Set<string>();
    const visitedBackwardAddresses = new Set<string>();
    const txPath: any[] = Array(MAX_DEPTH + 1).fill(null);

    let totalTransactions = 0;
    let position = '';

    for (let i = 0; i < 10; i++) {
        position = `Current position: ${i + 1}/${requestAddressesList.length}`;
        await processAddress(position, requestAddressesList[i], 0, 'start', null, 0);
    }

    async function processAddress(
        position: string,
        address: string,
        depth: number,
        direction: 'forward' | 'backward' | 'start',
        tokenSymbol: string | null,
        transactionTime: number
    ) {
        const addressTxList = await _getTxListOkLink(address);
        if (!addressTxList) {
            console.log("Bad address: ", address);
            return;
        }

        if (addressTxList.length > 0) {
            console.log(`Tx list of ${address} length: ${addressTxList.length}\n`);
            // console.log("Tx list: ", addressTxList);
            addressTxList.forEach((list) => {
                console.log("Total pages: ", list.totalPage);
                console.log("Transactions count: ", list.transactionLists.length);
                // console.log("Transactions: ", list.transactionLists[0]);
            });
        }
    }
}

function _checkDirectories(){
    try{    
        if (!fs.existsSync(mid_reports_directory)) {
            fs.mkdirSync(mid_reports_directory, { recursive: true });
        }
    } catch(e){
        console.log("_checkDirectories error: ", e);
    }
}

async function _getUTXOAnkr(address: string): Promise<UTXOAnkr[]> {
    const url = `https://rpc.ankr.com/http/btc_blockbook/api/v2/utxo/${address}`;
    try {
        const response = await axios.get<UTXOAnkrResponse>(url, {
            params: {
                confirmed: true
            }
        });
        if(response.status === 200){
            console.log("UTXO detailes retrieved");
            return response.data;
        } else {
            console.log("_getUTXOAnkr error");
            return null;
        }
    } catch (error) {
        console.error(`_getUTXOAnkr Request failed: ${error}`);
        return null;
    } 
}

async function _getTxInfoAnkr(tx: string): Promise<Vout[]> {
    const url = `https://rpc.ankr.com/http/btc_blockbook/api/v2/tx/${tx}`;
    try {
        const response = await axios.get<TxDetailAnkr>(url);
        if(response.status === 200){
            console.log("\nTx detailes retrieved");
            return response.data.vout;
        } else {
            console.log("_getTxInfoAnkr error");
            return null;
        }
    } catch (error) {
        console.error(`_getTxInfoAnkr Request failed: ${error}`);
        return null;
    } 
}

async function _getAddressTxsAnkr(address: string): Promise<string[]>{
    const url = `https://rpc.ankr.com/http/btc_blockbook/api/v2/address/${address}`;
    try {
        const response = await axios.get<IAddrInfoAnkrResponse>(url);
        if(response.status === 200){
            console.log("Address detailes retrieved");
            return response.data.txids;
        } else {
            console.log("_getAddresInfoAnkr error");
            return null;
        }
    } catch (error) {
        console.error(`_getAddresInfoAnkr Request failed: ${error}`);
        return null;
    } 
}

async function _getAddressList(file: string): Promise<string[]> {
    let requestAddresses: string[] = [];
    try {
        requestAddresses = await readAddressesFromCsv(file);
        console.log("Addresses for requests found: ", requestAddresses.length);
        return requestAddresses;
    } catch (e) {
        console.error('Error reading request addresses from CSV: ', e);
        process.exit(1);
    }
}

async function _getTxListOkLink(address: string): Promise<TransactionList[]> {
    const apikey = process.env.OKLINK_API_KEY;
    if (!apikey) {
        console.error('requestTxList_OkLink. API Key not found');
        process.exit(1);
    }

    try {
        const response = await axios.get<AddressTxResponse>('https://www.oklink.com/api/v5/explorer/address/transaction-list', {
            params: {
                chainShortName: 'btc',
                address: address,
                limit: 100,
                page: 1
            },
            headers: {
                'Ok-Access-Key': apikey
            }
        });
        console.log("Response code: ", response.data.code);
        return response.data.data;
    } catch (error) {
        console.error(`Error fetching transactions for ${address}: `, error);
        return null;
    }
}

async function _getTransactionData(tx: string): Promise<TxDetails> {
    const apikey = _getApiKey();

    const url = 'https://www.oklink.com/api/v5/explorer/transaction/transaction-fills';
    try {
        const response = await axios.get<TxDetailsResponse>(url, {
            params: {
                chainShortName: 'btc',
                txid: tx
            },
            headers: {
                'Ok-Access-Key': apikey
            }
        });
        if (response.data.code === "0") {
            console.log("Tx detailes retrieved");
            return response.data.data[0];
        } else {
            console.error(`Error: ${response.data.msg}`);
            return null;
        }
    } catch (error) {
        console.error(`Request failed: ${error}`);
        return null;
    } 
}

async function _getAddressUTXO (address: string): Promise<UTXO[]> {
    const apikey = _getApiKey();

    const url = 'https://www.oklink.com/api/v5/explorer/address/utxo';
    try {
        const response = await axios.get<UTXOResponse>(url, {
            params: {
                chainShortName: 'btc',
                address: address,
                limit: 100
            },
            headers: {
                'Ok-Access-Key': apikey
            }
        });
        if (response.data.code === "0") {
            console.log("UTXO data retrieved");
            return response.data.data[0].utxoList;
        } else {
            console.error(`Error: ${response.data.msg}`);
            return [];
        }
    } catch (error) {
        console.error(`Request failed: ${error}`);
        return [];
    }   
}

async function _getAddressTransactions(address: string): Promise<Transaction[]> {
    const apikey = _getApiKey();

    const url = 'https://www.oklink.com/api/v5/explorer/address/transaction-list';
    try {
        const response = await axios.get<AddressTxResponse>(url, {
            params: {
                chainShortName: 'btc',
                address: address,
                limit: 100
            },
            headers: {
                'Ok-Access-Key': apikey
            }
        });
        if (response.data.code === "0") {
            console.log("Transactions data retrieved");
            return response.data.data[0].transactionLists;
        } else {
            console.error(`Error: ${response.data.msg}`);
            return [];
        }
    } catch (e) {
        console.error(`Request failed: ${e}`);
        return [];
    }
}

function _getApiKey(): string {
    const apikey = process.env.OKLINK_API_KEY;
    if (!apikey) {
        console.error('getUTXO. API Key not found');
        process.exit(1);
    }
    return apikey;
}

///api/v5/explorer/transaction/transaction-fills

parseTransactions('bc1ql49ydapnjafl5t2cp9zqpjwe6pdgmxy98859v2');
