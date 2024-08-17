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

function loadAttributions(filePath: string): Map<string, string> {
  const fileContent = fs.readFileSync(filePath, 'utf-8');
  const records = parse(fileContent, { columns: true, skip_empty_lines: true });

  const attributionsMap = new Map<string, string>();

  for (const record of records) {
    const address = record['Address'];
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
        from_address: transactions[0]?.from || '',
        from_address_attribution: attributions.get(transactions[0]?.from) || '',
        tx1_txId: transactions[0]?.txId || '',
        tx1_transactionTime: transactions[0]?.transactionTime || '',
        tx1_amount: transactions[0]?.amount || '',
        tx1_currency: transactions[0]?.transactionSymbol || 'BTC',
        middle_address1: transactions[0]?.to || '',
        middle_address1_attribution: attributions.get(transactions[0]?.to) || '',
        tx2_txId: transactions[1]?.txId || '',
        tx2_transactionTime: transactions[1]?.transactionTime || '',
        tx2_amount: transactions[1]?.amount || '',
        tx2_currency: transactions[1]?.transactionSymbol || 'BTC',
        middle_address2: transactions[1]?.to || '',
        middle_address2_attribution: attributions.get(transactions[1]?.to) || '',
        tx3_txId: transactions[2]?.txId || '',
        tx3_transactionTime: transactions[2]?.transactionTime || '',
        tx3_amount: transactions[2]?.amount || '',
        tx3_currency: transactions[2]?.transactionSymbol || 'BTC',
        to_address: transactions[2]?.to || '',
        to_address_attribution: attributions.get(transactions[2]?.to) || ''
      };
    } else {
      record = {
        from_address: transactions[0]?.from || '',
        from_address_attribution: attributions.get(transactions[0]?.from) || '',
        tx1_txId: transactions[0]?.txId || '',
        tx1_transactionTime: transactions[0]?.transactionTime || '',
        tx1_amount: transactions[0]?.amount || '',
        tx1_currency: transactions[0]?.transactionSymbol || 'BTC',
        middle_address1: transactions[0]?.to || '',
        middle_address1_attribution: attributions.get(transactions[0]?.to) || '',
        tx2_txId: transactions[1]?.txId || '',
        tx2_transactionTime: transactions[1]?.transactionTime || '',
        tx2_amount: transactions[1]?.amount || '',
        tx2_currency: transactions[1]?.transactionSymbol || 'BTC',
        to_address: transactions[1]?.to || '',
        to_address_attribution: attributions.get(transactions[1]?.to) || '',
        middle_address2: '',
        middle_address2_attribution: '',
        tx3_txId: '',
        tx3_transactionTime: '',
        tx3_amount: '',
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
//       "txId": "27b9e213aa7c8a1a8df97e63b6fc34b6b8c300fe269e58da2c414eeb35031846",
//       "methodId": "",
//       "blocktxId": "00000000000000000008beac8f0ebd79998cdb467bcce88af00a862a1cedd82b",
//       "height": "734224",
//       "transactionTime": "1651311296000",
//       "from": "bc1qf6nwtf60v7kg2wcl2438mjqszfsw7ty86y5hs6",
//       "to": "19D1iGzDr7FyAdiy3ZZdxMd6ttHj1kj6WW",
//       "isFromContract": false,
//       "isToContract": false,
//       "amount": "0.00929476",
//       "transactionSymbol": "BTC",
//       "txFee": "0.00000524",
//       "state": "success",
//       "tokenId": "",
//       "tokenContractAddress": "",
//       "challengeStatus": "",
//       "l1OrigintxId": ""
//     },
//     {
//       "txId": "c263539cb3be3f0971eecee4ab6f86bbe4e90be28f5ab9822827aa791828abfd",
//       "methodId": "",
//       "blocktxId": "00000000000000000002c179c5a63104a4e35ea8e3f14dc4f3b495f058565712",
//       "height": "714030",
//       "transactionTime": "1639436698000",
//       "from": "bc1qkx3q0s4xjezknpuf2u6ucw6t380nt4vxuzfxvq,bc1qhunhjneku7pnsrpkme45ychm4rewqjqka7mknf",
//       "to": "bc1qf6nwtf60v7kg2wcl2438mjqszfsw7ty86y5hs6,bc1qkx3q0s4xjezknpuf2u6ucw6t380nt4vxuzfxvq",
//       "isFromContract": false,
//       "isToContract": false,
//       "amount": "0.00426396",
//       "transactionSymbol": "BTC",
//       "txFee": "0.00002853",
//       "state": "success",
//       "tokenId": "",
//       "tokenContractAddress": "",
//       "challengeStatus": "",
//       "l1OrigintxId": ""
//     },
//     {
//       "txId": "75b2c8abb17b79c0729ff0a91ca508cfda2890d5fe0925915345bb13ff1557a7",
//       "methodId": "",
//       "blocktxId": "0000000000000000000b65c31c0be869ffe77cc3dd5d7a6a5a657c843008abf3",
//       "height": "698254",
//       "transactionTime": "1630317031000",
//       "from": "3CQ85TtJgrWNgfdsaD3yXVkD9Ed1oybiK7,3GR57WCCJj7HwiEKvwNTuCh5H8s2tAYg5S,3ENtebTRHoHujKXHEkYmwx2wFhLUbXaJ9P,3GR57WCCJj7HwiEKvwNTuCh5H8s2tAYg5S",
//       "to": "3JHKE64wsnf77Vh4YMQqNMqUBTWhFStQYe,3C9zW68mweWLzj7FXNMVWZPRp4FZK6pYiv,1MnpJ16vuZVrGae71zVufo8gsLbP7Ddjgk,3KWvZo7gsGATN13SvAHcRoGMHPgm86bRVW,bc1qp4zk2c6ecxrmtaykr4mc8mmjrx6j8m2epcnwwj,bc1qymwrsxadp703qdakwt2rx00khese88f78w2xan,37CCzaxmSyfS8xh4ypDmUQWDogoBWp9QDA,15xT6F2ap87Btyor3jQNjSCYA8zdLTdSxh,bc1qqspcwme8fzlrngr32zwp4w7yn3l8jzl2kyyt05,3B2ogSVrwGWiC5hS5hKyGS4ZGWqHZy2gmV,3LLcCgFzvoXQrcMxeK7xLQ1vH8g2nUR4oB,bc1q7sw0q7czrhmuld767u4paw6qgjxty04qltjcpngcnwsej9cafm6s847ehq,bc1q76ttsx6mekd53svg45ztlutwmf3etzcrezlm25,1GGzKLWzjcpYTM3L2oFo9YQ23YQ4X2Di74,bc1qzh2cs8hrs2zwxn8z7z03gup6rk40l4h0c3jue3,33x9hPbvXRtiC2tzETg3Zk5NmdfoNekCqG,3CEFZdcQ3Nic6VN7A1k8XtbfFhMApxYdyz,19TUKVd7HXhTame2Jr9cQmHsbrYq75yLZU,36B7dZVue5dd3XwDYPGGZ3K6kjC2u6zssh,15fHb8MFFT3sZPuTnmgX66wtG5qGaDKPKd,bc1qxvhunx9tfpevmnxcqwwwacmm3pl5pjclzy53rk,337SQRB2gbMRDcgqpaX5PmMyteroNKATMf,35JRr5jfuFRBEycy8kpgJgUmRG2chFKsmq,3CSoKPLaDKWJCLMDZbeyJXsapXM1uLzmcp,bc1qvvc9znl5uf3j24hest9puxhe8mzgexhgcl70e8,3LEA3hgkLyEDFcr613agMS4rnivBzF9CzT,19KMxYYR2nJa6ZNd52L5KeRq3DoEum67R1,3EvafRAvR2SevVkxn1ZTm9RLW4NMywHrEV,1JfjM2GMnYhebgVr8hrd4Un7Nv6EdneTHF,3MRHKFiLnE6cDGxYgRvPmuzM1NcTcBZcEA,336izuoyUcd39zcPjq6m4qkmSFuZUX1Yik,bc1qhunhjneku7pnsrpkme45ychm4rewqjqka7mknf,16WGFva8Pm3mSRr4Zo6YrR2JYkGo9Agmw8",
//       "isFromContract": false,
//       "isToContract": false,
//       "amount": "0.02185",
//       "transactionSymbol": "BTC",
//       "txFee": "0.0001634",
//       "state": "success",
//       "tokenId": "",
//       "tokenContractAddress": "",
//       "challengeStatus": "",
//       "l1OrigintxId": ""
//     }
//   ]
