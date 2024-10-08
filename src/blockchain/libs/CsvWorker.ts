import { createObjectCsvWriter } from 'csv-writer';
import * as path from 'path';
import * as fs from 'fs';
import { ITransaction, ITokenTransfer, Counterparty} from '../dto/interactions.dto';
import * as csv from 'csv-parser';


const saveTransactionsToCSV = async (transactions: ITransaction[], directory: string, filename: string) => {
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

const saveTokenTransfersToCSV = async (tokenTransfers: ITokenTransfer[], directory: string, filename: string) => {
    const csvWriter = createObjectCsvWriter({
        path: path.join(directory, filename),
        header: [
            { id: 'hash', title: 'Transaction Hash' },
            { id: 'blockNumber', title: 'Block Number' },
            { id: 'timeStamp', title: 'Timestamp' },
            { id: 'nonce', title: 'Nonce' },
            { id: 'blockHash', title: 'Block Hash' },
            { id: 'from', title: 'From' },
            { id: 'contractAddress', title: 'Contract Address' },
            { id: 'to', title: 'To' },
            { id: 'value', title: 'Value' },
            { id: 'tokenName', title: 'Token Name' },
            { id: 'tokenSymbol', title: 'Token Symbol' },
            { id: 'tokenDecimal', title: 'Token Decimal' },
            { id: 'transactionIndex', title: 'Transaction Index' },
            { id: 'gas', title: 'Gas' },
            { id: 'gasPrice', title: 'Gas Price' },
            { id: 'gasUsed', title: 'Gas Used' },
            { id: 'cumulativeGasUsed', title: 'Cumulative Gas Used' },
            { id: 'input', title: 'Input' },
            { id: 'confirmations', title: 'Confirmations' }
        ]
    });

    await csvWriter.writeRecords(tokenTransfers);
    console.log(`Token transfers saved to ${filename}`);
}

const saveCounterpartiesToCSV = async (counterparties: Counterparty[], directory: string, filename: string) => {
    const sendersFileName = `senders_${filename}`;
    const sendersWriter = createObjectCsvWriter({
        path: path.join(directory, sendersFileName),
        header: [
            { id: 'address', title: 'Address' },
            { id: 'name', title: 'Name' },
            { id: 'interactions', title: 'Interactions' },
            { id: 'type', title: 'Type' }
        ]
    });

    await sendersWriter.writeRecords(counterparties);
    console.log(`Counterparties saved to 'receivers_${filename}' and 'senders_${filename}'`);
};

const readTransactionsFromCsv = async (directory: string, filename: string): Promise<ITransaction[]> => {
    const filePath = path.join(directory, filename);

    if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
    }

    const transactions: ITransaction[] = [];

    return new Promise((resolve, reject) => {
        fs.createReadStream(filePath)
            .pipe(csv())
            .on('data', (data) => transactions.push(data as ITransaction))
            .on('end', () => resolve(transactions))
            .on('error', (error) => reject(error));
    });
};

const readTokenTransfersFromCsv = async (directory: string, filename: string): Promise<ITokenTransfer[]> => {
    const filePath = path.join(directory, filename);

    if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
    }

    const tokenTransfers: ITokenTransfer[] = [];

    return new Promise((resolve, reject) => {
        fs.createReadStream(filePath)
            .pipe(csv())
            .on('data', (data) => tokenTransfers.push(data as ITokenTransfer))
            .on('end', () => resolve(tokenTransfers))
            .on('error', (error) => reject(error));
    });
}

const readCounterpartiesFromCsv = async (filePath: string): Promise<Counterparty[]> => {
    if(!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
    }

    const counterparties: Counterparty[] = [];

    return new Promise((resolve, reject) => {
        fs.createReadStream(filePath)
            .pipe(csv())
            .on('data', (data) => counterparties.push(data as Counterparty))
            .on('end', () => resolve(counterparties))
            .on('error', (error) => reject(error));
    });
};

const readAddressesFromCsv = async (filePath: string): Promise<string[]> => {
    if(!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
    }

    const addresses: string[] = [];

    return new Promise((resolve, reject) => {
        fs.createReadStream(filePath)
            .pipe(csv())
            .on('data', (data) => addresses.push(data.Address))
            .on('end', () => resolve(addresses))
            .on('error', (error) => reject(error));
    });
};

export { 
    saveTransactionsToCSV, 
    saveTokenTransfersToCSV, 
    readTokenTransfersFromCsv, 
    readTransactionsFromCsv,
    saveCounterpartiesToCSV,
    readCounterpartiesFromCsv,
    readAddressesFromCsv
};
