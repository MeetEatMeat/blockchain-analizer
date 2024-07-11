import { Transaction } from '../dto/transaction.dto';

export default async function checkAffiliates(transactions: Transaction[], range: number): Promise<string> {
    console.log('Analyzing affiliated addresses...\n');
    const fromAddresses: { [key: string]: number } = {};

    transactions.forEach(tx => {
        fromAddresses[tx.from] = (fromAddresses[tx.from] || 0) + 1;
    });

    const sortedFromAddresses = Object.entries(fromAddresses).sort((a, b) => b[1] - a[1]).slice(0, range);

    let result = 'Most frequent From Addresses:\n';
    sortedFromAddresses.forEach(([address, count]) => {
        result += `${address}: ${count}\n`;
    });

    return result;
}
