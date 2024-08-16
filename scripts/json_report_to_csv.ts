import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';
import { createObjectCsvWriter } from 'csv-writer';

const inputDirectory = path.join(__dirname, '../inputs/transactions');
const attributionFilePath = path.join(__dirname, '../inputs/attributions.csv');
const outputFilePath = path.join(__dirname, '../outputs/merged_report.csv');

const csvWriter = createObjectCsvWriter({
  path: outputFilePath,
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
  ]
});

function loadAttributions(filePath: string): Map<string, string> {
  const fileContent = fs.readFileSync(filePath, 'utf-8');
  const records = parse(fileContent, { columns: true, skip_empty_lines: true });

  const attributionsMap = new Map<string, string>();

  for (const record of records) {
    const address = record['Address'].toLowerCase();
    const attribution = record['Attribution'];
    attributionsMap.set(address, attribution);
  }

  return attributionsMap;
}

function processJsonFilesToCsv(attributions: Map<string, string>) {
  const jsonFiles = fs.readdirSync(inputDirectory).filter(file => file.endsWith('.json'));

  const records = [];

  for (const file of jsonFiles) {
    const filePath = path.join(inputDirectory, file);
    const rawData = fs.readFileSync(filePath, 'utf-8');
    const transactions = JSON.parse(rawData);

    let record: any;
    if (transactions[2]) {
      record = {
        from_address: transactions[2]?.from || '',
        from_address_attribution: attributions.get(transactions[2]?.from.toLowerCase()) || '',
        tx1_hash: transactions[2]?.hash || '',
        tx1_timestamp: transactions[2]?.timeStamp || '',
        tx1_value: transactions[2]?.value || '',
        tx1_currency: transactions[2]?.tokenSymbol || 'ETH',
        middle_address1: transactions[2]?.to || '',
        middle_address1_attribution: attributions.get(transactions[2]?.to.toLowerCase()) || '',
        tx2_hash: transactions[1]?.hash || '',
        tx2_timestamp: transactions[1]?.timeStamp || '',
        tx2_value: transactions[1]?.value || '',
        tx2_currency: transactions[1]?.tokenSymbol || 'ETH',
        middle_address2: transactions[1]?.to || '',
        middle_address2_attribution: attributions.get(transactions[1]?.to.toLowerCase()) || '',
        tx3_hash: transactions[0]?.hash || '',
        tx3_timestamp: transactions[0]?.timeStamp || '',
        tx3_value: transactions[0]?.value || '',
        tx3_currency: transactions[0]?.tokenSymbol || 'ETH',
        to_address: transactions[0]?.to || '',
        to_address_attribution: attributions.get(transactions[0]?.to.toLowerCase()) || ''
      };
    } else {
      record = {
        from_address: transactions[1]?.from || '',
        from_address_attribution: attributions.get(transactions[1]?.from.toLowerCase()) || '',
        tx1_hash: transactions[1]?.hash || '',
        tx1_timestamp: transactions[1]?.timeStamp || '',
        tx1_value: transactions[1]?.value || '',
        tx1_currency: transactions[1]?.tokenSymbol || 'ETH',
        middle_address1: transactions[1]?.to || '',
        middle_address1_attribution: attributions.get(transactions[1]?.to.toLowerCase()) || '',
        tx2_hash: transactions[0]?.hash || '',
        tx2_timestamp: transactions[0]?.timeStamp || '',
        tx2_value: transactions[0]?.value || '',
        tx2_currency: transactions[0]?.tokenSymbol || 'ETH',
        to_address: transactions[0]?.to || '',
        to_address_attribution: attributions.get(transactions[0]?.to.toLowerCase()) || '',
        middle_address2: '',
        middle_address2_attribution: '',
        tx3_hash: '',
        tx3_timestamp: '',
        tx3_value: '',
        tx3_currency: ''
      };
    }

    records.push(record);
  }
  console.log(records);

  csvWriter.writeRecords(records).then(() => console.log('CSV created successfuly'));
}

const attributions = loadAttributions(attributionFilePath);
processJsonFilesToCsv(attributions);

// The sample of the data that this script handles. It is assumed that transactions are already sorted
// [
//     {
//       "blockNumber": "13629397",
//       "timeStamp": "1637104016",
//       "hash": "0x5a776e9b57a41b67ace22a4fc16626fd669fe4ed9a0860cb6dd1e13832d44907",
//       "nonce": "54",
//       "blockHash": "0x1dcfc6578d89e11fc9f5b4b425e173e796e8fd5eb76fde9ddc80aa1211318ef3",
//       "from": "0x404c37edd43397357d803c8de4c1470e6499158a",
//       "to": "0xf3701f445b6bdafedbca97d1e477357839e4120d",
//       "contractAddress": "0xdac17f958d2ee523a2206206994597c13d831ec7",
//       "value": "175000000",
//       "tokenName": "Tether USD",
//       "tokenSymbol": "USDT",
//       "tokenDecimal": "6",
//       "transactionIndex": "47",
//       "gas": "94813",
//       "gasPrice": "121400539702",
//       "gasUsed": "63209",
//       "cumulativeGasUsed": "3520053",
//       "input": "0xa9059cbb000000000000000000000000f3701f445b6bdafedbca97d1e477357839e4120d000000000000000000000000000000000000000000000000000000000a6e49c0",
//       "confirmations": "6883518"
//     },
//     {
//       "blockNumber": "13037919",
//       "timeStamp": "1629139447",
//       "hash": "0x9f4f7eddf960d2302ac12f90c6f4619da3fabc6de006cfa3aa55dab0ec9107ed",
//       "nonce": "232",
//       "blockHash": "0xd19cebe99ea4f7a93d11577fd2ffb5b94b111b59c9810ce042d73f01fce6cea6",
//       "from": "0xf57f33ecee8f8072ada9a3028af18be1f9ba4571",
//       "contractAddress": "0xdac17f958d2ee523a2206206994597c13d831ec7",
//       "to": "0x404c37edd43397357d803c8de4c1470e6499158a",
//       "value": "606435542",
//       "tokenName": "Tether USD",
//       "tokenSymbol": "USDT",
//       "tokenDecimal": "6",
//       "transactionIndex": "142",
//       "gas": "70000",
//       "gasPrice": "44394000000",
//       "gasUsed": "46109",
//       "cumulativeGasUsed": "13558580",
//       "input": "deprecated",
//       "confirmations": "7474999"
//     },
//     {
//       "blockNumber": "12457836",
//       "timeStamp": "1621333705",
//       "hash": "0xc9e70be96b1dac765616f27227314439de1ea34a0bdd98431e24c0a146258445",
//       "nonce": "4311",
//       "blockHash": "0x7f912c87198ab00c9dc6cc5e11371cf1180fc8602e1e905d34d6d0160908c8d7",
//       "from": "0x6254b927ecc25ddd233aaecd5296d746b1c006b4",
//       "contractAddress": "0xdac17f958d2ee523a2206206994597c13d831ec7",
//       "to": "0xf57f33ecee8f8072ada9a3028af18be1f9ba4571",
//       "value": "400000000",
//       "tokenName": "Tether USD",
//       "tokenSymbol": "USDT",
//       "tokenDecimal": "6",
//       "transactionIndex": "108",
//       "gas": "202500",
//       "gasPrice": "74250000000",
//       "gasUsed": "46097",
//       "cumulativeGasUsed": "4064076",
//       "input": "deprecated",
//       "confirmations": "8055084"
//     }
//   ]
