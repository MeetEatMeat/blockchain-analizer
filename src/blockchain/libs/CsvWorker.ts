import { createObjectCsvWriter } from 'csv-writer';
import * as path from 'path';
import * as fs from 'fs';
import { Transaction } from '../dto/transaction.dto';
import * as csv from 'csv-parser';

const saveTransactionsToCSV = async (transactions: Transaction[], directory: string, filename: string) => {
    const csvWriter = createObjectCsvWriter({
        path: path.join(directory, filename),
        header: [
            { id: 'blockNumber', title: 'Block Number' },
            { id: 'timeStamp', title: 'Timestamp' },
            { id: 'hash', title: 'Transaction Hash' },
            { id: 'nonce', title: 'Nonce' },
            { id: 'blockHash', title: 'Block Hash' },
            { id: 'transactionIndex', title: 'Transaction Index' },
            { id: 'from', title: 'From' },
            { id: 'to', title: 'To' },
            { id: 'value', title: 'Value' },
            { id: 'gas', title: 'Gas' },
            { id: 'gasPrice', title: 'Gas Price' },
            { id: 'isError', title: 'Is Error' },
            { id: 'txreceipt_status', title: 'Transaction Receipt Status' },
            { id: 'input', title: 'Input' },
            { id: 'contractAddress', title: 'Contract Address' },
            { id: 'cumulativeGasUsed', title: 'Cumulative Gas Used' },
            { id: 'gasUsed', title: 'Gas Used' },
            { id: 'confirmations', title: 'Confirmations' }
        ]
    });

    await csvWriter.writeRecords(transactions);
    console.log(`Transactions saved to ${filename}`);
};

const readTransactionsFromCsv = async (directory: string, filename: string): Promise<Transaction[]> => {
    const filePath = path.join(directory, filename);

    if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
    }

    const transactions: Transaction[] = [];

    return new Promise((resolve, reject) => {
        fs.createReadStream(filePath)
            .pipe(csv())
            .on('data', (data) => transactions.push(data as Transaction))
            .on('end', () => resolve(transactions))
            .on('error', (error) => reject(error));
    });
};

export { saveTransactionsToCSV, readTransactionsFromCsv };
