import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';
import { createObjectCsvWriter } from 'csv-writer';

interface ITransaction {
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

const inputDirectory = path.join(__dirname, '../inputs/transactions/btc');
const attributionFilePath = path.join(__dirname, '../inputs/attributions_test.csv');
const outputFilePath = path.join(__dirname, '../outputs/merged_report_test.csv');
const exchangeAddressesPath = path.join(__dirname, '../inputs/cex_btc.csv');

const csvWriter = createObjectCsvWriter({
  path: outputFilePath,
  header: [
    { id: 'from_address', title: 'from_address' },
    { id: 'from_address_attribution', title: 'from_address_attribution' },
    { id: 'tx1_txId', title: 'tx1_txId' },
    { id: 'tx1_transactionTime', title: 'tx1_transactionTime' },
    { id: 'tx1_amount', title: 'tx1_amount' },
    { id: 'tx1_currency', title: 'tx1_currency' },
    { id: 'middle_address1', title: 'middle_address1' },
    { id: 'middle_address1_attribution', title: 'middle_address1_attribution' },
    { id: 'tx2_txId', title: 'tx2_txId' },
    { id: 'tx2_transactionTime', title: 'tx2_transactionTime' },
    { id: 'tx2_amount', title: 'tx2_amount' },
    { id: 'tx2_currency', title: 'tx2_currency' },
    { id: 'middle_address2', title: 'middle_address2' },
    { id: 'middle_address2_attribution', title: 'middle_address2_attribution' },
    { id: 'tx3_txId', title: 'tx3_txId' },
    { id: 'tx3_transactionTime', title: 'tx3_transactionTime' },
    { id: 'tx3_amount', title: 'tx3_amount' },
    { id: 'tx3_currency', title: 'tx3_currency' },
    { id: 'to_address', title: 'to_address' },
    { id: 'to_address_attribution', title: 'to_address_attribution' }
  ]
});

function loadAttributions(): Map<string, string> {
  const fileContent = fs.readFileSync(attributionFilePath, 'utf-8');
  const records = parse(fileContent, { columns: true, skip_empty_lines: true });

  const attributionsMap = new Map<string, string>();

  for (const record of records) {
    const address = record['Address'];
    const attribution = record['Attribution'];
    attributionsMap.set(address, attribution);
  }

  return attributionsMap;
}

function getAttributionString(addresses: string[], attributions: Map<string, string>): string {
  return addresses
    .map(addr => attributions.get(addr) || '')
    .filter(attr => attr !== '')
    .join(', ');
}

function findCommonAddress(addresses1: string, addresses2: string): string {
  const set1 = new Set(addresses1.split(','));
  const set2 = new Set(addresses2.split(','));
  const common = [...set1].filter(address => set2.has(address));
  return common.join(', ');
}

function loadExchangeAddresses(): Set<string> {
    const fileContent = fs.readFileSync(exchangeAddressesPath, 'utf-8');
    const records = parse(fileContent, { columns: true, skip_empty_lines: true });
  
    const exchangeAddressSet = new Set<string>();
  
    for (const record of records) {
      const address = record['Address'];
      exchangeAddressSet.add(address);
    }
  
    return exchangeAddressSet;
}
  
const exchangeAddresses = loadExchangeAddresses();
  
function determineDirection(transactions: ITransaction[]): 'forward' | 'backward' {
    let lastTransaction = transactions[transactions.length - 1];
    if (!lastTransaction) {
      lastTransaction = transactions[transactions.length - 2];
    }
    const lastFromAddresses = lastTransaction?.from?.split(',') || [];
    const lastToAddresses = lastTransaction?.to?.split(',') || [];
  
    if (lastFromAddresses.some(addr => exchangeAddresses.has(addr))) {
      return 'backward';
    } else if (lastToAddresses.some(addr => exchangeAddresses.has(addr))) {
      return 'forward';
    }
  
    throw new Error('Direction not determined');
}

function processJsonFilesToCsv(attributions: Map<string, string>) {
    const jsonFiles = fs.readdirSync(inputDirectory).filter(file => file.endsWith('.json'));

    const records = [];

    for (const file of jsonFiles) {
        const filePath = path.join(inputDirectory, file);
        const rawData = fs.readFileSync(filePath, 'utf-8');
        const transactions = JSON.parse(rawData);

        const direction = determineDirection(transactions);

        let record: any;
        if (transactions.length === 3) {
            if (direction === 'backward') {
                record = {
                    from_address: transactions[2]?.from.split(',').join(', ') || '',
                    from_address_attribution: getAttributionString(transactions[2]?.from.split(','), attributions),
                    tx1_txId: transactions[2]?.txId || '',
                    tx1_transactionTime: transactions[2]?.transactionTime || '',
                    tx1_amount: transactions[2]?.amount || '',
                    tx1_currency: transactions[2]?.transactionSymbol || 'BTC',
                    middle_address1: findCommonAddress(transactions[2]?.to, transactions[1]?.from),
                    middle_address1_attribution: getAttributionString(findCommonAddress(transactions[2]?.to, transactions[1]?.from).split(','), attributions),
                    tx2_txId: transactions[1]?.txId || '',
                    tx2_transactionTime: transactions[1]?.transactionTime || '',
                    tx2_amount: transactions[1]?.amount || '',
                    tx2_currency: transactions[1]?.transactionSymbol || 'BTC',
                    middle_address2: findCommonAddress(transactions[1]?.to, transactions[0]?.from),
                    middle_address2_attribution: getAttributionString(findCommonAddress(transactions[1]?.to, transactions[0]?.from).split(','), attributions),
                    tx3_txId: transactions[0]?.txId || '',
                    tx3_transactionTime: transactions[0]?.transactionTime || '',
                    tx3_amount: transactions[0]?.amount || '',
                    tx3_currency: transactions[0]?.transactionSymbol || 'BTC',
                    to_address: transactions[0]?.to.split(',').join(', ') || '',
                    to_address_attribution: getAttributionString(transactions[0]?.to.split(','), attributions)
                };
            } else {
                record = {
                    from_address: transactions[0]?.from.split(',').join(', ') || '',
                    from_address_attribution: getAttributionString(transactions[0]?.from.split(','), attributions),
                    tx1_txId: transactions[0]?.txId || '',
                    tx1_transactionTime: transactions[0]?.transactionTime || '',
                    tx1_amount: transactions[0]?.amount || '',
                    tx1_currency: transactions[0]?.transactionSymbol || 'BTC',
                    middle_address1: findCommonAddress(transactions[0]?.to, transactions[1]?.from),
                    middle_address1_attribution: getAttributionString(findCommonAddress(transactions[0]?.to, transactions[1]?.from).split(','), attributions),
                    tx2_txId: transactions[1]?.txId || '',
                    tx2_transactionTime: transactions[1]?.transactionTime || '',
                    tx2_amount: transactions[1]?.amount || '',
                    tx2_currency: transactions[1]?.transactionSymbol || 'BTC',
                    middle_address2: findCommonAddress(transactions[1]?.to, transactions[2]?.from),
                    middle_address2_attribution: getAttributionString(findCommonAddress(transactions[1]?.to, transactions[2]?.from).split(','), attributions),
                    tx3_txId: transactions[2]?.txId || '',
                    tx3_transactionTime: transactions[2]?.transactionTime || '',
                    tx3_amount: transactions[2]?.amount || '',
                    tx3_currency: transactions[2]?.transactionSymbol || 'BTC',
                    to_address: transactions[2]?.to.split(',').join(', ') || '',
                    to_address_attribution: getAttributionString(transactions[2]?.to.split(','), attributions)
                };
            }
        } else if (transactions.length === 2) {
            if (direction === 'backward') {
                record = {
                    from_address: transactions[1]?.from.split(',').join(', ') || '',
                    from_address_attribution: getAttributionString(transactions[1]?.from.split(','), attributions),
                    tx1_txId: transactions[1]?.txId || '',
                    tx1_transactionTime: transactions[1]?.transactionTime || '',
                    tx1_amount: transactions[1]?.amount || '',
                    tx1_currency: transactions[1]?.transactionSymbol || 'BTC',
                    middle_address1: findCommonAddress(transactions[1]?.to, transactions[0]?.from),
                    middle_address1_attribution: getAttributionString(findCommonAddress(transactions[1]?.to, transactions[0]?.from).split(','), attributions),
                    tx2_txId: transactions[0]?.txId || '',
                    tx2_transactionTime: transactions[0]?.transactionTime || '',
                    tx2_amount: transactions[0]?.amount || '',
                    tx2_currency: transactions[0]?.transactionSymbol || 'BTC',
                    to_address: transactions[0]?.to.split(',').join(', ') || '',
                    to_address_attribution: getAttributionString(transactions[0]?.to.split(','), attributions),
                    middle_address2: '',
                    middle_address2_attribution: '',
                    tx3_txId: '',
                    tx3_transactionTime: '',
                    tx3_amount: '',
                    tx3_currency: ''
                };
            } else {
                record = {
                    from_address: transactions[0]?.from.split(',').join(', ') || '',
                    from_address_attribution: getAttributionString(transactions[0]?.from.split(','), attributions),
                    tx1_txId: transactions[0]?.txId || '',
                    tx1_transactionTime: transactions[0]?.transactionTime || '',
                    tx1_amount: transactions[0]?.amount || '',
                    tx1_currency: transactions[0]?.transactionSymbol || 'BTC',
                    middle_address1: findCommonAddress(transactions[0]?.to, transactions[1]?.from),
                    middle_address1_attribution: getAttributionString(findCommonAddress(transactions[0]?.to, transactions[1]?.from).split(','), attributions),
                    tx2_txId: transactions[1]?.txId || '',
                    tx2_transactionTime: transactions[1]?.transactionTime || '',
                    tx2_amount: transactions[1]?.amount || '',
                    tx2_currency: transactions[1]?.transactionSymbol || 'BTC',
                    to_address: transactions[1]?.to.split(',').join(', ') || '',
                    to_address_attribution: getAttributionString(transactions[1]?.to.split(','), attributions),
                    middle_address2: '',
                    middle_address2_attribution: '',
                    tx3_txId: '',
                    tx3_transactionTime: '',
                    tx3_amount: '',
                    tx3_currency: ''
                };
            }
        }

        records.push(record);
    }

    csvWriter.writeRecords(records).then(() => console.log('CSV created successfully'));
}


const attributions = loadAttributions();
processJsonFilesToCsv(attributions);

