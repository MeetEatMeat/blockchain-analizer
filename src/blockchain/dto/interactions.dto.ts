interface ITransactionBase {
    blockNumber: string;
    timeStamp: string;
    hash: string;
    nonce: string;
    blockHash: string;
    from: string;
    contractAddress: string;
    to: string;
    value: string;
    gas: string;
    gasPrice: string;
    gasUsed: string;
    cumulativeGasUsed: string;
    input: string;
    confirmations: string;
    transactionIndex: string;
}

interface ITokenTransfer extends ITransactionBase {
    tokenName: string;
    tokenSymbol: string;
    tokenDecimal: string;
}

interface ITransaction extends ITransactionBase {
    isError: string;
    txreceipt_status: string;
}

type Interaction = ITokenTransfer | ITransaction;

type Counterparty = {
    address: string;
    type: 'sender' | 'receiver';
    name?: string;
    interactions?: number;
};

type AddressCounterparties = {
    address: string;
    counterparties: Counterparty[];
  };

interface TransferResult {
    senders: string[];
    receivers: string[];
}

export { 
    Counterparty, 
    ITokenTransfer, 
    ITransaction,
    Interaction,
    TransferResult,
    AddressCounterparties
};